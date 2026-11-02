import { NextResponse } from "next/server";
import crypto from "crypto";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HASH DE AUTORIZACIÓN
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

function crearTokenHash(token) {
  return crypto
    .createHmac(
      "sha256",
      obtenerPepper()
    )
    .update(
      `authorization:${token}`
    )
    .digest("hex");
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  try {
    // =========================================================
    // 1. VERIFICAR ADMIN + MFA AAL2
    // =========================================================

    const admin =
      await requireAdmin(req);

    if (!admin?.ok) {
      return NextResponse.json(
        {
          ok: false,

          error:
            admin?.error ||
            "No autorizado",

          requiresMfa:
            admin?.requiresMfa ===
            true,
        },
        {
          status:
            admin?.status || 401,
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

    // =========================================================
    // 2. LEER DATOS
    // =========================================================

    let body;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solicitud inválida",
        },
        {
          status: 400,
        }
      );
    }

    const nuevaPassword =
      String(
        body?.nuevaPassword || ""
      );

    const authorizationToken =
      String(
        body?.authorizationToken ||
          ""
      ).trim();

    // =========================================================
    // 3. EXIGIR AUTORIZACIÓN POR EMAIL
    // =========================================================

    if (!authorizationToken) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Debes verificar primero el código de seguridad enviado a tu correo.",
          requiresEmailVerification:
            true,
        },
        {
          status: 403,
        }
      );
    }

    // =========================================================
    // 4. VALIDAR CONTRASEÑA
    // =========================================================

    if (!nuevaPassword) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Debes ingresar una nueva contraseña",
        },
        {
          status: 400,
        }
      );
    }

    if (
      nuevaPassword.length < 12
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La nueva contraseña debe tener al menos 12 caracteres",
        },
        {
          status: 400,
        }
      );
    }

    if (
      nuevaPassword.length > 128
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La contraseña es demasiado larga",
        },
        {
          status: 400,
        }
      );
    }

    const tieneMinuscula =
      /[a-z]/.test(
        nuevaPassword
      );

    const tieneMayuscula =
      /[A-Z]/.test(
        nuevaPassword
      );

    const tieneNumero =
      /[0-9]/.test(
        nuevaPassword
      );

    const tieneEspecial =
      /[^A-Za-z0-9]/.test(
        nuevaPassword
      );

    if (
      !tieneMinuscula ||
      !tieneMayuscula ||
      !tieneNumero ||
      !tieneEspecial
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Usa mayúsculas, minúsculas, números y al menos un carácter especial",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================================
    // 5. BUSCAR AUTORIZACIÓN TEMPORAL
    // =========================================================

    const tokenHash =
      crearTokenHash(
        authorizationToken
      );

    const {
      data: authorization,
      error:
        authorizationQueryError,
    } = await supabaseAdmin
      .from(
        "admin_security_authorizations"
      )
      .select(
        `
          id,
          admin_user_id,
          accion,
          expires_at,
          usado_at
        `
      )
      .eq(
        "token_hash",
        tokenHash
      )
      .eq(
        "admin_user_id",
        adminUserId
      )
      .eq(
        "accion",
        "cambiar_password"
      )
      .is(
        "usado_at",
        null
      )
      .maybeSingle();

    if (
      authorizationQueryError
    ) {
      console.error(
        "Error consultando autorización:",
        authorizationQueryError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo comprobar la autorización de seguridad.",
        },
        {
          status: 500,
        }
      );
    }

    if (!authorization) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La autorización de seguridad no es válida o ya fue utilizada.",
          requiresEmailVerification:
            true,
        },
        {
          status: 403,
        }
      );
    }

    // =========================================================
    // 6. COMPROBAR EXPIRACIÓN
    // =========================================================

    const ahora =
      new Date();

    const expiresAt =
      new Date(
        authorization.expires_at
      );

    if (
      !Number.isFinite(
        expiresAt.getTime()
      ) ||
      expiresAt <= ahora
    ) {
      await supabaseAdmin
        .from(
          "admin_security_authorizations"
        )
        .update({
          usado_at:
            ahora.toISOString(),
        })
        .eq(
          "id",
          authorization.id
        )
        .is(
          "usado_at",
          null
        );

      return NextResponse.json(
        {
          ok: false,
          error:
            "La autorización de seguridad expiró. Solicita un código nuevo.",
          requiresEmailVerification:
            true,
        },
        {
          status: 403,
        }
      );
    }

    // =========================================================
    // 7. CONSUMIR AUTORIZACIÓN UNA SOLA VEZ
    // =========================================================

    const {
      data:
        authorizationConsumida,

      error:
        consumirAuthorizationError,
    } = await supabaseAdmin
      .from(
        "admin_security_authorizations"
      )
      .update({
        usado_at:
          ahora.toISOString(),
      })
      .eq(
        "id",
        authorization.id
      )
      .is(
        "usado_at",
        null
      )
      .select("id")
      .maybeSingle();

    if (
      consumirAuthorizationError ||
      !authorizationConsumida
    ) {
      console.error(
        "Error consumiendo autorización:",
        consumirAuthorizationError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "La autorización ya fue utilizada. Solicita un código nuevo.",
          requiresEmailVerification:
            true,
        },
        {
          status: 409,
        }
      );
    }

    // =========================================================
    // 8. CAMBIAR ÚNICAMENTE LA CONTRASEÑA
    // =========================================================

    const {
      error: updateError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        adminUserId,
        {
          password:
            nuevaPassword,
        }
      );

    if (updateError) {
      console.error(
        "Error actualizando contraseña del administrador:",
        updateError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo actualizar la contraseña",
        },
        {
          status: 500,
        }
      );
    }

    // =========================================================
    // 9. RESPUESTA
    // =========================================================

    return NextResponse.json(
      {
        ok: true,
        message:
          "Contraseña actualizada correctamente",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Error en admin-cambiar-password:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Error interno del servidor",
      },
      {
        status: 500,
      }
    );
  }
}