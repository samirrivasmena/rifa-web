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

function tomarNumerosAleatorios(disponibles, cantidad) {
  const pool = [...disponibles];
  const seleccionados = [];

  for (let i = 0; i < cantidad; i++) {
    const idx = randomInt(0, pool.length);
    seleccionados.push(pool.splice(idx, 1)[0]);
  }

  return seleccionados;
}

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);
  if (Number.isFinite(cantidad) && cantidad > 0) return cantidad;

  return String(rifa?.formato) === "3digitos" ? 1000 : 10000;
}

function obtenerRangoNumeros(rifa = {}, totalNumeros = 0) {
  const inicioRaw = Number(rifa?.numero_inicio);
  const finRaw = Number(rifa?.numero_fin);

  const inicio = Number.isFinite(inicioRaw) ? inicioRaw : 0;
  const fin = Number.isFinite(finRaw)
    ? finRaw
    : inicio + Math.max(totalNumeros - 1, 0);

  return { inicio, fin };
}

function construirListaNumeros(inicio, fin) {
  const lista = [];
  for (let n = inicio; n <= fin; n++) {
    lista.push(n);
  }
  return lista;
}

async function asegurarTicketsBase(rifa) {
  const totalNumeros = obtenerTotalNumeros(rifa);
  const { inicio, fin } = obtenerRangoNumeros(rifa, totalNumeros);
  const esperados = construirListaNumeros(inicio, fin);

  const { data: existentes, error: errorExistentes } = await supabaseAdmin
    .from("tickets")
    .select("id, numero_ticket, compra_id")
    .eq("rifa_id", rifa.id);

  if (errorExistentes) {
    return {
      ok: false,
      error: errorExistentes.message || "No se pudieron leer los tickets existentes",
    };
  }

  const ticketsExistentes = Array.isArray(existentes) ? existentes : [];
  const setExistentes = new Set(
    ticketsExistentes
      .map((t) => Number(t.numero_ticket))
      .filter((n) => Number.isFinite(n))
  );

  const faltantes = esperados.filter((n) => !setExistentes.has(n));

  if (faltantes.length > 0) {
    const batchSize = 500;

    for (let i = 0; i < faltantes.length; i += batchSize) {
      const batch = faltantes.slice(i, i + batchSize).map((numero) => ({
        rifa_id: rifa.id,
        numero_ticket: numero,
        compra_id: null,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("tickets")
        .insert(batch);

      if (insertError) {
        return {
          ok: false,
          error: insertError.message || "No se pudieron crear los tickets faltantes",
        };
      }
    }
  }

  const { data: ticketsReload, error: errorReload } = await supabaseAdmin
    .from("tickets")
    .select("id, numero_ticket, compra_id, rifa_id")
    .eq("rifa_id", rifa.id)
    .order("numero_ticket", { ascending: true });

  if (errorReload) {
    return {
      ok: false,
      error: errorReload.message || "No se pudieron recargar los tickets",
    };
  }

  return {
    ok: true,
    tickets: Array.isArray(ticketsReload) ? ticketsReload : [],
  };
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
        console.warn(
          "No se pudo leer el usuario asociado:",
          usuarioError.message
        );
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
    const { error: revertTicketsError } = await supabaseAdmin
      .from("tickets")
      .update({ compra_id: null })
      .in("id", ticketIds);

    if (revertTicketsError) {
      errores.push(
        revertTicketsError.message || "No se pudieron revertir los tickets"
      );
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
    errores.push(
      rollbackCompraError.message || "No se pudo revertir la compra"
    );
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
      .select(
        "id, usuario_id, estado_pago, cantidad_tickets, monto_total, rifa_id, referencia"
      )
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
      return errorResponse(
        "La compra fue rechazada y no puede aprobarse",
        400
      );
    }

    const cantidadTickets = Number(compra.cantidad_tickets) || 0;

    if (!Number.isInteger(cantidadTickets) || cantidadTickets <= 0) {
      return errorResponse(
        "La compra no tiene una cantidad válida de tickets",
        400
      );
    }

    const estadoAnteriorCompra = compra.estado_pago || "pendiente";
    const rifaIdOriginal = compra.rifa_id || null;

    let rifaId = compra.rifa_id;

    if (!rifaId) {
      const { data: rifaActiva, error: rifaActivaError } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("estado", "activa")
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
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      console.error("Error consultando rifa:", rifaError);
      return errorResponse(
        "No se pudo consultar la rifa asociada",
        500
      );
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

    const totalNumeros = obtenerTotalNumeros(rifa);

    if (totalNumeros <= 0) {
      return errorResponse(
        "La rifa no tiene una cantidad válida de números",
        400
      );
    }

    // Aseguramos que existan todos los tickets de la rifa
    const aseguracion = await asegurarTicketsBase(rifa);
    if (!aseguracion.ok) {
      return errorResponse(aseguracion.error, 500);
    }

    const ticketsActuales = Array.isArray(aseguracion.tickets)
      ? aseguracion.tickets
      : [];

    const ticketsVendidosAntes = ticketsActuales.filter(
      (t) => t.compra_id !== null && t.compra_id !== undefined
    ).length;

    const ticketsLibresAntes = ticketsActuales.filter(
      (t) => t.compra_id === null || t.compra_id === undefined
    );

    if (ticketsVendidosAntes >= totalNumeros) {
      const { error: updateAgotadaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateAgotadaError) {
        console.error("Error marcando rifa como agotada:", {
          message: updateAgotadaError.message,
          details: updateAgotadaError.details,
          hint: updateAgotadaError.hint,
          code: updateAgotadaError.code,
        });
      }

      return errorResponse(
        "La rifa ya alcanzó el 100% y no tiene números disponibles",
        409
      );
    }

    const disponiblesRestantesAntes = ticketsLibresAntes.length;

    if (cantidadTickets > disponiblesRestantesAntes) {
      return errorResponse(
        `No hay suficientes números disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s)`,
        409
      );
    }

    if (ticketsLibresAntes.length < cantidadTickets) {
      return errorResponse(
        "No hay suficientes números disponibles en esta rifa",
        400
      );
    }

    const seleccionados = tomarNumerosAleatorios(
      ticketsLibresAntes,
      cantidadTickets
    );

    const idsTicketsAsignar = seleccionados.map((t) => t.id);

    const { error: asignarTicketsError } = await supabaseAdmin
      .from("tickets")
      .update({
        compra_id: compra.id,
      })
      .in("id", idsTicketsAsignar);

    if (asignarTicketsError) {
      console.error("Error asignando tickets:", asignarTicketsError);
      return errorResponse(
        asignarTicketsError.message || "No se pudieron asignar los tickets",
        500
      );
    }

    const nuevosTickets = seleccionados.map((t) => ({
      id: t.id,
      numero_ticket: t.numero_ticket,
      compra_id: compra.id,
      rifa_id: rifa.id,
    }));

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
        `No se pudo aprobar la compra. ${
          rollbackErrors.length ? "Hubo un problema al revertir cambios." : ""
        }`,
        500
      );
    }

    const ticketsVendidosDespues = ticketsVendidosAntes + cantidadTickets;
    const rifaCompleta = ticketsVendidosDespues >= totalNumeros;

    let advertenciaRifa = null;

    if (rifaCompleta) {
      const { error: updateRifaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateRifaError) {
        console.error("Error actualizando rifa a agotada:", {
          message: updateRifaError.message,
          details: updateRifaError.details,
          hint: updateRifaError.hint,
          code: updateRifaError.code,
        });

        advertenciaRifa =
          `La compra se aprobó, pero no se pudo marcar la rifa como agotada: ` +
          (updateRifaError.message || "error desconocido");
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
          padLength: String(rifa.formato) === "3digitos" ? 3 : 4,
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
      advertenciaRifa,
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

    return errorResponse(
      "No se pudo procesar la aprobación de la compra",
      500
    );
  }
}