import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .in("estado", ["activa", "finalizada"])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron cargar las rifas públicas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rifas: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}