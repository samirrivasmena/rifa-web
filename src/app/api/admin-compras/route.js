import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function traerTodosLosTickets() {
  const pageSize = 1000;
  let from = 0;
  let allTickets = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .order("numero_ticket", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    allTickets = [...allTickets, ...(data || [])];

    if (!data || data.length < pageSize) break;

    from += pageSize;
  }

  return allTickets;
}

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
        ),
        rifas (
          id,
          nombre,
          premio,
          descripcion,
          portada_url,
          portada_scroll_url,
          fecha_sorteo,
          hora_sorteo,
          formato,
          estado
        )
      `)
      .order("fecha_compra", { ascending: false });

    if (comprasError) {
      return NextResponse.json(
        { error: comprasError.message || "Error al cargar compras" },
        { status: 500 }
      );
    }

    const tickets = await traerTodosLosTickets();

    return NextResponse.json(
      {
        ok: true,
        compras: compras || [],
        tickets: tickets || [],
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
    console.error("admin-compras error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}