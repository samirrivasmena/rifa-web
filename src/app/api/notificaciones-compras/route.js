import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("compras")
      .select(`
        id,
        cantidad_tickets,
        fecha_compra,
        usuarios!compras_usuario_id_fkey (
          nombre
        ),
        rifas!compras_rifa_id_fkey (
          nombre
        )
      `)
      .eq("estado_pago", "aprobado")
      .order("fecha_compra", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
      });
    }

    const compras = (data || []).map((compra) => ({
      id: compra.id,
      nombre: compra.usuarios?.nombre || "Cliente",
      cantidad_tickets: compra.cantidad_tickets || 1,
      rifa: compra.rifas?.nombre || "Rifa",
      fecha_compra: compra.fecha_compra,
    }));

    return NextResponse.json({
      ok: true,
      compras,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
    });
  }
}