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

function agregarNumero(mapa, rifaId, numeroTicket) {
  if (
    rifaId == null ||
    numeroTicket == null ||
    numeroTicket === ""
  ) {
    return;
  }

  const rifaKey = String(rifaId);
  const numeroKey = String(numeroTicket);

  if (!mapa[rifaKey]) {
    mapa[rifaKey] = new Set();
  }

  mapa[rifaKey].add(numeroKey);
}

export async function GET() {
  try {
    const { data: rifasData, error: rifasError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .in("estado", ["activa", "finalizada", "agotada", "publicada"])
      .eq("publicada", true)
      .order("created_at", { ascending: false });

    if (rifasError) {
      return NextResponse.json(
        {
          error:
            rifasError.message ||
            "No se pudieron cargar las rifas públicas",
        },
        { status: 500 }
      );
    }

    const rifas = Array.isArray(rifasData) ? rifasData : [];

    if (!rifas.length) {
      return NextResponse.json(
        {
          ok: true,
          rifas: [],
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

    const rifaIds = rifas.map((rifa) => rifa.id);

    /*
     * IMPORTANTE:
     *
     * Ya no podemos consultar solamente tickets con compra_id.
     *
     * Un número puede estar ocupado por:
     * - una compra normal;
     * - una participación FREE.
     *
     * Además necesitamos conocer el estado real del inventario para
     * distinguir correctamente:
     *
     * PAGADOS
     * FREE
     * OCUPADOS
     * DISPONIBLES
     */
    const { data: ticketsData, error: ticketsError } = await supabaseAdmin
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
      .in("rifa_id", rifaIds);

    if (ticketsError) {
      return NextResponse.json(
        {
          error:
            ticketsError.message ||
            "No se pudieron cargar los tickets",
        },
        { status: 500 }
      );
    }

    const { data: sorteosData, error: sorteosError } = await supabaseAdmin
      .from("sorteos")
      .select(
        "id, rifa_id, numero_ganador, numero_oficial, fecha_sorteo, fuente"
      )
      .in("rifa_id", rifaIds)
      .order("fecha_sorteo", { ascending: false });

    if (sorteosError) {
      return NextResponse.json(
        {
          error:
            sorteosError.message ||
            "No se pudieron cargar los sorteos",
        },
        { status: 500 }
      );
    }

    const tickets = Array.isArray(ticketsData)
      ? ticketsData
      : [];

    const sorteos = Array.isArray(sorteosData)
      ? sorteosData
      : [];

    /*
     * Sets independientes por rifa.
     *
     * Usamos Set para protegernos de posibles duplicados y contar
     * números únicos, no filas.
     */
    const pagadosPorRifa = {};
    const freePorRifa = {};
    const ocupadosPorRifa = {};
    const disponiblesInventarioPorRifa = {};

    for (const ticket of tickets) {
      if (
        ticket?.rifa_id == null ||
        ticket?.numero_ticket == null ||
        ticket?.numero_ticket === ""
      ) {
        continue;
      }

      if (esTicketFree(ticket)) {
        agregarNumero(
          freePorRifa,
          ticket.rifa_id,
          ticket.numero_ticket
        );

        agregarNumero(
          ocupadosPorRifa,
          ticket.rifa_id,
          ticket.numero_ticket
        );

        continue;
      }

      if (esTicketPagado(ticket)) {
        agregarNumero(
          pagadosPorRifa,
          ticket.rifa_id,
          ticket.numero_ticket
        );

        agregarNumero(
          ocupadosPorRifa,
          ticket.rifa_id,
          ticket.numero_ticket
        );

        continue;
      }

      if (esTicketDisponible(ticket)) {
        agregarNumero(
          disponiblesInventarioPorRifa,
          ticket.rifa_id,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Cualquier ticket que no sea realmente disponible también
       * se considera ocupado/reservado para que el frontend nunca
       * anuncie como libre un número que el inventario tiene bloqueado.
       */
      agregarNumero(
        ocupadosPorRifa,
        ticket.rifa_id,
        ticket.numero_ticket
      );
    }

    /*
     * Conservamos exactamente la lógica actual:
     * el primer sorteo de cada rifa es el más reciente porque la
     * consulta viene ordenada por fecha_sorteo DESC.
     */
    const sorteoPorRifa = sorteos.reduce((acc, sorteo) => {
      const rifaKey = String(sorteo.rifa_id);

      if (!acc[rifaKey]) {
        acc[rifaKey] = sorteo;
      }

      return acc;
    }, {});

    const rifasConStats = rifas.map((rifa) => {
      const rifaKey = String(rifa.id);

      const totalNumeros = obtenerTotalNumeros(rifa);

      const pagadosSet =
        pagadosPorRifa[rifaKey] || new Set();

      const freeSet =
        freePorRifa[rifaKey] || new Set();

      const ocupadosSet =
        ocupadosPorRifa[rifaKey] || new Set();

      const disponiblesInventarioSet =
        disponiblesInventarioPorRifa[rifaKey] || new Set();

      const ticketsPagados = pagadosSet.size;
      const ticketsFree = freeSet.size;
      const ticketsOcupados = ocupadosSet.size;

      /*
       * La disponibilidad pública se calcula contra los números
       * realmente ocupados.
       *
       * Esto evita que un ticket FREE vuelva a aparecer como
       * disponible para una compra normal.
       */
      const ticketsDisponibles = Math.max(
        totalNumeros - ticketsOcupados,
        0
      );

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

      const sorteo =
        sorteoPorRifa[rifaKey] || null;

      return {
        ...rifa,

        sorteo,

        numero_ganador:
          sorteo?.numero_ganador ??
          rifa.numero_ganador ??
          null,

        numero_oficial:
          sorteo?.numero_oficial ??
          rifa.numero_oficial ??
          null,

        total_numeros: totalNumeros,

        /*
         * COMPATIBILIDAD:
         *
         * Conservamos tickets_vendidos porque tu frontend ya lo usa.
         *
         * Para el progreso público representa números que ya no están
         * disponibles: PAGADOS + FREE + cualquier otro número ocupado.
         */
        tickets_vendidos: ticketsOcupados,

        tickets_pagados: ticketsPagados,
        tickets_free: ticketsFree,
        tickets_ocupados: ticketsOcupados,
        tickets_disponibles: ticketsDisponibles,

        porcentaje_vendido: porcentajeVendido,
        sold_out: soldOut,

        stats: {
          total: totalNumeros,

          /*
           * Campos anteriores conservados.
           */
          vendidos: ticketsOcupados,
          disponibles: ticketsDisponibles,
          porcentaje: porcentajeVendido,
          soldOut,
          ticketsVendidos: ticketsOcupados,
          porcentajeVendido,

          /*
           * Nuevos campos explícitos.
           */
          pagados: ticketsPagados,
          free: ticketsFree,
          ocupados: ticketsOcupados,

          ticketsPagados,
          ticketsFree,
          ticketsOcupados,

          /*
           * Dato de diagnóstico.
           *
           * Nos permite comparar el inventario físico marcado como
           * disponible con la disponibilidad matemática de la rifa.
           */
          disponiblesInventario:
            disponiblesInventarioSet.size,
        },
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rifas: rifasConStats,
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
    console.error("rifas-publicas error:", error);

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