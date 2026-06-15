import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraAprobadaEmail } from "../../../lib/sendCompraAprobadaEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) {
    return envUrl.startsWith("http")
      ? envUrl.replace(/\/$/, "")
      : `https://${envUrl.replace(/\/$/, "")}`;
  }

  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/$/, "");
}

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);
  return Number.isFinite(cantidad) ? cantidad : 0;
}

function contarNumerosUnicosVendidos(lista = []) {
  return new Set(
    lista
      .filter((t) => t?.compra_id !== null && t?.compra_id !== undefined)
      .map((t) => Number(t?.numero_ticket))
      .filter(Number.isFinite)
  ).size;
}

async function obtenerDatosCliente(compra) {
  let nombreCliente = "cliente";
  let emailDestino = "";

  if (compra?.usuario_id) {
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("nombre, email")
      .eq("id", compra.usuario_id)
      .maybeSingle();

    if (usuario) {
      nombreCliente = usuario.nombre || nombreCliente;
      emailDestino = usuario.email || emailDestino;
    }
  }

  return { nombreCliente, emailDestino };
}

async function rollbackAprobacionManual({ compraId, ticketsActualizadosIds = [], ticketsInsertadosIds = [] }) {
  if (ticketsActualizadosIds.length > 0) {
    await supabaseAdmin
      .from("tickets")
      .update({ compra_id: null })
      .in("id", ticketsActualizadosIds);
  }

  if (ticketsInsertadosIds.length > 0) {
    await supabaseAdmin
      .from("tickets")
      .delete()
      .in("id", ticketsInsertadosIds);
  }

  await supabaseAdmin
    .from("compras")
    .update({ estado_pago: "pendiente" })
    .eq("id", compraId);
}

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { compraId, rifaId, ticketsSeleccionados } = body;

    if (!compraId || !rifaId || !Array.isArray(ticketsSeleccionados)) {
      return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 });
    }

    const ticketsNormalizados = ticketsSeleccionados.map((n) => Number(n));

    if (ticketsNormalizados.length === 0) {
      return NextResponse.json({ error: "Debes seleccionar al menos un ticket." }, { status: 400 });
    }

    if (ticketsNormalizados.some((n) => Number.isNaN(n))) {
      return NextResponse.json({ error: "Hay tickets inválidos en la selección." }, { status: 400 });
    }

    const ticketsUnicos = [...new Set(ticketsNormalizados)];

    if (ticketsUnicos.length !== ticketsNormalizados.length) {
      return NextResponse.json({ error: "Hay números repetidos en la selección." }, { status: 400 });
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, rifa_id, estado_pago, cantidad_tickets, monto_total")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError || !compra) {
      return NextResponse.json({ error: "No se encontró la compra." }, { status: 404 });
    }

    if (String(compra.rifa_id) !== String(rifaId)) {
      return NextResponse.json(
        { error: "La compra no pertenece a la rifa seleccionada." },
        { status: 400 }
      );
    }

    if (String(compra.estado_pago || "").toLowerCase() !== "pendiente") {
      return NextResponse.json({ error: "La compra ya no está pendiente." }, { status: 400 });
    }

    const cantidadEsperada = Number(compra.cantidad_tickets) || 0;

    if (ticketsUnicos.length !== cantidadEsperada) {
      return NextResponse.json(
        { error: `Debes seleccionar exactamente ${cantidadEsperada} ticket(s).` },
        { status: 400 }
      );
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError || !rifa) {
      return NextResponse.json({ error: "No se encontró la rifa." }, { status: 404 });
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "cerrada", "disponible", "publicada", "agotada"].includes(estadoRifa)) {
      return NextResponse.json(
        { error: "La rifa no permite aprobación manual en su estado actual." },
        { status: 400 }
      );
    }

    const numeroInicio = Number.isFinite(Number(rifa.numero_inicio))
      ? Number(rifa.numero_inicio)
      : 0;

    const numeroFin = Number.isFinite(Number(rifa.numero_fin))
      ? Number(rifa.numero_fin)
      : String(rifa.formato) === "3digitos"
      ? 999
      : 9999;

    const padLength = String(rifa.formato) === "3digitos" ? 3 : 4;
    const totalNumeros = obtenerTotalNumeros(rifa);

    if (totalNumeros <= 0) {
      return NextResponse.json(
        { error: "La rifa no tiene una cantidad de números válida." },
        { status: 400 }
      );
    }

    for (const numero of ticketsUnicos) {
      if (numero < numeroInicio || numero > numeroFin) {
        return NextResponse.json(
          { error: `El número ${String(numero).padStart(padLength, "0")} está fuera del rango permitido.` },
          { status: 400 }
        );
      }
    }

    const { data: ticketsActuales, error: ticketsActualesError } = await supabaseAdmin
      .from("tickets")
      .select("id, numero_ticket, compra_id")
      .eq("rifa_id", rifaId);

    if (ticketsActualesError) {
      return NextResponse.json(
        { error: "Error al validar disponibilidad general de tickets." },
        { status: 500 }
      );
    }

    const ticketsVendidosAntes = contarNumerosUnicosVendidos(ticketsActuales || []);
    const disponiblesRestantesAntes = totalNumeros - ticketsVendidosAntes;

    if (disponiblesRestantesAntes <= 0) {
      await supabaseAdmin.from("rifas").update({ estado: "agotada" }).eq("id", rifaId);

      return NextResponse.json(
        { error: "La rifa ya alcanzó el 100% y no acepta más tickets." },
        { status: 409 }
      );
    }

    if (ticketsUnicos.length > disponiblesRestantesAntes) {
      return NextResponse.json(
        {
          error: `No hay suficientes tickets disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s).`,
        },
        { status: 409 }
      );
    }

    const { data: ticketsExistentes, error: ticketsExistentesError } = await supabaseAdmin
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("rifa_id", rifaId)
      .in("numero_ticket", ticketsUnicos);

    if (ticketsExistentesError) {
      return NextResponse.json(
        { error: "Error al validar tickets existentes." },
        { status: 500 }
      );
    }

    const vendidosYa = new Set(
      (ticketsExistentes || [])
        .filter((t) => t.compra_id !== null && t.compra_id !== undefined)
        .map((t) => Number(t.numero_ticket))
        .filter(Number.isFinite)
    );

    if (vendidosYa.size > 0) {
      return NextResponse.json(
        {
          error: `Algunos tickets ya fueron vendidos: ${[...vendidosYa]
            .sort((a, b) => a - b)
            .map((n) => String(n).padStart(padLength, "0"))
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    const existentesPorNumero = new Map(
      (ticketsExistentes || []).map((t) => [Number(t.numero_ticket), t])
    );

    const ticketsParaActualizar = [];
    const ticketsParaInsertar = [];

    for (const numero of ticketsUnicos) {
      const existente = existentesPorNumero.get(numero);

      if (existente?.id) {
        ticketsParaActualizar.push(existente.id);
      } else {
        ticketsParaInsertar.push({
          compra_id: compra.id,
          rifa_id: rifaId,
          numero_ticket: numero,
        });
      }
    }

    let ticketsActualizados = [];
    let ticketsInsertadosNuevos = [];

    if (ticketsParaActualizar.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("tickets")
        .update({ compra_id: compra.id })
        .in("id", ticketsParaActualizar)
        .select("id, numero_ticket, compra_id, rifa_id");

      if (error) {
        return NextResponse.json(
          { error: error.message || "No se pudieron actualizar los tickets." },
          { status: 500 }
        );
      }

      ticketsActualizados = data || [];
    }

    if (ticketsParaInsertar.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("tickets")
        .insert(ticketsParaInsertar)
        .select("id, numero_ticket, compra_id, rifa_id");

      if (error) {
        await rollbackAprobacionManual({
          compraId: compra.id,
          ticketsActualizadosIds: ticketsActualizados.map((t) => t.id),
          ticketsInsertadosIds: [],
        });

        return NextResponse.json(
          { error: error.message || "No se pudieron crear tickets faltantes." },
          { status: 500 }
        );
      }

      ticketsInsertadosNuevos = data || [];
    }

    const ticketsAsignados = [...ticketsActualizados, ...ticketsInsertadosNuevos];

    if (ticketsAsignados.length !== ticketsUnicos.length) {
      await rollbackAprobacionManual({
        compraId: compra.id,
        ticketsActualizadosIds: ticketsActualizados.map((t) => t.id),
        ticketsInsertadosIds: ticketsInsertadosNuevos.map((t) => t.id),
      });

      return NextResponse.json(
        { error: "No se pudieron asignar todos los tickets seleccionados." },
        { status: 500 }
      );
    }

    const { error: updateCompraError } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago: "aprobado",
        rifa_id: rifaId,
      })
      .eq("id", compra.id);

    if (updateCompraError) {
      await rollbackAprobacionManual({
        compraId: compra.id,
        ticketsActualizadosIds: ticketsActualizados.map((t) => t.id),
        ticketsInsertadosIds: ticketsInsertadosNuevos.map((t) => t.id),
      });

      return NextResponse.json(
        { error: "Los tickets se asignaron, pero no se pudo actualizar la compra." },
        { status: 500 }
      );
    }

    const ticketsVendidosDespues = ticketsVendidosAntes + ticketsUnicos.length;
    const rifaCompleta = ticketsVendidosDespues >= totalNumeros;
    const nuevoEstadoRifa = rifaCompleta ? "agotada" : rifa.estado;

    let advertenciaRifa = null;

    if (rifaCompleta) {
      const { error: updateRifaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifaId);

      if (updateRifaError) {
        advertenciaRifa =
          "La compra se aprobó, pero no se pudo marcar la rifa como agotada: " +
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
          numerosTickets: ticketsAsignados
            .map((t) => Number(t.numero_ticket))
            .sort((a, b) => a - b),
          totalPagar: Number(compra.monto_total ?? 0),
          eventoUrl: `${baseUrl}/evento/${rifa.id}`,
          verificarUrl: `${baseUrl}/principal`,
          padLength,
        });
      }
    } catch (emailError) {
      console.error("No se pudo enviar el correo:", emailError);
    }

    return NextResponse.json({
      ok: true,
      message: "Compra aprobada manualmente",
      compraId: compra.id,
      tickets: ticketsAsignados,
      advertenciaRifa,
      rifa: {
        id: rifa.id,
        nombre: rifa.nombre,
        formato: rifa.formato,
        estado: nuevoEstadoRifa,
        tickets_vendidos: ticketsVendidosDespues,
        total_numeros: totalNumeros,
        porcentaje_vendido:
          totalNumeros > 0
            ? Number(((ticketsVendidosDespues / totalNumeros) * 100).toFixed(2))
            : 0,
        sold_out: rifaCompleta,
      },
      rifaCompleta,
    });
  } catch (error) {
    console.error("aprobar-compra-manual error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}