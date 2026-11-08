
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraAprobadaEmail } from "../../../lib/sendCompraAprobadaEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   UTILIDADES
========================================================= */

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) {
    return envUrl.startsWith("http")
      ? envUrl.replace(/\/$/, "")
      : `https://${envUrl.replace(/\/$/, "")}`;
  }

  const proto = (
    req.headers.get("x-forwarded-proto") || "https"
  )
    .split(",")[0]
    .trim();

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/$/, "");
}

function obtenerRango(rifa) {
  const inicio =
    rifa.numero_inicio === null ||
    rifa.numero_inicio === undefined
      ? 0
      : Number(rifa.numero_inicio);

  const fin =
    rifa.numero_fin === null ||
    rifa.numero_fin === undefined
      ? String(rifa.formato) === "3digitos"
        ? 999
        : 9999
      : Number(rifa.numero_fin);

  const total =
    Number.isInteger(inicio) &&
    Number.isInteger(fin) &&
    fin >= inicio
      ? fin - inicio + 1
      : 0;

  return {
    inicio,
    fin,
    total,
    padLength:
      String(rifa.formato) === "3digitos" ? 3 : 4,
  };
}

function responderError(mensaje, status = 400) {
  return NextResponse.json(
    { ok: false, error: mensaje },
    { status }
  );
}

/* =========================================================
   DATOS DEL CLIENTE
========================================================= */

async function obtenerDatosCliente(compra) {
  let nombreCliente =
    compra.nombre_cliente || "cliente";

  let emailDestino =
    compra.email_cliente || "";

  if (compra.usuario_id) {
    const { data: usuario, error } =
      await supabaseAdmin
        .from("usuarios")
        .select("nombre, email")
        .eq("id", compra.usuario_id)
        .maybeSingle();

    if (error) {
      console.warn(
        "No se pudo consultar el usuario:",
        error.message
      );
    }

    if (usuario) {
      nombreCliente =
        usuario.nombre || nombreCliente;

      emailDestino =
        usuario.email || emailDestino;
    }
  }

  return { nombreCliente, emailDestino };
}

/* =========================================================
   ESTADÍSTICAS OPTIMIZADAS CON UNA RPC
========================================================= */

async function obtenerEstadisticas(rifaId, totalNumeros) {
  const { data, error } = await supabaseAdmin.rpc(
    "get_rifa_stats_detalladas",
    {
      p_rifa_id: rifaId,
    }
  );

  if (error) {
    throw new Error(
      `Error obteniendo estadísticas: ${error.message}`
    );
  }

  const stats = Array.isArray(data) ? data[0] : data;

  if (!stats) {
    throw new Error(
      "No se encontraron estadísticas de la rifa."
    );
  }

  return {
    ocupados: Number(stats.tickets_vendidos),
    pagados: Number(stats.tickets_pagados),
    free: Number(stats.tickets_free),
    disponibles: Number(stats.tickets_disponibles),
    soldOut: stats.sold_out === true,
    porcentaje: Number(stats.porcentaje_vendido),
  };
}

/* =========================================================
   APROBACIÓN MANUAL
========================================================= */

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return responderError(
      auth.error || "Acceso no autorizado.",
      auth.status || 401
    );
  }

  try {
    let body;

    try {
      body = await req.json();
    } catch {
      return responderError(
        "Cuerpo de la solicitud inválido."
      );
    }

    const {
      compraId,
      rifaId,
      ticketsSeleccionados,
    } = body || {};

    if (
      !compraId ||
      !rifaId ||
      !Array.isArray(ticketsSeleccionados)
    ) {
      return responderError(
        "Faltan datos requeridos."
      );
    }

    if (
      ticketsSeleccionados.length < 1 ||
      ticketsSeleccionados.length > 100
    ) {
      return responderError(
        "Debes seleccionar entre 1 y 100 tickets."
      );
    }

    const numeros = ticketsSeleccionados.map(
      (valor) => Number(valor)
    );

    if (
      numeros.some(
        (numero) =>
          !Number.isSafeInteger(numero)
      )
    ) {
      return responderError(
        "Hay números inválidos en la selección."
      );
    }

    if (
      new Set(numeros).size !== numeros.length
    ) {
      return responderError(
        "Hay números repetidos en la selección."
      );
    }

    /* =============================================
       CONSULTAR COMPRA
    ============================================= */

    const {
      data: compra,
      error: compraError,
    } = await supabaseAdmin
      .from("compras")
      .select(
        [
          "id",
          "usuario_id",
          "rifa_id",
          "estado_pago",
          "cantidad_tickets",
          "monto_total",
          "nombre_cliente",
          "email_cliente",
        ].join(",")
      )
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
      console.error(
        "Error consultando compra:",
        compraError
      );

      return responderError(
        "No se pudo consultar la compra.",
        500
      );
    }

    if (!compra) {
      return responderError(
        "No se encontró la compra.",
        404
      );
    }

    if (
      String(compra.rifa_id) !==
      String(rifaId)
    ) {
      return responderError(
        "La compra no pertenece a esta rifa."
      );
    }

    if (
      normalizarTexto(compra.estado_pago) !==
      "pendiente"
    ) {
      return responderError(
        "La compra ya no está pendiente.",
        409
      );
    }

    const cantidadEsperada = Number(
      compra.cantidad_tickets
    );

    if (
      !Number.isInteger(cantidadEsperada) ||
      numeros.length !== cantidadEsperada
    ) {
      return responderError(
        `Debes seleccionar exactamente ${
          compra.cantidad_tickets
        } ticket(s).`
      );
    }

    /* =============================================
       CONSULTAR RIFA
    ============================================= */

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

      return responderError(
        "No se pudo consultar la rifa.",
        500
      );
    }

    if (!rifa) {
      return responderError(
        "No se encontró la rifa.",
        404
      );
    }

    const estadosPermitidos = [
      "activa",
      "disponible",
      "publicada",
    ];

    if (
      !estadosPermitidos.includes(
        normalizarTexto(rifa.estado)
      )
    ) {
      return responderError(
        "Solo se pueden aprobar compras de rifas activas.",
        409
      );
    }

    const {
      inicio,
      fin,
      total,
      padLength,
    } = obtenerRango(rifa);

    if (total <= 0) {
      return responderError(
        "La rifa tiene un rango de números inválido."
      );
    }

    const fueraDeRango = numeros.find(
      (numero) =>
        numero < inicio || numero > fin
    );

    if (fueraDeRango !== undefined) {
      return responderError(
        `El número ${String(
          fueraDeRango
        ).padStart(
          padLength,
          "0"
        )} está fuera del rango permitido.`
      );
    }

    /* =============================================
       ESTADÍSTICAS ANTERIORES
       Si fallan, no impedimos la aprobación.
    ============================================= */

    let estadisticasAntes = null;

    try {
      estadisticasAntes =
        await obtenerEstadisticas(
          rifaId,
          total
        );
    } catch (error) {
      console.warn(
        "No se pudieron consultar las estadísticas anteriores:",
        error.message
      );
    }

    /* =============================================
       APROBACIÓN TRANSACCIONAL EN SUPABASE
    ============================================= */

    const {
      data: resultadoRPC,
      error: rpcError,
    } = await supabaseAdmin.rpc(
      "aprobar_compra_manual_segura",
      {
        p_compra_id: compraId,
        p_rifa_id: rifaId,
        p_numeros: numeros,
      }
    );

    if (rpcError) {
      console.error(
        "Error en aprobación manual segura:",
        rpcError
      );

      const mensaje =
        rpcError.message ||
        "No se pudo aprobar la compra.";

      const conflicto =
        /ocupado|reservado|pendiente|activa|rango|repetid|asignad|cantidad|disponible|autorizado/i.test(
          mensaje
        );

      return responderError(
        mensaje,
        conflicto ? 409 : 500
      );
    }

    const filas = Array.isArray(resultadoRPC)
      ? resultadoRPC
      : [];

    /*
      La RPC devuelve:
      ticket_id, numero_ticket

      La asignación y la aprobación ya fueron
      confirmadas por PostgreSQL.
    */

    const ticketsAsignados = filas.map(
      (fila) => ({
        id: fila.ticket_id,
        numero_ticket: Number(
          fila.numero_ticket
        ),
        compra_id: compraId,
        rifa_id: rifaId,
        tipo: null,
        estado: "asignado",
        free_drop_id: null,
        free_drop_participation_id: null,
      })
    );

    if (
      ticketsAsignados.length !==
      cantidadEsperada
    ) {
      /*
        No hacemos rollback desde JavaScript:
        la RPC ya terminó su transacción.
      */

      console.error(
        "La RPC devolvió una cantidad inesperada de tickets.",
        {
          compraId,
          esperados: cantidadEsperada,
          recibidos: ticketsAsignados.length,
        }
      );

      return responderError(
        "La aprobación requiere revisión: la respuesta de tickets fue inesperada. Verifica la compra antes de intentar nuevamente.",
        500
      );
    }

    /* =============================================
       ESTADÍSTICAS POSTERIORES
    ============================================= */

    let estadisticasDespues = null;
    let advertenciaRifa = null;

    try {
      estadisticasDespues =
        await obtenerEstadisticas(
          rifaId,
          total
        );
    } catch (error) {
      console.warn(
        "No se pudieron actualizar las estadísticas:",
        error.message
      );

      advertenciaRifa =
        "La compra fue aprobada, pero no se pudieron actualizar las estadísticas.";
    }

    const rifaCompleta =
      estadisticasDespues?.soldOut ?? false;

    let nuevoEstadoRifa = rifa.estado;

    if (rifaCompleta) {
      const { error: estadoError } =
        await supabaseAdmin
          .from("rifas")
          .update({
            estado: "agotada",
          })
          .eq("id", rifaId)
          .in("estado", estadosPermitidos);

      if (estadoError) {
        advertenciaRifa =
          "La compra fue aprobada, pero no se pudo actualizar el estado de la rifa.";

        console.error(
          "Error actualizando estado de rifa:",
          estadoError
        );
      } else {
        nuevoEstadoRifa = "agotada";
      }
    }

    /* =============================================
       ENVIAR CORREO
    ============================================= */

    try {
      const {
        nombreCliente,
        emailDestino,
      } = await obtenerDatosCliente(compra);

      if (emailDestino) {
        const baseUrl = getBaseUrl(req);

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
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Chicago",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),

          horaEvento:
            rifa.hora_sorteo ||
            rifa.hora ||
            rifa.hora_rifa ||
            "",

          tickets: cantidadEsperada,

          numerosTickets:
            ticketsAsignados
              .map(
                (ticket) =>
                  ticket.numero_ticket
              )
              .sort((a, b) => a - b),

          totalPagar: Number(
            compra.monto_total ?? 0
          ),

          eventoUrl:
            `${baseUrl}/evento/${rifa.id}`,

          verificarUrl:
            `${baseUrl}/principal`,

          padLength,
        });
      }
    } catch (emailError) {
      /*
        El correo no modifica la aprobación.
      */

      console.error(
        "No se pudo enviar el correo:",
        emailError
      );
    }

    /* =============================================
       RESPUESTA COMPATIBLE CON EL ADMIN
    ============================================= */

    const despues =
      estadisticasDespues || {
        ocupados: null,
        pagados: null,
        free: null,
        disponibles: null,
        porcentaje: null,
        soldOut: false,
      };

    function diagnostico(stats) {
      if (!stats) return null;

      return {
        ocupados: stats.ocupados,
        pagados: stats.pagados,
        free: stats.free,
        disponibles: stats.disponibles,
      };
    }

    return NextResponse.json({
      ok: true,

      message:
        "Compra aprobada manualmente",

      compraId: compra.id,

      tickets: ticketsAsignados,

      advertenciaRifa,

      rifa: {
        id: rifa.id,
        nombre: rifa.nombre,
        formato: rifa.formato,
        estado: nuevoEstadoRifa,

        tickets_vendidos:
          despues.ocupados,

        tickets_ocupados:
          despues.ocupados,

        tickets_pagados:
          despues.pagados,

        tickets_free:
          despues.free,

        tickets_disponibles:
          despues.disponibles,

        total_numeros: total,

        porcentaje_vendido:
          despues.porcentaje,

        sold_out:
          despues.soldOut,
      },

      diagnostico: {
        antes: diagnostico(
          estadisticasAntes
        ),
        despues: diagnostico(
          estadisticasDespues
        ),
      },

      rifaCompleta,
    });
  } catch (error) {
    console.error(
      "aprobar-compra-manual error:",
      error
    );

    return responderError(
      "Error interno del servidor. Verifica el estado de la compra antes de reintentar.",
      500
    );
  }
}
