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
    const { compraId } = body;

    if (!compraId) {
      return NextResponse.json(
        { error: "Falta el ID de la compra" },
        { status: 400 }
      );
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, estado_pago, cantidad_tickets, monto_total, rifa_id")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
      return NextResponse.json(
        { error: compraError.message },
        { status: 500 }
      );
    }

    if (!compra) {
      return NextResponse.json(
        { error: "La compra no existe" },
        { status: 404 }
      );
    }

    if (compra.estado_pago === "aprobado") {
      return NextResponse.json(
        { error: "La compra ya fue aprobada" },
        { status: 400 }
      );
    }

    if (compra.estado_pago === "rechazado") {
      return NextResponse.json(
        { error: "La compra fue rechazada y no puede aprobarse" },
        { status: 400 }
      );
    }

    const cantidadTickets = Number(compra.cantidad_tickets) || 0;

    if (cantidadTickets <= 0) {
      return NextResponse.json(
        { error: "La compra no tiene una cantidad válida de tickets" },
        { status: 400 }
      );
    }

    let rifaId = compra.rifa_id;

    if (!rifaId) {
      const { data: rifaActiva, error: rifaActivaError } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("estado", "activa")
        .limit(1)
        .maybeSingle();

      if (rifaActivaError) {
        return NextResponse.json(
          { error: rifaActivaError.message },
          { status: 500 }
        );
      }

      if (!rifaActiva) {
        return NextResponse.json(
          { error: "No hay una rifa activa disponible" },
          { status: 400 }
        );
      }

      rifaId = rifaActiva.id;

      const { error: updateCompraRifaError } = await supabaseAdmin
        .from("compras")
        .update({ rifa_id: rifaId })
        .eq("id", compra.id);

      if (updateCompraRifaError) {
        return NextResponse.json(
          { error: updateCompraRifaError.message },
          { status: 500 }
        );
      }
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return NextResponse.json(
        { error: rifaError.message },
        { status: 500 }
      );
    }

    if (!rifa) {
      return NextResponse.json(
        { error: "La rifa asociada no existe" },
        { status: 404 }
      );
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "disponible", "publicada"].includes(estadoRifa)) {
      return NextResponse.json(
        { error: "La rifa no está disponible para aprobar compras automáticamente" },
        { status: 400 }
      );
    }

    const numeroInicio = Number(rifa.numero_inicio);
    const numeroFin = Number(rifa.numero_fin);

    if (
      !Number.isInteger(numeroInicio) ||
      !Number.isInteger(numeroFin) ||
      numeroFin < numeroInicio
    ) {
      return NextResponse.json(
        { error: "La rifa no tiene un rango de números válido" },
        { status: 400 }
      );
    }

    const totalNumerosConfigurados = Number(
      rifa.cantidad_numeros ?? numeroFin - numeroInicio + 1
    );

    const totalNumeros =
      Number.isFinite(totalNumerosConfigurados) && totalNumerosConfigurados > 0
        ? totalNumerosConfigurados
        : numeroFin - numeroInicio + 1;

    const { data: ticketsExistentes, error: ticketsExistentesError } =
      await supabaseAdmin
        .from("tickets")
        .select("id, numero_ticket")
        .eq("rifa_id", rifa.id);

    if (ticketsExistentesError) {
      return NextResponse.json(
        { error: ticketsExistentesError.message },
        { status: 500 }
      );
    }

    const ticketsActuales = Array.isArray(ticketsExistentes)
      ? ticketsExistentes
      : [];
    const ticketsVendidosAntes = ticketsActuales.length;

    if (ticketsVendidosAntes >= totalNumeros) {
      const { error: updateAgotadaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateAgotadaError) {
        return NextResponse.json(
          { error: updateAgotadaError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "La rifa ya alcanzó el 100% y no tiene números disponibles" },
        { status: 409 }
      );
    }

    const disponiblesRestantesAntes = totalNumeros - ticketsVendidosAntes;

    if (cantidadTickets > disponiblesRestantesAntes) {
      return NextResponse.json(
        {
          error: `No hay suficientes números disponibles. Solo quedan ${disponiblesRestantesAntes} ticket(s)`,
        },
        { status: 409 }
      );
    }

    const numerosOcupados = new Set(
      ticketsActuales.map((t) => Number(t.numero_ticket))
    );

    const disponibles = [];
    for (let i = numeroInicio; i <= numeroFin; i++) {
      if (!numerosOcupados.has(i)) {
        disponibles.push(i);
      }
    }

    if (disponibles.length < cantidadTickets) {
      return NextResponse.json(
        { error: "No hay suficientes números disponibles en esta rifa" },
        { status: 400 }
      );
    }

    const disponiblesMezclados = [...disponibles].sort(() => Math.random() - 0.5);
    const seleccionados = disponiblesMezclados.slice(0, cantidadTickets);

    const ticketsParaInsertar = seleccionados.map((numero) => ({
      compra_id: compra.id,
      rifa_id: rifa.id,
      numero_ticket: numero,
    }));

    const { data: nuevosTickets, error: insertTicketsError } = await supabaseAdmin
      .from("tickets")
      .insert(ticketsParaInsertar)
      .select();

    if (insertTicketsError) {
      return NextResponse.json(
        { error: insertTicketsError.message },
        { status: 500 }
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
      return NextResponse.json(
        { error: aprobarCompraError.message },
        { status: 500 }
      );
    }

    const ticketsVendidosDespues = ticketsVendidosAntes + cantidadTickets;
    const rifaCompleta = ticketsVendidosDespues >= totalNumeros;
    const nuevoEstadoRifa = rifaCompleta ? "agotada" : rifa.estado;

    if (rifaCompleta) {
      const { error: updateRifaError } = await supabaseAdmin
        .from("rifas")
        .update({ estado: "agotada" })
        .eq("id", rifa.id);

      if (updateRifaError) {
        return NextResponse.json(
          { error: updateRifaError.message },
          { status: 500 }
        );
      }
    }

    // Enviar correo sin bloquear la aprobación si falla
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
      tickets: nuevosTickets || [],
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
    console.error("aprobar-compra error:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}