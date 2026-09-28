import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);

  if (Number.isFinite(cantidad) && cantidad > 0) {
    return cantidad;
  }

  return String(rifa?.formato) === "3digitos"
    ? 1000
    : 10000;
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function esTicketFree(ticket = {}) {
  return (
    ticket?.free_drop_id != null ||
    ticket?.free_drop_participation_id != null ||
    normalizarTexto(ticket?.tipo) === "free"
  );
}

function esTicketPagado(ticket = {}) {
  return (
    ticket?.compra_id != null &&
    !esTicketFree(ticket)
  );
}

function esTicketDisponible(ticket = {}) {
  return (
    ticket?.compra_id == null &&
    ticket?.free_drop_id == null &&
    ticket?.free_drop_participation_id == null &&
    normalizarTexto(ticket?.tipo) !== "free" &&
    normalizarTexto(ticket?.estado) === "disponible"
  );
}

function agregarNumero(set, numeroTicket) {
  if (
    numeroTicket == null ||
    numeroTicket === ""
  ) {
    return;
  }

  set.add(String(numeroTicket));
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rifaId = searchParams.get("rifaId");

    let rifa = null;

    /*
     * Si recibimos rifaId cargamos exactamente esa rifa.
     *
     * Esto se conserva porque EventoDetallePageClient depende
     * de poder consultar un evento específico.
     */
    if (rifaId) {
      const { data, error } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("id", rifaId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error:
              error.message ||
              "No se pudo cargar la rifa",
          },
          { status: 500 }
        );
      }

      rifa = data || null;
    } else {
      /*
       * Conservamos el comportamiento existente cuando no llega
       * rifaId: usar la rifa publicada más reciente.
       */
      const { data, error } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("publicada", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error:
              error.message ||
              "No se pudo cargar la rifa activa",
          },
          { status: 500 }
        );
      }

      rifa = data || null;
    }

    if (!rifa) {
      return NextResponse.json(
        {
          ok: true,
          rifa: null,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const totalNumeros =
      obtenerTotalNumeros(rifa);

    /*
     * Cargamos el inventario completo de esta rifa.
     *
     * Necesitamos todos estos campos para distinguir correctamente:
     *
     * - tickets pagados
     * - tickets FREE
     * - tickets disponibles
     * - tickets bloqueados/reservados
     */
    const {
      data: ticketsData,
      error: ticketsError,
    } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        numero_ticket,
        compra_id,
        estado,
        tipo,
        free_drop_id,
        free_drop_participation_id,
        rifa_id,
        asignado_at
      `)
      .eq("rifa_id", rifa.id);

    if (ticketsError) {
      return NextResponse.json(
        {
          error:
            ticketsError.message ||
            "No se pudieron obtener los tickets de la rifa",
        },
        { status: 500 }
      );
    }

    const tickets =
      Array.isArray(ticketsData)
        ? ticketsData
        : [];

    /*
     * Usamos Sets para contar números únicos y no simplemente
     * cantidad de filas.
     */
    const numerosPagados = new Set();
    const numerosFree = new Set();
    const numerosOcupados = new Set();
    const numerosDisponiblesInventario = new Set();

    for (const ticket of tickets) {
      if (
        ticket?.numero_ticket == null ||
        ticket?.numero_ticket === ""
      ) {
        continue;
      }

      /*
       * FREE tiene prioridad.
       *
       * No dependemos solamente de estado="asignado".
       *
       * Si existe:
       *
       * - tipo="free"
       * - free_drop_id
       * - free_drop_participation_id
       *
       * el número ya pertenece al flujo FREE y no debe volver
       * a aparecer disponible para una compra.
       *
       * Esto incluye FREE en estado "reservado".
       */
      if (esTicketFree(ticket)) {
        agregarNumero(
          numerosFree,
          ticket.numero_ticket
        );

        agregarNumero(
          numerosOcupados,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Ticket perteneciente a una compra normal.
       */
      if (esTicketPagado(ticket)) {
        agregarNumero(
          numerosPagados,
          ticket.numero_ticket
        );

        agregarNumero(
          numerosOcupados,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Un ticket solamente es realmente disponible cuando:
       *
       * - no tiene compra
       * - no tiene referencias FREE
       * - no es tipo FREE
       * - estado = disponible
       */
      if (esTicketDisponible(ticket)) {
        agregarNumero(
          numerosDisponiblesInventario,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Cualquier fila restante no cumple las condiciones estrictas
       * para estar disponible.
       *
       * Por seguridad de inventario se considera ocupada/bloqueada.
       */
      agregarNumero(
        numerosOcupados,
        ticket.numero_ticket
      );
    }

    const ticketsPagados =
      numerosPagados.size;

    const ticketsFree =
      numerosFree.size;

    const ticketsOcupados =
      numerosOcupados.size;

    /*
     * Disponibilidad matemática pública.
     *
     * TOTAL - todos los números realmente ocupados.
     */
    const ticketsDisponibles =
      Math.max(
        totalNumeros - ticketsOcupados,
        0
      );

    /*
     * Conservamos tickets_vendidos como alias de ocupación total
     * porque el frontend existente utiliza este campo para mostrar
     * el progreso general de la rifa.
     *
     * El desglose real queda disponible mediante:
     *
     * tickets_pagados
     * tickets_free
     * tickets_ocupados
     */
    const ticketsVendidos =
      ticketsOcupados;

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(
            (
              (ticketsOcupados / totalNumeros) *
              100
            ).toFixed(2)
          )
        : 0;

    const soldOut =
      totalNumeros > 0 &&
      ticketsOcupados >= totalNumeros;

    return NextResponse.json(
      {
        ok: true,

        rifa: {
          ...rifa,

          total_numeros:
            totalNumeros,

          /*
           * CAMPOS EXISTENTES.
           *
           * Se conservan para no romper EventoDetallePageClient
           * ni otros componentes existentes.
           */
          tickets_vendidos:
            ticketsVendidos,

          tickets_disponibles:
            ticketsDisponibles,

          porcentaje_vendido:
            porcentajeVendido,

          sold_out:
            soldOut,

          /*
           * NUEVO DESGLOSE.
           */
          tickets_pagados:
            ticketsPagados,

          tickets_free:
            ticketsFree,

          tickets_ocupados:
            ticketsOcupados,

          stats: {
            total:
              totalNumeros,

            /*
             * Compatibilidad anterior.
             */
            vendidos:
              ticketsVendidos,

            ocupados:
              ticketsOcupados,

            disponibles:
              ticketsDisponibles,

            porcentaje:
              porcentajeVendido,

            soldOut,

            ticketsVendidos,

            ticketsOcupados,

            porcentajeVendido,

            /*
             * Desglose explícito.
             */
            pagados:
              ticketsPagados,

            free:
              ticketsFree,

            ticketsPagados,

            ticketsFree,

            /*
             * Diagnóstico del inventario físico.
             */
            disponiblesInventario:
              numerosDisponiblesInventario.size,
          },
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "rifa-resumen error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}