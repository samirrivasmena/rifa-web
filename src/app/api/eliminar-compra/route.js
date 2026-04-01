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
    const { compraId } = body;

    if (!compraId) {
      return NextResponse.json(
        { error: "Falta el ID de la compra" },
        { status: 400 }
      );
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, estado_pago")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
      return NextResponse.json(
        { error: compraError.message },
        { status: 500 }
      );
    }

    if (!compra) {
      return NextResponse.json(
        { error: "La compra no existe" },
        { status: 404 }
      );
    }

    if (compra.estado_pago !== "rechazado") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar compras rechazadas" },
        { status: 400 }
      );
    }

    const { error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .delete()
      .eq("compra_id", compraId);

    if (ticketsError) {
      return NextResponse.json(
        { error: ticketsError.message },
        { status: 500 }
      );
    }

    const { error: deleteCompraError } = await supabaseAdmin
      .from("compras")
      .delete()
      .eq("id", compraId);

    if (deleteCompraError) {
      return NextResponse.json(
        { error: deleteCompraError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Compra rechazada eliminada correctamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}