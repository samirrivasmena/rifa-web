import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraAprobadaEmail } from "../../../lib/sendCompraAprobadaEmail";

export const runtime = "nodejs";

function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) {
    return envUrl.startsWith("http")
      ? envUrl.replace(/\/$/, "")
      : `https://${envUrl.replace(/\/$/, "")}`;
  }

  const protoRaw = req.headers.get("x-forwarded-proto") || "https";
  const proto = protoRaw.split(",")[0].trim();
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/$/, "");
}

function mezclarSeguro(array) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function validarId(valor) {
  const id = limpiarTexto(valor);
  return Boolean(id) && /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

async function obtenerDatosCliente(compra) {
  let nombreCliente = "cliente";
  let emailDestino = "";

  if (compra?.usuario_id) {
    try {
      const { data: usuario, error: usuarioError } = await supabaseAdmin
        .from("usuarios")
        .select("nombre, email")
        .eq("id", compra.usuario_id)
        .maybeSingle();

      if (usuarioError) {
        console.warn("No se pudo leer el usuario asociado:", usuarioError.message);
      }

      if (usuario) {
        nombreCliente = usuario.nombre || nombreCliente;
        emailDestino = usuario.email || emailDestino;
      }
    } catch (error) {
      console.warn("Error obteniendo datos del cliente:", error.message);
    }
  }

  return { nombreCliente, emailDestino };
}

async function rollbackAprobacion({
  compraId,
  estadoAnteriorCompra,
  rifaIdOriginal,
  ticketIds = [],
}) {
  const errores = [];

  if (ticketIds.length > 0) {
    const { error: deleteTicketsError } = await supabaseAdmin
      .from("tickets")
      .delete()
      .in("id", ticketIds);

    if (deleteTicketsError) {
      errores.push(deleteTicketsError.message || "No se pudieron eliminar los tickets");
    }
  }

  const { error: rollbackCompraError } = await supabaseAdmin
    .from("compras")
    .update({
      estado_pago: estadoAnteriorCompra,
      rifa_id: rifaIdOriginal || null,
    })
    .eq("id", compraId);

  if (rollbackCompraError) {
    errores.push(rollbackCompraError.message || "No se pudo revertir la compra");
  }

  return errores;
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

    const { compraId } = body;
    const compraIdLimpio = limpiarTexto(compraId);

    if (!validarId(compraIdLimpio)) {
      return errorResponse("Falta el ID de la compra", 400);
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, estado_pago, cantidad_tickets, monto_total, rifa_id, referencia")
      .eq("id", compraIdLimpio)
      .maybeSingle();

    if (compraError) {
      console.error("Error consultando compra:", compraError);
      return errorResponse("No se pudo consultar la compra", 500);
    }

    if (!compra) {
      return errorResponse("La compra no existe", 404);
    }

    if (compra.estado_pago === "aprobado") {
      return errorResponse("La compra ya fue aprobada", 400);
    }

    if (compra.estado_pago === "rechazado") {
      return errorResponse("La compra fue rechazada y no puede aprobarse", 400);
    }

    const cantidadTickets = Number(compra.cantidad_tickets) || 0;

    if (!Number.isInteger(cantidadTickets) || cantidadTickets <= 0) {
      return errorResponse("La compra no tiene una cantidad válida de tickets", 400);
    }

    const estadoAnteriorCompra = compra.estado_pago || "pendiente";
    const rifaIdOriginal = compra.rifa_id || null;

    let rifaId = compra.rifa_id;

    if (!rifaId) {
      const { data: rifaActiva, error: rifaActivaError } = await supabaseAdmin
        .from("rifas")
        .select("id, estado, cantidad_numeros, total_tickets, numeros_totales, precio_ticket, numero_inicio, numero_fin, formato, nombre, descripcion, portada_url, portada_scroll_url, fecha_sorteo, fecha, fecha_rifa, hora_sorteo, hora, hora_rifa")
        .eq("estado", "activa")
        .limit(1)
        .maybeSingle();

      if (rifaActivaError) {
        console.error("Error buscando rifa activa:", rifaActivaError);
        return errorResponse("No se pudo buscar una rifa activa", 500);
      }

      if (!rifaActiva) {
        return errorResponse("No hay una rifa activa disponible", 400);
      }

      rifaId = rifaActiva.id;
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, estado, cantidad_numeros, total_tickets, numeros_totales, precio_ticket, numero_inicio, numero_fin, formato, nombre, descripcion, portada_url, portada_scroll_url, fecha_sorteo, fecha, fecha_rifa, hora_sorteo, hora, hora_rifa")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      console.error("Error consultando rifa:", rifaError);
      return errorResponse("No se pudo consultar la rifa asociada", 500);
    }

    if (!rifa) {
      return errorResponse("La rifa asociada no existe", 404);
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "disponible", "publicada"].includes(estadoRifa)) {
      return errorResponse(
        "La rifa no está disponible para aprobar compras automáticamente",
        400
      );
    }

    const numeroInicioRaw = Number(rifa.numero_inicio);
    const numeroFinRaw = Number(rifa.numero_fin);

    const numeroInicio = Number.isInteger(numeroInicioRaw)
      ? numeroInicioRaw
      : 0;

    const numeroFin = Number.isInteger(numeroFinRaw)
      ? numeroFinRaw
      : String(rifa.formato) === "3digitos"
      ? 999
      : 9999;

    if (
      !Number.isInteger(numeroInicio) ||
      !Number.isInteger(numeroFin) ||
      numeroFin < numeroInicio
    ) {
      return errorResponse("La rifa no tiene un rango de números válido", 400);
    }

    const padLength = String(rifa.formato) === "3digitos" ? 3 : 4;

    const totalNumerosConfigurados = Number(
      rifa.cantidad_numeros ?? rifa.total_tickets ?? rifa.numeros_totales ?? 0
    );

    const totalNumeros =
      Number.isFinite(totalNumerosConfigurados) && totalNumerosConfigurados > 0
        ? totalNumerosConfigurados
        : numeroFin - numeroInicio + 1;

    if (totalNumeros <= 0) {
      return errorResponse("La rifa no tiene una cantidad de números válida", 400);
    }

    const { data: ticketsExistentes, error: ticketsExistentesError } =
      await supabaseAdmin
        .from("tickets")
        .select("id, numero_ticket")
        .eq("rifa_id", rifa.id);

    if (ticketsExistentesError) {
      console.error("Error consultando tickets existentes:", ticketsExistentesError);
      return errorResponse("No se pudo validar la disponibilidad de números", 500);
    }

    const ticketsActuales = Array.isArray(ticketsExistentes) ? ticketsExistentes : [];
    const ticketsVendidosAntes = ticketsActuales.length;

    if (ticketsVendidosAntes >= totalNumeros) {
      const { error: updateAgotadaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateAgotadaError) {
        console.error("Error marcando rifa como agotada:", updateAgotadaError);
        return errorResponse("No se pudo actualizar el estado de la rifa", 500);
      }

      return errorResponse(
        "La rifa ya alcanzó el 100% y no tiene números disponibles",
        409
      );
    }

    const disponiblesRestantesAntes = totalNumeros - ticketsVendidosAntes;

    if (cantidadTickets > disponiblesRestantesAntes) {
      return errorResponse(
        `No hay suficientes números disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s)`,
        409
      );
    }

    const numerosOcupados = new Set(
      ticketsActuales.map((t) => Number(t.numero_ticket))
    );

    const disponibles = [];
    for (let i = numeroInicio; i <= numeroFin; i++) {
      if (!numerosOcupados.has(i)) disponibles.push(i);
    }

    if (disponibles.length < cantidadTickets) {
      return errorResponse("No hay suficientes números disponibles en esta rifa", 400);
    }

    const disponiblesMezclados = mezclarSeguro(disponibles);
    const seleccionados = disponiblesMezclados.slice(0, cantidadTickets);

    const ticketsParaInsertar = seleccionados.map((numero) => ({
      compra_id: compra.id,
      rifa_id: rifa.id,
      numero_ticket: numero,
    }));

    const { data: nuevosTickets, error: insertTicketsError } = await supabaseAdmin
      .from("tickets")
      .insert(ticketsParaInsertar)
      .select("id, numero_ticket, compra_id, rifa_id");

    if (insertTicketsError || !nuevosTickets) {
      console.error("Error insertando tickets:", insertTicketsError);
      return errorResponse(
        insertTicketsError?.message || "No se pudieron asignar los tickets",
        500
      );
    }

    const { error: aprobarCompraError } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago: "aprobado",
        rifa_id: rifa.id,
      })
      .eq("id", compra.id);

    if (aprobarCompraError) {
      console.error("Error aprobando compra:", aprobarCompraError);

      const rollbackErrors = await rollbackAprobacion({
        compraId: compra.id,
        estadoAnteriorCompra,
        rifaIdOriginal,
        ticketIds: nuevosTickets.map((t) => t.id),
      });

      return errorResponse(
        `No se pudo aprobar la compra. ${rollbackErrors.length ? "Hubo un problema al revertir cambios." : ""}`,
        500
      );
    }

    const ticketsVendidosDespues = ticketsVendidosAntes + cantidadTickets;
    const rifaCompleta = ticketsVendidosDespues >= totalNumeros;

    if (rifaCompleta) {
      const { error: updateRifaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateRifaError) {
        console.error("Error actualizando rifa a agotada:", updateRifaError);

        const rollbackErrors = await rollbackAprobacion({
          compraId: compra.id,
          estadoAnteriorCompra,
          rifaIdOriginal,
          ticketIds: nuevosTickets.map((t) => t.id),
        });

        return errorResponse(
          `La compra se aprobó, pero no se pudo actualizar el estado de la rifa. ${rollbackErrors.length ? "Hubo un problema al revertir cambios." : ""}`,
          500
        );
      }
    }

    try {
      const baseUrl = getBaseUrl(req);
      const { nombreCliente, emailDestino } = await obtenerDatosCliente(compra);

      if (emailDestino) {
        await sendCompraAprobadaEmail({
          to: emailDestino,
          nombre: nombreCliente,
          rifaNombre: rifa.nombre || "Rifa",
          rifaDescripcion: rifa.descripcion || "",
          portadaUrl: rifa.portada_url || rifa.portada_scroll_url || "",
          fechaEvento: rifa.fecha_sorteo || rifa.fecha || rifa.fecha_rifa || "",
          horaEvento: rifa.hora_sorteo || rifa.hora || rifa.hora_rifa || "",
          tickets: compra.cantidad_tickets || 0,
          numerosTickets: (nuevosTickets || [])
            .map((t) => t.numero_ticket)
            .sort((a, b) => Number(a) - Number(b)),
          totalPagar: Number(compra.monto_total ?? 0),
          eventoUrl: `${baseUrl}/evento/${rifa.id}`,
          verificarUrl: `${baseUrl}/principal`,
          padLength,
        });
      } else {
        console.warn(
          `La compra ${compra.id} fue aprobada pero no tiene email destino`
        );
      }
    } catch (emailError) {
      console.error("No se pudo enviar el correo:", emailError);
    }

    return NextResponse.json({
      ok: true,
      tickets: (nuevosTickets || []).map((t) => ({
        id: t.id,
        numero_ticket: t.numero_ticket,
        compra_id: t.compra_id,
        rifa_id: t.rifa_id,
      })),
      rifa: {
        id: rifa.id,
        nombre: rifa.nombre,
        formato: rifa.formato,
        estado: rifaCompleta ? "agotada" : rifa.estado,
        tickets_vendidos: ticketsVendidosDespues,
        total_numeros: totalNumeros,
        porcentaje_vendido:
          totalNumeros > 0
            ? Number(((ticketsVendidosDespues / totalNumeros) * 100).toFixed(2))
            : 0,
      },
      rifaCompleta,
    });
  } catch (error) {
    console.error("aprobar-compra error:", error);

    return errorResponse("No se pudo procesar la aprobación de la compra", 500);
  }
}