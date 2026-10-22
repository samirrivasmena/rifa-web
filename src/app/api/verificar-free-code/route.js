import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
// CONFIGURACIÓN DE SEGURIDAD
// ============================================================

/*
 * Esta API es pública.
 *
 * Los códigos actuales tienen formato:
 *
 * FREE-123456
 *
 * Conservamos ese formato para no romper códigos
 * que ya fueron entregados a participantes.
 */

const CODIGO_FREE_REGEX = /^FREE-\d{6}$/;

/*
 * Protección básica contra intentos masivos.
 *
 * Máximo:
 * 10 intentos dentro de una ventana de 10 minutos.
 *
 * IMPORTANTE:
 * Este límite funciona como una capa adicional.
 * En entornos serverless diferentes instancias pueden
 * tener memorias independientes.
 */

const MAX_INTENTOS = 10;
const VENTANA_MS = 10 * 60 * 1000;

// ============================================================
// RATE LIMIT EN MEMORIA
// ============================================================

const globalForFreeCode = globalThis;

if (!globalForFreeCode.__freeCodeRateLimit) {
  globalForFreeCode.__freeCodeRateLimit = new Map();
}

const rateLimitStore =
  globalForFreeCode.__freeCodeRateLimit;

// ============================================================
// SUPABASE SERVER
// ============================================================

function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceKey
  ) {
    throw new Error(
      "Faltan variables de entorno de Supabase"
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

// ============================================================
// HELPERS
// ============================================================

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function responderError(
  mensaje,
  status = 400,
  headers = {}
) {
  return NextResponse.json(
    {
      error: mensaje,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        ...headers,
      },
    }
  );
}

// ============================================================
// OBTENER IP
// ============================================================

function obtenerIp(req) {
  const forwardedFor =
    req.headers.get(
      "x-forwarded-for"
    ) || "";

  const primeraIp =
    forwardedFor
      .split(",")[0]
      ?.trim() || "";

  if (primeraIp) {
    return primeraIp;
  }

  const realIp =
    req.headers.get(
      "x-real-ip"
    ) || "";

  if (realIp.trim()) {
    return realIp.trim();
  }

  /*
   * Fallback.
   *
   * Principalmente útil durante desarrollo local.
   */

  return "local";
}

// ============================================================
// HASH DE IP
// ============================================================

function hashIp(ip) {
  /*
   * No necesitamos guardar la IP directamente
   * dentro del Map.
   */

  return createHash("sha256")
    .update(
      String(ip || "unknown")
    )
    .digest("hex");
}

// ============================================================
// LIMPIAR RATE LIMITS EXPIRADOS
// ============================================================

function limpiarRateLimitsExpirados() {
  const ahora = Date.now();

  for (
    const [key, registro]
    of rateLimitStore.entries()
  ) {
    if (
      !registro ||
      ahora -
        Number(
          registro.inicio || 0
        ) >
        VENTANA_MS
    ) {
      rateLimitStore.delete(key);
    }
  }
}

// ============================================================
// COMPROBAR RATE LIMIT
// ============================================================

function comprobarRateLimit(ip) {
  limpiarRateLimitsExpirados();

  const ahora = Date.now();
  const key = hashIp(ip);

  const registro =
    rateLimitStore.get(key);

  /*
   * Primera solicitud dentro
   * de la ventana.
   */

  if (!registro) {
    rateLimitStore.set(
      key,
      {
        intentos: 0,
        inicio: ahora,
      }
    );

    return {
      permitido: true,
      key,
      retryAfter: 0,
    };
  }

  const transcurrido =
    ahora -
    Number(
      registro.inicio || ahora
    );

  /*
   * Ventana expirada.
   */

  if (transcurrido >= VENTANA_MS) {
    rateLimitStore.set(
      key,
      {
        intentos: 0,
        inicio: ahora,
      }
    );

    return {
      permitido: true,
      key,
      retryAfter: 0,
    };
  }

  /*
   * Demasiados intentos fallidos.
   */

  if (
    Number(
      registro.intentos || 0
    ) >= MAX_INTENTOS
  ) {
    const restanteMs =
      VENTANA_MS -
      transcurrido;

    const retryAfter =
      Math.max(
        Math.ceil(
          restanteMs / 1000
        ),
        1
      );

    return {
      permitido: false,
      key,
      retryAfter,
    };
  }

  return {
    permitido: true,
    key,
    retryAfter: 0,
  };
}

// ============================================================
// REGISTRAR INTENTO FALLIDO
// ============================================================

function registrarIntentoFallido(
  key
) {
  if (!key) {
    return;
  }

  const ahora = Date.now();

  const registro =
    rateLimitStore.get(key);

  if (!registro) {
    rateLimitStore.set(
      key,
      {
        intentos: 1,
        inicio: ahora,
      }
    );

    return;
  }

  rateLimitStore.set(
    key,
    {
      ...registro,

      intentos:
        Number(
          registro.intentos || 0
        ) + 1,
    }
  );
}

// ============================================================
// LIMPIAR INTENTOS DESPUÉS DE ÉXITO
// ============================================================

function limpiarIntentos(key) {
  if (!key) {
    return;
  }

  rateLimitStore.delete(key);
}

// ============================================================
// ESTADO VISUAL
// ============================================================

function estadoVisualParticipacion(
  estado
) {
  const value =
    normalizarTexto(estado);

  if (
    [
      "activo",
      "valida",
      "válida",
      "aprobado",
      "aprobada",
      "approved",
    ].includes(value)
  ) {
    return "VÁLIDA";
  }

  if (
    [
      "pendiente",
      "pending",
    ].includes(value)
  ) {
    return "PENDIENTE";
  }

  if (
    [
      "rechazado",
      "rechazada",
      "rejected",
    ].includes(value)
  ) {
    return "RECHAZADA";
  }

  if (
    [
      "anulado",
      "anulada",
      "cancelado",
      "cancelada",
    ].includes(value)
  ) {
    return "ANULADA";
  }

  return String(
    estado ||
      "DESCONOCIDO"
  ).toUpperCase();
}

// ============================================================
// FORMATEAR NÚMERO
// ============================================================

function formatearNumero(
  numero,
  padLength = 4
) {
  if (
    numero === null ||
    numero === undefined ||
    numero === ""
  ) {
    return null;
  }

  const n = Number(numero);

  if (!Number.isFinite(n)) {
    return null;
  }

  return `#${String(n).padStart(
    padLength,
    "0"
  )}`;
}

// ============================================================
// POST
// ============================================================

export async function POST(req) {
  let rateLimitKey = null;

  try {
    // ========================================================
    // 1. RATE LIMIT
    // ========================================================

    const clientIp =
      obtenerIp(req);

    const rateLimit =
      comprobarRateLimit(
        clientIp
      );

    rateLimitKey =
      rateLimit.key;

    if (!rateLimit.permitido) {
      return responderError(
        "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
        429,
        {
          "Retry-After":
            String(
              rateLimit.retryAfter
            ),
        }
      );
    }

    // ========================================================
    // 2. BODY
    // ========================================================

    const body =
      await req
        .json()
        .catch(() => null);

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(body)
    ) {
      registrarIntentoFallido(
        rateLimitKey
      );

      return responderError(
        "Solicitud inválida",
        400
      );
    }

    // ========================================================
    // 3. CÓDIGO FREE
    // ========================================================

    const codigo =
      limpiarTexto(
        body.codigo ||
          body.codigo_free ||
          body.codigoUnico ||
          body.codigo_unico
      ).toUpperCase();

    if (!codigo) {
      registrarIntentoFallido(
        rateLimitKey
      );

      return responderError(
        "El código FREE es requerido",
        400
      );
    }

    /*
     * Tus códigos actuales utilizan:
     *
     * FREE-123456
     *
     * Esta validación reduce enormemente
     * entradas basura antes de consultar
     * Supabase.
     */

    if (
      !CODIGO_FREE_REGEX.test(
        codigo
      )
    ) {
      registrarIntentoFallido(
        rateLimitKey
      );

      return responderError(
        "Código FREE inválido",
        400
      );
    }

    // ========================================================
    // 4. SUPABASE
    // ========================================================

    const supabase =
      getSupabaseServerClient();

    // ========================================================
    // 5. BUSCAR PARTICIPACIÓN
    // ========================================================

    const {
      data: participacion,
      error:
        errorParticipacion,
    } = await supabase
      .from(
        "free_drop_participations"
      )
      .select(
        [
          "id",
          "rifa_id",
          "free_drop_id",
          "ticket_id",
          "codigo_unico",
          "estado",
          "created_at",
        ].join(",")
      )
      .eq(
        "codigo_unico",
        codigo
      )
      .maybeSingle();

    if (errorParticipacion) {
      console.error(
        "Error buscando participación FREE:",
        errorParticipacion
      );

      /*
       * Un error del servidor NO cuenta
       * como intento fallido del usuario.
       */

      return responderError(
        "No se pudo verificar el código FREE",
        500
      );
    }

    if (!participacion) {
      registrarIntentoFallido(
        rateLimitKey
      );

      return responderError(
        "Código FREE no encontrado",
        404
      );
    }

    // ========================================================
    // 6. CONSULTAS RELACIONADAS
    // ========================================================

    const ticketPromise =
      participacion.ticket_id
        ? supabase
            .from("tickets")
            .select(
              "id, numero_ticket"
            )
            .eq(
              "id",
              participacion.ticket_id
            )
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          });

    const [
      eventoRes,
      dropRes,
      ticketRes,
    ] = await Promise.all([
      supabase
        .from("rifas")
        .select(
          "id, nombre, formato"
        )
        .eq(
          "id",
          participacion.rifa_id
        )
        .maybeSingle(),

      supabase
        .from("free_drops")
        .select(
          "id, nombre, numero_drop"
        )
        .eq(
          "id",
          participacion.free_drop_id
        )
        .maybeSingle(),

      ticketPromise,
    ]);

    // ========================================================
    // 7. VALIDAR CONSULTAS
    // ========================================================

    if (eventoRes.error) {
      console.error(
        "Error cargando evento:",
        eventoRes.error
      );

      return responderError(
        "No se pudo cargar el evento",
        500
      );
    }

    if (dropRes.error) {
      console.error(
        "Error cargando free drop:",
        dropRes.error
      );

      return responderError(
        "No se pudo cargar el free drop",
        500
      );
    }

    if (ticketRes.error) {
      console.error(
        "Error cargando ticket:",
        ticketRes.error
      );

      return responderError(
        "No se pudo cargar el número de participación",
        500
      );
    }

    // ========================================================
    // 8. DATOS PÚBLICOS
    // ========================================================

    const evento =
      eventoRes.data ||
      null;

    const freeDrop =
      dropRes.data ||
      null;

    const ticket =
      ticketRes.data ||
      null;

    const padLength =
      evento?.formato ===
      "3digitos"
        ? 3
        : 4;

    /*
     * El código existe y fue verificado.
     *
     * Limpiamos los intentos fallidos
     * asociados a esta IP.
     */

    limpiarIntentos(
      rateLimitKey
    );

    // ========================================================
    // 9. RESPUESTA
    //
    // IMPORTANTE:
    //
    // Esta API es pública.
    //
    // NO devolvemos:
    //
    // - nombre
    // - apellido
    // - email
    // - teléfono
    // - IP
    // - user-agent
    // - información de riesgo
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        participacion: {
          codigo:
            participacion.codigo_unico,

          estado:
            participacion.estado,

          estado_visual:
            estadoVisualParticipacion(
              participacion.estado
            ),

          fecha_iso:
            participacion.created_at,

          evento:
            evento?.nombre ||
            "Evento",

          rifa: {
            id:
              evento?.id ||
              null,

            nombre:
              evento?.nombre ||
              "Evento",

            formato:
              evento?.formato ||
              "4digitos",
          },

          free_drop:
            freeDrop?.nombre ||
            `FREE DROP #${
              freeDrop
                ?.numero_drop ||
              ""
            }`,

          free_drop_numero:
            freeDrop
              ?.numero_drop ??
            null,

          free_drop_id:
            freeDrop?.id ||
            null,

          numero_participacion:
            ticket
              ?.numero_ticket ??
            null,

          numero_participacion_formateado:
            formatearNumero(
              ticket
                ?.numero_ticket,
              padLength
            ) || null,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error en POST /api/verificar-free-code:",
      error
    );

    /*
     * Nunca enviamos error.message
     * al navegador.
     */

    return responderError(
      "Error inesperado al verificar el código FREE",
      500
    );
  }
}