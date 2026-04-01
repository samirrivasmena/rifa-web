import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("estado", "activa")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo obtener la rifa activa" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rifa: Array.isArray(data) && data.length > 0 ? data[0] : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}