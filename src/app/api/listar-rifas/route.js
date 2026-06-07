import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

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

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { data: rifasData, error: rifasError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .order("created_at", { ascending: false });

    if (rifasError) {
      return NextResponse.json(
        { error: rifasError.message || "No se pudieron cargar las rifas" },
        { status: 500 }
      );
    }

    const rifas = Array.isArray(rifasData) ? rifasData : [];

    if (!rifas.length) {
      return NextResponse.json({ ok: true, rifas: [] });
    }

    const rifaIds = rifas.map((r) => r.id);

    const { data: ticketsData, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("rifa_id, numero_ticket, compra_id")
      .in("rifa_id", rifaIds)
      .not("compra_id", "is", null);

    if (ticketsError) {
      return NextResponse.json(
        { error: ticketsError.message || "No se pudieron cargar los tickets" },
        { status: 500 }
      );
    }

    const { data: comprasData, error: comprasError } = await supabaseAdmin
      .from("compras")
      .select("id, rifa_id")
      .in("rifa_id", rifaIds);

    if (comprasError) {
      return NextResponse.json(
        { error: comprasError.message || "No se pudieron cargar las compras" },
        { status: 500 }
      );
    }

    const { data: sorteosData, error: sorteosError } = await supabaseAdmin
      .from("sorteos")
      .select("id, rifa_id, numero_ganador, numero_oficial, fecha_sorteo, fuente")
      .in("rifa_id", rifaIds)
      .order("fecha_sorteo", { ascending: false });

    if (sorteosError) {
      return NextResponse.json(
        { error: sorteosError.message || "No se pudieron cargar los sorteos" },
        { status: 500 }
      );
    }

    const tickets = Array.isArray(ticketsData) ? ticketsData : [];
    const compras = Array.isArray(comprasData) ? comprasData : [];
    const sorteos = Array.isArray(sorteosData) ? sorteosData : [];

    const ticketsPorRifa = tickets.reduce((acc, ticket) => {
      if (
        ticket?.rifa_id == null ||
        ticket?.numero_ticket == null ||
        ticket?.numero_ticket === ""
      ) {
        return acc;
      }

      const rifaKey = String(ticket.rifa_id);
      const numeroKey = String(ticket.numero_ticket);

      if (!acc[rifaKey]) acc[rifaKey] = new Set();
      acc[rifaKey].add(numeroKey);

      return acc;
    }, {});

    const comprasPorRifa = compras.reduce((acc, compra) => {
      if (!compra?.rifa_id) return acc;

      const rifaKey = String(compra.rifa_id);
      acc[rifaKey] = (acc[rifaKey] || 0) + 1;

      return acc;
    }, {});

    const sorteoPorRifa = sorteos.reduce((acc, sorteo) => {
      const rifaKey = String(sorteo.rifa_id);
      if (!acc[rifaKey]) acc[rifaKey] = sorteo;
      return acc;
    }, {});

    const rifasConStats = rifas.map((rifa) => {
      const totalNumeros = obtenerTotalNumeros(rifa);
      const vendidosSet = ticketsPorRifa[String(rifa.id)] || new Set();
      const ticketsVendidos = vendidosSet.size;
      const ticketsDisponibles = Math.max(totalNumeros - ticketsVendidos, 0);
      const comprasCount = comprasPorRifa[String(rifa.id)] || 0;

      const porcentajeVendido =
        totalNumeros > 0
          ? Number(((ticketsVendidos / totalNumeros) * 100).toFixed(2))
          : 0;

      const soldOut = totalNumeros > 0 && ticketsVendidos >= totalNumeros;
      const sorteo = sorteoPorRifa[String(rifa.id)] || null;

      return {
        ...rifa,
        sorteo,
        numero_ganador: sorteo?.numero_ganador ?? rifa.numero_ganador ?? null,
        numero_oficial: sorteo?.numero_oficial ?? rifa.numero_oficial ?? null,
        total_numeros: totalNumeros,
        total_compras: comprasCount,
        compras_count: comprasCount,
        tickets_vendidos: ticketsVendidos,
        tickets_disponibles: ticketsDisponibles,
        porcentaje_vendido: porcentajeVendido,
        sold_out: soldOut,
        stats: {
          compras: comprasCount,
          total: totalNumeros,
          vendidos: ticketsVendidos,
          disponibles: ticketsDisponibles,
          porcentaje: porcentajeVendido,
          soldOut,
          ticketsVendidos,
          porcentajeVendido,
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
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("listar-rifas error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}