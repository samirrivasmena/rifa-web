import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);
  return Number.isFinite(cantidad) ? cantidad : 0;
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
  return ticket?.compra_id != null && !esTicketFree(ticket);
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
  if (numeroTicket == null || numeroTicket === "") {
    return;
  }

  set.add(String(numeroTicket));
}

export async function GET() {
  try {
    /*
     * Conservamos tu lógica actual:
     *
     * 1. Busca rifas publicadas activas o agotadas.
     * 2. Da prioridad a una rifa ACTIVA.
     * 3. Si no existe, utiliza la AGOTADA más reciente.
     */
    const { data: rifasData, error: rifasError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .in("estado", ["activa", "agotada"])
      .eq("publicada", true)
      .order("created_at", { ascending: false });

    if (rifasError) {
      return NextResponse.json(
        {
          error:
            rifasError.message ||
            "No se pudo obtener la rifa activa",
        },
        { status: 500 }
      );
    }

    const rifas = Array.isArray(rifasData)
      ? rifasData
      : [];

    const rifaActiva = rifas.find(
      (rifa) =>
        normalizarTexto(rifa?.estado) === "activa"
    );

    const rifaAgotada = rifas.find(
      (rifa) =>
        normalizarTexto(rifa?.estado) === "agotada"
    );

    const rifa =
      rifaActiva ||
      rifaAgotada ||
      null;

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

    const totalNumeros = obtenerTotalNumeros(rifa);

    /*
     * IMPORTANTE:
     *
     * Antes este endpoint consultaba solamente:
     *
     *   compra_id IS NOT NULL
     *
     * Eso excluía los tickets FREE.
     *
     * Ahora consultamos el inventario completo de esta rifa para
     * distinguir:
     *
     * - PAGADOS
     * - FREE
     * - OCUPADOS
     * - DISPONIBLES
     */
    const { data: ticketsData, error: ticketsError } =
      await supabaseAdmin
        .from("tickets")
        .select(`
          id,
          rifa_id,
          numero_ticket,
          compra_id,
          tipo,
          estado,
          free_drop_id,
          free_drop_participation_id
        `)
        .eq("rifa_id", rifa.id);

    if (ticketsError) {
      return NextResponse.json(
        {
          error:
            ticketsError.message ||
            "No se pudieron obtener los tickets de la rifa activa",
        },
        { status: 500 }
      );
    }

    /*
     * Conservamos la consulta del sorteo más reciente.
     */
    const {
      data: sorteoData,
      error: sorteoError,
    } = await supabaseAdmin
      .from("sorteos")
      .select(
        "id, rifa_id, numero_ganador, numero_oficial, fecha_sorteo, fuente"
      )
      .eq("rifa_id", rifa.id)
      .order("fecha_sorteo", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sorteoError) {
      console.error(
        "rifa-activa sorteo error:",
        sorteoError
      );
    }

    const tickets = Array.isArray(ticketsData)
      ? ticketsData
      : [];

    /*
     * Sets independientes.
     *
     * Contamos números únicos, no filas.
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
       * FREE tiene prioridad de clasificación.
       *
       * Si existe cualquier referencia FREE o tipo="free",
       * ese número nunca puede considerarse disponible para
       * una compra normal.
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
       * Compra normal.
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
       * Solamente consideramos realmente disponible un ticket
       * completamente libre.
       */
      if (esTicketDisponible(ticket)) {
        agregarNumero(
          numerosDisponiblesInventario,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Si existe una fila que no es FREE, no tiene compra,
       * pero tampoco cumple las condiciones estrictas para estar
       * disponible, la tratamos como ocupada/bloqueada.
       *
       * Así evitamos anunciar públicamente como disponible un
       * número cuyo estado real indique lo contrario.
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
     * La disponibilidad pública se calcula contra todos los
     * números ocupados, incluyendo FREE.
     */
    const ticketsDisponibles = Math.max(
      totalNumeros - ticketsOcupados,
      0
    );

    /*
     * Para mantener compatibilidad con tu frontend,
     * "tickets_vendidos" representa el avance/ocupación total.
     *
     * De esta forma el progreso no vuelve a presentar como
     * disponibles los números entregados mediante FREE Drops.
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

          sorteo:
            sorteoData || null,

          numero_ganador:
            sorteoData?.numero_ganador ??
            rifa.numero_ganador ??
            null,

          numero_oficial:
            sorteoData?.numero_oficial ??
            rifa.numero_oficial ??
            null,

          total_numeros:
            totalNumeros,

          /*
           * CAMPOS EXISTENTES.
           *
           * Se conservan para no romper HomePageClient ni otros
           * componentes que ya dependan de estos nombres.
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
           * CAMPOS NUEVOS Y EXPLÍCITOS.
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

            disponibles:
              ticketsDisponibles,

            porcentaje:
              porcentajeVendido,

            soldOut,

            ticketsVendidos,

            porcentajeVendido,

            /*
             * Desglose nuevo.
             */
            pagados:
              ticketsPagados,

            free:
              ticketsFree,

            ocupados:
              ticketsOcupados,

            ticketsPagados,

            ticketsFree,

            ticketsOcupados,

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
      "rifa-activa error:",
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