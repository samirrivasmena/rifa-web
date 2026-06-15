import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("sorteos")
      .select(`
        id,
        rifa_id,
        numero_ganador,
        numero_oficial,
        nombre_ganador,
        foto_ganador_url,
        foto_ganador_secundaria_url,
        descripcion_resultado,
        ciudad_ganador,
        instagram_ganador,
        estado_entrega,
        fecha_entrega,
        nota_interna,
        fecha_sorteo,
        fuente,
        rifas (
          id,
          nombre,
          premio,
          descripcion,
          portada_url,
          portada_scroll_url,
          fecha_sorteo,
          hora_sorteo,
          estado,
          formato
        )
      `)
      .order("fecha_sorteo", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo cargar el historial" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, ganadores: data || [] });
  } catch (error) {
    console.error("historial-ganadores error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}