import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    const { data: rifasData, error: rifasError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .in("estado", ["activa", "finalizada"])
      .order("created_at", { ascending: false });

    if (rifasError) {
      return NextResponse.json(
        { error: rifasError.message || "No se pudieron cargar las rifas públicas" },
        { status: 500 }
      );
    }

    const rifas = Array.isArray(rifasData) ? rifasData : [];

    if (!rifas.length) {
      return NextResponse.json({
        ok: true,
        rifas: [],
      });
    }

    const rifaIds = rifas.map((rifa) => rifa.id);

    const { data: ticketsData, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id, rifa_id")
      .in("rifa_id", rifaIds);

    if (ticketsError) {
      return NextResponse.json(
        { error: ticketsError.message || "No se pudieron cargar los tickets de las rifas" },
        { status: 500 }
      );
    }

    const tickets = Array.isArray(ticketsData) ? ticketsData : [];

    const ticketsPorRifa = tickets.reduce((acc, ticket) => {
      const key = String(ticket.rifa_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const rifasConProgreso = rifas.map((rifa) => {
      const totalNumerosRaw = Number(
        rifa.cantidad_numeros ?? rifa.total_tickets ?? rifa.numeros_totales ?? 0
      );

      const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;
      const ticketsVendidos = ticketsPorRifa[String(rifa.id)] || 0;

      const porcentajeVendido =
        totalNumeros > 0
          ? Number(((ticketsVendidos / totalNumeros) * 100).toFixed(2))
          : 0;

      return {
        ...rifa,
        tickets_vendidos: ticketsVendidos,
        porcentaje_vendido: porcentajeVendido,
      };
    });

    return NextResponse.json({
      ok: true,
      rifas: rifasConProgreso,
    });
  } catch (error) {
    console.error("rifas-publicas error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}