import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraRechazadaEmail } from "../../../lib/sendCompraRechazadaEmail";

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
  .select(`
    id,
    usuario_id,
    rifa_id,
    estado_pago,
    cantidad_tickets,
    monto_total,
    referencia,
    metodo_pago,
    fecha_compra,
    usuarios (
      id,
      nombre,
      email
    ),
    rifas (
      id,
      nombre,
      portada_url,
      portada_scroll_url
    )
  `)
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
    // =========================================================
// EMAIL DE COMPRA RECHAZADA
// =========================================================

let emailEnviado = false;
let emailErrorMensaje = null;

try {
  const emailDestino =
    compra?.usuarios?.email || "";

  if (emailDestino) {
    const protoRaw =
      req.headers.get("x-forwarded-proto") || "https";

    const proto =
      protoRaw.split(",")[0].trim();

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";

    const envUrl =
      String(process.env.NEXT_PUBLIC_SITE_URL || "")
        .trim()
        .replace(/\/$/, "");

    const baseUrl =
      envUrl ||
      `${proto}://${host}`.replace(/\/$/, "");

    const rifa =
      compra?.rifas || {};

    await sendCompraRechazadaEmail({
      to: emailDestino,

      nombre:
        compra?.usuarios?.nombre ||
        "cliente",

      rifaNombre:
        rifa?.nombre ||
        "Evento",

      portadaUrl:
        rifa?.portada_url ||
        rifa?.portada_scroll_url ||
        "",

      cantidadTickets:
        Number(compra?.cantidad_tickets || 0),

      montoTotal:
        Number(compra?.monto_total || 0),

      referencia:
        compra?.referencia || "",

      metodoPago:
        compra?.metodo_pago || "",

      // La fecha que mostramos es la del RECHAZO,
      // no la fecha original de la compra.
      fechaIso:
        new Date().toISOString(),

      eventoUrl:
        compra?.rifa_id
          ? `${baseUrl}/evento/${compra.rifa_id}`
          : baseUrl,

      verificarUrl:
        `${baseUrl}/principal`,
    });

    emailEnviado = true;
  } else {
    console.warn(
      `La compra ${compra.id} fue rechazada pero no tiene email destino`
    );
  }
} catch (emailError) {
  // IMPORTANTE:
  // El rechazo ya fue realizado correctamente.
  // Un error de Resend NO revierte la compra.
  emailErrorMensaje =
    emailError?.message ||
    "No se pudo enviar el correo";

  console.error(
    "La compra fue rechazada, pero no se pudo enviar el correo:",
    emailError
  );
}

    return NextResponse.json({
      ok: true,
      message: "Compra rechazada correctamente",

      emailEnviado,
emailError: emailErrorMensaje,

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