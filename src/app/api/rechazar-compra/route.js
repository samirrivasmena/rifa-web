import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const limpio = limpiarTexto(valor);
  return Boolean(limpio) && limpio.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(limpio);
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Cuerpo de la solicitud inválido", 400);
    }

    const compraIdLimpio = limpiarTexto(body?.compraId);

    if (!validarId(compraIdLimpio)) {
      return errorResponse("Falta el ID de la compra", 400);
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, estado_pago")
      .eq("id", compraIdLimpio)
      .maybeSingle();

    if (compraError) {
      console.error("Error buscando compra para rechazar:", compraError);
      return errorResponse("No se pudo consultar la compra", 500);
    }

    if (!compra) {
      return errorResponse("La compra no existe", 404);
    }

    const estadoActual = String(compra.estado_pago || "").toLowerCase();

    if (estadoActual === "rechazado") {
      return errorResponse("La compra ya está rechazada", 400);
    }

    if (estadoActual === "aprobado") {
      const { data: ticketsAsignados, error: ticketsError } = await supabaseAdmin
        .from("tickets")
        .select("id")
        .eq("compra_id", compra.id)
        .limit(1);

      if (ticketsError) {
        console.error("Error verificando tickets de compra aprobada:", ticketsError);
        return errorResponse("No se pudo verificar si la compra tiene tickets asignados", 500);
      }

      if (Array.isArray(ticketsAsignados) && ticketsAsignados.length > 0) {
        return errorResponse(
          "La compra ya fue aprobada y tiene tickets asignados. No puede rechazarse.",
          400
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago: "rechazado",
      })
      .eq("id", compraIdLimpio);

    if (updateError) {
      console.error("Error rechazando compra:", updateError);
      return errorResponse("No se pudo rechazar la compra", 500);
    }

    return NextResponse.json({
      ok: true,
      message: "Compra rechazada correctamente",
      compra: {
        id: compraIdLimpio,
        estado_pago: "rechazado",
      },
    });
  } catch (error) {
    console.error("rechazar-compra error:", error);
    return errorResponse("No se pudo procesar el rechazo de la compra", 500);
  }
}