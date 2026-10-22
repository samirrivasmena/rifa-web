import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const MAX_ATTEMPTS_BEFORE_BLOCK = 5;

// Si pasan 30 minutos desde el último fallo,
// comenzamos de nuevo.
const ATTEMPT_RESET_MINUTES = 30;

// Límites de seguridad.
const MAX_IP_LENGTH = 200;
const MAX_ACTION_LENGTH = 30;

/* =========================================================
   RESPUESTA JSON SIN CACHE
========================================================= */

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/* =========================================================
   OBTENER IP
========================================================= */

function obtenerIp(req) {
  /*
    En Vercel normalmente x-forwarded-for contiene
    la IP original del visitante.

    Tomamos únicamente la primera dirección.
  */

  const forwardedFor =
    req.headers.get("x-forwarded-for") || "";

  if (forwardedFor) {
    const primeraIp = forwardedFor
      .split(",")[0]
      ?.trim();

    if (primeraIp) {
      return primeraIp.slice(0, MAX_IP_LENGTH);
    }
  }

  const realIp =
    req.headers.get("x-real-ip") || "";

  if (realIp.trim()) {
    return realIp
      .trim()
      .slice(0, MAX_IP_LENGTH);
  }

  /*
    Desarrollo local.

    No almacenamos esta cadena directamente:
    igualmente será hasheada con el pepper.
  */
  return "local-development";
}

/* =========================================================
   HASH PRIVADO DE IP
========================================================= */

function crearHashIp(ip) {
  const pepper = String(
    process.env.ADMIN_SECURITY_PEPPER || ""
  ).trim();

  if (!pepper) {
    throw new Error(
      "ADMIN_SECURITY_PEPPER no está configurado"
    );
  }

  /*
    HMAC evita guardar la IP real.

    Incluso teniendo acceso a la tabla,
    no se puede simplemente leer la dirección.
  */
  return crypto
    .createHmac("sha256", pepper)
    .update(ip)
    .digest("hex");
}

/* =========================================================
   CALCULAR BLOQUEO PROGRESIVO
========================================================= */

function calcularMinutosBloqueo(intentos) {
  /*
    1 - 4 fallos: sin bloqueo

    5 fallos: 1 minuto
    6 fallos: 2 minutos
    7 fallos: 5 minutos
    8 fallos: 10 minutos
    9 fallos: 30 minutos
    10+ fallos: 60 minutos

    No hacemos bloqueos permanentes.
  */

  if (intentos < 5) return 0;
  if (intentos === 5) return 1;
  if (intentos === 6) return 2;
  if (intentos === 7) return 5;
  if (intentos === 8) return 10;
  if (intentos === 9) return 30;

  return 60;
}

/* =========================================================
   SEGUNDOS RESTANTES
========================================================= */

function segundosRestantes(fecha) {
  if (!fecha) return 0;

  const bloqueadoHasta =
    new Date(fecha).getTime();

  if (!Number.isFinite(bloqueadoHasta)) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(
      (bloqueadoHasta - Date.now()) / 1000
    )
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  try {
    /* =====================================================
       1. COMPROBAR CONFIGURACIÓN
    ===================================================== */

    const pepper = String(
      process.env.ADMIN_SECURITY_PEPPER || ""
    ).trim();

    if (!pepper) {
      console.error(
        "SEGURIDAD: ADMIN_SECURITY_PEPPER no está configurado"
      );

      return json(
        {
          ok: false,
          error: "Configuración de seguridad incompleta",
        },
        500
      );
    }

    /* =====================================================
       2. LEER BODY
    ===================================================== */

    let body;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          ok: false,
          error: "Solicitud inválida",
        },
        400
      );
    }

    const action = String(
      body?.action || ""
    )
      .trim()
      .toLowerCase()
      .slice(0, MAX_ACTION_LENGTH);

    /*
      Acciones permitidas:

      check   -> comprobar si puede intentar login
      failure -> registrar contraseña/login fallido
      success -> limpiar contador después de login correcto
    */

    if (
      action !== "check" &&
      action !== "failure" &&
      action !== "success"
    ) {
      return json(
        {
          ok: false,
          error: "Acción de seguridad inválida",
        },
        400
      );
    }

    /* =====================================================
       3. IDENTIFICAR VISITANTE
    ===================================================== */

    const ip = obtenerIp(req);
    const ipHash = crearHashIp(ip);

    /* =====================================================
       4. BUSCAR ESTADO ACTUAL
    ===================================================== */

    const {
      data: registro,
      error: registroError,
    } = await supabaseAdmin
      .from("admin_login_security")
      .select(`
        id,
        failed_attempts,
        blocked_until,
        last_attempt_at,
        created_at,
        updated_at
      `)
      .eq("ip_hash", ipHash)
      .maybeSingle();

    if (registroError) {
      console.error(
        "Error leyendo admin_login_security:",
        registroError
      );

      return json(
        {
          ok: false,
          error:
            "No se pudo comprobar la seguridad del acceso",
        },
        500
      );
    }

    /* =====================================================
       5. CHECK
    ===================================================== */

    if (action === "check") {
      if (!registro) {
        return json({
          ok: true,
          allowed: true,
          remainingAttempts:
            MAX_ATTEMPTS_BEFORE_BLOCK,
        });
      }

      const waitSeconds =
        segundosRestantes(
          registro.blocked_until
        );

      if (waitSeconds > 0) {
        return json(
          {
            ok: true,
            allowed: false,
            blocked: true,
            retryAfter: waitSeconds,
            error:
              "Demasiados intentos de acceso. Espera antes de volver a intentarlo.",
          },
          429
        );
      }

      /*
        Si el último fallo fue hace más de 30 minutos,
        limpiamos automáticamente el contador.
      */

      const ultimoIntento =
        registro.last_attempt_at
          ? new Date(
              registro.last_attempt_at
            ).getTime()
          : 0;

      const resetMs =
        ATTEMPT_RESET_MINUTES *
        60 *
        1000;

      if (
        ultimoIntento &&
        Date.now() - ultimoIntento >
          resetMs
      ) {
        const {
          error: resetError,
        } = await supabaseAdmin
          .from(
            "admin_login_security"
          )
          .update({
            failed_attempts: 0,
            blocked_until: null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", registro.id);

        if (resetError) {
          console.error(
            "Error reiniciando intentos:",
            resetError
          );
        }

        return json({
          ok: true,
          allowed: true,
          remainingAttempts:
            MAX_ATTEMPTS_BEFORE_BLOCK,
        });
      }

      const fallos =
        Number(
          registro.failed_attempts
        ) || 0;

      return json({
        ok: true,
        allowed: true,
        remainingAttempts:
          Math.max(
            0,
            MAX_ATTEMPTS_BEFORE_BLOCK -
              fallos
          ),
      });
    }

    /* =====================================================
       6. REGISTRAR FALLO
    ===================================================== */

    if (action === "failure") {
      const ahora =
        new Date();

      let intentosActuales =
        Number(
          registro?.failed_attempts
        ) || 0;

      /*
        Si llevaba mucho tiempo sin fallar,
        no seguimos acumulando intentos antiguos.
      */

      if (
        registro?.last_attempt_at
      ) {
        const ultimoIntento =
          new Date(
            registro.last_attempt_at
          ).getTime();

        const resetMs =
          ATTEMPT_RESET_MINUTES *
          60 *
          1000;

        if (
          Number.isFinite(
            ultimoIntento
          ) &&
          Date.now() -
            ultimoIntento >
            resetMs
        ) {
          intentosActuales = 0;
        }
      }

      const nuevosIntentos =
        intentosActuales + 1;

      const minutosBloqueo =
        calcularMinutosBloqueo(
          nuevosIntentos
        );

      let blockedUntil = null;

      if (minutosBloqueo > 0) {
        blockedUntil =
          new Date(
            ahora.getTime() +
              minutosBloqueo *
                60 *
                1000
          ).toISOString();
      }

      const datos = {
        failed_attempts:
          nuevosIntentos,

        blocked_until:
          blockedUntil,

        last_attempt_at:
          ahora.toISOString(),

        updated_at:
          ahora.toISOString(),
      };

      if (registro?.id) {
        const {
          error: updateError,
        } = await supabaseAdmin
          .from(
            "admin_login_security"
          )
          .update(datos)
          .eq("id", registro.id);

        if (updateError) {
          console.error(
            "Error actualizando intento fallido:",
            updateError
          );

          return json(
            {
              ok: false,
              error:
                "No se pudo actualizar la seguridad",
            },
            500
          );
        }
      } else {
        const {
          error: insertError,
        } = await supabaseAdmin
          .from(
            "admin_login_security"
          )
          .insert({
            ip_hash: ipHash,
            ...datos,
          });

        if (insertError) {
          console.error(
            "Error registrando intento fallido:",
            insertError
          );

          return json(
            {
              ok: false,
              error:
                "No se pudo actualizar la seguridad",
            },
            500
          );
        }
      }

      const waitSeconds =
        blockedUntil
          ? segundosRestantes(
              blockedUntil
            )
          : 0;

      return json({
        ok: true,

        blocked:
          waitSeconds > 0,

        retryAfter:
          waitSeconds,

        remainingAttempts:
          Math.max(
            0,
            MAX_ATTEMPTS_BEFORE_BLOCK -
              nuevosIntentos
          ),
      });
    }

    /* =====================================================
       7. LOGIN CORRECTO
    ===================================================== */
if (action === "success") {
  /* =====================================================
     SOLO UN ADMIN AUTENTICADO PUEDE LIMPIAR LOS FALLOS
  ===================================================== */

  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return json(
      {
        ok: false,
        error: "No autorizado",
      },
      auth.status || 401
    );
  }

  /*
    Ya comprobamos en el servidor que:
    - existe una sesión válida
    - el token pertenece a un usuario real
    - el email coincide con ADMIN_EMAIL

    Ahora sí podemos limpiar los intentos.
  */

  if (registro?.id) {
    const { error: deleteError } =
      await supabaseAdmin
        .from("admin_login_security")
        .delete()
        .eq("id", registro.id);

    if (deleteError) {
      console.error(
        "Error limpiando intentos:",
        deleteError
      );

      /*
        No bloqueamos un login válido porque
        haya fallado solamente la limpieza.
      */
      return json({
        ok: true,
        cleared: false,
      });
    }
  }

  return json({
    ok: true,
    cleared: true,
  });
}

    return json(
      {
        ok: false,
        error: "Acción inválida",
      },
      400
    );
  } catch (error) {
    console.error(
      "admin-security/rate-limit error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "Error interno de seguridad",
      },
      500
    );
  }
}