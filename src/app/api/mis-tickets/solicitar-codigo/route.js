import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMisTicketsCodeEmail } from "@/lib/sendMisTicketsCodeEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DURACION_MINUTOS = 10;
const REENVIO_SEGUNDOS = 60;
const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function responder(body, status = 200, headers = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...HEADERS, ...headers },
  });
}

function limpiarEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function obtenerIp(req) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    String(req.headers.get("x-real-ip") || "").trim();
}

async function verificarTurnstile(token, ip) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (ip) body.set("remoteip", ip);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
        cache: "no-store",
      }
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data?.success === true;
  } catch (error) {
    console.error("Error verificando Turnstile en Mis Tickets:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return responder({ ok: false, error: "Solicitud inválida" }, 400);
    }

    const email = limpiarEmail(body.email);
    const captchaToken = String(body.captchaToken || "").trim();
    if (!email) return responder({ ok: false, error: "Email requerido" }, 400);
    if (!emailValido(email)) {
      return responder({ ok: false, error: "Ingresa un correo electrónico válido" }, 400);
    }
    if (!process.env.MIS_TICKETS_OTP_SECRET ||
        !process.env.RESEND_API_KEY ||
        !process.env.EMAIL_FROM ||
        !process.env.TURNSTILE_SECRET_KEY) {
      console.error("Configuración incompleta para OTP Mis Tickets");
      return responder({ ok: false, error: "El sistema de verificación no está configurado" }, 500);
    }
    if (!captchaToken) {
      return responder({ ok: false, error: "Completa la verificación de seguridad." }, 400);
    }
    if (!(await verificarTurnstile(captchaToken, obtenerIp(req)))) {
      return responder({ ok: false, error: "La verificación de seguridad expiró o no es válida. Inténtalo nuevamente." }, 400);
    }

    // Se envía OTP a cualquier correo válido, tenga o no participaciones.
    // La existencia de compras se consulta únicamente DESPUÉS de verificar el OTP.
    const { data: ultimoOtp, error: ultimoOtpError } = await supabaseAdmin
      .from("mis_tickets_otps")
      .select("id, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimoOtpError) {
      console.error("Error consultando último OTP:", ultimoOtpError);
      return responder({ ok: false, error: "No se pudo generar el código" }, 500);
    }
    if (ultimoOtp?.created_at) {
      const diferencia = Math.floor((Date.now() - new Date(ultimoOtp.created_at).getTime()) / 1000);
      if (Number.isFinite(diferencia) && diferencia >= -5 && diferencia < REENVIO_SEGUNDOS) {
        const retryAfter = Math.max(1, REENVIO_SEGUNDOS - Math.max(0, diferencia));
        return responder({
          ok: false,
          error: `Espera ${retryAfter} segundos antes de solicitar otro código.`,
          retryAfter,
        }, 429, { "Retry-After": String(retryAfter) });
      }
    }

    const codigo = String(crypto.randomInt(100000, 1000000));
    const codigoHash = crypto
      .createHmac("sha256", process.env.MIS_TICKETS_OTP_SECRET)
      .update(`${email}:${codigo}`)
      .digest("hex");
    const expiresAt = new Date(Date.now() + DURACION_MINUTOS * 60 * 1000);

    const { error: invalidarError } = await supabaseAdmin
      .from("mis_tickets_otps")
      .update({ usado: true })
      .eq("email", email)
      .eq("usado", false);
    if (invalidarError) {
      console.error("Error invalidando OTP anteriores:", invalidarError);
      return responder({ ok: false, error: "No se pudo generar el código" }, 500);
    }

    const { data: nuevoOtp, error: insertarError } = await supabaseAdmin
      .from("mis_tickets_otps")
      .insert({
        email,
        codigo_hash: codigoHash,
        expires_at: expiresAt.toISOString(),
        intentos: 0,
        usado: false,
      })
      .select("id")
      .single();
    if (insertarError) {
      console.error("Error guardando OTP:", insertarError);
      return responder({ ok: false, error: "No se pudo generar el código" }, 500);
    }

    try {
      await sendMisTicketsCodeEmail({ to: email, codigo });
    } catch (error) {
      console.error("Error enviando OTP por email:", error);
      if (nuevoOtp?.id) {
        const { error: invalidarNuevoError } = await supabaseAdmin
          .from("mis_tickets_otps")
          .update({ usado: true })
          .eq("id", nuevoOtp.id);
        if (invalidarNuevoError) console.error("Error invalidando OTP fallido:", invalidarNuevoError);
      }
      return responder({ ok: false, error: "No se pudo enviar el código de verificación. Inténtalo nuevamente." }, 500);
    }

    return responder({
      ok: true,
      mensaje: "Si el correo puede recibir mensajes, llegará un código de 6 dígitos para consultar tus participaciones.",
      expiresIn: DURACION_MINUTOS * 60,
      retryAfter: REENVIO_SEGUNDOS,
    });
  } catch (error) {
    console.error("Error general solicitar código Mis Tickets:", error);
    return responder({ ok: false, error: "Error interno al solicitar el código" }, 500);
  }
}
