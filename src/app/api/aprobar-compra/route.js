import { NextResponse } from "next/server";
import { randomInt } from "crypto";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraAprobadaEmail } from "../../../lib/sendCompraAprobadaEmail";

export const runtime = "nodejs";

/* =========================================================
   URL BASE
========================================================= */

function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) {
    return envUrl.startsWith("http")
      ? envUrl.replace(/\/$/, "")
      : `https://${envUrl.replace(/\/$/, "")}`;
  }

  const protoRaw = req.headers.get("x-forwarded-proto") || "https";
  const proto = protoRaw.split(",")[0].trim();

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/$/, "");
}

/* =========================================================
   HELPERS GENERALES
========================================================= */

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function limpiarTelefonoWhatsapp(valor) {
  const soloNumeros = String(valor || "").replace(/\D/g, "");

  if (!soloNumeros) {
    return "";
  }

  if (soloNumeros.length === 10) {
    return `1${soloNumeros}`;
  }

  return soloNumeros;
}

function validarId(valor) {
  const id = limpiarTexto(valor);

  return (
    Boolean(id) &&
    /^[a-zA-Z0-9_-]+$/.test(id) &&
    id.length <= 100
  );
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    {
      error: mensaje,
    },
    {
      status,
    }
  );
}

/* =========================================================
   PROTECCIÓN FREE
========================================================= */

/**
 * Detecta si un ticket pertenece al sistema FREE.
 *
 * No dependemos únicamente de tipo = free.
 * También comprobamos las relaciones FREE.
 */
function esTicketFree(ticket = {}) {
  const tipo = normalizarTexto(ticket?.tipo);

  return Boolean(
    (ticket?.free_drop_id !== null &&
      ticket?.free_drop_id !== undefined) ||
      (ticket?.free_drop_participation_id !== null &&
        ticket?.free_drop_participation_id !== undefined) ||
      tipo === "free"
  );
}

/**
 * Un ticket solamente puede asignarse a una
 * compra normal cuando está completamente libre.
 */
function esTicketDisponible(ticket = {}) {
  const sinCompra =
    ticket?.compra_id === null ||
    ticket?.compra_id === undefined;

  const sinFreeDrop =
    ticket?.free_drop_id === null ||
    ticket?.free_drop_id === undefined;

  const sinParticipacionFree =
    ticket?.free_drop_participation_id === null ||
    ticket?.free_drop_participation_id === undefined;

  const tipo = normalizarTexto(ticket?.tipo);
  const estado = normalizarTexto(ticket?.estado);

  return (
    sinCompra &&
    sinFreeDrop &&
    sinParticipacionFree &&
    tipo !== "free" &&
    estado === "disponible"
  );
}

function esTicketOcupado(ticket = {}) {
  return !esTicketDisponible(ticket);
}

/**
 * Cuenta números únicos ocupados.
 *
 * Incluye:
 * - compra normal
 * - FREE
 * - reservado
 * - asignado
 * - vendido
 * - cualquier ticket que no esté realmente disponible
 */
function contarNumerosUnicosOcupados(tickets = []) {
  return new Set(
    tickets
      .filter(esTicketOcupado)
      .map((ticket) => Number(ticket?.numero_ticket))
      .filter(Number.isFinite)
  ).size;
}

/* =========================================================
   SELECCIÓN ALEATORIA
========================================================= */

function tomarNumerosAleatorios(disponibles, cantidad) {
  const pool = [...disponibles];
  const seleccionados = [];

  for (let i = 0; i < cantidad; i++) {
    const idx = randomInt(0, pool.length);

    seleccionados.push(
      pool.splice(idx, 1)[0]
    );
  }

  return seleccionados;
}

/* =========================================================
   CONFIGURACIÓN DE RIFA
========================================================= */

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (
    Number.isFinite(inicio) &&
    Number.isFinite(fin) &&
    fin >= inicio
  ) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);

  if (
    Number.isFinite(cantidad) &&
    cantidad > 0
  ) {
    return cantidad;
  }

  return String(rifa?.formato) === "3digitos"
    ? 1000
    : 10000;
}

function obtenerRangoNumeros(rifa = {}, totalNumeros = 0) {
  const inicioRaw = Number(rifa?.numero_inicio);
  const finRaw = Number(rifa?.numero_fin);

  const inicio = Number.isFinite(inicioRaw)
    ? inicioRaw
    : 0;

  const fin = Number.isFinite(finRaw)
    ? finRaw
    : inicio + Math.max(totalNumeros - 1, 0);

  return {
    inicio,
    fin,
  };
}

function construirListaNumeros(inicio, fin) {
  const lista = [];

  for (let n = inicio; n <= fin; n++) {
    lista.push(n);
  }

  return lista;
}

/* =========================================================
   ASEGURAR INVENTARIO BASE
========================================================= */

async function asegurarTicketsBase(rifa) {
  const totalNumeros = obtenerTotalNumeros(rifa);

  const { inicio, fin } = obtenerRangoNumeros(
    rifa,
    totalNumeros
  );

  const esperados = construirListaNumeros(
    inicio,
    fin
  );

  /*
   * Cargamos también los campos relacionados
   * con FREE para nunca considerar esos números libres.
   */
  const {
    data: existentes,
    error: errorExistentes,
  } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      numero_ticket,
      compra_id,
      rifa_id,
      tipo,
      estado,
      free_drop_id,
      free_drop_participation_id
    `)
    .eq("rifa_id", rifa.id);

  if (errorExistentes) {
    return {
      ok: false,
      error:
        errorExistentes.message ||
        "No se pudieron leer los tickets existentes",
    };
  }

  const ticketsExistentes = Array.isArray(existentes)
    ? existentes
    : [];

  const setExistentes = new Set(
    ticketsExistentes
      .map((ticket) => Number(ticket.numero_ticket))
      .filter(Number.isFinite)
  );

  /*
   * Conservamos la funcionalidad existente:
   * si falta físicamente algún número del inventario,
   * lo crea como disponible.
   */
  const faltantes = esperados.filter(
    (numero) => !setExistentes.has(numero)
  );

  if (faltantes.length > 0) {
    const batchSize = 500;

    for (
      let i = 0;
      i < faltantes.length;
      i += batchSize
    ) {
      const batch = faltantes
        .slice(i, i + batchSize)
        .map((numero) => ({
          rifa_id: rifa.id,
          numero_ticket: numero,
          compra_id: null,
          tipo: null,
          estado: "disponible",
          free_drop_id: null,
          free_drop_participation_id: null,
        }));

      const { error: insertError } =
        await supabaseAdmin
          .from("tickets")
          .insert(batch);

      if (insertError) {
        return {
          ok: false,
          error:
            insertError.message ||
            "No se pudieron crear los tickets faltantes",
        };
      }
    }
  }

  /*
   * Recargamos el inventario completo.
   */
  const {
    data: ticketsReload,
    error: errorReload,
  } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      numero_ticket,
      compra_id,
      rifa_id,
      tipo,
      estado,
      free_drop_id,
      free_drop_participation_id
    `)
    .eq("rifa_id", rifa.id)
    .order("numero_ticket", {
      ascending: true,
    });

  if (errorReload) {
    return {
      ok: false,
      error:
        errorReload.message ||
        "No se pudieron recargar los tickets",
    };
  }

  return {
    ok: true,
    tickets: Array.isArray(ticketsReload)
      ? ticketsReload
      : [],
  };
}

/* =========================================================
   DATOS CLIENTE
========================================================= */

async function obtenerDatosCliente(compra) {
  let nombreCliente = "cliente";
  let emailDestino = "";
  let telefonoCliente = "";

  if (compra?.usuario_id) {
    try {
      const {
        data: usuario,
        error: usuarioError,
      } = await supabaseAdmin
        .from("usuarios")
        .select("nombre, email, telefono")
        .eq("id", compra.usuario_id)
        .maybeSingle();

      if (usuarioError) {
        console.warn(
          "No se pudo leer el usuario asociado:",
          usuarioError.message
        );
      }

      if (usuario) {
        nombreCliente =
          usuario.nombre ||
          nombreCliente;

        emailDestino =
          usuario.email ||
          emailDestino;

        telefonoCliente =
          usuario.telefono ||
          telefonoCliente;
      }
    } catch (error) {
      console.warn(
        "Error obteniendo datos del cliente:",
        error.message
      );
    }
  }

  return {
    nombreCliente,
    emailDestino,
    telefonoCliente,
  };
}

/* =========================================================
   ROLLBACK
========================================================= */

async function rollbackAprobacion({
  compraId,
  estadoAnteriorCompra,
  rifaIdOriginal,
  ticketIds = [],
}) {
  const errores = [];

  if (ticketIds.length > 0) {
    /*
     * Solamente revertimos tickets que continúan
     * perteneciendo a ESTA compra.
     *
     * IMPORTANTE:
     * También restauramos estado = disponible.
     *
     * No tocamos FREE.
     */
    const {
      error: revertTicketsError,
    } = await supabaseAdmin
      .from("tickets")
      .update({
        compra_id: null,
        estado: "disponible",
      })
      .in("id", ticketIds)
      .eq("compra_id", compraId);

    if (revertTicketsError) {
      errores.push(
        revertTicketsError.message ||
          "No se pudieron revertir los tickets"
      );
    }
  }

  const {
    error: rollbackCompraError,
  } = await supabaseAdmin
    .from("compras")
    .update({
      estado_pago: estadoAnteriorCompra,
      rifa_id: rifaIdOriginal || null,
    })
    .eq("id", compraId);

  if (rollbackCompraError) {
    errores.push(
      rollbackCompraError.message ||
        "No se pudo revertir la compra"
    );
  }

  return errores;
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  /*
   * Solo administrador.
   */
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
    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    let body;

    try {
      body = await req.json();
    } catch {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
    }

    const { compraId } = body;

    const compraIdLimpio = limpiarTexto(
      compraId
    );

    if (!validarId(compraIdLimpio)) {
      return errorResponse(
        "Falta el ID de la compra",
        400
      );
    }

    /* -----------------------------------------------------
       COMPRA
    ----------------------------------------------------- */

    const {
      data: compra,
      error: compraError,
    } = await supabaseAdmin
      .from("compras")
      .select(`
        id,
        usuario_id,
        estado_pago,
        cantidad_tickets,
        monto_total,
        rifa_id,
        referencia
      `)
      .eq("id", compraIdLimpio)
      .maybeSingle();

    if (compraError) {
      console.error(
        "Error consultando compra:",
        compraError
      );

      return errorResponse(
        "No se pudo consultar la compra",
        500
      );
    }

    if (!compra) {
      return errorResponse(
        "La compra no existe",
        404
      );
    }

    const estadoCompra = normalizarTexto(
      compra.estado_pago
    );

    if (estadoCompra === "aprobado") {
      return errorResponse(
        "La compra ya fue aprobada",
        400
      );
    }

    if (estadoCompra === "rechazado") {
      return errorResponse(
        "La compra fue rechazada y no puede aprobarse",
        400
      );
    }

    /*
     * Solamente permitimos aprobar compras pendientes.
     */
    if (estadoCompra !== "pendiente") {
      return errorResponse(
        "La compra no está pendiente",
        400
      );
    }

    const cantidadTickets =
      Number(compra.cantidad_tickets) || 0;

    if (
      !Number.isInteger(cantidadTickets) ||
      cantidadTickets <= 0
    ) {
      return errorResponse(
        "La compra no tiene una cantidad válida de tickets",
        400
      );
    }

    const estadoAnteriorCompra =
      compra.estado_pago || "pendiente";

    const rifaIdOriginal =
      compra.rifa_id || null;

    /* -----------------------------------------------------
       RIFA
    ----------------------------------------------------- */

    let rifaId = compra.rifa_id;

    if (!rifaId) {
      const {
        data: rifaActiva,
        error: rifaActivaError,
      } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("estado", "activa")
        .limit(1)
        .maybeSingle();

      if (rifaActivaError) {
        console.error(
          "Error buscando rifa activa:",
          rifaActivaError
        );

        return errorResponse(
          "No se pudo buscar una rifa activa",
          500
        );
      }

      if (!rifaActiva) {
        return errorResponse(
          "No hay una rifa activa disponible",
          400
        );
      }

      rifaId = rifaActiva.id;
    }

    const {
      data: rifa,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      console.error(
        "Error consultando rifa:",
        rifaError
      );

      return errorResponse(
        "No se pudo consultar la rifa asociada",
        500
      );
    }

    if (!rifa) {
      return errorResponse(
        "La rifa asociada no existe",
        404
      );
    }

    const estadoRifa = normalizarTexto(
      rifa.estado
    );

    if (
      ![
        "activa",
        "disponible",
        "publicada",
      ].includes(estadoRifa)
    ) {
      return errorResponse(
        "La rifa no está disponible para aprobar compras automáticamente",
        400
      );
    }

    const totalNumeros =
      obtenerTotalNumeros(rifa);

    if (totalNumeros <= 0) {
      return errorResponse(
        "La rifa no tiene una cantidad válida de números",
        400
      );
    }

    /* -----------------------------------------------------
       INVENTARIO
    ----------------------------------------------------- */

    const aseguracion =
      await asegurarTicketsBase(rifa);

    if (!aseguracion.ok) {
      return errorResponse(
        aseguracion.error,
        500
      );
    }

    const ticketsActuales =
      Array.isArray(aseguracion.tickets)
        ? aseguracion.tickets
        : [];

    /*
     * Un ticket libre debe:
     *
     * - no tener compra
     * - no pertenecer a FREE
     * - estar en estado disponible
     */
    const ticketsLibresAntes =
      ticketsActuales.filter(
        esTicketDisponible
      );

    const ticketsOcupadosAntes =
      contarNumerosUnicosOcupados(
        ticketsActuales
      );

    /*
     * Estadísticas separadas para diagnóstico.
     */
    const ticketsPagadosAntes =
      new Set(
        ticketsActuales
          .filter(
            (ticket) =>
              ticket?.compra_id !== null &&
              ticket?.compra_id !== undefined
          )
          .map((ticket) =>
            Number(ticket.numero_ticket)
          )
          .filter(Number.isFinite)
      ).size;

    const ticketsFreeAntes =
      new Set(
        ticketsActuales
          .filter(esTicketFree)
          .map((ticket) =>
            Number(ticket.numero_ticket)
          )
          .filter(Number.isFinite)
      ).size;

    /* -----------------------------------------------------
       AGOTADA
    ----------------------------------------------------- */

    if (
      ticketsLibresAntes.length <= 0 ||
      ticketsOcupadosAntes >= totalNumeros
    ) {
      const {
        error: updateAgotadaError,
      } = await supabaseAdmin
        .from("rifas")
        .update({
          estado: "agotada",
        })
        .eq("id", rifa.id);

      if (updateAgotadaError) {
        console.error(
          "Error marcando rifa como agotada:",
          updateAgotadaError
        );
      }

      return errorResponse(
        "La rifa ya alcanzó el 100% y no tiene números disponibles",
        409
      );
    }

    const disponiblesRestantesAntes =
      ticketsLibresAntes.length;

    if (
      cantidadTickets >
      disponiblesRestantesAntes
    ) {
      return errorResponse(
        `No hay suficientes números disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s)`,
        409
      );
    }

    /* -----------------------------------------------------
       SELECCIÓN ALEATORIA
    ----------------------------------------------------- */

    const seleccionados =
      tomarNumerosAleatorios(
        ticketsLibresAntes,
        cantidadTickets
      );

    const idsTicketsAsignar =
      seleccionados.map(
        (ticket) => ticket.id
      );

    if (
      idsTicketsAsignar.length !==
      cantidadTickets
    ) {
      return errorResponse(
        "No se pudieron seleccionar todos los tickets requeridos",
        409
      );
    }

    /* -----------------------------------------------------
       ASIGNACIÓN PROTEGIDA
    ----------------------------------------------------- */

    /*
     * Segunda defensa:
     *
     * Aunque los tickets estaban disponibles cuando
     * los leímos, volvemos a comprobarlo en el UPDATE.
     *
     * Así evitamos sobrescribir:
     *
     * - una compra
     * - un FREE
     * - una reserva
     * - un ticket que cambió de estado
     *
     * Al asignarlo a una compra normal:
     *
     * disponible -> asignado
     */
    const {
      data: ticketsActualizados,
      error: asignarTicketsError,
    } = await supabaseAdmin
      .from("tickets")
      .update({
        compra_id: compra.id,
        estado: "asignado",
      })
      .in("id", idsTicketsAsignar)
      .is("compra_id", null)
      .is("free_drop_id", null)
      .is("free_drop_participation_id", null)
      .eq("estado", "disponible")
      .or("tipo.is.null,tipo.neq.free")
      .select(`
        id,
        numero_ticket,
        compra_id,
        rifa_id,
        tipo,
        estado,
        free_drop_id,
        free_drop_participation_id
      `);

    if (asignarTicketsError) {
      console.error(
        "Error asignando tickets:",
        asignarTicketsError
      );

      return errorResponse(
        asignarTicketsError.message ||
          "No se pudieron asignar los tickets",
        500
      );
    }

    const actualizados =
      Array.isArray(ticketsActualizados)
        ? ticketsActualizados
        : [];

    /*
     * Si otro proceso tomó uno de los tickets
     * entre SELECT y UPDATE, la cantidad actualizada
     * será menor.
     *
     * En ese caso revertimos solamente los que
     * esta operación alcanzó a asignar.
     */
    if (
      actualizados.length !==
      cantidadTickets
    ) {
      if (actualizados.length > 0) {
        await supabaseAdmin
          .from("tickets")
          .update({
            compra_id: null,
            estado: "disponible",
          })
          .in(
            "id",
            actualizados.map(
              (ticket) => ticket.id
            )
          )
          .eq(
            "compra_id",
            compra.id
          );
      }

      return errorResponse(
        "Uno o más tickets dejaron de estar disponibles o pertenecen a FREE. Intenta aprobar la compra nuevamente.",
        409
      );
    }

    /*
     * Verificación extra.
     *
     * Nunca aceptamos como resultado un ticket FREE.
     */
    const resultadoInvalido =
      actualizados.some((ticket) =>
        esTicketFree(ticket)
      );

    if (resultadoInvalido) {
      await supabaseAdmin
        .from("tickets")
        .update({
          compra_id: null,
          estado: "disponible",
        })
        .in(
          "id",
          actualizados.map(
            (ticket) => ticket.id
          )
        )
        .eq(
          "compra_id",
          compra.id
        );

      return errorResponse(
        "La asignación fue cancelada porque se detectó un ticket FREE.",
        409
      );
    }

    const nuevosTickets =
      actualizados.map((ticket) => ({
        id: ticket.id,
        numero_ticket:
          ticket.numero_ticket,
        compra_id: compra.id,
        rifa_id: rifa.id,
        tipo: ticket.tipo,
        estado: ticket.estado,
        free_drop_id:
          ticket.free_drop_id,
        free_drop_participation_id:
          ticket.free_drop_participation_id,
      }));

    /* -----------------------------------------------------
       APROBAR COMPRA
    ----------------------------------------------------- */

    const {
      data: compraActualizada,
      error: aprobarCompraError,
    } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago: "aprobado",
        rifa_id: rifa.id,
      })
      .eq("id", compra.id)
      .eq(
        "estado_pago",
        estadoAnteriorCompra
      )
      .select(
        "id, estado_pago, rifa_id"
      )
      .maybeSingle();

    if (
      aprobarCompraError ||
      !compraActualizada
    ) {
      console.error(
        "Error aprobando compra:",
        aprobarCompraError
      );

      const rollbackErrors =
        await rollbackAprobacion({
          compraId: compra.id,
          estadoAnteriorCompra,
          rifaIdOriginal,
          ticketIds:
            nuevosTickets.map(
              (ticket) => ticket.id
            ),
        });

      return errorResponse(
        `No se pudo aprobar la compra. ${
          rollbackErrors.length
            ? "Hubo un problema al revertir cambios."
            : ""
        }`,
        500
      );
    }

    /* -----------------------------------------------------
       RECALCULAR ESTADÍSTICAS REALES
    ----------------------------------------------------- */

    const {
      data: ticketsFinalesData,
      error: ticketsFinalesError,
    } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        numero_ticket,
        compra_id,
        rifa_id,
        tipo,
        estado,
        free_drop_id,
        free_drop_participation_id
      `)
      .eq("rifa_id", rifa.id);

    let ticketsFinales =
      Array.isArray(ticketsFinalesData)
        ? ticketsFinalesData
        : [];

    /*
     * Si por algún motivo falla la consulta final,
     * calculamos usando el estado anterior más
     * los tickets recién asignados.
     */
    if (ticketsFinalesError) {
      console.warn(
        "No se pudieron recalcular las estadísticas finales:",
        ticketsFinalesError.message
      );

      ticketsFinales =
        ticketsActuales.map(
          (ticket) => {
            if (
              idsTicketsAsignar.includes(
                ticket.id
              )
            ) {
              return {
                ...ticket,
                compra_id: compra.id,
                estado: "asignado",
              };
            }

            return ticket;
          }
        );
    }

    const ticketsVendidosDespues =
      contarNumerosUnicosOcupados(
        ticketsFinales
      );

    const ticketsPagadosDespues =
      new Set(
        ticketsFinales
          .filter(
            (ticket) =>
              ticket?.compra_id !== null &&
              ticket?.compra_id !== undefined
          )
          .map((ticket) =>
            Number(ticket.numero_ticket)
          )
          .filter(Number.isFinite)
      ).size;

    const ticketsFreeDespues =
      new Set(
        ticketsFinales
          .filter(esTicketFree)
          .map((ticket) =>
            Number(ticket.numero_ticket)
          )
          .filter(Number.isFinite)
      ).size;

    const ticketsDisponiblesDespues =
      new Set(
        ticketsFinales
          .filter(esTicketDisponible)
          .map((ticket) =>
            Number(ticket.numero_ticket)
          )
          .filter(Number.isFinite)
      ).size;

    const rifaCompleta =
      ticketsDisponiblesDespues <= 0 ||
      ticketsVendidosDespues >=
        totalNumeros;

    /* -----------------------------------------------------
       MARCAR RIFA AGOTADA
    ----------------------------------------------------- */

    let advertenciaRifa = null;

    if (rifaCompleta) {
      const {
        error: updateRifaError,
      } = await supabaseAdmin
        .from("rifas")
        .update({
          estado: "agotada",
        })
        .eq("id", rifa.id);

      if (updateRifaError) {
        console.error(
          "Error actualizando rifa a agotada:",
          updateRifaError
        );

        advertenciaRifa =
          "La compra se aprobó, pero no se pudo marcar la rifa como agotada: " +
          (
            updateRifaError.message ||
            "error desconocido"
          );
      }
    }

    /* -----------------------------------------------------
       EMAIL
    ----------------------------------------------------- */

    const baseUrl = getBaseUrl(req);

    const {
      nombreCliente,
      emailDestino,
      telefonoCliente,
    } = await obtenerDatosCliente(
      compra
    );

    const padLength =
      String(rifa.formato) ===
      "3digitos"
        ? 3
        : 4;

    const numerosTickets =
      nuevosTickets
        .map((ticket) =>
          Number(
            ticket.numero_ticket
          )
        )
        .sort((a, b) => a - b);

    try {
      if (emailDestino) {
        await sendCompraAprobadaEmail({
          to: emailDestino,
          nombre: nombreCliente,
          rifaNombre:
            rifa.nombre || "Rifa",
          rifaDescripcion:
            rifa.descripcion || "",
          portadaUrl:
            rifa.portada_url ||
            rifa.portada_scroll_url ||
            "",
          fechaEvento:
            rifa.fecha_sorteo ||
            rifa.fecha ||
            rifa.fecha_rifa ||
            "",
          horaEvento:
            rifa.hora_sorteo ||
            rifa.hora ||
            rifa.hora_rifa ||
            "",
          tickets:
            compra.cantidad_tickets ||
            0,
          numerosTickets,
          totalPagar:
            Number(
              compra.monto_total ?? 0
            ),
          eventoUrl:
            `${baseUrl}/evento/${rifa.id}`,
          verificarUrl:
            `${baseUrl}/principal`,
          padLength,
        });
      } else {
        console.warn(
          `La compra ${compra.id} fue aprobada pero no tiene email destino`
        );
      }
    } catch (emailError) {
      /*
       * Un error de email NO revierte la compra.
       */
      console.error(
        "No se pudo enviar el correo:",
        emailError
      );
    }

    /* -----------------------------------------------------
       WHATSAPP
    ----------------------------------------------------- */

    const telefonoWhatsapp =
      limpiarTelefonoWhatsapp(
        telefonoCliente
      );

    const numerosWhatsapp =
      numerosTickets
        .map(
          (numero) =>
            `• ${String(
              numero
            ).padStart(
              padLength,
              "0"
            )}`
        )
        .join("\n");

    const mensajeWhatsapp =
      `🎉 Felicidades ${nombreCliente}

Tu compra fue aprobada.

🎟️ Rifa: ${rifa.nombre || "Rifa"}

🎫 Tickets:
${numerosWhatsapp}

Gracias por participar en Rifas LSD.`;

    const whatsappUrl =
      telefonoWhatsapp
        ? `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(
            mensajeWhatsapp
          )}`
        : null;

    /* -----------------------------------------------------
       RESPUESTA
    ----------------------------------------------------- */

    return NextResponse.json({
      ok: true,

      message:
        "Compra aprobada correctamente",

      advertenciaRifa,

      whatsapp: {
        telefono:
          telefonoWhatsapp,
        mensaje:
          mensajeWhatsapp,
        url:
          whatsappUrl,
      },

      tickets:
        nuevosTickets.map(
          (ticket) => ({
            id:
              ticket.id,
            numero_ticket:
              ticket.numero_ticket,
            compra_id:
              ticket.compra_id,
            rifa_id:
              ticket.rifa_id,
            tipo:
              ticket.tipo,
            estado:
              ticket.estado,
            free_drop_id:
              ticket.free_drop_id,
            free_drop_participation_id:
              ticket.free_drop_participation_id,
          })
        ),

      rifa: {
        id:
          rifa.id,

        nombre:
          rifa.nombre,

        formato:
          rifa.formato,

        estado:
          rifaCompleta
            ? "agotada"
            : rifa.estado,

        /*
         * Conservamos tickets_vendidos por
         * compatibilidad con el frontend.
         *
         * Representa ocupación total:
         * PAGADOS + FREE.
         */
        tickets_vendidos:
          ticketsVendidosDespues,

        tickets_ocupados:
          ticketsVendidosDespues,

        tickets_pagados:
          ticketsPagadosDespues,

        tickets_free:
          ticketsFreeDespues,

        tickets_disponibles:
          ticketsDisponiblesDespues,

        total_numeros:
          totalNumeros,

        porcentaje_vendido:
          totalNumeros > 0
            ? Number(
                (
                  (
                    ticketsVendidosDespues /
                    totalNumeros
                  ) *
                  100
                ).toFixed(2)
              )
            : 0,
      },

      diagnostico: {
        antes: {
          ocupados:
            ticketsOcupadosAntes,

          pagados:
            ticketsPagadosAntes,

          free:
            ticketsFreeAntes,

          disponibles:
            disponiblesRestantesAntes,
        },

        despues: {
          ocupados:
            ticketsVendidosDespues,

          pagados:
            ticketsPagadosDespues,

          free:
            ticketsFreeDespues,

          disponibles:
            ticketsDisponiblesDespues,
        },
      },

      rifaCompleta,
    });
  } catch (error) {
    console.error(
      "aprobar-compra error:",
      error
    );

    return errorResponse(
      "No se pudo procesar la aprobación de la compra",
      500
    );
  }
}