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

async function restaurarTickets(ticketsBackup = []) {
  if (!Array.isArray(ticketsBackup) || ticketsBackup.length === 0) {
    return { ok: true };
  }

  const payload = ticketsBackup.map((ticket) => ({
    compra_id: ticket.compra_id,
    rifa_id: ticket.rifa_id,
    numero_ticket: ticket.numero_ticket,
  }));

  const { error } = await supabaseAdmin.from("tickets").insert(payload);

  if (error) {
    return { ok: false, error: error.message || "No se pudieron restaurar los tickets" };
  }

  return { ok: true };
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

    const compraId = limpiarTexto(body?.compraId);

    if (!validarId(compraId)) {
      return errorResponse("Falta el ID de la compra", 400);
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, estado_pago")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
      console.error("Error consultando compra para eliminar:", compraError);
      return errorResponse("No se pudo consultar la compra", 500);
    }

    if (!compra) {
      return errorResponse("La compra no existe", 404);
    }

    const estadoActual = String(compra.estado_pago || "").toLowerCase();

    if (estadoActual !== "rechazado") {
      return errorResponse("Solo se pueden eliminar compras rechazadas", 400);
    }

    // Respaldo de tickets antes de eliminarlos, por si hay que revertir
    const { data: ticketsPrevios, error: ticketsReadError } = await supabaseAdmin
      .from("tickets")
      .select("compra_id, rifa_id, numero_ticket")
      .eq("compra_id", compraId);

    if (ticketsReadError) {
      console.error("Error leyendo tickets asociados:", ticketsReadError);
      return errorResponse("No se pudieron verificar los tickets asociados", 500);
    }

    const ticketsBackup = Array.isArray(ticketsPrevios) ? ticketsPrevios : [];

    // Si existen tickets asociados, los eliminamos primero
    if (ticketsBackup.length > 0) {
      const { error: ticketsDeleteError } = await supabaseAdmin
        .from("tickets")
        .delete()
        .eq("compra_id", compraId);

      if (ticketsDeleteError) {
        console.error("Error eliminando tickets asociados:", ticketsDeleteError);
        return errorResponse("No se pudieron eliminar los tickets asociados", 500);
      }
    }

    // Luego eliminamos la compra
    const { error: deleteCompraError } = await supabaseAdmin
      .from("compras")
      .delete()
      .eq("id", compraId);

    if (deleteCompraError) {
      console.error("Error eliminando compra:", deleteCompraError);

      // Intento de rollback de tickets si la compra no se pudo borrar
      if (ticketsBackup.length > 0) {
        const restore = await restaurarTickets(ticketsBackup);

        if (!restore.ok) {
          console.error("Rollback de tickets falló:", restore.error);
        }
      }

      return errorResponse("No se pudo eliminar la compra", 500);
    }

    return NextResponse.json({
      ok: true,
      message: "Compra rechazada eliminada correctamente",
      compra: {
        id: compraId,
        estado_pago: "eliminada",
      },
    });
  } catch (error) {
    console.error("eliminar-compra error:", error);
    return errorResponse("No se pudo procesar la eliminación de la compra", 500);
  }
}