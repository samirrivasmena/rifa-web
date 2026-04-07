import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    const { data: rifasData, error: rifasError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .in("estado", ["activa", "agotada"])
      .order("created_at", { ascending: false });

    if (rifasError) {
      return NextResponse.json(
        { error: rifasError.message || "No se pudo obtener la rifa activa" },
        { status: 500 }
      );
    }

    const rifas = Array.isArray(rifasData) ? rifasData : [];

    const rifaActiva = rifas.find(
      (r) => String(r.estado || "").toLowerCase() === "activa"
    );

    const rifaAgotada = rifas.find(
      (r) => String(r.estado || "").toLowerCase() === "agotada"
    );

    const rifa = rifaActiva || rifaAgotada || null;

    if (!rifa) {
      return NextResponse.json({
        ok: true,
        rifa: null,
      });
    }

    const { data: ticketsData, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id, rifa_id, numero_ticket, compra_id")
      .eq("rifa_id", rifa.id);

    if (ticketsError) {
      return NextResponse.json(
        { error: ticketsError.message || "No se pudieron obtener los tickets de la rifa activa" },
        { status: 500 }
      );
    }

    const ticketsVendidos = Array.isArray(ticketsData) ? ticketsData.length : 0;

    const totalNumerosRaw = Number(
      rifa.cantidad_numeros ?? rifa.total_tickets ?? rifa.numeros_totales ?? 0
    );

    const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(((ticketsVendidos / totalNumeros) * 100).toFixed(2))
        : 0;

    return NextResponse.json({
      ok: true,
      rifa: {
        ...rifa,
        tickets_vendidos: ticketsVendidos,
        porcentaje_vendido: porcentajeVendido,
      },
    });
  } catch (error) {
    console.error("rifa-activa error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}