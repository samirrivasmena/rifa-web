import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const { data: compras, error: comprasError } = await supabaseAdmin
      .from("compras")
      .select(`
        *,
        usuarios (
          id,
          nombre,
          email,
          telefono
        )
      `)
      .order("fecha_compra", { ascending: false });

    if (comprasError) {
      return NextResponse.json(
        { error: comprasError.message || "Error al cargar compras" },
        { status: 500 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .order("numero_ticket", { ascending: true });

    if (ticketsError) {
      return NextResponse.json(
        { error: ticketsError.message || "Error al cargar tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      compras: compras || [],
      tickets: tickets || [],
    });
  } catch (error) {
    console.error("admin-compras error:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}