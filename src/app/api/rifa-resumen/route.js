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
  if (Number.isFinite(cantidad) && cantidad > 0) return cantidad;

  return String(rifa?.formato) === "3digitos" ? 1000 : 10000;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rifaId = searchParams.get("rifaId");

    let rifa = null;

    if (rifaId) {
      const { data, error } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("id", rifaId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message || "No se pudo cargar la rifa" },
          { status: 500 }
        );
      }

      rifa = data || null;
    } else {
      const { data, error } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("publicada", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message || "No se pudo cargar la rifa activa" },
          { status: 500 }
        );
      }

      rifa = data || null;
    }

    if (!rifa) {
      return NextResponse.json({
        ok: true,
        rifa: null,
      });
    }

    const totalNumeros = obtenerTotalNumeros(rifa);

    const { data: ticketsData, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("numero_ticket, compra_id")
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

    const tickets = Array.isArray(ticketsData) ? ticketsData : [];

    const ticketsVendidos = tickets.filter(
      (t) => t?.compra_id !== null && t?.compra_id !== undefined
    ).length;

    const ticketsDisponibles = Math.max(totalNumeros - ticketsVendidos, 0);

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(((ticketsVendidos / totalNumeros) * 100).toFixed(2))
        : 0;

    const soldOut = totalNumeros > 0 && ticketsVendidos >= totalNumeros;

    return NextResponse.json(
      {
        ok: true,
        rifa: {
          ...rifa,
          total_numeros: totalNumeros,
          tickets_vendidos: ticketsVendidos,
          tickets_disponibles: ticketsDisponibles,
          porcentaje_vendido: porcentajeVendido,
          sold_out: soldOut,
          stats: {
            total: totalNumeros,
            vendidos: ticketsVendidos,
            disponibles: ticketsDisponibles,
            porcentaje: porcentajeVendido,
            soldOut,
            ticketsVendidos,
            porcentajeVendido,
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
    console.error("rifa-resumen error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}