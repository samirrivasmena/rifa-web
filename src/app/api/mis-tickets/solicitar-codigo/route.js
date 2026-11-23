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
    const codigo = String(crypto.randomInt(100000, 1000000));
    const codigoHash = crypto
      .createHmac("sha256", process.env.MIS_TICKETS_OTP_SECRET)
      .update(`${email}:${codigo}`)
      .digest("hex");
    const { data: resultado, error: insertarError } = await supabaseAdmin.rpc("crear_mis_tickets_otp_seguro", { p_email: email, p_hash: codigoHash });
    if (insertarError || !resultado) return responder({ ok: false, error: "No se pudo generar el código" }, 500);
    if (!resultado.ok) {
      const retryAfter = resultado.retry_after || 60;
      return responder({ ok: false, error: `Espera ${retryAfter} segundos antes de solicitar otro código.`, retryAfter }, 429, { "Retry-After": String(retryAfter) });
    }
    const nuevoOtp = { id: resultado.id };
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
