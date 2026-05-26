import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;
const PATH_COMPROBANTES = "/storage/v1/object/public/comprobantes/";

// Store simple en memoria para rate limiting básico
const globalForRateLimit = globalThis;
if (!globalForRateLimit.__comprarRateLimitStore) {
  globalForRateLimit.__comprarRateLimitStore = new Map();
}
const rateLimitStore = globalForRateLimit.__comprarRateLimitStore;

function validarEmail(email) {
  return /\S+@\S+\.\S+/.test(String(email || "").trim());
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function limpiarTelefono(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function limitarLongitud(valor, max = 120) {
  return String(valor || "").trim().slice(0, max);
}

function obtenerIp(req) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function aplicarRateLimit(req) {
  const ip = obtenerIp(req);
  const key = `comprar:${ip}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    record = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  if (now > record.resetAt) {
    rateLimitStore.delete(key);
    return { limited: false };
  }

  if (record.count > RATE_LIMIT_MAX) {
    return {
      limited: true,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  return { limited: false };
}

function esComprobanteValido(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") return false;

    return parsed.pathname.includes(PATH_COMPROBANTES);
  } catch {
    return false;
  }
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    { error: mensaje },
    { status }
  );
}

export async function POST(req) {
  try {
    // Rate limit básico
    const rateLimit = aplicarRateLimit(req);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta nuevamente más tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter || 60),
          },
        }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Cuerpo de la solicitud inválido", 400);
    }

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

    const nombreLimpio = limitarLongitud(limpiarTexto(nombre), 120);
    const emailLimpio = limitarLongitud(limpiarTexto(email).toLowerCase(), 254);
    const telefonoLimpio = limitarLongitud(limpiarTelefono(telefono), 15);
    const referenciaLimpia = limitarLongitud(limpiarTexto(referencia), 80);
    const metodoPago = limitarLongitud(limpiarTexto(paymentMethod), 30);
    const comprobante = limitarLongitud(limpiarTexto(comprobanteUrl), 500);
    const rifaIdLimpio = limitarLongitud(limpiarTexto(rifaId), 100);

    const cantidadTickets = Number(tickets);
    const totalRecibido = Number(totalPagar);

    const metodosPermitidos = ["Binance", "Zelle", "App Pay", "PayPal", "Cash App"];

    if (!metodosPermitidos.includes(metodoPago)) {
      return errorResponse("Método de pago no válido", 400);
    }

    if (!nombreLimpio || !emailLimpio || !telefonoLimpio || !metodoPago || !rifaIdLimpio) {
      return errorResponse("Faltan datos obligatorios", 400);
    }

    if (!validarEmail(emailLimpio)) {
      return errorResponse("El correo electrónico no es válido", 400);
    }

    if (telefonoLimpio.length < 8 || telefonoLimpio.length > 15) {
      return errorResponse("El número de teléfono no es válido", 400);
    }

    if (
      !Number.isInteger(cantidadTickets) ||
      cantidadTickets < 1 ||
      cantidadTickets > 100
    ) {
      return errorResponse("La cantidad de tickets debe estar entre 1 y 100", 400);
    }

    if (!Number.isFinite(totalRecibido) || totalRecibido <= 0) {
      return errorResponse("El monto total es inválido", 400);
    }

    const esAppPay = metodoPago === "App Pay";

    // Para métodos que no son App Pay, referencia y comprobante son obligatorios
    if (!esAppPay && !referenciaLimpia) {
      return errorResponse(
        "La referencia es obligatoria para este método de pago",
        400
      );
    }

    if (!esAppPay && !comprobante) {
      return errorResponse(
        "El comprobante es obligatorio para este método de pago",
        400
      );
    }

    if (!esAppPay && !esComprobanteValido(comprobante)) {
      return errorResponse(
        "El comprobante no proviene de una fuente permitida",
        400
      );
    }

    // Rifa
    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, estado, cantidad_numeros, total_tickets, numeros_totales, precio_ticket")
      .eq("id", rifaIdLimpio)
      .maybeSingle();

    if (rifaError) {
      console.error("Error consultando rifa:", rifaError);
      return errorResponse("No se pudo validar la rifa seleccionada", 500);
    }

    if (!rifa) {
      return errorResponse("La rifa seleccionada no existe", 404);
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "disponible", "publicada"].includes(estadoRifa)) {
      return errorResponse(
        "La rifa seleccionada no está disponible para comprar",
        400
      );
    }

    const totalNumerosRaw = Number(
      rifa.cantidad_numeros ?? rifa.total_tickets ?? rifa.numeros_totales ?? 0
    );

    const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;

    if (totalNumeros <= 0) {
      return errorResponse(
        "La rifa no tiene una cantidad de números válida configurada",
        400
      );
    }

    const precioTicket = Number(rifa.precio_ticket);
    if (!Number.isFinite(precioTicket) || precioTicket <= 0) {
      return errorResponse(
        "La rifa no tiene un precio de ticket válido configurado",
        400
      );
    }

    // Disponibilidad
    const { data: ticketsExistentes, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id")
      .eq("rifa_id", rifaIdLimpio);

    if (ticketsError) {
      console.error("Error validando tickets:", ticketsError);
      return errorResponse(
        ticketsError.message || "No se pudo validar la disponibilidad de tickets",
        500
      );
    }

    const ticketsVendidos = Array.isArray(ticketsExistentes)
      ? ticketsExistentes.length
      : 0;

    const ticketsDisponibles = Math.max(totalNumeros - ticketsVendidos, 0);

    if (ticketsVendidos >= totalNumeros) {
      return errorResponse("La rifa ya alcanzó el 100% y no acepta más compras", 409);
    }

    if (cantidadTickets > ticketsDisponibles) {
      return errorResponse(
        `Solo quedan ${ticketsDisponibles} ticket(s) disponibles para esta rifa`,
        409
      );
    }

    // El servidor decide el total real
    const totalEsperado = Number((cantidadTickets * precioTicket).toFixed(2));
    const totalEnviado = Number(totalRecibido.toFixed(2));

    // CORRECCIÓN #2: No se expone el precio esperado en el mensaje de error
    if (totalEsperado !== totalEnviado) {
      return errorResponse(
        "El monto enviado no coincide con el precio actual de la rifa",
        400
      );
    }

    // Duplicidad de referencia solo para métodos normales
    if (!esAppPay) {
      const { data: compraDuplicada, error: compraDuplicadaError } =
        await supabaseAdmin
          .from("compras")
          .select("id, referencia, estado_pago, rifa_id")
          .eq("referencia", referenciaLimpia)
          .eq("rifa_id", rifaIdLimpio)
          .maybeSingle();

      if (compraDuplicadaError) {
        console.error("Error validando duplicidad:", compraDuplicadaError);
        return errorResponse(compraDuplicadaError.message, 500);
      }

      if (compraDuplicada) {
        return errorResponse(
          "Ya existe una compra registrada con esa referencia para esta rifa",
          409
        );
      }
    }

    // Usuario
    const { data: usuarioExistente, error: usuarioBusquedaError } =
      await supabaseAdmin
        .from("usuarios")
        .select("id, nombre, email, telefono")
        .eq("email", emailLimpio)
        .maybeSingle();

    if (usuarioBusquedaError) {
      console.error("Error buscando usuario:", usuarioBusquedaError);
      return errorResponse(usuarioBusquedaError.message, 500);
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
          .select("id, nombre, email, telefono")
          .single();

      if (crearUsuarioError || !nuevoUsuario) {
        console.error("Error creando usuario:", crearUsuarioError);
        return errorResponse(
          crearUsuarioError?.message || "No se pudo crear el usuario",
          500
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
        console.error("Error actualizando usuario:", actualizarUsuarioError);
        return errorResponse(actualizarUsuarioError.message, 500);
      }
    }

    const referenciaFinal = esAppPay
      ? referenciaLimpia || `APPPAY-${Date.now()}`
      : referenciaLimpia;

    const comprobanteFinal = esAppPay ? null : comprobante;

    const payloadCompra = {
      usuario_id: usuarioId,
      rifa_id: rifaIdLimpio,
      cantidad_tickets: cantidadTickets,
      monto_total: totalEsperado,
      metodo_pago: metodoPago,
      referencia: referenciaFinal,
      comprobante_url: comprobanteFinal,
      estado_pago: "pendiente",
      fecha_compra: new Date().toISOString(),
    };

    const { data: compraCreada, error: compraError } = await supabaseAdmin
      .from("compras")
      .insert([payloadCompra])
      .select("id, usuario_id, rifa_id, cantidad_tickets, monto_total, metodo_pago, referencia, comprobante_url, estado_pago, fecha_compra")
      .single();

    if (compraError || !compraCreada) {
      console.error("Error creando compra:", compraError);
      return errorResponse(
        compraError?.message || "No se pudo registrar la compra",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Compra registrada correctamente",
      compra: {
        id: compraCreada.id,
        rifa_id: compraCreada.rifa_id,
        cantidad_tickets: compraCreada.cantidad_tickets,
        monto_total: compraCreada.monto_total,
        estado_pago: compraCreada.estado_pago,
      },
      disponibilidad: {
        total_numeros: totalNumeros,
        tickets_vendidos: ticketsVendidos,
        tickets_disponibles: ticketsDisponibles - cantidadTickets,
      },
    });
  } catch (error) {
    console.error("comprar route error:", error);

    return errorResponse("No se pudo procesar la compra", 500);
  }
}