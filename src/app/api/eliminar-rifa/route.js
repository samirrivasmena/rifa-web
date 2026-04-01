import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();
    const { rifaId } = body;

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    const { data: compras, error: comprasError } = await supabaseAdmin
      .from("compras")
      .select("id")
      .eq("rifa_id", rifaId)
      .limit(1);

    if (comprasError) {
      return NextResponse.json(
        { error: comprasError.message },
        { status: 500 }
      );
    }

    if (compras && compras.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una rifa que tiene compras asociadas" },
        { status: 400 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id")
      .eq("rifa_id", rifaId)
      .limit(1);

    if (ticketsError) {
      return NextResponse.json(
        { error: ticketsError.message },
        { status: 500 }
      );
    }

    if (tickets && tickets.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una rifa que tiene tickets asociados" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("rifas")
      .delete()
      .eq("id", rifaId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rifa eliminada correctamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}