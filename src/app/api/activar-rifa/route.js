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
    const { rifaId } = body;

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return NextResponse.json(
        { error: rifaError.message },
        { status: 500 }
      );
    }

    if (!rifa) {
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 404 }
      );
    }

    const { error: cerrarOtrasError } = await supabaseAdmin
      .from("rifas")
      .update({ estado: "cerrada" })
      .eq("estado", "activa");

    if (cerrarOtrasError) {
      return NextResponse.json(
        { error: cerrarOtrasError.message },
        { status: 500 }
      );
    }

    const { error: activarError } = await supabaseAdmin
      .from("rifas")
      .update({ estado: "activa" })
      .eq("id", rifaId);

    if (activarError) {
      return NextResponse.json(
        { error: activarError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rifa activada correctamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}