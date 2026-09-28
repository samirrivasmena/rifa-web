import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "../../../lib/requireAdmin";

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

function estadoLabel(estado) {
  const value = normalizarEstado(estado);

  const labels = {
    borrador: "Borrador",
    programado: "Programado",
    pendiente: "Pendiente",
    activo: "Activo",
    pausado: "Pausado",
    agotado: "Agotado",
    cerrado: "Cerrado",
    archivado: "Archivado",
  };

  return labels[value] || estado || "Sin estado";
}

function esParticipacionValida(estado) {
  const value = normalizarEstado(estado);

  return [
    "activo",
    "activa",
    "valida",
    "válida",
    "approved",
    "aprobado",
    "aprobada",
  ].includes(value);
}

function estadoValidoParaCrear(estado) {
  return [
    "borrador",
    "programado",
    "pendiente",
    "activo",
    "pausado",
    "agotado",
    "cerrado",
    "archivado",
  ].includes(normalizarEstado(estado));
}

function parsearFechaProgramada(valor) {
  const texto = limpiarTexto(valor);

  if (!texto) return null;

  const fecha = new Date(texto);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha;
}

async function obtenerSettingsDelEvento(supabase, rifaId) {
  const { data, error } = await supabase
    .from("free_drop_settings")
    .select("total_free_allowed, enabled")
    .eq("rifa_id", rifaId)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

async function obtenerTotalReservado(
  supabase,
  rifaId,
  excludeId = null
) {
  let query = supabase
    .from("free_drops")
    .select("id, cupos_total, cupos_usados, estado")
    .eq("rifa_id", rifaId);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (Array.isArray(data) ? data : []).reduce(
    (acc, item) => {
      const estado = normalizarEstado(item.estado);

      const cuposTotal = Math.max(
        Number(item.cupos_total || 0),
        0
      );

      const cuposUsados = Math.max(
        Number(item.cupos_usados || 0),
        0
      );

      if (
        estado === "cerrado" ||
        estado === "archivado"
      ) {
        return acc + Math.min(cuposUsados, cuposTotal);
      }

      return acc + cuposTotal;
    },
    0
  );
}

async function obtenerParticipacionesCountPorDrop(
  supabase,
  rifaId
) {
  const { data, error } = await supabase
    .from("free_drop_participations")
    .select("id, free_drop_id, estado")
    .eq("rifa_id", rifaId);

  if (error) throw error;

  const totalPorDrop = {};
  const validasPorDrop = {};

  (Array.isArray(data) ? data : []).forEach((item) => {
    const key = String(item.free_drop_id);

    totalPorDrop[key] = (totalPorDrop[key] || 0) + 1;

    if (esParticipacionValida(item.estado)) {
      validasPorDrop[key] = (validasPorDrop[key] || 0) + 1;
    }
  });

  return {
    totalPorDrop,
    validasPorDrop,
  };
}

// ============================================================
// AUDIT LOG
// ============================================================

async function registrarAuditoriaFreeDrop(
  supabase,
  {
    rifaId,
    dropId = null,
    action,
    previousState = null,
    newState = null,
    details = {},
    actorType = "admin",
    actorIdentifier = "admin",
  }
) {
  try {
    const { error } = await supabase
      .from("free_drop_audit_logs")
      .insert({
        rifa_id: rifaId,
        free_drop_id: dropId,
        participation_id: null,
        ticket_id: null,
        action,
        entity_type: "free_drop",
        actor_type: actorType,
        actor_identifier: actorIdentifier,
        previous_state: previousState,
        new_state: newState,
        details: details || {},
      });

    if (error) {
      console.error(
        `Error registrando Audit Log ${action}:`,
        error
      );
    }
  } catch (error) {
    /*
     * El Audit Log no debe convertir una operación de negocio
     * ya completada en un falso error para el administrador.
     * Registramos el fallo en servidor y preservamos la acción.
     */
    console.error(
      `Error inesperado registrando Audit Log ${action}:`,
      error
    );
  }
}

// ============================================================
// GET
// ============================================================

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { searchParams } = new URL(req.url);
    const rifaId = limpiarTexto(searchParams.get("rifaId"));

    if (!rifaId) {
      return responderError("rifaId es requerido", 400);
    }

    const { data: drops, error: errorDrops } = await supabase
      .from("free_drops")
      .select("*")
      .eq("rifa_id", rifaId)
      .order("numero_drop", { ascending: true });

    if (errorDrops) {
      console.error(
        "Error cargando free drops:",
        errorDrops
      );

      return responderError(
        "No se pudieron cargar los free drops",
        500
      );
    }

    const {
      totalPorDrop,
      validasPorDrop,
    } = await obtenerParticipacionesCountPorDrop(
      supabase,
      rifaId
    );

    const dropsEnriquecidos = (
      Array.isArray(drops) ? drops : []
    ).map((drop) => {
      const cuposTotal = Number(drop.cupos_total || 0);

      const cuposUsados = Math.max(
        Number(drop.cupos_usados || 0),
        0
      );

      const cuposDisponibles = Math.max(
        cuposTotal - cuposUsados,
        0
      );

      const participacionesValidas =
        validasPorDrop[String(drop.id)] || 0;

      const participacionesTotal =
        totalPorDrop[String(drop.id)] || 0;

      return {
        ...drop,

        estado: normalizarEstado(drop.estado),
        estado_label: estadoLabel(drop.estado),

        cupos_usados: cuposUsados,
        cupos_disponibles: cuposDisponibles,

        participaciones_count: participacionesValidas,
        participaciones_total: participacionesTotal,
      };
    });

    const summary = dropsEnriquecidos.reduce(
      (acc, drop) => {
        const estado = normalizarEstado(drop.estado);

        acc.totalDrops += 1;

        acc.totalReservado += Number(
          drop.cupos_total || 0
        );

        acc.totalUsados += Number(
          drop.cupos_usados || 0
        );

        acc.totalDisponibles += Number(
          drop.cupos_disponibles || 0
        );

        acc.participaciones += Number(
          drop.participaciones_count || 0
        );

        acc.participacionesHistoricas += Number(
          drop.participaciones_total || 0
        );

        if (estado === "borrador") {
          acc.borradores += 1;
        }

        if (estado === "programado") {
          acc.programados += 1;
        }

        if (estado === "pendiente") {
          acc.pendientes += 1;
        }

        if (estado === "activo") {
          acc.activos += 1;
        }

        if (estado === "pausado") {
          acc.pausados += 1;
        }

        if (estado === "agotado") {
          acc.agotados += 1;
        }

        if (estado === "cerrado") {
          acc.cerrados += 1;
        }

        if (estado === "archivado") {
          acc.archivados += 1;
        }

        return acc;
      },
      {
        totalDrops: 0,
        totalReservado: 0,
        totalUsados: 0,
        totalDisponibles: 0,
        participaciones: 0,
        participacionesHistoricas: 0,
        borradores: 0,
        programados: 0,
        pendientes: 0,
        activos: 0,
        pausados: 0,
        agotados: 0,
        cerrados: 0,
        archivados: 0,
      }
    );

    return NextResponse.json({
      ok: true,
      drops: dropsEnriquecidos,
      summary,
    });
  } catch (error) {
    console.error(
      "Error en GET admin free drops:",
      error
    );

    return responderError(
      "Error inesperado al cargar free drops",
      500
    );
  }
}

// ============================================================
// POST
// ============================================================

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const body = await req.json();

    const rifaId = limpiarTexto(body.rifaId);

    const nombre = limpiarTexto(body.nombre);

    const cuposTotal = Math.floor(
      Number(
        body.cuposTotal ||
          body.cupos_total ||
          0
      )
    );

    const estadoSolicitado = estadoValidoParaCrear(body.estado)
      ? normalizarEstado(body.estado)
      : "pendiente";

    const fechaProgramada = parsearFechaProgramada(
      body.fechaInicio || body.fecha_inicio
    );

    // ========================================================
    // VALIDACIONES BÁSICAS
    // ========================================================

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    if (
      !Number.isFinite(cuposTotal) ||
      cuposTotal < 1
    ) {
      return responderError(
        "cuposTotal debe ser mayor a 0",
        400
      );
    }

    // ========================================================
    // VALIDACIÓN DE PROGRAMADO
    // ========================================================
    //
    // Conservamos exactamente la validación que ya tenía
    // el Admin para mantener los mismos mensajes al usuario.
    //
    // PostgreSQL vuelve a validar esta condición dentro de
    // admin_create_free_drop para evitar carreras.
    // ========================================================

    if (estadoSolicitado === "programado") {
      if (!fechaProgramada) {
        return responderError(
          "Debes indicar una fecha y hora válida para el free drop programado",
          400
        );
      }

      if (fechaProgramada.getTime() <= Date.now()) {
        return responderError(
          "La fecha y hora programada debe estar en el futuro",
          400
        );
      }
    }

    // ========================================================
    // CREACIÓN TRANSACCIONAL
    // ========================================================
    //
    // admin_create_free_drop realiza dentro de UNA SOLA
    // transacción PostgreSQL:
    //
    // - bloqueo de la configuración FREE;
    // - bloqueo de los Drops del evento;
    // - validación de total_free_allowed;
    // - cálculo de numero_drop;
    // - creación del Drop;
    // - DROP_CREATED;
    //
    // Y cuando se solicita ACTIVO:
    //
    // - crea inicialmente como PENDIENTE;
    // - cierra el Drop activo anterior;
    // - DROP_AUTO_CLOSED;
    // - activa el nuevo Drop;
    // - DROP_ACTIVATED.
    //
    // Si cualquiera de esas operaciones falla,
    // PostgreSQL revierte TODO.
    //
    // Ya no existe rollback compensatorio en JavaScript.
    // ========================================================

    const {
      data: resultadoCrear,
      error: errorCrear,
    } = await supabase.rpc(
      "admin_create_free_drop",
      {
        p_rifa_id: rifaId,

        p_nombre:
          nombre || null,

        p_cupos_total:
          cuposTotal,

        p_estado:
          estadoSolicitado,

        p_fecha_inicio:
          estadoSolicitado === "programado"
            ? fechaProgramada.toISOString()
            : null,

        p_actor_type:
          "admin",

        p_actor_identifier:
          "admin",
      }
    );

    // ========================================================
    // ERRORES DE LA RPC
    // ========================================================

    if (errorCrear) {
      console.error(
        "Error creando free drop mediante RPC transaccional:",
        errorCrear
      );

      const mensajeRpc = String(
        errorCrear?.message || ""
      );

      if (
        mensajeRpc.includes(
          "RIFA_ID_REQUIRED"
        )
      ) {
        return responderError(
          "rifaId es requerido",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_INVALID_CAPACITY"
        )
      ) {
        return responderError(
          "cuposTotal debe ser mayor a 0",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_SCHEDULE_REQUIRED"
        )
      ) {
        return responderError(
          "Debes indicar una fecha y hora válida para el free drop programado",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_SCHEDULE_MUST_BE_FUTURE"
        )
      ) {
        return responderError(
          "La fecha y hora programada debe estar en el futuro",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_SETTINGS_NOT_FOUND"
        )
      ) {
        return responderError(
          "Primero debes configurar FREE TICKETS para este evento",
          409
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_TOTAL_NOT_CONFIGURED"
        )
      ) {
        return responderError(
          "El total FREE permitido debe ser mayor a 0",
          409
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_TOTAL_LIMIT_EXCEEDED"
        )
      ) {
        return responderError(
          "No puedes crear este Drop porque excedería el máximo de cupos FREE permitido para este evento.",
          409
        );
      }

      return responderError(
        "No se pudo crear el free drop",
        500
      );
    }

    // ========================================================
    // VALIDAR RESPUESTA
    // ========================================================

    const dropCreado =
      resultadoCrear?.drop || null;

    if (
      !resultadoCrear?.ok ||
      !dropCreado
    ) {
      console.error(
        "admin_create_free_drop no devolvió un resultado válido:",
        resultadoCrear
      );

      return responderError(
        "El free drop fue procesado pero no se recibió el resultado esperado",
        500
      );
    }

    // ========================================================
    // RESPUESTA FINAL
    // ========================================================

    if (estadoSolicitado === "activo") {
      return NextResponse.json({
        ok: true,

        drop:
          dropCreado,

        resultado:
          resultadoCrear,

        message:
          "Free drop creado y activado correctamente",
      });
    }

    return NextResponse.json({
      ok: true,

      drop:
        dropCreado,

      resultado:
        resultadoCrear,

      message:
        estadoSolicitado === "programado"
          ? "Free drop programado correctamente"
          : "Free drop creado correctamente",
    });
  } catch (error) {
    console.error(
      "Error en POST admin free drops:",
      error
    );

    return responderError(
      "Error inesperado al crear el free drop",
      500
    );
  }
}

// ============================================================
// DELETE
// ============================================================

export async function DELETE(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { searchParams } = new URL(req.url);

    const dropId = Number(
      searchParams.get("dropId")
    );

    const rifaId = limpiarTexto(
      searchParams.get("rifaId")
    );

    if (!Number.isFinite(dropId) || dropId <= 0) {
      return responderError(
        "dropId inválido",
        400
      );
    }

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    /*
     * ============================================================
     * ELIMINACIÓN TRANSACCIONAL
     * ============================================================
     *
     * La RPC admin_mutate_free_drop:
     *
     * - bloquea el Drop;
     * - comprueba que exista;
     * - comprueba que no tenga participaciones;
     * - elimina físicamente el Drop;
     * - registra DROP_DELETED;
     * - y hace todo dentro de UNA MISMA transacción.
     *
     * Si falla el Audit Log, también se revierte el DELETE.
     * Si falla el DELETE, tampoco queda una auditoría falsa.
     * ============================================================
     */

    const {
      data: resultado,
      error: errorEliminar,
    } = await supabase.rpc(
      "admin_mutate_free_drop",
      {
        p_action: "eliminar",
        p_drop_id: dropId,
        p_rifa_id: rifaId,
        p_nombre: null,
        p_cupos_total: null,
        p_fecha_inicio: null,
        p_actor_type: "admin",
        p_actor_identifier: "admin",
      }
    );

    if (errorEliminar) {
      console.error(
        "Error eliminando free drop mediante RPC transaccional:",
        errorEliminar
      );

      const mensajeRpc = String(
        errorEliminar?.message || ""
      );

      if (
        mensajeRpc.includes(
          "FREE_DROP_NOT_FOUND"
        )
      ) {
        return responderError(
          "El free drop no existe",
          404
        );
      }

if (
  mensajeRpc.includes(
    "FREE_DROP_HAS_PARTICIPATIONS"
  )
) {
  return responderError(
    "No se puede eliminar este Free Drop. Este Drop tiene historial de participaciones, aunque actualmente tenga 0 participaciones válidas. Para conservar el historial y la auditoría, puedes cerrarlo o archivarlo.",
    409
  );
}

      if (
        mensajeRpc.includes(
          "FREE_DROP_INVALID_ID"
        )
      ) {
        return responderError(
          "dropId inválido",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "RIFA_ID_REQUIRED"
        )
      ) {
        return responderError(
          "rifaId es requerido",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_DELETE_FAILED"
        )
      ) {
        return responderError(
          "No se pudo eliminar el free drop",
          500
        );
      }

      return responderError(
        "No se pudo eliminar el free drop",
        500
      );
    }

    if (!resultado?.ok) {
      console.error(
        "La RPC de eliminación no devolvió un resultado válido:",
        resultado
      );

      return responderError(
        "No se pudo eliminar el free drop",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Free drop eliminado",
    });
  } catch (error) {
    console.error(
      "Error en DELETE admin free drops:",
      error
    );

    return responderError(
      "Error inesperado al eliminar el free drop",
      500
    );
  }
}

// ============================================================
// PATCH
// ============================================================

export async function PATCH(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const body = await req.json();

    const action = normalizarEstado(
      body.action
    );

    const rifaId = limpiarTexto(
      body.rifaId
    );

    const dropId = Number(
      body.dropId ||
        body.id ||
        0
    );

    const ahora = new Date().toISOString();

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    // =====================================================
    // HELPER LOCAL — ERRORES RPC TRANSACCIONAL
    // =====================================================

    function responderErrorRpcMutacion(
      error,
      accion
    ) {
      const mensajeRpc = String(
        error?.message || ""
      );

      if (
        mensajeRpc.includes(
          "FREE_DROP_NOT_FOUND"
        )
      ) {
        return responderError(
          "El free drop no existe",
          404
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_INVALID_ID"
        )
      ) {
        return responderError(
          "dropId inválido",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "RIFA_ID_REQUIRED"
        )
      ) {
        return responderError(
          "rifaId es requerido",
          400
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_INVALID_CAPACITY"
        )
      ) {
        return responderError(
          "El free drop no tiene una capacidad válida",
          409
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_CAPACITY_BELOW_USED"
        )
      ) {
        return responderError(
          "No puedes reducir la capacidad por debajo de los cupos ya ocupados.",
          409
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_SETTINGS_NOT_FOUND"
        )
      ) {
        return responderError(
          "No existe configuración FREE para este evento",
          409
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_TOTAL_LIMIT_EXCEEDED"
        )
      ) {
        return responderError(
          "La nueva capacidad supera el total FREE permitido.",
          409
        );
      }

      if (
        mensajeRpc.includes(
          "FREE_DROP_SCHEDULE_MUST_BE_FUTURE"
        )
      ) {
        return responderError(
          "La fecha y hora programada debe estar en el futuro",
          400
        );
      }

      console.error(
        `Error RPC transaccional (${accion}):`,
        error
      );

      return responderError(
        `No se pudo completar la acción ${accion}`,
        500
      );
    }

    // =====================================================
    // EDITAR
    // =====================================================

    if (action === "editar") {
      if (
        !Number.isFinite(dropId) ||
        dropId <= 0
      ) {
        return responderError(
          "dropId inválido",
          400
        );
      }

      /*
       * Conservamos las validaciones que ya tenías
       * para mantener los mismos mensajes del Admin.
       *
       * La RPC vuelve a validar lo crítico dentro
       * de PostgreSQL para que la operación final
       * sea transaccional.
       */

      const {
        data: dropActual,
        error: errorDrop,
      } = await supabase
        .from("free_drops")
        .select("*")
        .eq("id", dropId)
        .eq("rifa_id", rifaId)
        .maybeSingle();

      if (errorDrop) {
        console.error(
          "Error cargando drop para editar:",
          errorDrop
        );

        return responderError(
          "No se pudo cargar el free drop",
          500
        );
      }

      if (!dropActual) {
        return responderError(
          "El free drop no existe",
          404
        );
      }

      const nombre = limpiarTexto(
        body.nombre ??
          dropActual.nombre
      );

      const cuposTotal = Math.floor(
        Number(
          body.cuposTotal ??
            body.cupos_total ??
            dropActual.cupos_total
        )
      );

      if (
        !Number.isFinite(cuposTotal) ||
        cuposTotal < 1
      ) {
        return responderError(
          "cuposTotal debe ser mayor a 0",
          400
        );
      }

      const cuposUsados = Math.max(
        Number(
          dropActual.cupos_usados || 0
        ),
        0
      );

      if (cuposTotal < cuposUsados) {
        return responderError(
          `No puedes reducir la capacidad a ${cuposTotal} porque este Drop ya tiene ${cuposUsados} cupos ocupados.`,
          409
        );
      }

      const totalReservado =
        await obtenerTotalReservado(
          supabase,
          rifaId,
          dropId
        );

      const settings =
        await obtenerSettingsDelEvento(
          supabase,
          rifaId
        );

      if (!settings) {
        return responderError(
          "No existe configuración FREE para este evento",
          409
        );
      }

      const totalPermitido = Number(
        settings.total_free_allowed || 0
      );

      const estadoActual =
        normalizarEstado(
          dropActual.estado
        );

      const capacidadEditadaComprometida =
        estadoActual === "cerrado" ||
        estadoActual === "archivado"
          ? Math.min(
              cuposUsados,
              cuposTotal
            )
          : cuposTotal;

      if (
        totalReservado +
          capacidadEditadaComprometida >
        totalPermitido
      ) {
        return responderError(
          `La nueva capacidad supera el total FREE permitido. ` +
            `Hay ${totalReservado} cupos comprometidos fuera de este Drop ` +
            `y el máximo permitido es ${totalPermitido}.`,
          409
        );
      }

      let fechaInicioRpc = null;

      /*
       * Si el Drop es PROGRAMADO permitimos
       * modificar su fecha programada.
       *
       * Si no se envía una fecha nueva,
       * la RPC conserva la existente.
       */

      if (estadoActual === "programado") {
        const fechaEnviada =
          body.fechaInicio ??
          body.fecha_inicio;

        if (
          fechaEnviada !== undefined &&
          fechaEnviada !== null &&
          limpiarTexto(fechaEnviada)
        ) {
          const fechaProgramada =
            parsearFechaProgramada(
              fechaEnviada
            );

          if (!fechaProgramada) {
            return responderError(
              "La fecha y hora programada no es válida",
              400
            );
          }

          if (
            fechaProgramada.getTime() <=
            Date.now()
          ) {
            return responderError(
              "La fecha y hora programada debe estar en el futuro",
              400
            );
          }

          fechaInicioRpc =
            fechaProgramada.toISOString();
        }
      }

      const {
        data: resultadoEditar,
        error: errorEditar,
      } = await supabase.rpc(
        "admin_mutate_free_drop",
        {
          p_action: "editar",
          p_drop_id: dropId,
          p_rifa_id: rifaId,

          p_nombre:
            nombre ||
            dropActual.nombre ||
            `FREE DROP #${dropActual.numero_drop}`,

          p_cupos_total:
            cuposTotal,

          p_fecha_inicio:
            fechaInicioRpc,

          p_actor_type:
            "admin",

          p_actor_identifier:
            "admin",
        }
      );

      if (errorEditar) {
        return responderErrorRpcMutacion(
          errorEditar,
          "editar"
        );
      }

      const dropEditado =
        resultadoEditar?.drop || null;

      if (
        !resultadoEditar?.ok ||
        !dropEditado
      ) {
        console.error(
          "La RPC de edición no devolvió un resultado válido:",
          resultadoEditar
        );

        return responderError(
          "No se pudo editar el free drop",
          500
        );
      }

      return NextResponse.json({
        ok: true,
        drop: dropEditado,
        message:
          "Free drop actualizado correctamente",
      });
    }

    // =====================================================
    // DUPLICAR
    // =====================================================
    //
    // Esta operación se conserva como estaba.
    // Después la convertiremos a su propia RPC
    // transaccional sin afectar esta actualización.
    // =====================================================

if (action === "duplicar") {
  if (
    !Number.isFinite(dropId) ||
    dropId <= 0
  ) {
    return responderError(
      "dropId inválido",
      400
    );
  }

  /*
   * La duplicación ahora ocurre completamente dentro de PostgreSQL:
   *
   * - bloquea la configuración FREE del evento;
   * - bloquea los Drops del evento;
   * - valida el Drop original;
   * - valida total_free_allowed;
   * - calcula el siguiente numero_drop;
   * - crea la copia como BORRADOR;
   * - registra DROP_DUPLICATED;
   *
   * Todo ocurre en una sola transacción.
   */
  const {
    data: resultadoDuplicar,
    error: errorDuplicar,
  } = await supabase.rpc(
    "admin_duplicate_free_drop",
    {
      p_drop_id: dropId,
      p_rifa_id: rifaId,
      p_actor_type: "admin",
      p_actor_identifier: "admin",
    }
  );

  if (errorDuplicar) {
    console.error(
      "Error duplicando free drop:",
      errorDuplicar
    );

    const mensaje =
      String(
        errorDuplicar?.message || ""
      );

    if (
      mensaje.includes(
        "FREE_DROP_NOT_FOUND"
      )
    ) {
      return responderError(
        "El free drop original no existe",
        404
      );
    }

    if (
      mensaje.includes(
        "FREE_DROP_INVALID_ID"
      )
    ) {
      return responderError(
        "dropId inválido",
        400
      );
    }

    if (
      mensaje.includes(
        "RIFA_ID_REQUIRED"
      )
    ) {
      return responderError(
        "rifaId es obligatorio",
        400
      );
    }

    if (
      mensaje.includes(
        "FREE_DROP_INVALID_CAPACITY"
      )
    ) {
      return responderError(
        "El free drop original no tiene una capacidad válida",
        409
      );
    }

    if (
      mensaje.includes(
        "FREE_SETTINGS_NOT_FOUND"
      )
    ) {
      return responderError(
        "No existe configuración FREE para este evento",
        409
      );
    }

    if (
      mensaje.includes(
        "FREE_TOTAL_LIMIT_EXCEEDED"
      )
    ) {
      return responderError(
        "No puedes duplicar este Drop porque excedería el máximo de cupos FREE permitido para este evento.",
        409
      );
    }

    return responderError(
      "No se pudo duplicar el free drop",
      500
    );
  }

  const duplicado =
    resultadoDuplicar?.drop || null;

  if (!duplicado) {
    console.error(
      "admin_duplicate_free_drop no devolvió el Drop creado:",
      resultadoDuplicar
    );

    return responderError(
      "El free drop fue procesado pero no se recibió el resultado esperado",
      500
    );
  }

  return NextResponse.json({
    ok: true,
    drop: duplicado,
    message:
      "Free drop duplicado como borrador",
  });
}

    // =====================================================
    // ACTIVAR SIGUIENTE
    // =====================================================

    if (action === "activar_siguiente") {
      const {
        data: candidatos,
        error: errorCandidatos,
      } = await supabase
        .from("free_drops")
        .select("*")
        .eq("rifa_id", rifaId)
        .in("estado", [
          "pendiente",
          "programado",
          "borrador",
        ])
        .order("numero_drop", {
          ascending: true,
        });

      if (errorCandidatos) {
        console.error(
          "Error buscando siguiente drop:",
          errorCandidatos
        );

        return responderError(
          "No se pudo buscar el siguiente free drop",
          500
        );
      }

      const siguienteDrop =
        (
          Array.isArray(candidatos)
            ? candidatos
            : []
        )[0] || null;

      if (!siguienteDrop) {
        return responderError(
          "No hay otro free drop pendiente, programado o borrador para activar",
          404
        );
      }

      const {
        data: resultadoActivacion,
        error: errorActivar,
      } = await supabase.rpc(
        "admin_activate_free_drop",
        {
          p_drop_id: siguienteDrop.id,
          p_rifa_id: rifaId,
          p_actor_type: "admin",
          p_actor_identifier: "admin",
        }
      );

      if (errorActivar) {
        console.error(
          "Error activando siguiente drop mediante RPC:",
          errorActivar
        );

        const mensajeRpc =
          String(
            errorActivar?.message ||
              ""
          );

        if (
          mensajeRpc.includes(
            "FREE_DROP_NOT_FOUND"
          )
        ) {
          return responderError(
            "El free drop seleccionado ya no existe",
            404
          );
        }

        if (
          mensajeRpc.includes(
            "FREE_DROP_ARCHIVED"
          )
        ) {
          return responderError(
            "No se puede activar un free drop archivado",
            409
          );
        }

        if (
          mensajeRpc.includes(
            "FREE_DROP_EXHAUSTED"
          )
        ) {
          return responderError(
            "No se puede activar un free drop agotado",
            409
          );
        }

        if (
          mensajeRpc.includes(
            "FREE_DROP_INVALID_CAPACITY"
          )
        ) {
          return responderError(
            "El free drop no tiene una capacidad válida",
            409
          );
        }

        return responderError(
          "No se pudo activar el siguiente free drop",
          500
        );
      }

      const {
        data: dropActivado,
        error: errorRecargar,
      } = await supabase
        .from("free_drops")
        .select("*")
        .eq(
          "id",
          siguienteDrop.id
        )
        .eq(
          "rifa_id",
          rifaId
        )
        .single();

      if (errorRecargar) {
        console.error(
          "El drop fue activado pero no se pudo recargar:",
          errorRecargar
        );

        return NextResponse.json({
          ok: true,
          drop:
            resultadoActivacion,
          resultado:
            resultadoActivacion,
          message:
            "Siguiente free drop activado correctamente",
        });
      }

      return NextResponse.json({
        ok: true,
        drop:
          dropActivado,
        resultado:
          resultadoActivacion,
        message:
          "Siguiente free drop activado correctamente",
      });
    }
    // =====================================================
    // VALIDAR DROP ID
    // =====================================================

    if (
      !Number.isFinite(dropId) ||
      dropId <= 0
    ) {
      return responderError(
        "dropId inválido",
        400
      );
    }

    // =====================================================
    // ACTIVAR
    // =====================================================
    //
    // La activación utiliza la versión de 4 argumentos
    // para registrar correctamente al Admin como actor.
    // =====================================================

    if (action === "activar") {
      const {
        data: resultadoActivacion,
        error: errorActivar,
      } = await supabase.rpc(
        "admin_activate_free_drop",
        {
          p_drop_id: dropId,
          p_rifa_id: rifaId,
          p_actor_type: "admin",
          p_actor_identifier: "admin",
        }
      );

      if (errorActivar) {
        console.error(
          "Error activando drop mediante RPC:",
          errorActivar
        );

        const mensajeRpc =
          String(
            errorActivar?.message ||
              ""
          );

        if (
          mensajeRpc.includes(
            "FREE_DROP_NOT_FOUND"
          )
        ) {
          return responderError(
            "El free drop seleccionado ya no existe",
            404
          );
        }

        if (
          mensajeRpc.includes(
            "FREE_DROP_ARCHIVED"
          )
        ) {
          return responderError(
            "No se puede activar un free drop archivado",
            409
          );
        }

        if (
          mensajeRpc.includes(
            "FREE_DROP_EXHAUSTED"
          )
        ) {
          return responderError(
            "No se puede activar un free drop agotado",
            409
          );
        }

        if (
          mensajeRpc.includes(
            "FREE_DROP_INVALID_CAPACITY"
          )
        ) {
          return responderError(
            "El free drop no tiene una capacidad válida",
            409
          );
        }

        return responderError(
          "No se pudo activar el free drop",
          500
        );
      }

      const {
        data: dropActivado,
        error: errorRecargar,
      } = await supabase
        .from("free_drops")
        .select("*")
        .eq(
          "id",
          dropId
        )
        .eq(
          "rifa_id",
          rifaId
        )
        .single();

      if (errorRecargar) {
        console.error(
          "El drop fue activado pero no se pudo recargar:",
          errorRecargar
        );

        return NextResponse.json({
          ok: true,
          drop:
            resultadoActivacion,
          resultado:
            resultadoActivacion,
          message:
            "Free drop activado",
        });
      }

      return NextResponse.json({
        ok: true,
        drop:
          dropActivado,
        resultado:
          resultadoActivacion,
        message:
          "Free drop activado",
      });
    }

    // =====================================================
    // CERRAR / AGOTADO / PENDIENTE / PAUSAR / ARCHIVAR
    // =====================================================
    //
    // Todas estas operaciones pasan ahora por
    // admin_mutate_free_drop.
    //
    // PostgreSQL realiza:
    //
    // 1. cambio del Drop
    // 2. Audit Log
    //
    // dentro de la misma transacción.
    // =====================================================

    const accionesTransaccionales = {
      cerrar: {
        message:
          "Free drop cerrado",
      },

      agotado: {
        message:
          "Free drop marcado como agotado",
      },

      pendiente: {
        message:
          "Free drop cambiado a pendiente",
      },

      pausar: {
        message:
          "Free drop pausado",
      },

      archivar: {
        message:
          "Free drop archivado",
      },
    };

    if (
      Object.prototype.hasOwnProperty.call(
        accionesTransaccionales,
        action
      )
    ) {
      const {
        data: resultadoMutacion,
        error: errorMutacion,
      } = await supabase.rpc(
        "admin_mutate_free_drop",
        {
          p_action:
            action,

          p_drop_id:
            dropId,

          p_rifa_id:
            rifaId,

          p_nombre:
            null,

          p_cupos_total:
            null,

          p_fecha_inicio:
            null,

          p_actor_type:
            "admin",

          p_actor_identifier:
            "admin",
        }
      );

      if (errorMutacion) {
        return responderErrorRpcMutacion(
          errorMutacion,
          action
        );
      }

      const dropActualizado =
        resultadoMutacion?.drop ||
        null;

      if (
        !resultadoMutacion?.ok ||
        !dropActualizado
      ) {
        console.error(
          `La RPC ${action} no devolvió un resultado válido:`,
          resultadoMutacion
        );

        return responderError(
          `No se pudo completar la acción ${action}`,
          500
        );
      }

      return NextResponse.json({
        ok: true,

        drop:
          dropActualizado,

        message:
          accionesTransaccionales[
            action
          ].message,
      });
    }

    // =====================================================
    // ACCIÓN DESCONOCIDA
    // =====================================================

    return responderError(
      "Acción no válida",
      400
    );
  } catch (error) {
    console.error(
      "Error en PATCH admin free drops:",
      error
    );

    return responderError(
      "Error inesperado al actualizar el free drop",
      500
    );
  }
}