import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SUPABASE SERVER
// ============================================================

function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
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

function responderError(mensaje, status = 400) {
  return NextResponse.json(
    {
      error: mensaje,
    },
    {
      status,
    }
  );
}

// ============================================================
// ESTADO VISUAL
// ============================================================

function estadoVisualParticipacion(estado) {
  const value = normalizarTexto(estado);

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
    estado || "DESCONOCIDO"
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
  try {
    const supabase =
      getSupabaseServerClient();

    // ========================================================
    // 1. BODY
    // ========================================================

    const body = await req
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return responderError(
        "Solicitud inválida",
        400
      );
    }

    // ========================================================
    // 2. CÓDIGO FREE
    // ========================================================

    const codigo = limpiarTexto(
      body.codigo ||
        body.codigo_free ||
        body.codigoUnico ||
        body.codigo_unico
    ).toUpperCase();

    if (!codigo) {
      return responderError(
        "El código FREE es requerido",
        400
      );
    }

    /*
     * Los códigos FREE legítimos utilizan:
     *
     * - letras
     * - números
     * - guion
     * - guion bajo
     *
     * Rechazamos cualquier otro carácter antes de consultar
     * la base de datos.
     */

    if (codigo.length > 100) {
      return responderError(
        "Código FREE inválido",
        400
      );
    }

    if (!/^[A-Z0-9_-]+$/.test(codigo)) {
      return responderError(
        "Código FREE inválido",
        400
      );
    }

    // ========================================================
    // 3. BUSCAR PARTICIPACIÓN
    // ========================================================

    const {
      data: participacion,
      error: errorParticipacion,
    } = await supabase
      .from("free_drop_participations")
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
      .eq("codigo_unico", codigo)
      .maybeSingle();

    if (errorParticipacion) {
      console.error(
        "Error buscando participación FREE:",
        errorParticipacion
      );

      return responderError(
        "No se pudo verificar el código FREE",
        500
      );
    }

    if (!participacion) {
      return responderError(
        "Código FREE no encontrado",
        404
      );
    }

    // ========================================================
    // 4. CONSULTAS RELACIONADAS
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
    // 5. VALIDAR CONSULTAS
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
    // 6. DATOS PÚBLICOS
    // ========================================================

    const evento =
      eventoRes.data || null;

    const freeDrop =
      dropRes.data || null;

    const ticket =
      ticketRes.data || null;

    const padLength =
      evento?.formato === "3digitos"
        ? 3
        : 4;

    // ========================================================
    // 7. RESPUESTA
    //
    // IMPORTANTE:
    // Esta API es pública.
    //
    // No devolvemos:
    // - nombre del participante
    // - apellido
    // - email
    // - teléfono
    // - IP
    // - user-agent
    // - información de riesgo
    // ========================================================

    return NextResponse.json({
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
            evento?.id || null,

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
            freeDrop?.numero_drop || ""
          }`,

        free_drop_numero:
          freeDrop?.numero_drop ??
          null,

        free_drop_id:
          freeDrop?.id ||
          null,

        numero_participacion:
          ticket?.numero_ticket ??
          null,

        numero_participacion_formateado:
          formatearNumero(
            ticket?.numero_ticket,
            padLength
          ) || null,
      },
    });
  } catch (error) {
    console.error(
      "Error en POST /api/verificar-free-code:",
      error
    );

    return responderError(
      "Error inesperado al verificar el código FREE",
      500
    );
  }
}