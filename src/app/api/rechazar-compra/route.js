
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraRechazadaEmail } from "../../../lib/sendCompraRechazadaEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// =========================================================
// UTILIDADES
// =========================================================

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const limpio = limpiarTexto(valor);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(limpio);
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    { error: mensaje },
    { status }
  );
}

// =========================================================
// RECHAZAR COMPRA
// =========================================================

export async function POST(req) {
  // =======================================================
  // 1. VERIFICAR ADMINISTRADOR
  // =======================================================

  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    // =====================================================
    // 2. LEER SOLICITUD
    // =====================================================

    let body;

    try {
      body = await req.json();
    } catch {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
    }

    const compraIdLimpio = limpiarTexto(
      body?.compraId
    );

    if (!validarId(compraIdLimpio)) {
      return errorResponse(
        "Falta el ID de la compra",
        400
      );
    }

    // =====================================================
    // 3. BUSCAR COMPRA
    // =====================================================

    const {
      data: compra,
      error: compraError,
    } = await supabaseAdmin
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
        nombre_cliente,
        email_cliente,
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
      console.error(
        "Error buscando compra para rechazar:",
        compraError
      );

      return errorResponse(
        "No se pudo consultar la compra",
        500
      );
    }

    if (!compra) {
      return errorResponse(
        "La compra no existe",
        404
      );
    }

    // =====================================================
    // 4. VALIDAR ESTADO DE COMPRA
    // =====================================================

    const estadoActual = limpiarTexto(
      compra.estado_pago
    ).toLowerCase();

    if (estadoActual === "rechazado") {
      return errorResponse(
        "La compra ya está rechazada",
        400
      );
    }

    // SEGURIDAD:
    // Una compra aprobada nunca puede rechazarse
    // desde esta ruta, tenga o no tickets asociados.

    if (estadoActual === "aprobado") {
      return errorResponse(
        "La compra ya fue aprobada y no puede rechazarse.",
        400
      );
    }

    if (estadoActual !== "pendiente") {
      return errorResponse(
        "Solo se pueden rechazar compras pendientes.",
        400
      );
    }

    // =====================================================
    // 5. RECHAZO SEGURO EN SUPABASE
    // =====================================================
    //
    // Esta función debe:
    //
    // - Bloquear la compra durante la operación.
    // - Verificar nuevamente que siga pendiente.
    // - Liberar sus números reservados.
    // - Marcar la compra como rechazada.
    // - Revertir todo si ocurre un error.
    //
    // Ya no hacemos un UPDATE directo.
    // =====================================================

    const {
      error: rechazoError,
    } = await supabaseAdmin.rpc(
      "rechazar_compra_con_liberacion_segura",
      {
        p_compra_id: compraIdLimpio,
      }
    );

    if (rechazoError) {
      console.error(
        "Error rechazando compra de forma segura:",
        rechazoError
      );

      const mensaje = limpiarTexto(
        rechazoError.message
      ).toLowerCase();

      if (
        mensaje.includes("pendiente") ||
        mensaje.includes("aprobado") ||
        mensaje.includes("aprobada") ||
        mensaje.includes("rechazado") ||
        mensaje.includes("rechazada")
      ) {
        return errorResponse(
          "La compra ya no está pendiente. Actualiza el administrador.",
          409
        );
      }

      return errorResponse(
        "No se pudo rechazar la compra de forma segura.",
        500
      );
    }

    // =====================================================
    // 6. EMAIL DE COMPRA RECHAZADA
    // =====================================================
    //
    // La compra ya fue rechazada correctamente.
    // Si Resend falla, NO se revierte el rechazo.
    // =====================================================

    let emailEnviado = false;
    let emailErrorMensaje = null;

    try {
      const usuario = Array.isArray(
        compra?.usuarios
      )
        ? compra.usuarios[0]
        : compra?.usuarios;

      const rifa = Array.isArray(
        compra?.rifas
      )
        ? compra.rifas[0]
        : compra?.rifas || {};

      const emailDestino =
        limpiarTexto(compra?.email_cliente) ||
        limpiarTexto(usuario?.email);

      if (emailDestino) {
        const protoRaw =
          req.headers.get("x-forwarded-proto") ||
          "https";

        const proto =
          protoRaw.split(",")[0].trim();

        const host =
          req.headers.get("x-forwarded-host") ||
          req.headers.get("host") ||
          "localhost:3000";

        const envUrl = limpiarTexto(
          process.env.NEXT_PUBLIC_SITE_URL
        ).replace(/\/+$/, "");

        const baseUrl =
          envUrl ||
          `${proto}://${host}`.replace(/\/+$/, "");

        await sendCompraRechazadaEmail({
          to: emailDestino,

          nombre:
            limpiarTexto(compra?.nombre_cliente) ||
            limpiarTexto(usuario?.nombre) ||
            "cliente",

          rifaNombre:
            rifa?.nombre ||
            "Evento",

          portadaUrl:
            rifa?.portada_url ||
            rifa?.portada_scroll_url ||
            "",

          cantidadTickets: Number(
            compra?.cantidad_tickets || 0
          ),

          montoTotal: Number(
            compra?.monto_total || 0
          ),

          referencia:
            compra?.referencia || "",

          metodoPago:
            compra?.metodo_pago || "",

          // Mostrar fecha del rechazo.
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
      emailErrorMensaje =
        emailError?.message ||
        "No se pudo enviar el correo";

      console.error(
        "La compra fue rechazada, pero no se pudo enviar el correo:",
        emailError
      );
    }

    // =====================================================
    // 7. RESPUESTA AL ADMINISTRADOR
    // =====================================================

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
    console.error(
      "rechazar-compra error:",
      error
    );

    return errorResponse(
      "No se pudo procesar el rechazo de la compra",
      500
    );
  }
}
