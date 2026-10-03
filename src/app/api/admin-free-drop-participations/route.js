import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendFreeDropConfirmationEmail } from "@/lib/email/sendFreeDropConfirmationEmail";
import { sendFreeDropCancellationEmail } from "@/lib/email/sendFreeDropCancellationEmail";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Faltan variables de entorno de Supabase");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(estado) {
  return String(estado ?? "").trim().toLowerCase();
}

function responderError(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

function getNombreCompleto(item = {}) {
  const nombre = limpiarTexto(item?.nombre);
  const apellido = limpiarTexto(item?.apellido);

  return [nombre, apellido].filter(Boolean).join(" ").trim();
}

function estadoLabel(estado) {
  const value = normalizarEstado(estado);

  if (
    ["activo", "activa", "valida", "válida", "approved", "aprobado"].includes(
      value
    )
  ) {
    return "Válida";
  }

  if (["pendiente", "pending"].includes(value)) {
    return "Pendiente";
  }

  if (
    ["rechazado", "rechazada", "rejected"].includes(value)
  ) {
    return "Rechazada";
  }

  if (
    ["anulado", "anulada", "cancelado", "cancelada"].includes(value)
  ) {
    return "Anulada";
  }

  return estado || "Sin estado";
}

function estadoResumenKey(estado) {
  const value = normalizarEstado(estado);

  if (
    ["activo", "activa", "valida", "válida", "approved", "aprobado"].includes(
      value
    )
  ) {
    return "valida";
  }

  if (["pendiente", "pending"].includes(value)) {
    return "pendiente";
  }

  if (
    ["rechazado", "rechazada", "rejected"].includes(value)
  ) {
    return "rechazada";
  }

  if (
    ["anulado", "anulada", "cancelado", "cancelada"].includes(value)
  ) {
    return "anulada";
  }

  return null;
}

function getDropLabel(drop) {
  if (!drop) {
    return "Sin free drop";
  }

  return drop.nombre || `FREE DROP #${drop.numero_drop || ""}`;
}

function getNumeroTicket(item) {
  const ticket = item?.tickets;

  if (!ticket?.numero_ticket && ticket?.numero_ticket !== 0) {
    return null;
  }

  return ticket.numero_ticket;
}

/*
|--------------------------------------------------------------------------
| Convierte los errores internos del RPC en mensajes claros para el admin
|--------------------------------------------------------------------------
*/

function getRpcErrorResponse(error) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");

  const contenido = `${message} ${details} ${hint}`;

  if (contenido.includes("FREE_INVALID_ACTION")) {
    return {
      status: 400,
      message: "Acción no válida",
    };
  }

  if (contenido.includes("FREE_PARTICIPATION_NOT_FOUND")) {
    return {
      status: 404,
      message: "La participación no existe",
    };
  }

  if (contenido.includes("FREE_DROP_NOT_FOUND")) {
    return {
      status: 409,
      message: "El FREE DROP asociado a la participación no existe",
    };
  }

  if (contenido.includes("FREE_SETTINGS_NOT_FOUND")) {
    return {
      status: 409,
      message: "No existe la configuración FREE de esta rifa",
    };
  }

  if (contenido.includes("FREE_TICKET_NOT_FOUND")) {
    return {
      status: 409,
      message: "La participación no tiene un ticket FREE válido asociado",
    };
  }

  if (contenido.includes("FREE_TICKET_HAS_PURCHASE")) {
    return {
      status: 409,
      message:
        "El ticket está relacionado con una compra y no puede modificarse como FREE",
    };
  }

  if (contenido.includes("FREE_TICKET_RELATION_MISMATCH")) {
    return {
      status: 409,
      message:
        "El ticket ya no corresponde correctamente con esta participación FREE",
    };
  }
  if (contenido.includes("FREE_NO_TICKETS_AVAILABLE")) {
  return {
    status: 409,
    message:
      "No quedan números disponibles para aprobar esta participación.",
  };
}

  if (contenido.includes("FREE_NOT_PENDING")) {
    return {
      status: 409,
      message: "Solo se pueden aprobar participaciones pendientes",
    };
  }

  if (contenido.includes("FREE_TICKET_INVALID_TYPE")) {
    return {
      status: 409,
      message: "El ticket asociado ya no está marcado como FREE",
    };
  }

  if (contenido.includes("FREE_TICKET_NOT_RESERVED")) {
    return {
      status: 409,
      message:
        "El ticket ya no se encuentra reservado y no puede aprobarse",
    };
  }

  if (contenido.includes("FREE_ALREADY_FINALIZED")) {
    return {
      status: 409,
      message: "La participación ya fue finalizada",
    };
  }

  if (contenido.includes("FREE_PARTICIPATION_UPDATE_FAILED")) {
    return {
      status: 409,
      message: "No se pudo actualizar la participación",
    };
  }

  if (contenido.includes("FREE_TICKET_UPDATE_FAILED")) {
    return {
      status: 409,
      message: "No se pudo confirmar el ticket FREE",
    };
  }

  if (contenido.includes("FREE_TICKET_RELEASE_FAILED")) {
    return {
      status: 409,
      message: "No se pudo liberar el ticket FREE",
    };
  }

  if (contenido.includes("FREE_DROP_UPDATE_FAILED")) {
    return {
      status: 409,
      message: "No se pudo actualizar el FREE DROP",
    };
  }

  if (contenido.includes("FREE_SETTINGS_UPDATE_FAILED")) {
    return {
      status: 409,
      message: "No se pudo actualizar la configuración FREE",
    };
  }

  return {
    status: 500,
    message: "No se pudo actualizar la participación FREE",
  };
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| Carga todas las participaciones FREE de una rifa.
| Mantiene la misma estructura utilizada por AdminFreeDropParticipationsSection.
|
*/

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { searchParams } = new URL(req.url);

    const rifaId = limpiarTexto(searchParams.get("rifaId"));
    const dropId = limpiarTexto(searchParams.get("dropId"));
    const estado = limpiarTexto(searchParams.get("estado"));
    const q = limpiarTexto(searchParams.get("q")).toLowerCase();

    if (!rifaId) {
      return responderError("rifaId es requerido", 400);
    }

    /*
    |--------------------------------------------------------------------------
    | Participaciones + lista de Drops
    |--------------------------------------------------------------------------
    */

    const [participacionesResult, dropsResult] = await Promise.all([
      supabase
        .from("free_drop_participations")
.select(`
  id,
  rifa_id,
  free_drop_id,
  ticket_id,
  nombre,
  apellido,
  email,
  telefono,
  codigo_unico,
  estado,
  email_normalized,
  telefono_normalized,
  social_username,
  evidence_url,
  acepta_reglas,
  cumple_requisitos,
  estado_residencia,
  ip_address,
  user_agent,

  risk_score,
  risk_reasons,
  requires_manual_review,
  review_source,
  reviewed_at,
  reviewed_by,

  created_at,
  updated_at
`)
        .eq("rifa_id", rifaId)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("free_drops")
        .select(`
          id,
          nombre,
          numero_drop,
          estado,
          cupos_total,
          cupos_usados,
          fecha_inicio,
          fecha_fin,
          created_at,
          updated_at
        `)
        .eq("rifa_id", rifaId)
        .order("numero_drop", {
          ascending: true,
        }),
    ]);

    if (participacionesResult.error) {
      console.error(
        "Error cargando participaciones free:",
        participacionesResult.error
      );

      return responderError(
        participacionesResult.error.message ||
          "No se pudieron cargar las participaciones",
        500
      );
    }

    if (dropsResult.error) {
      console.error(
        "Error cargando drops:",
        dropsResult.error
      );

      return responderError(
        dropsResult.error.message ||
          "No se pudieron cargar los drops",
        500
      );
    }

    const base = Array.isArray(participacionesResult.data)
      ? participacionesResult.data
      : [];

    const dropsBase = Array.isArray(dropsResult.data)
      ? dropsResult.data
      : [];

    /*
    |--------------------------------------------------------------------------
    | IDs relacionados
    |--------------------------------------------------------------------------
    */

    const freeDropIds = [
      ...new Set(
        base
          .map((item) => item.free_drop_id)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    const ticketIds = [
      ...new Set(
        base
          .map((item) => item.ticket_id)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    /*
    |--------------------------------------------------------------------------
    | Cargar información relacionada
    |--------------------------------------------------------------------------
    */

    const [dropsRes, ticketsRes] = await Promise.all([
      freeDropIds.length
        ? supabase
            .from("free_drops")
            .select(`
              id,
              nombre,
              numero_drop,
              estado,
              cupos_total,
              cupos_usados
            `)
            .in("id", freeDropIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),

      ticketIds.length
        ? supabase
            .from("tickets")
            .select(`
              id,
              numero_ticket,
              estado,
              tipo,
              asignado_a_nombre,
              asignado_a_email,
              asignado_a_telefono,
              asignado_at,
              fecha_asignacion
            `)
            .in("id", ticketIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

    if (dropsRes.error) {
      console.error(
        "Error cargando free drops:",
        dropsRes.error
      );

      return responderError(
        dropsRes.error.message ||
          "No se pudieron cargar los free drops",
        500
      );
    }

    if (ticketsRes.error) {
      console.error(
        "Error cargando tickets:",
        ticketsRes.error
      );

      return responderError(
        ticketsRes.error.message ||
          "No se pudieron cargar los tickets",
        500
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Mapas para evitar búsquedas repetidas
    |--------------------------------------------------------------------------
    */

    const dropsMap = new Map(
      (dropsRes.data || []).map((drop) => [
        String(drop.id),
        drop,
      ])
    );

    const ticketsMap = new Map(
      (ticketsRes.data || []).map((ticket) => [
        String(ticket.id),
        ticket,
      ])
    );

    /*
    |--------------------------------------------------------------------------
    | Construir respuesta compatible con el componente actual
    |--------------------------------------------------------------------------
    */

    const participaciones = base.map((item) => {
      const drop =
        dropsMap.get(String(item.free_drop_id)) || null;

      const ticket =
        ticketsMap.get(String(item.ticket_id)) || null;

      const nombreCompleto = getNombreCompleto(item);

      const numeroTicket = getNumeroTicket({
        tickets: ticket,
      });

      return {
        ...item,

        free_drops: drop,
        tickets: ticket,

        nombreCompleto,

        freeDropLabel: getDropLabel(drop),

        numeroTicket:
          numeroTicket != null
            ? Number(numeroTicket)
            : null,

        estadoVisual: estadoLabel(item.estado),
      };
    });

    /*
    |--------------------------------------------------------------------------
    | Filtros
    |--------------------------------------------------------------------------
    */

    let participacionesFiltradas = [
      ...participaciones,
    ];

    if (dropId) {
      participacionesFiltradas =
        participacionesFiltradas.filter(
          (item) =>
            String(item.free_drop_id) ===
            String(dropId)
        );
    }

    if (estado) {
      participacionesFiltradas =
        participacionesFiltradas.filter(
          (item) =>
            normalizarEstado(item.estado) ===
            normalizarEstado(estado)
        );
    }

    if (q) {
      participacionesFiltradas =
        participacionesFiltradas.filter(
          (item) => {
            const nombreCompleto = String(
              item.nombreCompleto || ""
            ).toLowerCase();

            const email = String(
              item.email || ""
            ).toLowerCase();

            const telefono = String(
              item.telefono || ""
            ).toLowerCase();

            const codigo = String(
              item.codigo_unico || ""
            ).toLowerCase();

            const numero = String(
              item.numeroTicket || ""
            ).toLowerCase();

            const dropLabel = String(
              item.freeDropLabel || ""
            ).toLowerCase();

            return (
              nombreCompleto.includes(q) ||
              email.includes(q) ||
              telefono.includes(q) ||
              codigo.includes(q) ||
              numero.includes(q) ||
              dropLabel.includes(q)
            );
          }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Resumen
    |--------------------------------------------------------------------------
    */

    const resumen =
      participacionesFiltradas.reduce(
        (acc, item) => {
          acc.total += 1;

          const key =
            estadoResumenKey(item.estado);

          if (key) {
            acc[key] += 1;
          }

          return acc;
        },
        {
          total: 0,
          valida: 0,
          pendiente: 0,
          rechazada: 0,
          anulada: 0,
        }
      );

    /*
    |--------------------------------------------------------------------------
    | Alias para compatibilidad con la UI anterior
    |--------------------------------------------------------------------------
    */

    resumen.activos = resumen.valida;
    resumen.pendientes = resumen.pendiente;
    resumen.rechazados = resumen.rechazada;
    resumen.anulados = resumen.anulada;

    /*
    |--------------------------------------------------------------------------
    | Drops con cantidad histórica de participaciones
    |--------------------------------------------------------------------------
    |
    | IMPORTANTE:
    | participaciones_count cuenta participaciones registradas,
    | incluyendo las anuladas/rechazadas, porque forman parte del historial.
    |
    */

    const dropsConConteo = dropsBase.map(
      (drop) => {
        const count = participaciones.reduce(
          (acc, item) => {
            if (
              String(item.free_drop_id) ===
              String(drop.id)
            ) {
              return acc + 1;
            }

            return acc;
          },
          0
        );

        return {
          ...drop,

          estado: normalizarEstado(
            drop.estado
          ),

          estado_label: estadoLabel(
            drop.estado
          ),

          participaciones_count: count,
        };
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Respuesta
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      ok: true,
      participaciones:
        participacionesFiltradas,
      resumen,
      drops: dropsConConteo,
    });
  } catch (error) {
    console.error(
      "Error en GET admin free drop participations:",
      error
    );

    return responderError(
      error.message ||
        "Error inesperado al cargar participaciones",
      500
    );
  }
}

/*
|--------------------------------------------------------------------------
| PATCH
|--------------------------------------------------------------------------
|
| Acciones disponibles:
|
| - aprobar
| - rechazar
| - anular
|
| IMPORTANTE:
| Ya NO modificamos participación, ticket, drop y settings desde JavaScript
| mediante varios UPDATE independientes.
|
| Toda la operación se realiza dentro de:
|
| public.admin_update_free_drop_participation(...)
|
| PostgreSQL maneja la operación como una sola transacción.
|
*/

export async function PATCH(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  try {
    const supabase =
      getSupabaseServerClient();

    const body = await req.json();

    const participationId = limpiarTexto(
      body.participationId || body.id
    );

    const rifaId = limpiarTexto(
      body.rifaId
    );

    const action = normalizarEstado(
      body.action
    );

    /*
    |--------------------------------------------------------------------------
    | Validaciones básicas
    |--------------------------------------------------------------------------
    */

    if (!participationId) {
      return responderError(
        "participationId es requerido",
        400
      );
    }

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    if (
      ![
        "aprobar",
        "rechazar",
        "anular",
      ].includes(action)
    ) {
      return responderError(
        "Acción no válida",
        400
      );
    }

    /*
    |--------------------------------------------------------------------------
    | participationId es BIGINT en PostgreSQL
    |--------------------------------------------------------------------------
    |
    | Actualmente tus IDs están dentro del rango seguro de JavaScript.
    | Validamos que llegue un entero positivo antes de llamar al RPC.
    |
    */

    const participationIdNumber =
      Number(participationId);

    if (
      !Number.isSafeInteger(
        participationIdNumber
      ) ||
      participationIdNumber <= 0
    ) {
      return responderError(
        "participationId no es válido",
        400
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RPC TRANSACCIONAL
    |--------------------------------------------------------------------------
    |
    | El RPC:
    |
    | 1. bloquea participación
    | 2. bloquea Drop
    | 3. bloquea settings
    | 4. bloquea ticket
    | 5. verifica que no exista compra_id
    | 6. verifica referencias FREE
    | 7. ejecuta la acción completa
    | 8. hace rollback automático si algo falla
    |
    */

    const {
      data: resultado,
      error: rpcError,
    } = await supabase.rpc(
      "admin_update_free_drop_participation",
      {
        p_participation_id:
          participationIdNumber,

        p_rifa_id:
          rifaId,

        p_action:
          action,
      }
    );
    /*
|--------------------------------------------------------------------------
| DATOS PREVIOS PARA CORREO DE ANULACIÓN
|--------------------------------------------------------------------------
|
| Cuando anulamos, el RPC puede liberar el ticket.
| Guardamos aquí los datos necesarios ANTES de ejecutar la anulación.
|
*/

let datosPreviosAnulacion = null;

if (action === "anular") {
  try {
    const {
      data: participacionPrevia,
      error: participacionPreviaError,
    } = await supabase
      .from("free_drop_participations")
      .select(`
        id,
        rifa_id,
        free_drop_id,
        ticket_id,
        nombre,
        apellido,
        email,
        codigo_unico,
        estado,
        created_at,
        updated_at
      `)
      .eq("id", participationIdNumber)
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (participacionPreviaError) {
      throw participacionPreviaError;
    }

    if (participacionPrevia) {
      let ticketPrevio = null;
      let dropPrevio = null;
      let rifaPrevia = null;

      if (participacionPrevia.ticket_id) {
        const { data } = await supabase
          .from("tickets")
          .select(`
            id,
            numero_ticket,
            estado,
            tipo
          `)
          .eq("id", participacionPrevia.ticket_id)
          .maybeSingle();

        ticketPrevio = data || null;
      }

      if (participacionPrevia.free_drop_id) {
        const { data } = await supabase
          .from("free_drops")
          .select(`
            id,
            nombre,
            numero_drop
          `)
          .eq("id", participacionPrevia.free_drop_id)
          .maybeSingle();

        dropPrevio = data || null;
      }

      const { data } = await supabase
        .from("rifas")
        .select(`
          id,
          nombre,
          formato
        `)
        .eq("id", rifaId)
        .maybeSingle();

      rifaPrevia = data || null;

      datosPreviosAnulacion = {
        participacion: participacionPrevia,
        ticket: ticketPrevio,
        drop: dropPrevio,
        rifa: rifaPrevia,
      };
    }
  } catch (errorDatosPrevios) {
    console.error(
      "No se pudieron preparar los datos del correo de anulación FREE:",
      errorDatosPrevios
    );

    /*
     * NO detenemos la anulación.
     * El correo es secundario respecto a la operación administrativa.
     */
  }
}

    /*
    |--------------------------------------------------------------------------
    | Error del RPC
    |--------------------------------------------------------------------------
    */

    if (rpcError) {
      console.error(
        "Error ejecutando admin_update_free_drop_participation:",
        {
          participationId:
            participationIdNumber,
          rifaId,
          action,
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
        }
      );

      const mappedError =
        getRpcErrorResponse(rpcError);

      return responderError(
        mappedError.message,
        mappedError.status
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Protección adicional
    |--------------------------------------------------------------------------
    |
    | Nuestra función devuelve un JSON con ok:true.
    | Si por alguna razón no llega ese resultado, no reportamos éxito.
    |
    */

    if (
      !resultado ||
      resultado.ok !== true
    ) {
      console.error(
        "Respuesta inesperada del RPC admin_update_free_drop_participation:",
        resultado
      );

      return responderError(
        "La operación FREE no devolvió una respuesta válida",
        500
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Mensaje para la UI
    |--------------------------------------------------------------------------
    */

let message =
  "Participación actualizada correctamente";

let emailEnviado = null;
let emailError = null;

/*
|--------------------------------------------------------------------------
| APROBAR
|--------------------------------------------------------------------------
|
| El RPC ya terminó correctamente antes de llegar aquí.
|
| Ahora:
| 1. cargamos la participación ya aprobada
| 2. obtenemos el ticket REAL que acaba de asignarse
| 3. cargamos FREE DROP + rifa
| 4. enviamos el correo de confirmación
|
| IMPORTANTE:
| Si el correo falla, NO deshacemos la aprobación.
| La participación y el número asignado siguen siendo válidos.
|
*/

if (action === "aprobar") {
  message =
    "Participación aprobada correctamente";

  try {
    /*
    |--------------------------------------------------------------------------
    | Participación aprobada
    |--------------------------------------------------------------------------
    */

    const {
      data: participacionAprobada,
      error: participacionError,
    } = await supabase
      .from("free_drop_participations")
      .select(`
        id,
        rifa_id,
        free_drop_id,
        ticket_id,
        nombre,
        apellido,
        email,
        telefono,
        codigo_unico,
        estado,
        created_at,
        updated_at
      `)
      .eq("id", participationIdNumber)
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (participacionError) {
      throw new Error(
        participacionError.message ||
          "No se pudo cargar la participación aprobada"
      );
    }

    if (!participacionAprobada) {
      throw new Error(
        "No se encontró la participación después de aprobarla"
      );
    }

    if (!participacionAprobada.ticket_id) {
      throw new Error(
        "La participación fue aprobada pero no tiene un ticket asignado"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Ticket REAL asignado por el RPC
    |--------------------------------------------------------------------------
    */

    const {
      data: ticketAsignado,
      error: ticketError,
    } = await supabase
      .from("tickets")
      .select(`
        id,
        numero_ticket,
        estado,
        tipo
      `)
      .eq("id", participacionAprobada.ticket_id)
      .maybeSingle();

    if (ticketError) {
      throw new Error(
        ticketError.message ||
          "No se pudo cargar el ticket asignado"
      );
    }

    if (!ticketAsignado) {
      throw new Error(
        "No se encontró el ticket asignado a la participación"
      );
    }

    if (
      ticketAsignado.numero_ticket === null ||
      ticketAsignado.numero_ticket === undefined
    ) {
      throw new Error(
        "El ticket asignado no tiene número"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FREE DROP
    |--------------------------------------------------------------------------
    */

    const {
      data: dropAprobado,
      error: dropError,
    } = await supabase
      .from("free_drops")
      .select(`
        id,
        rifa_id,
        nombre,
        numero_drop
      `)
      .eq("id", participacionAprobada.free_drop_id)
      .maybeSingle();

    if (dropError) {
      throw new Error(
        dropError.message ||
          "No se pudo cargar el FREE DROP"
      );
    }

    if (!dropAprobado) {
      throw new Error(
        "No se encontró el FREE DROP de la participación"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Rifa / Evento
    |--------------------------------------------------------------------------
    */

    const {
      data: rifaAprobada,
      error: rifaError,
    } = await supabase
      .from("rifas")
      .select(`
        id,
        nombre,
        formato
      `)
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      throw new Error(
        rifaError.message ||
          "No se pudo cargar la rifa"
      );
    }

    if (!rifaAprobada) {
      throw new Error(
        "No se encontró la rifa de la participación"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Datos para el correo
    |--------------------------------------------------------------------------
    */

    const nombreCompleto = [
      limpiarTexto(participacionAprobada.nombre),
      limpiarTexto(participacionAprobada.apellido),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const freeDropNombre =
      limpiarTexto(dropAprobado.nombre) ||
      `FREE DROP #${dropAprobado.numero_drop || ""}`;

    const eventoNombre =
      limpiarTexto(rifaAprobada.nombre) ||
      "Evento";

    const padLength =
      rifaAprobada.formato === "3digitos"
        ? 3
        : 4;

    /*
    |--------------------------------------------------------------------------
    | URLs
    |--------------------------------------------------------------------------
    */

    const envBase =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.VERCEL_URL ||
      "";

    let baseUrl =
      limpiarTexto(envBase);

    if (!baseUrl) {
      baseUrl =
        limpiarTexto(
          req.headers.get("origin")
        );
    }

    if (
      baseUrl &&
      !/^https?:\/\//i.test(baseUrl)
    ) {
      baseUrl =
        `https://${baseUrl}`;
    }

    try {
      baseUrl =
        baseUrl
          ? new URL(baseUrl).origin
          : "";
    } catch {
      baseUrl = "";
    }

    const verificarUrl =
      baseUrl
        ? `${baseUrl}/principal`
        : "/principal";

    const eventoUrl =
      baseUrl
        ? `${baseUrl}/evento/${rifaId}`
        : `/evento/${rifaId}`;

    /*
    |--------------------------------------------------------------------------
    | Enviar correo
    |--------------------------------------------------------------------------
    */

    await sendFreeDropConfirmationEmail({
      to: participacionAprobada.email,

      nombre:
        nombreCompleto ||
        participacionAprobada.nombre ||
        "cliente",

      eventoNombre,

      freeDropNombre,

      numeroParticipacion:
        ticketAsignado.numero_ticket,

      codigoFree:
        participacionAprobada.codigo_unico,

      estado: "VÁLIDA",

      fechaIso:
        participacionAprobada.updated_at ||
        participacionAprobada.created_at ||
        new Date().toISOString(),

      verificarUrl,

      eventoUrl,

      padLength,
    });

    emailEnviado = true;

    console.log(
      "Correo FREE de aprobación enviado:",
      {
        participationId:
          participationIdNumber,

        email:
          participacionAprobada.email,

        codigoFree:
          participacionAprobada.codigo_unico,

        numeroTicket:
          ticketAsignado.numero_ticket,
      }
    );
  } catch (errorCorreo) {
    /*
    |--------------------------------------------------------------------------
    | MUY IMPORTANTE
    |--------------------------------------------------------------------------
    |
    | Llegar aquí NO significa que la aprobación falló.
    |
    | El RPC ya confirmó la participación y asignó el ticket.
    | Solamente falló el correo o la carga de datos para el correo.
    |
    */

    emailEnviado = false;

    emailError =
      errorCorreo?.message ||
      "No se pudo enviar el correo de aprobación";

    console.error(
      "La participación FREE fue aprobada, pero el correo no pudo enviarse:",
      {
        participationId:
          participationIdNumber,

        rifaId,

        error:
          errorCorreo,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| RECHAZAR
|--------------------------------------------------------------------------
*/

if (action === "rechazar") {
  message =
    "Participación rechazada correctamente";
}

/*
|--------------------------------------------------------------------------
| ANULAR
|--------------------------------------------------------------------------
*/

if (action === "anular") {
  message =
    "Participación anulada correctamente";

  try {
    const participacion =
      datosPreviosAnulacion?.participacion || null;

    const ticket =
      datosPreviosAnulacion?.ticket || null;

    const drop =
      datosPreviosAnulacion?.drop || null;

    const rifa =
      datosPreviosAnulacion?.rifa || null;

    if (!participacion) {
      throw new Error(
        "No se pudieron recuperar los datos previos de la participación"
      );
    }

    if (!participacion.email) {
      throw new Error(
        "La participación no tiene correo electrónico"
      );
    }

    const nombreCompleto = [
      limpiarTexto(participacion.nombre),
      limpiarTexto(participacion.apellido),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const freeDropNombre =
      limpiarTexto(drop?.nombre) ||
      `FREE DROP #${drop?.numero_drop || ""}`;

    const eventoNombre =
      limpiarTexto(rifa?.nombre) ||
      "Evento";

    const padLength =
      rifa?.formato === "3digitos"
        ? 3
        : 4;

    /*
    |--------------------------------------------------------------------------
    | URLs
    |--------------------------------------------------------------------------
    */

    const envBase =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.VERCEL_URL ||
      "";

    let baseUrl =
      limpiarTexto(envBase);

    if (!baseUrl) {
      baseUrl =
        limpiarTexto(
          req.headers.get("origin")
        );
    }

    if (
      baseUrl &&
      !/^https?:\/\//i.test(baseUrl)
    ) {
      baseUrl =
        `https://${baseUrl}`;
    }

    try {
      baseUrl =
        baseUrl
          ? new URL(baseUrl).origin
          : "";
    } catch {
      baseUrl = "";
    }

    const verificarUrl =
      baseUrl
        ? `${baseUrl}/principal`
        : "/principal";

    const eventoUrl =
      baseUrl
        ? `${baseUrl}/evento/${rifaId}`
        : `/evento/${rifaId}`;

    /*
    |--------------------------------------------------------------------------
    | CORREO DE ANULACIÓN
    |--------------------------------------------------------------------------
    |
    | IMPORTANTE:
    | El RPC ya terminó correctamente.
    | Si el correo falla, NO revertimos la anulación.
    |
    */

    await sendFreeDropCancellationEmail({
      to: participacion.email,

      nombre:
        nombreCompleto ||
        participacion.nombre ||
        "cliente",

      eventoNombre,

      freeDropNombre,

      numeroParticipacion:
        ticket?.numero_ticket ?? null,

      codigoFree:
        participacion.codigo_unico || "",

      fechaIso:
        new Date().toISOString(),

      verificarUrl,

      eventoUrl,

      padLength,
    });

    emailEnviado = true;

    console.log(
      "Correo FREE de anulación enviado:",
      {
        participationId:
          participationIdNumber,

        email:
          participacion.email,

        codigoFree:
          participacion.codigo_unico,

        numeroTicket:
          ticket?.numero_ticket ?? null,
      }
    );
  } catch (errorCorreo) {
    emailEnviado = false;

    emailError =
      errorCorreo?.message ||
      "No se pudo enviar el correo de anulación";

    console.error(
      "La participación FREE fue anulada, pero el correo no pudo enviarse:",
      {
        participationId:
          participationIdNumber,

        rifaId,

        error:
          errorCorreo,
      }
    );
  }
}

    /*
    |--------------------------------------------------------------------------
    | Respuesta
    |--------------------------------------------------------------------------
    |
    | Conservamos:
    |
    | {
    |   ok: true,
    |   message: "..."
    | }
    |
    | que ya utiliza tu componente.
    |
    | También enviamos resultado para tener disponible la información
    | transaccional sin romper la compatibilidad existente.
    |
    */

return NextResponse.json({
  ok: true,
  message,
  resultado,

email_enviado:
  ["aprobar", "anular"].includes(action)
    ? emailEnviado
    : null,

email_error:
  ["aprobar", "anular"].includes(action) &&
  emailEnviado === false
    ? emailError
    : null,
});
  } catch (error) {
    console.error(
      "Error en PATCH admin free drop participations:",
      error
    );

    return responderError(
      "Error inesperado al actualizar la participación",
      500
    );
  }
}