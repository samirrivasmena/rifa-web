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

    const sorteoId = String(body.sorteoId || body.sorteo_id || "").trim();
    const padLength = Number(body.padLength || 4);
    const numero = Number(String(body.numero_ganador || "").replace(/\D/g, ""));

    if (!sorteoId) {
      return NextResponse.json({ error: "Falta sorteoId" }, { status: 400 });
    }

    if (!Number.isInteger(numero)) {
      return NextResponse.json({ error: "Número inválido" }, { status: 400 });
    }

    const numeroOficial = String(numero).padStart(padLength, "0");

    const estadoEntrega =
      String(body.estado_entrega || "").toLowerCase() === "entregado"
        ? "entregado"
        : "pendiente";

    const updateData = {
      numero_ganador: numero,
      numero_oficial: numeroOficial,
      fuente: body.fuente || "Rifa",

      nombre_ganador: body.nombre_ganador || null,
      foto_ganador_url: body.foto_ganador_url || null,
      foto_ganador_secundaria_url: body.foto_ganador_secundaria_url || null,
      descripcion_resultado: body.descripcion_resultado || null,
      ciudad_ganador: body.ciudad_ganador || null,
      instagram_ganador: body.instagram_ganador || null,

      estado_entrega: estadoEntrega,
      fecha_entrega:
        estadoEntrega === "entregado"
          ? body.fecha_entrega || new Date().toISOString()
          : body.fecha_entrega || null,
      nota_interna: body.nota_interna || null,
    };

    if (body.fecha_sorteo) {
      updateData.fecha_sorteo = body.fecha_sorteo;
    }

    const { error } = await supabaseAdmin
      .from("sorteos")
      .update(updateData)
      .eq("id", sorteoId);

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo editar el ganador" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      numero_ganador: numero,
      numero_oficial: numeroOficial,
      estado_entrega: estadoEntrega,
      fecha_entrega: updateData.fecha_entrega,
      nota_interna: updateData.nota_interna,
    });
  } catch (error) {
    console.error("editar-ganador error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}