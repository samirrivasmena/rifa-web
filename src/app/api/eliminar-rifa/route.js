import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const rifaId = String(body?.rifaId || body?.rifa_id || "").trim();

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    await supabaseAdmin.from("sorteos").delete().eq("rifa_id", rifaId);
    await supabaseAdmin.from("tickets").delete().eq("rifa_id", rifaId);
    await supabaseAdmin.from("compras").delete().eq("rifa_id", rifaId);

    const { error: deleteError } = await supabaseAdmin
      .from("rifas")
      .delete()
      .eq("id", rifaId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || "No se pudo eliminar la rifa" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rifa eliminada correctamente con sus datos asociados",
    });
  } catch (error) {
    console.error("eliminar-rifa error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}