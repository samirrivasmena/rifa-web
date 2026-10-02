import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// ============================================================
// CAMPOS PÚBLICOS DE RIFA
// ============================================================

const CAMPOS_PUBLICOS_RIFA = `
  id,
  nombre,
  descripcion,
  numero_inicio,
  numero_fin,
  cantidad_numeros,
  formato,
  estado,
  numero_ganador,
  portada_url,
  portada_scroll_url,
  premio,
  precio_ticket,
  fecha_sorteo,
  hora_sorteo,
  publicada,
  destacada
`;

// ============================================================
// TOTAL DE NÚMEROS
// ============================================================

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

  return Number.isFinite(cantidad) ? cantidad : 0;
}

// ============================================================
// NORMALIZAR TEXTO
// ============================================================

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

// ============================================================
// HEADERS
// ============================================================

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// ============================================================
// GET
// ============================================================

export async function GET() {
  try {
    // ========================================================
    // BUSCAR RIFAS PUBLICADAS ACTIVAS O AGOTADAS
    // ========================================================

    const {
      data: rifasData,
      error: rifasError,
    } = await supabaseAdmin
      .from("rifas")
      .select(CAMPOS_PUBLICOS_RIFA)
      .in("estado", ["activa", "agotada"])
      .eq("publicada", true)
      .order("created_at", {
        ascending: false,
      });

    // ========================================================
    // ERROR CARGANDO RIFAS
    // ========================================================

    if (rifasError) {
      console.error(
        "Error cargando rifa activa:",
        rifasError
      );

      return NextResponse.json(
        {
          error: "No se pudo obtener la rifa activa",
        },
        {
          status: 500,
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    const rifas = Array.isArray(rifasData)
      ? rifasData
      : [];

    // ========================================================
    // BUSCAR ACTIVA
    // ========================================================

    const rifaActiva = rifas.find(
      (rifa) =>
        normalizarTexto(rifa?.estado) === "activa"
    );

    // ========================================================
    // BUSCAR AGOTADA
    // ========================================================

    const rifaAgotada = rifas.find(
      (rifa) =>
        normalizarTexto(rifa?.estado) === "agotada"
    );

    // ========================================================
    // PRIORIDAD
    // ========================================================

    const rifa =
      rifaActiva ||
      rifaAgotada ||
      null;

    // ========================================================
    // SI NO HAY RIFA
    // ========================================================

    if (!rifa) {
      return NextResponse.json(
        {
          ok: true,
          rifa: null,
        },
        {
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // TOTAL DE NÚMEROS
    // ========================================================

    const totalNumeros =
      obtenerTotalNumeros(rifa);

    // ========================================================
    // CARGAR RESUMEN DE TICKETS + SORTEO EN PARALELO
    // ========================================================
    //
    // Estas dos consultas no dependen una de la otra.
    // Por eso las ejecutamos al mismo tiempo.
    // ========================================================

    const [
      resumenTicketsResult,
      sorteoResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("resumen_publico_tickets_por_rifa")
        .select(`
          rifa_id,
          tickets_pagados,
          tickets_free,
          tickets_ocupados,
          disponibles_inventario
        `)
        .eq("rifa_id", rifa.id)
        .maybeSingle(),

      supabaseAdmin
        .from("sorteos")
        .select(
          [
            "id",
            "rifa_id",
            "numero_ganador",
            "numero_oficial",
            "fecha_sorteo",
            "fuente",
          ].join(",")
        )
        .eq("rifa_id", rifa.id)
        .order("fecha_sorteo", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle(),
    ]);

    // ========================================================
    // RESULTADO DEL RESUMEN
    // ========================================================

    const {
      data: resumenTickets,
      error: ticketsError,
    } = resumenTicketsResult;

    // ========================================================
    // RESULTADO DEL SORTEO
    // ========================================================

    const {
      data: sorteoData,
      error: sorteoError,
    } = sorteoResult;

    // ========================================================
    // ERROR EN RESUMEN DE TICKETS
    // ========================================================

    if (ticketsError) {
      console.error(
        "Error cargando resumen de tickets de rifa activa:",
        ticketsError
      );

      return NextResponse.json(
        {
          error:
            "No se pudo obtener el resumen de tickets de la rifa activa",
        },
        {
          status: 500,
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // ERROR EN SORTEO
    // ========================================================
    //
    // Un error en el sorteo no impide mostrar la rifa.
    // ========================================================

    if (sorteoError) {
      console.error(
        "rifa-activa sorteo error:",
        sorteoError
      );
    }

    // ========================================================
    // TOTALES DESDE LA VISTA
    // ========================================================

    const ticketsPagados =
      Number(
        resumenTickets?.tickets_pagados || 0
      );

    const ticketsFree =
      Number(
        resumenTickets?.tickets_free || 0
      );

    const ticketsOcupados =
      Number(
        resumenTickets?.tickets_ocupados || 0
      );

    const disponiblesInventario =
      Number(
        resumenTickets?.disponibles_inventario || 0
      );

    // ========================================================
    // DISPONIBLES
    // ========================================================
    //
    // TOTAL - OCUPADOS
    //
    // Los FREE también cuentan como ocupados.
    // ========================================================

    const ticketsDisponibles =
      Math.max(
        totalNumeros - ticketsOcupados,
        0
      );

    // ========================================================
    // COMPATIBILIDAD
    // ========================================================
    //
    // Conservamos tickets_vendidos como ocupación total
    // para no romper componentes existentes.
    // ========================================================

    const ticketsVendidos =
      ticketsOcupados;

    // ========================================================
    // PORCENTAJE
    // ========================================================

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(
            (
              (ticketsOcupados /
                totalNumeros) *
              100
            ).toFixed(2)
          )
        : 0;

    // ========================================================
    // SOLD OUT
    // ========================================================

    const soldOut =
      totalNumeros > 0 &&
      ticketsOcupados >= totalNumeros;

    // ========================================================
    // RESPUESTA
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        rifa: {
          ...rifa,

          // ==================================================
          // SORTEO
          // ==================================================

          sorteo:
            sorteoData || null,

          numero_ganador:
            sorteoData?.numero_ganador ??
            rifa.numero_ganador ??
            null,

          numero_oficial:
            sorteoData?.numero_oficial ??
            null,

          // ==================================================
          // ESTADÍSTICAS
          // ==================================================

          total_numeros:
            totalNumeros,

          tickets_vendidos:
            ticketsVendidos,

          tickets_disponibles:
            ticketsDisponibles,

          porcentaje_vendido:
            porcentajeVendido,

          sold_out:
            soldOut,

          // ==================================================
          // DESGLOSE
          // ==================================================

          tickets_pagados:
            ticketsPagados,

          tickets_free:
            ticketsFree,

          tickets_ocupados:
            ticketsOcupados,

          // ==================================================
          // STATS
          // ==================================================

          stats: {
            total:
              totalNumeros,

            vendidos:
              ticketsVendidos,

            disponibles:
              ticketsDisponibles,

            porcentaje:
              porcentajeVendido,

            soldOut,

            ticketsVendidos,

            porcentajeVendido,

            pagados:
              ticketsPagados,

            free:
              ticketsFree,

            ocupados:
              ticketsOcupados,

            ticketsPagados,

            ticketsFree,

            ticketsOcupados,

            disponiblesInventario,
          },
        },
      },
      {
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    // ========================================================
    // ERROR GENERAL
    // ========================================================

    console.error(
      "rifa-activa error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno del servidor",
      },
      {
        status: 500,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}