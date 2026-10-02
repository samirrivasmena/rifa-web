import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// ============================================================
// CAMPOS PÚBLICOS DE RIFAS
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

  return Number.isFinite(cantidad)
    ? cantidad
    : 0;
}

// ============================================================
// NÚMERO SEGURO
// ============================================================

function numeroSeguro(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

// ============================================================
// GET
// ============================================================

export async function GET() {
  try {
    // ========================================================
    // 1. CARGAR ÚNICAMENTE RIFAS PÚBLICAS
    // ========================================================

    const {
      data: rifasData,
      error: rifasError,
    } = await supabaseAdmin
      .from("rifas")
      .select(CAMPOS_PUBLICOS_RIFA)
      .in(
        "estado",
        [
          "activa",
          "finalizada",
          "agotada",
          "publicada",
        ]
      )
      .eq("publicada", true)
      .order("created_at", {
        ascending: false,
      });

    if (rifasError) {
      console.error(
        "Error cargando rifas públicas:",
        rifasError
      );

      return NextResponse.json(
        {
          error:
            "No se pudieron cargar las rifas públicas",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const rifas =
      Array.isArray(rifasData)
        ? rifasData
        : [];

    // ========================================================
    // 2. SI NO HAY RIFAS PÚBLICAS
    // ========================================================

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

    // ========================================================
    // 3. IDS DE RIFAS
    // ========================================================

    const rifaIds = rifas.map(
      (rifa) => rifa.id
    );

    // ========================================================
    // 4. CARGAR RESUMEN DE TICKETS
    // ========================================================
    //
    // IMPORTANTE:
    //
    // Ya NO descargamos todos los tickets de todas las rifas.
    //
    // Supabase calcula directamente:
    //
    // - PAGADOS
    // - FREE
    // - OCUPADOS
    // - DISPONIBLES DEL INVENTARIO
    //
    // usando la vista:
    //
    // resumen_publico_tickets_por_rifa
    //
    // ========================================================

    const {
      data: resumenTicketsData,
      error: resumenTicketsError,
    } = await supabaseAdmin
      .from("resumen_publico_tickets_por_rifa")
      .select(`
        rifa_id,
        tickets_pagados,
        tickets_free,
        tickets_ocupados,
        disponibles_inventario
      `)
      .in("rifa_id", rifaIds);

    if (resumenTicketsError) {
      console.error(
        "Error cargando resumen público de tickets:",
        resumenTicketsError
      );

      return NextResponse.json(
        {
          error:
            "No se pudo cargar el resumen de tickets",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // ========================================================
    // 5. CARGAR RESULTADOS DE SORTEOS
    // ========================================================

    const {
      data: sorteosData,
      error: sorteosError,
    } = await supabaseAdmin
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
      .in("rifa_id", rifaIds)
      .order("fecha_sorteo", {
        ascending: false,
      });

    if (sorteosError) {
      console.error(
        "Error cargando sorteos:",
        sorteosError
      );

      return NextResponse.json(
        {
          error:
            "No se pudieron cargar los sorteos",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // ========================================================
    // 6. NORMALIZAR DATOS
    // ========================================================

    const resumenTickets =
      Array.isArray(resumenTicketsData)
        ? resumenTicketsData
        : [];

    const sorteos =
      Array.isArray(sorteosData)
        ? sorteosData
        : [];

    // ========================================================
    // 7. MAPA DE RESUMEN POR RIFA
    // ========================================================

    const resumenPorRifa =
      resumenTickets.reduce(
        (acc, item) => {
          if (item?.rifa_id == null) {
            return acc;
          }

          acc[String(item.rifa_id)] = item;

          return acc;
        },
        {}
      );

    // ========================================================
    // 8. SORTEO MÁS RECIENTE POR RIFA
    // ========================================================

    const sorteoPorRifa =
      sorteos.reduce(
        (acc, sorteo) => {
          const rifaKey =
            String(sorteo.rifa_id);

          if (!acc[rifaKey]) {
            acc[rifaKey] = sorteo;
          }

          return acc;
        },
        {}
      );

    // ========================================================
    // 9. CONSTRUIR RIFAS CON ESTADÍSTICAS
    // ========================================================

    const rifasConStats =
      rifas.map((rifa) => {
        const rifaKey =
          String(rifa.id);

        const totalNumeros =
          obtenerTotalNumeros(rifa);

        const resumen =
          resumenPorRifa[rifaKey] || {};

        // ----------------------------------------------------
        // PAGADOS
        // ----------------------------------------------------

        const ticketsPagados =
          numeroSeguro(
            resumen.tickets_pagados
          );

        // ----------------------------------------------------
        // FREE
        // ----------------------------------------------------

        const ticketsFree =
          numeroSeguro(
            resumen.tickets_free
          );

        // ----------------------------------------------------
        // OCUPADOS
        // ----------------------------------------------------
        //
        // Incluye:
        //
        // - tickets de compra
        // - tickets FREE
        // - cualquier otro número ocupado
        //
        // ----------------------------------------------------

        const ticketsOcupados =
          numeroSeguro(
            resumen.tickets_ocupados
          );

        // ----------------------------------------------------
        // DISPONIBLES FÍSICOS DEL INVENTARIO
        // ----------------------------------------------------

        const disponiblesInventario =
          numeroSeguro(
            resumen.disponibles_inventario
          );

        // ----------------------------------------------------
        // DISPONIBLES PÚBLICOS
        // ----------------------------------------------------
        //
        // Siempre:
        //
        // TOTAL - OCUPADOS
        //
        // Así un FREE nunca vuelve a aparecer disponible.
        //
        // ----------------------------------------------------

        const ticketsDisponibles =
          Math.max(
            totalNumeros -
              ticketsOcupados,
            0
          );

        // ----------------------------------------------------
        // PORCENTAJE
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // AGOTADA
        // ----------------------------------------------------

        const soldOut =
          totalNumeros > 0 &&
          ticketsOcupados >=
            totalNumeros;

        // ----------------------------------------------------
        // SORTEO
        // ----------------------------------------------------

        const sorteo =
          sorteoPorRifa[rifaKey] ||
          null;

        // ----------------------------------------------------
        // RESPUESTA
        // ----------------------------------------------------

        return {
          ...rifa,

          sorteo,

          numero_ganador:
            sorteo?.numero_ganador ??
            rifa.numero_ganador ??
            null,

          numero_oficial:
            sorteo?.numero_oficial ??
            null,

          // ==================================================
          // ESTADÍSTICAS PRINCIPALES
          // ==================================================

          total_numeros:
            totalNumeros,

          /*
           * COMPATIBILIDAD CON TU FRONTEND:
           *
           * tickets_vendidos representa aquí
           * todos los números OCUPADOS.
           *
           * Es decir:
           *
           * PAGADOS + FREE + OTROS OCUPADOS.
           */

          tickets_vendidos:
            ticketsOcupados,

          tickets_pagados:
            ticketsPagados,

          tickets_free:
            ticketsFree,

          tickets_ocupados:
            ticketsOcupados,

          tickets_disponibles:
            ticketsDisponibles,

          porcentaje_vendido:
            porcentajeVendido,

          sold_out:
            soldOut,

          // ==================================================
          // STATS
          // ==================================================

          stats: {
            total:
              totalNumeros,

            vendidos:
              ticketsOcupados,

            disponibles:
              ticketsDisponibles,

            porcentaje:
              porcentajeVendido,

            soldOut,

            // ----------------------------------------------
            // CAMPOS DE COMPATIBILIDAD
            // ----------------------------------------------

            ticketsVendidos:
              ticketsOcupados,

            porcentajeVendido,

            // ----------------------------------------------
            // CAMPOS EXPLÍCITOS
            // ----------------------------------------------

            pagados:
              ticketsPagados,

            free:
              ticketsFree,

            ocupados:
              ticketsOcupados,

            ticketsPagados,

            ticketsFree,

            ticketsOcupados,

            // ----------------------------------------------
            // DIAGNÓSTICO DEL INVENTARIO
            // ----------------------------------------------

            disponiblesInventario,
          },
        };
      });

    // ========================================================
    // 10. RESPUESTA FINAL
    // ========================================================

    return NextResponse.json(
      {
        ok: true,
        rifas:
          rifasConStats,
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
      "rifas-publicas error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno del servidor",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}