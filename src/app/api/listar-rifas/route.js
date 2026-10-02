import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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
    // ========================================================
    // 1. CARGAR RIFAS
    // ========================================================

    const {
      data: rifasData,
      error: rifasError,
    } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (rifasError) {
      return NextResponse.json(
        {
          error:
            rifasError.message ||
            "No se pudieron cargar las rifas",
        },
        {
          status: 500,
        }
      );
    }

    const rifas =
      Array.isArray(rifasData)
        ? rifasData
        : [];

    // ========================================================
    // SI NO HAY RIFAS
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
    // 2. IDS DE RIFAS
    // ========================================================

    const rifaIds =
      rifas.map((rifa) => rifa.id);

    // ========================================================
    // 3. CARGAR DATOS RELACIONADOS EN PARALELO
    // ========================================================
    //
    // Estas tres consultas solamente necesitan rifaIds.
    //
    // Por eso no hace falta:
    //
    // resumen -> esperar
    // compras -> esperar
    // sorteos -> esperar
    //
    // Ahora se ejecutan simultáneamente.
    // ========================================================

    const [
      resumenTicketsResult,
      comprasResult,
      sorteosResult,
    ] = await Promise.all([
      // ------------------------------------------------------
      // RESUMEN REAL DE TICKETS
      // ------------------------------------------------------

      supabaseAdmin
        .from("resumen_publico_tickets_por_rifa")
        .select(`
          rifa_id,
          tickets_pagados,
          tickets_free,
          tickets_ocupados,
          disponibles_inventario
        `)
        .in("rifa_id", rifaIds),

      // ------------------------------------------------------
      // COMPRAS
      // ------------------------------------------------------

      supabaseAdmin
        .from("compras")
        .select("id, rifa_id")
        .in("rifa_id", rifaIds),

      // ------------------------------------------------------
      // SORTEOS
      // ------------------------------------------------------

      supabaseAdmin
        .from("sorteos")
        .select(
          "id, rifa_id, numero_ganador, numero_oficial, fecha_sorteo, fuente"
        )
        .in("rifa_id", rifaIds)
        .order("fecha_sorteo", {
          ascending: false,
        }),
    ]);

    // ========================================================
    // 4. RESULTADO DEL RESUMEN DE TICKETS
    // ========================================================

    const {
      data: resumenTicketsData,
      error: resumenTicketsError,
    } = resumenTicketsResult;

    if (resumenTicketsError) {
      return NextResponse.json(
        {
          error:
            resumenTicketsError.message ||
            "No se pudo cargar el resumen de tickets",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 5. RESULTADO DE COMPRAS
    // ========================================================

    const {
      data: comprasData,
      error: comprasError,
    } = comprasResult;

    if (comprasError) {
      return NextResponse.json(
        {
          error:
            comprasError.message ||
            "No se pudieron cargar las compras",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 6. RESULTADO DE SORTEOS
    // ========================================================

    const {
      data: sorteosData,
      error: sorteosError,
    } = sorteosResult;

    if (sorteosError) {
      return NextResponse.json(
        {
          error:
            sorteosError.message ||
            "No se pudieron cargar los sorteos",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 7. NORMALIZAR
    // ========================================================

    const resumenTickets =
      Array.isArray(resumenTicketsData)
        ? resumenTicketsData
        : [];

    const compras =
      Array.isArray(comprasData)
        ? comprasData
        : [];

    const sorteos =
      Array.isArray(sorteosData)
        ? sorteosData
        : [];

    // ========================================================
    // 8. RESUMEN DE TICKETS POR RIFA
    // ========================================================

    const resumenPorRifa =
      resumenTickets.reduce(
        (acc, item) => {
          if (!item?.rifa_id) {
            return acc;
          }

          acc[String(item.rifa_id)] =
            item;

          return acc;
        },
        {}
      );

    // ========================================================
    // 9. COMPRAS POR RIFA
    // ========================================================

    const comprasPorRifa =
      compras.reduce(
        (acc, compra) => {
          if (!compra?.rifa_id) {
            return acc;
          }

          const rifaKey =
            String(compra.rifa_id);

          acc[rifaKey] =
            (acc[rifaKey] || 0) + 1;

          return acc;
        },
        {}
      );

    // ========================================================
    // 10. SORTEO MÁS RECIENTE POR RIFA
    // ========================================================
    //
    // La consulta ya viene ordenada:
    // fecha_sorteo DESC
    //
    // Por eso el primero encontrado para cada rifa
    // es el más reciente.
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
    // 11. CONSTRUIR RIFAS
    // ========================================================

    const rifasConStats =
      rifas.map((rifa) => {
        const rifaKey =
          String(rifa.id);

        // ----------------------------------------------------
        // TOTAL
        // ----------------------------------------------------

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

        const ticketsOcupados =
          numeroSeguro(
            resumen.tickets_ocupados
          );

        // ----------------------------------------------------
        // DISPONIBLES
        // ----------------------------------------------------
        //
        // FREE también cuenta como ocupado.
        // ----------------------------------------------------

        const ticketsDisponibles =
          Math.max(
            totalNumeros -
              ticketsOcupados,
            0
          );

        // ----------------------------------------------------
        // INVENTARIO
        // ----------------------------------------------------

        const disponiblesInventario =
          numeroSeguro(
            resumen.disponibles_inventario
          );

        // ----------------------------------------------------
        // COMPRAS
        // ----------------------------------------------------

        const comprasCount =
          comprasPorRifa[rifaKey] ||
          0;

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
        // SOLD OUT
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

        // ====================================================
        // RESPUESTA DE ESTA RIFA
        // ====================================================

        return {
          ...rifa,

          // --------------------------------------------------
          // SORTEO
          // --------------------------------------------------

          sorteo,

          numero_ganador:
            sorteo?.numero_ganador ??
            rifa.numero_ganador ??
            null,

          numero_oficial:
            sorteo?.numero_oficial ??
            rifa.numero_oficial ??
            null,

          // --------------------------------------------------
          // TOTALES
          // --------------------------------------------------

          total_numeros:
            totalNumeros,

          total_compras:
            comprasCount,

          compras_count:
            comprasCount,

          // --------------------------------------------------
          // TICKETS
          // --------------------------------------------------
          //
          // IMPORTANTE:
          //
          // tickets_vendidos mantiene compatibilidad
          // con tu Dashboard y representa OCUPADOS.
          //
          // --------------------------------------------------

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
            compras:
              comprasCount,

            total:
              totalNumeros,

            vendidos:
              ticketsOcupados,

            disponibles:
              ticketsDisponibles,

            porcentaje:
              porcentajeVendido,

            soldOut,

            ticketsVendidos:
              ticketsOcupados,

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
        };
      });

    // ========================================================
    // 12. RESPUESTA FINAL
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
      "listar-rifas error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Error interno del servidor",
      },
      {
        status: 500,
      }
    );
  }
}