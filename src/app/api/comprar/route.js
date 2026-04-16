import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function validarEmail(email) {
  return /\S+@\S+\.\S+/.test(String(email || "").trim());
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function limpiarTelefono(valor) {
  return String(valor || "").replace(/\D/g, "");
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      nombre,
      email,
      telefono,
      referencia,
      tickets,
      totalPagar,
      paymentMethod,
      comprobanteUrl,
      rifaId,
    } = body;

    const nombreLimpio = limpiarTexto(nombre);
    const emailLimpio = limpiarTexto(email).toLowerCase();
    const telefonoLimpio = limpiarTelefono(telefono);
    const referenciaLimpia = limpiarTexto(referencia);
    const metodoPago = limpiarTexto(paymentMethod);
    const comprobante = limpiarTexto(comprobanteUrl);
    const rifaIdLimpio = limpiarTexto(rifaId);

    const cantidadTickets = Number(tickets);
    const totalRecibido = Number(totalPagar);

    const metodosPermitidos = [
      "Binance",
      "Zelle",
      "App Pay",
      "PayPal",
      "Cash App",
    ];

    if (!metodosPermitidos.includes(metodoPago)) {
      return NextResponse.json(
        { error: "Método de pago no válido" },
        { status: 400 }
      );
    }

    if (
      !nombreLimpio ||
      !emailLimpio ||
      !telefonoLimpio ||
      !metodoPago ||
      !rifaIdLimpio
    ) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (metodoPago !== "App Pay" && !referenciaLimpia) {
      return NextResponse.json(
        { error: "La referencia es obligatoria para este método de pago" },
        { status: 400 }
      );
    }

    if (!validarEmail(emailLimpio)) {
      return NextResponse.json(
        { error: "El correo electrónico no es válido" },
        { status: 400 }
      );
    }

    if (telefonoLimpio.length < 8) {
      return NextResponse.json(
        { error: "El número de teléfono no es válido" },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(cantidadTickets) ||
      cantidadTickets < 1 ||
      cantidadTickets > 100
    ) {
      return NextResponse.json(
        { error: "La cantidad de tickets debe estar entre 1 y 100" },
        { status: 400 }
      );
    }

    if (Number.isNaN(totalRecibido) || totalRecibido <= 0) {
      return NextResponse.json(
        { error: "El monto total es inválido" },
        { status: 400 }
      );
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaIdLimpio)
      .single();

    if (rifaError || !rifa) {
      return NextResponse.json(
        { error: "La rifa seleccionada no existe" },
        { status: 404 }
      );
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "disponible", "publicada"].includes(estadoRifa)) {
      return NextResponse.json(
        { error: "La rifa seleccionada no está disponible para comprar" },
        { status: 400 }
      );
    }

    const totalNumerosRaw = Number(
      rifa.cantidad_numeros ?? rifa.total_tickets ?? rifa.numeros_totales ?? 0
    );

    const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;

    if (totalNumeros <= 0) {
      return NextResponse.json(
        { error: "La rifa no tiene una cantidad de números válida configurada" },
        { status: 400 }
      );
    }

    const { data: ticketsExistentes, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id, rifa_id")
      .eq("rifa_id", rifaIdLimpio);

    if (ticketsError) {
      return NextResponse.json(
        {
          error:
            ticketsError.message ||
            "No se pudo validar la disponibilidad de tickets",
        },
        { status: 500 }
      );
    }

    const ticketsVendidos = Array.isArray(ticketsExistentes)
      ? ticketsExistentes.length
      : 0;

    const ticketsDisponibles = Math.max(totalNumeros - ticketsVendidos, 0);

    if (ticketsVendidos >= totalNumeros) {
      return NextResponse.json(
        { error: "La rifa ya alcanzó el 100% y no acepta más compras" },
        { status: 409 }
      );
    }

    if (cantidadTickets > ticketsDisponibles) {
      return NextResponse.json(
        {
          error: `Solo quedan ${ticketsDisponibles} ticket(s) disponibles para esta rifa`,
        },
        { status: 409 }
      );
    }

    const precioTicket = Number(rifa.precio_ticket || 3);
    const totalEsperado = Number((cantidadTickets * precioTicket).toFixed(2));
    const totalFormateado = Number(totalRecibido.toFixed(2));

    if (totalEsperado !== totalFormateado) {
      return NextResponse.json(
        {
          error: `El monto enviado no coincide con el precio actual de la rifa. Total esperado: ${totalEsperado}`,
        },
        { status: 400 }
      );
    }

    if (metodoPago !== "App Pay") {
      const { data: compraDuplicada, error: compraDuplicadaError } =
        await supabaseAdmin
          .from("compras")
          .select("id, referencia, estado_pago, rifa_id")
          .eq("referencia", referenciaLimpia)
          .eq("rifa_id", rifaIdLimpio)
          .maybeSingle();

      if (compraDuplicadaError) {
        return NextResponse.json(
          { error: compraDuplicadaError.message },
          { status: 500 }
        );
      }

      if (compraDuplicada) {
        return NextResponse.json(
          {
            error:
              "Ya existe una compra registrada con esa referencia para esta rifa",
          },
          { status: 409 }
        );
      }
    }

    const { data: usuarioExistente, error: usuarioBusquedaError } =
      await supabaseAdmin
        .from("usuarios")
        .select("*")
        .eq("email", emailLimpio)
        .maybeSingle();

    if (usuarioBusquedaError) {
      return NextResponse.json(
        { error: usuarioBusquedaError.message },
        { status: 500 }
      );
    }

    let usuarioId = usuarioExistente?.id || null;

    if (!usuarioId) {
      const { data: nuevoUsuario, error: crearUsuarioError } =
        await supabaseAdmin
          .from("usuarios")
          .insert([
            {
              nombre: nombreLimpio,
              email: emailLimpio,
              telefono: telefonoLimpio,
            },
          ])
          .select()
          .single();

      if (crearUsuarioError || !nuevoUsuario) {
        return NextResponse.json(
          { error: crearUsuarioError?.message || "No se pudo crear el usuario" },
          { status: 500 }
        );
      }

      usuarioId = nuevoUsuario.id;
    } else {
      const { error: actualizarUsuarioError } = await supabaseAdmin
        .from("usuarios")
        .update({
          nombre: nombreLimpio,
          telefono: telefonoLimpio,
        })
        .eq("id", usuarioId);

      if (actualizarUsuarioError) {
        return NextResponse.json(
          { error: actualizarUsuarioError.message },
          { status: 500 }
        );
      }
    }

    const payloadCompra = {
      usuario_id: usuarioId,
      rifa_id: rifaIdLimpio,
      cantidad_tickets: cantidadTickets,
      monto_total: totalFormateado,
      metodo_pago: metodoPago,
      referencia: referenciaLimpia || `APPPAY-${Date.now()}`,
      comprobante_url: comprobante || null,
      estado_pago: "pendiente",
      fecha_compra: new Date().toISOString(),
    };

    const { data: compraCreada, error: compraError } = await supabaseAdmin
      .from("compras")
      .insert([payloadCompra])
      .select()
      .single();

    if (compraError || !compraCreada) {
      return NextResponse.json(
        { error: compraError?.message || "No se pudo registrar la compra" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Compra registrada correctamente",
      compra: compraCreada,
      disponibilidad: {
        total_numeros: totalNumeros,
        tickets_vendidos: ticketsVendidos,
        tickets_disponibles: ticketsDisponibles - cantidadTickets,
      },
    });
  } catch (error) {
    console.error("comprar route error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}