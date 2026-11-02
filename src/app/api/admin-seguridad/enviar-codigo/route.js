import { NextResponse } from "next/server";
import crypto from "crypto";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendAdminSecurityCodeEmail } from "@/lib/sendAdminSecurityCodeEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCIONES_PERMITIDAS = new Set([
  "cambiar_password",
  "cambiar_email",
]);

const OTP_EXPIRACION_MINUTOS = 10;
const COOLDOWN_SEGUNDOS = 60;

function crearCodigo() {
  return crypto
    .randomInt(0, 1000000)
    .toString()
    .padStart(6, "0");
}

function obtenerPepper() {
  const pepper =
    process.env.ADMIN_SECURITY_PEPPER;

  if (!pepper) {
    throw new Error(
      "Falta ADMIN_SECURITY_PEPPER"
    );
  }

  return pepper;
}

function crearHash({
  adminUserId,
  accion,
  codigo,
}) {
  const pepper = obtenerPepper();

  return crypto
    .createHmac("sha256", pepper)
    .update(
      `${adminUserId}:${accion}:${codigo}`
    )
    .digest("hex");
}

export async function POST(req) {
  try {
    /* =========================================================
       1. VERIFICAR ADMIN + MFA AAL2
    ========================================================= */

    const admin = await requireAdmin(req);

    if (!admin?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            admin?.error ||
            "Acceso denegado",
          requiresMfa:
            Boolean(admin?.requiresMfa),
        },
        {
          status: admin?.status || 403,
        }
      );
    }

    const adminUserId =
      String(admin?.user?.id || "").trim();

    const adminEmail =
      String(admin?.user?.email || "")
        .trim()
        .toLowerCase();

    if (!adminUserId || !adminEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo identificar la cuenta administrativa.",
        },
        {
          status: 403,
        }
      );
    }

    /* =========================================================
       2. VALIDAR ACCIÓN
    ========================================================= */

    const body =
      await req.json().catch(() => ({}));

    const accion =
      String(body?.accion || "").trim();

    if (!ACCIONES_PERMITIDAS.has(accion)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Acción de seguridad no válida.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================================
       3. COOLDOWN DE ENVÍO
    ========================================================= */

    const limiteCooldown = new Date(
      Date.now() -
        COOLDOWN_SEGUNDOS * 1000
    ).toISOString();

    const {
      data: ultimoOtp,
      error: ultimoOtpError,
    } = await supabaseAdmin
      .from("admin_security_otps")
      .select("id, created_at")
      .eq(
        "admin_user_id",
        adminUserId
      )
      .eq("accion", accion)
      .gte(
        "created_at",
        limiteCooldown
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (ultimoOtpError) {
      console.error(
        "Error comprobando cooldown OTP:",
        ultimoOtpError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo procesar la solicitud de seguridad.",
        },
        {
          status: 500,
        }
      );
    }

    if (ultimoOtp) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Espera 60 segundos antes de solicitar otro código.",
        },
        {
          status: 429,
        }
      );
    }

    /* =========================================================
       4. INVALIDAR CÓDIGOS ANTERIORES
    ========================================================= */

    const ahora =
      new Date().toISOString();

    const {
      error: invalidarError,
    } = await supabaseAdmin
      .from("admin_security_otps")
      .update({
        usado_at: ahora,
      })
      .eq(
        "admin_user_id",
        adminUserId
      )
      .eq("accion", accion)
      .is("usado_at", null);

    if (invalidarError) {
      console.error(
        "Error invalidando OTP anteriores:",
        invalidarError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo preparar el código de seguridad.",
        },
        {
          status: 500,
        }
      );
    }

    /* =========================================================
       5. GENERAR CÓDIGO
    ========================================================= */

    const codigo = crearCodigo();

    const codigoHash = crearHash({
      adminUserId,
      accion,
      codigo,
    });

    const expiresAt =
      new Date(
        Date.now() +
          OTP_EXPIRACION_MINUTOS *
            60 *
            1000
      ).toISOString();

    /* =========================================================
       6. GUARDAR SOLO EL HASH
    ========================================================= */

    const {
      data: otpCreado,
      error: insertError,
    } = await supabaseAdmin
      .from("admin_security_otps")
      .insert({
        admin_user_id:
          adminUserId,

        accion,

        codigo_hash:
          codigoHash,

        intentos: 0,
        max_intentos: 5,

        expires_at:
          expiresAt,
      })
      .select("id")
      .single();

    if (
      insertError ||
      !otpCreado?.id
    ) {
      console.error(
        "Error creando OTP administrativo:",
        insertError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo crear el código de seguridad.",
        },
        {
          status: 500,
        }
      );
    }

    /* =========================================================
       7. ENVIAR AL CORREO ACTUAL
    ========================================================= */

    try {
      await sendAdminSecurityCodeEmail({
        to: adminEmail,
        codigo,
        accion,
      });
    } catch (emailError) {
      console.error(
        "Error enviando OTP administrativo:",
        emailError
      );

      /*
       * Si Resend falla, invalidamos el OTP
       * para que no quede activo un código
       * que nunca llegó al administrador.
       */

      await supabaseAdmin
        .from("admin_security_otps")
        .update({
          usado_at:
            new Date().toISOString(),
        })
        .eq("id", otpCreado.id);

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo enviar el código de seguridad.",
        },
        {
          status: 500,
        }
      );
    }

    /* =========================================================
       8. RESPUESTA
    ========================================================= */

    return NextResponse.json({
      ok: true,

      message:
        "Código de seguridad enviado.",

      expiresIn:
        OTP_EXPIRACION_MINUTOS * 60,
    });
  } catch (error) {
    console.error(
      "Error en enviar-codigo admin:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Error interno procesando la solicitud de seguridad.",
      },
      {
        status: 500,
      }
    );
  }
}