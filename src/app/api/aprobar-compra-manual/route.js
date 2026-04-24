import { NextResponse } from "next/server";
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

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();
    const { compraId, rifaId, ticketsSeleccionados } = body;

    if (!compraId || !rifaId || !Array.isArray(ticketsSeleccionados)) {
      return NextResponse.json(
        { error: "Faltan datos requeridos." },
        { status: 400 }
      );
    }

    if (ticketsSeleccionados.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos un ticket." },
        { status: 400 }
      );
    }

    const ticketsNormalizados = ticketsSeleccionados.map((n) => Number(n));

    if (ticketsNormalizados.some((n) => Number.isNaN(n))) {
      return NextResponse.json(
        { error: "Hay tickets inválidos en la selección." },
        { status: 400 }
      );
    }

    const ticketsUnicos = [...new Set(ticketsNormalizados)];

    if (ticketsUnicos.length !== ticketsNormalizados.length) {
      return NextResponse.json(
        { error: "Hay números repetidos en la selección." },
        { status: 400 }
      );
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, rifa_id, estado_pago, cantidad_tickets, monto_total")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError || !compra) {
      return NextResponse.json(
        { error: "No se encontró la compra." },
        { status: 404 }
      );
    }

    if (String(compra.rifa_id) !== String(rifaId)) {
      return NextResponse.json(
        { error: "La compra no pertenece a la rifa seleccionada." },
        { status: 400 }
      );
    }

    if (compra.estado_pago !== "pendiente") {
      return NextResponse.json(
        { error: "La compra ya no está pendiente." },
        { status: 400 }
      );
    }

    const cantidadEsperada = Number(compra.cantidad_tickets) || 0;

    if (ticketsUnicos.length !== cantidadEsperada) {
      return NextResponse.json(
        {
          error: `Debes seleccionar exactamente ${cantidadEsperada} ticket(s).`,
        },
        { status: 400 }
      );
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError || !rifa) {
      return NextResponse.json(
        { error: "No se encontró la rifa." },
        { status: 404 }
      );
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "cerrada", "disponible", "publicada"].includes(estadoRifa)) {
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

    if (
      !Number.isInteger(numeroInicio) ||
      !Number.isInteger(numeroFin) ||
      numeroFin < numeroInicio
    ) {
      return NextResponse.json(
        { error: "La rifa no tiene un rango de números válido." },
        { status: 400 }
      );
    }

    const padLength = String(rifa.formato) === "3digitos" ? 3 : 4;

    const totalNumerosConfigurados = Number(
      rifa.cantidad_numeros ?? numeroFin - numeroInicio + 1
    );

    const totalNumeros =
      Number.isFinite(totalNumerosConfigurados) && totalNumerosConfigurados > 0
        ? totalNumerosConfigurados
        : numeroFin - numeroInicio + 1;

    const { data: todosLosTicketsActuales, error: todosLosTicketsError } =
      await supabaseAdmin
        .from("tickets")
        .select("id, numero_ticket")
        .eq("rifa_id", rifaId);

    if (todosLosTicketsError) {
      return NextResponse.json(
        { error: "Error al validar disponibilidad general de tickets." },
        { status: 500 }
      );
    }

    const ticketsActuales = Array.isArray(todosLosTicketsActuales)
      ? todosLosTicketsActuales
      : [];

    const ticketsVendidosAntes = ticketsActuales.length;

    if (ticketsVendidosAntes >= totalNumeros) {
      const { error: updateAgotadaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifaId);

      if (updateAgotadaError) {
        return NextResponse.json(
          { error: updateAgotadaError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "La rifa ya alcanzó el 100% y no acepta más tickets." },
        { status: 409 }
      );
    }

    const disponiblesRestantesAntes = totalNumeros - ticketsVendidosAntes;

    if (ticketsUnicos.length > disponiblesRestantesAntes) {
      return NextResponse.json(
        {
          error: `No hay suficientes tickets disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s).`,
        },
        { status: 409 }
      );
    }

    for (const numero of ticketsUnicos) {
      if (numero < numeroInicio || numero > numeroFin) {
        return NextResponse.json(
          { error: `El número ${numero} está fuera del rango permitido.` },
          { status: 400 }
        );
      }
    }

    const { data: ticketsExistentes, error: ticketsExistentesError } =
      await supabaseAdmin
        .from("tickets")
        .select("numero_ticket")
        .eq("rifa_id", rifaId)
        .in("numero_ticket", ticketsUnicos);

    if (ticketsExistentesError) {
      return NextResponse.json(
        { error: "Error al validar tickets existentes." },
        { status: 500 }
      );
    }

    if (ticketsExistentes && ticketsExistentes.length > 0) {
      return NextResponse.json(
        {
          error: `Algunos tickets ya fueron vendidos: ${ticketsExistentes
            .map((t) => t.numero_ticket)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    const ticketsInsertar = ticketsUnicos.map((numero) => ({
      compra_id: compra.id,
      rifa_id: rifaId,
      numero_ticket: numero,
    }));

    const { data: ticketsInsertados, error: insertError } = await supabaseAdmin
      .from("tickets")
      .insert(ticketsInsertar)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "No se pudieron guardar los tickets manuales." },
        { status: 500 }
      );
    }

    const { error: updateCompraError } = await supabaseAdmin
      .from("compras")
      .update({ estado_pago: "aprobado" })
      .eq("id", compra.id);

    if (updateCompraError) {
      return NextResponse.json(
        { error: "Los tickets se guardaron, pero no se pudo actualizar la compra." },
        { status: 500 }
      );
    }

    const ticketsVendidosDespues = ticketsVendidosAntes + ticketsUnicos.length;
    const rifaCompleta = ticketsVendidosDespues >= totalNumeros;
    const nuevoEstadoRifa = rifaCompleta ? "agotada" : rifa.estado;

    if (rifaCompleta) {
      const { error: updateRifaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifaId);

      if (updateRifaError) {
        return NextResponse.json(
          { error: updateRifaError.message },
          { status: 500 }
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
          numerosTickets: (ticketsInsertados || []).map((t) => t.numero_ticket),
          totalPagar: Number(compra.monto_total ?? 0),
          eventoUrl: `${baseUrl}/evento/${rifa.id}`,
          verificarUrl: `${baseUrl}/principal`,
          padLength,
        });
      } else {
        console.warn(
          `La compra ${compra.id} fue aprobada manualmente pero no se encontró email del cliente.`
        );
      }
    } catch (emailError) {
      console.error("No se pudo enviar el correo:", emailError);
    }

    return NextResponse.json({
      ok: true,
      message: "Compra aprobada manualmente",
      compraId: compra.id,
      tickets: ticketsInsertados || ticketsInsertar,
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