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

    if (compra.estado_pago === "rechazado") {
      return NextResponse.json(
        { error: "La compra ya está rechazada" },
        { status: 400 }
      );
    }

    if (compra.estado_pago === "aprobado") {
      const { data: ticketsAsignados, error: ticketsError } = await supabaseAdmin
        .from("tickets")
        .select("id")
        .eq("compra_id", compra.id)
        .limit(1);

      if (ticketsError) {
        return NextResponse.json(
          { error: ticketsError.message },
          { status: 500 }
        );
      }

      if (ticketsAsignados && ticketsAsignados.length > 0) {
        return NextResponse.json(
          {
            error: "La compra ya fue aprobada y tiene tickets asignados. No puede rechazarse.",
          },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("compras")
      .update({ estado_pago: "rechazado" })
      .eq("id", compraId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Compra rechazada correctamente",
    });
  } catch (error) {
    console.error("rechazar-compra error:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}