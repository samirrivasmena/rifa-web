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
    const { data, error } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron listar las rifas" },
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