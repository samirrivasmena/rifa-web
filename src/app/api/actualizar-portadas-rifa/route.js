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
    const { rifaId, portada_url, portada_scroll_url } = body;

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    if (portada_url === undefined && portada_scroll_url === undefined) {
      return NextResponse.json(
        { error: "No se enviaron campos para actualizar" },
        { status: 400 }
      );
    }

    const updateData = {};

    if (portada_url !== undefined) {
      updateData.portada_url = portada_url || null;
    }

    if (portada_scroll_url !== undefined) {
      updateData.portada_scroll_url = portada_scroll_url || null;
    }

    const { data, error } = await supabaseAdmin
      .from("rifas")
      .update(updateData)
      .eq("id", rifaId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron actualizar las portadas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      rifa: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}