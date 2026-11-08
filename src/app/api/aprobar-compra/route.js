
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraAprobadaEmail } from "../../../lib/sendCompraAprobadaEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error, status = 400) {
  return NextResponse.json({ error }, { status });
}

function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) {
    return (
      envUrl.startsWith("http")
        ? envUrl
        : `https://${envUrl}`
    ).replace(/\/$/, "");
  }

  const proto = (
    req.headers.get("x-forwarded-proto") || "https"
  )
    .split(",")[0]
    .trim();

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/$/, "");
}

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function limpiarTelefonoWhatsapp(valor) {
  const numeros = String(valor || "").replace(/\D/g, "");

  return numeros.length === 10
    ? `1${numeros}`
    : numeros;
}

async function obtenerDatosCliente(compra) {
  let nombreCliente = compra.nombre_cliente || "cliente";
  let emailDestino = compra.email_cliente || "";
  let telefonoCliente = compra.telefono_cliente || "";

  if (compra.usuario_id) {
    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("nombre, email, telefono")
      .eq("id", compra.usuario_id)
      .maybeSingle();

    if (error) {
      console.warn(
        "No se pudo consultar el usuario:",
        error.message
      );
    }

    if (data) {
      nombreCliente = data.nombre || nombreCliente;
      emailDestino = data.email || emailDestino;
      telefonoCliente = data.telefono || telefonoCliente;
    }
  }

  return {
    nombreCliente,
    emailDestino,
    telefonoCliente,
  };
}

// Cuenta tickets sin descargar todas las filas.
async function contarTickets(rifaId, filtro) {
  let query = supabaseAdmin
    .from("tickets")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("rifa_id", rifaId);

  if (filtro === "pagados") {
    query = query.not("compra_id", "is", null);
  }

  if (filtro === "free") {
    query = query.or(
      "free_drop_id.not.is.null," +
      "free_drop_participation_id.not.is.null," +
      "tipo.eq.free"
    );
  }

  const { count, error } = await query;

  if (error || count === null) {
    throw new Error(
      `Error contando tickets ${filtro}: ${
        error?.message || "sin resultado"
      }`
    );
  }

  return count;
}

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }

  try {
    let body;

    try {
      body = await req.json();
    } catch {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
    }

    const compraId = String(
      body?.compraId || ""
    ).trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        compraId
      )
    ) {
      return errorResponse(
        "ID de compra inválido",
        400
      );
    }

    // CONSULTAR COMPRA
    const {
      data: compra,
      error: compraError,
    } = await supabaseAdmin
      .from("compras")
      .select(`
        id,
        usuario_id,
        nombre_cliente,
        email_cliente,
        telefono_cliente,
        estado_pago,
        cantidad_tickets,
        monto_total,
        rifa_id,
        referencia
      `)
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
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

    if (
      normalizarTexto(compra.estado_pago) !==
      "pendiente"
    ) {
      return errorResponse(
        compra.estado_pago === "aprobado"
          ? "La compra ya fue aprobada"
          : "La compra no está pendiente",
        409
      );
    }

    const cantidad = Number(
      compra.cantidad_tickets
    );

    if (
      !Number.isInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > 100
    ) {
      return errorResponse(
        "La función de aprobación admite entre 1 y 100 tickets por compra",
        400
      );
    }

    // La función SQL requiere una rifa asociada.
    if (!compra.rifa_id) {
      return errorResponse(
        "La compra no tiene una rifa asociada. Revísala antes de aprobar.",
        409
      );
    }

    // CONSULTAR RIFA
    const {
      data: rifa,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", compra.rifa_id)
      .maybeSingle();

    if (rifaError || !rifa) {
      return errorResponse(
        "No se pudo consultar la rifa asociada",
        500
      );
    }

    if (
      ![
        "activa",
        "disponible",
        "publicada",
      ].includes(normalizarTexto(rifa.estado))
    ) {
      return errorResponse(
        "La rifa no está disponible para aprobar compras",
        409
      );
    }

    const totalNumeros =
      Number(rifa.numero_fin) -
      Number(rifa.numero_inicio) +
      1;

    if (
      !Number.isSafeInteger(totalNumeros) ||
      totalNumeros <= 0
    ) {
      return errorResponse(
        "Rango de números inválido",
        500
      );
    }

    // APROBACIÓN ATÓMICA EN SUPABASE
    // Asigna tickets y aprueba la compra juntos.
    const {
      data: asignados,
      error: rpcError,
    } = await supabaseAdmin.rpc(
      "aprobar_compra_segura",
      {
        p_compra_id: compra.id,
      }
    );

    if (rpcError) {
      console.error(
        "aprobar_compra_segura:",
        rpcError
      );

      const mensaje = rpcError.message || "";

      if (
        mensaje.includes("TICKETS_INSUFICIENTES")
      ) {
        return errorResponse(
          "No hay suficientes números disponibles para aprobar esta compra",
          409
        );
      }

      if (
        mensaje.includes("COMPRA_NO_PENDIENTE")
      ) {
        return errorResponse(
          "Esta compra ya fue procesada por otra operación",
          409
        );
      }

      if (
        mensaje.includes("RIFA_NO_DISPONIBLE")
      ) {
        return errorResponse(
          "La rifa no está disponible",
          409
        );
      }

      if (
        mensaje.includes("CANTIDAD_INVALIDA")
      ) {
        return errorResponse(
          "Cantidad de tickets inválida (máximo 100)",
          400
        );
      }

      if (
        mensaje.includes("COMPRA_SIN_RIFA")
      ) {
        return errorResponse(
          "La compra no tiene rifa asociada",
          409
        );
      }

      return errorResponse(
        "No se pudo aprobar la compra de forma segura",
        500
      );
    }

    const filas = Array.isArray(asignados)
      ? asignados
      : [];

    // No revertimos manualmente:
    // PostgreSQL ya confirmó la transacción.
    if (filas.length !== cantidad) {
      console.error(
        "Resultado inesperado de aprobar_compra_segura:",
        compra.id,
        filas.length,
        cantidad
      );

      return errorResponse(
        "La compra pudo aprobarse, pero la respuesta de tickets fue inesperada. Verifica el estado antes de reintentar.",
        500
      );
    }

    const nuevosTickets = filas.map(
      (fila) => ({
        id: fila.ticket_id,
        numero_ticket: fila.numero_ticket,
        compra_id: compra.id,
        rifa_id: fila.rifa_id,
        tipo: null,
        estado: "asignado",
        free_drop_id: null,
        free_drop_participation_id: null,
      })
    );

    // ESTADÍSTICAS
    let advertenciaRifa = null;

    let ticketsVendidosDespues = null;
    let ticketsPagadosDespues = null;
    let ticketsFreeDespues = null;
    let ticketsDisponiblesDespues = null;

    let rifaCompleta = false;

    try {
const {
  data: statsData,
  error: statsError,
} = await supabaseAdmin.rpc(
  "get_rifa_stats_detalladas",
  {
    p_rifa_id: rifa.id,
  }
);

      if (statsError) {
        throw statsError;
      }

      const stats = Array.isArray(statsData)
        ? statsData[0]
        : statsData;

      if (!stats) {
        throw new Error("Sin estadísticas");
      }

      ticketsVendidosDespues = Number(
        stats.tickets_vendidos
      );

      ticketsDisponiblesDespues = Number(
        stats.tickets_disponibles
      );

      rifaCompleta =
        stats.sold_out === true;

ticketsPagadosDespues = Number(
  stats.tickets_pagados
);

ticketsFreeDespues = Number(
  stats.tickets_free
);

      if (rifaCompleta) {
        const { error } = await supabaseAdmin
          .from("rifas")
          .update({
            estado: "agotada",
          })
          .eq("id", rifa.id);

        if (error) {
          advertenciaRifa =
            "La compra se aprobó, pero no se pudo marcar la rifa como agotada: " +
            error.message;
        }
      }
    } catch (error) {
      console.warn(
        "Compra aprobada; error obteniendo estadísticas:",
        error
      );

      advertenciaRifa =
        "La compra se aprobó, pero no se pudieron actualizar todas las estadísticas.";
    }

    // NÚMEROS ASIGNADOS
    const numerosTickets = nuevosTickets
      .map((ticket) =>
        Number(ticket.numero_ticket)
      )
      .sort((a, b) => a - b);

    const padLength =
      rifa.formato === "3digitos"
        ? 3
        : 4;

    // DATOS DEL CLIENTE
    let nombreCliente =
      compra.nombre_cliente || "cliente";

    let emailDestino =
      compra.email_cliente || "";

    let telefonoCliente =
      compra.telefono_cliente || "";

    try {
      ({
        nombreCliente,
        emailDestino,
        telefonoCliente,
      } = await obtenerDatosCliente(compra));
    } catch (error) {
      console.warn(
        "Compra aprobada; no se pudieron obtener todos los datos del cliente:",
        error
      );
    }

    // ENVIAR CORREO
    try {
      if (emailDestino) {
        await sendCompraAprobadaEmail({
          to: emailDestino,
          nombre: nombreCliente,
          rifaNombre:
            rifa.nombre || "Rifa",
          rifaDescripcion:
            rifa.descripcion || "",
          portadaUrl:
            rifa.portada_url ||
            rifa.portada_scroll_url ||
            "",
          fechaEvento:
            new Intl.DateTimeFormat(
              "en-CA",
              {
                timeZone:
                  "America/Chicago",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }
            ).format(new Date()),
          horaEvento:
            rifa.hora_sorteo ||
            rifa.hora ||
            rifa.hora_rifa ||
            "",
          tickets:
            compra.cantidad_tickets || 0,
          numerosTickets,
          totalPagar: Number(
            compra.monto_total ?? 0
          ),
          eventoUrl:
            `${getBaseUrl(req)}/evento/${rifa.id}`,
          verificarUrl:
            `${getBaseUrl(req)}/principal`,
          padLength,
        });
      } else {
        console.warn(
          `La compra ${compra.id} fue aprobada pero no tiene email destino`
        );
      }
    } catch (error) {
      console.error(
        "Compra aprobada; no se pudo enviar el correo:",
        error
      );
    }

    // WHATSAPP
    const telefonoWhatsapp =
      limpiarTelefonoWhatsapp(
        telefonoCliente
      );

    const numerosWhatsapp =
      numerosTickets
        .map(
          (numero) =>
            `• ${String(numero).padStart(
              padLength,
              "0"
            )}`
        )
        .join("\n");

    const mensajeWhatsapp =
      `🎉 Felicidades ${nombreCliente}\n\n` +
      `Tu compra fue aprobada.\n\n` +
      `🎟️ Rifa: ${rifa.nombre || "Rifa"}\n\n` +
      `🎫 Tickets:\n${numerosWhatsapp}\n\n` +
      "Gracias por participar en Sorteos LSD.";

    const whatsappUrl =
      telefonoWhatsapp
        ? `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(
            mensajeWhatsapp
          )}`
        : null;

    // RESPUESTA AL ADMINISTRADOR
    return NextResponse.json({
      ok: true,

      message:
        "Compra aprobada correctamente",

      advertenciaRifa,

      whatsapp: {
        telefono: telefonoWhatsapp,
        mensaje: mensajeWhatsapp,
        url: whatsappUrl,
      },

      tickets: nuevosTickets,

      rifa: {
        id: rifa.id,
        nombre: rifa.nombre,
        formato: rifa.formato,

        estado: rifaCompleta
          ? "agotada"
          : rifa.estado,

        tickets_vendidos:
          ticketsVendidosDespues,

        tickets_ocupados:
          ticketsVendidosDespues,

        tickets_pagados:
          ticketsPagadosDespues,

        tickets_free:
          ticketsFreeDespues,

        tickets_disponibles:
          ticketsDisponiblesDespues,

        total_numeros:
          totalNumeros,

        porcentaje_vendido:
          ticketsVendidosDespues === null
            ? null
            : Number(
                (
                  (ticketsVendidosDespues /
                    totalNumeros) *
                  100
                ).toFixed(2)
              ),
      },

      diagnostico: {
        antes: null,

        despues: {
          ocupados:
            ticketsVendidosDespues,

          pagados:
            ticketsPagadosDespues,

          free:
            ticketsFreeDespues,

          disponibles:
            ticketsDisponiblesDespues,
        },
      },

      rifaCompleta,
    });
  } catch (error) {
    console.error(
      "aprobar-compra error:",
      error
    );

    return errorResponse(
      "No se pudo procesar la aprobación de la compra",
      500
    );
  }
}
