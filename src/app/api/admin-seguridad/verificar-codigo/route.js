import { NextResponse } from "next/server";
import crypto from "crypto";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCIONES_PERMITIDAS = new Set([
  "cambiar_password",
  "cambiar_email",
]);

const AUTORIZACION_MINUTOS = 5;

/* =========================================================
   PEPPER
========================================================= */

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

/* =========================================================
   HASH DEL OTP
========================================================= */

function crearCodigoHash({
  adminUserId,
  accion,
  codigo,
}) {
  return crypto
    .createHmac(
      "sha256",
      obtenerPepper()
    )
    .update(
      `${adminUserId}:${accion}:${codigo}`
    )
    .digest("hex");
}

/* =========================================================
   HASH DEL TOKEN DE AUTORIZACIÓN
========================================================= */

function crearTokenHash(token) {
  return crypto
    .createHmac(
      "sha256",
      obtenerPepper()
    )
    .update(`authorization:${token}`)
    .digest("hex");
}

/* =========================================================
   COMPARACIÓN SEGURA
========================================================= */

function hashesIguales(a, b) {
  try {
    const bufferA =
      Buffer.from(String(a), "hex");

    const bufferB =
      Buffer.from(String(b), "hex");

    if (
      bufferA.length === 0 ||
      bufferA.length !== bufferB.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      bufferA,
      bufferB
    );
  } catch {
    return false;
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  try {
    /* =====================================================
       1. ADMIN + MFA AAL2
    ===================================================== */

    const admin =
      await requireAdmin(req);

    if (!admin?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            admin?.error ||
            "Acceso denegado",
          requiresMfa:
            Boolean(
              admin?.requiresMfa
            ),
        },
        {
          status:
            admin?.status || 403,
        }
      );
    }

    const adminUserId =
      String(
        admin?.user?.id || ""
      ).trim();

    if (!adminUserId) {
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

    /* =====================================================
       2. BODY
    ===================================================== */

    const body =
      await req
        .json()
        .catch(() => ({}));

    const accion =
      String(
        body?.accion || ""
      ).trim();

    const codigo =
      String(
        body?.codigo || ""
      ).trim();

    if (
      !ACCIONES_PERMITIDAS.has(
        accion
      )
    ) {
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

    if (!/^\d{6}$/.test(codigo)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El código debe tener 6 dígitos.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       3. BUSCAR OTP ACTIVO MÁS RECIENTE
    ===================================================== */

    const ahora =
      new Date();

    const {
      data: otp,
      error: otpError,
    } = await supabaseAdmin
      .from(
        "admin_security_otps"
      )
      .select(
        `
          id,
          codigo_hash,
          intentos,
          max_intentos,
          expires_at,
          usado_at
        `
      )
      .eq(
        "admin_user_id",
        adminUserId
      )
      .eq(
        "accion",
        accion
      )
      .is(
        "usado_at",
        null
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error(
        "Error consultando OTP:",
        otpError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo verificar el código.",
        },
        {
          status: 500,
        }
      );
    }

    if (!otp) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No existe un código de seguridad activo. Solicita uno nuevo.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       4. COMPROBAR EXPIRACIÓN
    ===================================================== */

    const expiresAt =
      new Date(otp.expires_at);

    if (
      !Number.isFinite(
        expiresAt.getTime()
      ) ||
      expiresAt <= ahora
    ) {
      await supabaseAdmin
        .from(
          "admin_security_otps"
        )
        .update({
          usado_at:
            ahora.toISOString(),
        })
        .eq("id", otp.id);

      return NextResponse.json(
        {
          ok: false,
          error:
            "El código expiró. Solicita uno nuevo.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       5. COMPROBAR INTENTOS
    ===================================================== */

    const intentos =
      Number(otp.intentos || 0);

    const maxIntentos =
      Number(
        otp.max_intentos || 5
      );

    if (
      intentos >= maxIntentos
    ) {
      await supabaseAdmin
        .from(
          "admin_security_otps"
        )
        .update({
          usado_at:
            ahora.toISOString(),
        })
        .eq("id", otp.id);

      return NextResponse.json(
        {
          ok: false,
          error:
            "Este código fue bloqueado por demasiados intentos. Solicita uno nuevo.",
        },
        {
          status: 429,
        }
      );
    }

    /* =====================================================
       6. COMPARAR HASH
    ===================================================== */

    const hashRecibido =
      crearCodigoHash({
        adminUserId,
        accion,
        codigo,
      });

    const codigoCorrecto =
      hashesIguales(
        hashRecibido,
        otp.codigo_hash
      );

    if (!codigoCorrecto) {
      const nuevosIntentos =
        intentos + 1;

      const bloquear =
        nuevosIntentos >=
        maxIntentos;

      const {
        error: intentoError,
      } = await supabaseAdmin
        .from(
          "admin_security_otps"
        )
        .update({
          intentos:
            nuevosIntentos,

          ...(bloquear
            ? {
                usado_at:
                  ahora.toISOString(),
              }
            : {}),
        })
        .eq("id", otp.id);

      if (intentoError) {
        console.error(
          "Error actualizando intentos OTP:",
          intentoError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "No se pudo verificar el código.",
          },
          {
            status: 500,
          }
        );
      }

      const restantes =
        Math.max(
          maxIntentos -
            nuevosIntentos,
          0
        );

      return NextResponse.json(
        {
          ok: false,

          error: bloquear
            ? "Código bloqueado por demasiados intentos. Solicita uno nuevo."
            : `Código incorrecto. Te quedan ${restantes} intento${
                restantes === 1
                  ? ""
                  : "s"
              }.`,
        },
        {
          status:
            bloquear
              ? 429
              : 400,
        }
      );
    }

    /* =====================================================
       7. MARCAR OTP COMO USADO

       Solo un proceso puede reclamarlo.
    ===================================================== */

    const {
      data: otpConsumido,
      error: consumirOtpError,
    } = await supabaseAdmin
      .from(
        "admin_security_otps"
      )
      .update({
        usado_at:
          ahora.toISOString(),
      })
      .eq("id", otp.id)
      .is("usado_at", null)
      .select("id")
      .maybeSingle();

    if (
      consumirOtpError ||
      !otpConsumido
    ) {
      console.error(
        "Error consumiendo OTP:",
        consumirOtpError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "El código ya fue utilizado o no pudo validarse.",
        },
        {
          status: 409,
        }
      );
    }

    /* =====================================================
       8. INVALIDAR AUTORIZACIONES ANTERIORES
    ===================================================== */

    const {
      error:
        invalidarAutorizacionesError,
    } = await supabaseAdmin
      .from(
        "admin_security_authorizations"
      )
      .update({
        usado_at:
          ahora.toISOString(),
      })
      .eq(
        "admin_user_id",
        adminUserId
      )
      .eq(
        "accion",
        accion
      )
      .is(
        "usado_at",
        null
      );

    if (
      invalidarAutorizacionesError
    ) {
      console.error(
        "Error invalidando autorizaciones:",
        invalidarAutorizacionesError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "El código fue validado, pero no se pudo crear la autorización de seguridad. Solicita un código nuevo.",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       9. TOKEN ALEATORIO DE AUTORIZACIÓN
    ===================================================== */

    const authorizationToken =
      crypto
        .randomBytes(32)
        .toString("base64url");

    const tokenHash =
      crearTokenHash(
        authorizationToken
      );

    const authorizationExpiresAt =
      new Date(
        Date.now() +
          AUTORIZACION_MINUTOS *
            60 *
            1000
      ).toISOString();

    /* =====================================================
       10. GUARDAR SOLO HASH DEL TOKEN
    ===================================================== */

    const {
      error:
        authorizationError,
    } = await supabaseAdmin
      .from(
        "admin_security_authorizations"
      )
      .insert({
        admin_user_id:
          adminUserId,

        accion,

        token_hash:
          tokenHash,

        expires_at:
          authorizationExpiresAt,
      });

    if (authorizationError) {
      console.error(
        "Error creando autorización:",
        authorizationError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "El código fue validado, pero no se pudo crear la autorización. Solicita un código nuevo.",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       11. DEVOLVER TOKEN SOLO ESTA VEZ
    ===================================================== */

    return NextResponse.json({
      ok: true,

      authorizationToken,

      expiresIn:
        AUTORIZACION_MINUTOS *
        60,
    });
  } catch (error) {
    console.error(
      "Error verificando código administrativo:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Error interno verificando el código de seguridad.",
      },
      {
        status: 500,
      }
    );
  }
}