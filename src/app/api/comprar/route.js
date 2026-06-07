import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;
const PATH_COMPROBANTES = "/storage/v1/object/public/comprobantes/";

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
  return NextResponse.json({ error: mensaje }, { status });
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

function construirNumerosTickets(rifa = {}, totalNumeros = 0) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio) {
    const numeros = [];
    for (let n = inicio; n <= fin; n++) {
      numeros.push(n);
    }
    return numeros;
  }

  const cantidad = Number(rifa?.cantidad_numeros);
  const limite = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : totalNumeros;

  return Array.from({ length: limite }, (_, index) => index + 1);
}

async function generarTicketsSiNoExisten(rifaIdLimpio, rifa, totalNumeros) {
  const { count, error } = await supabaseAdmin
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("rifa_id", rifaIdLimpio);

  if (error) {
    return {
      ok: false,
      error: error.message || "No se pudo validar si existen tickets",
    };
  }

  const ticketsExistentes = count ?? 0;

  if (ticketsExistentes > 0) {
    return { ok: true, generados: false };
  }

  const numeros = construirNumerosTickets(rifa, totalNumeros);

  if (!Array.isArray(numeros) || numeros.length === 0) {
    return {
      ok: false,
      error: "No se pudieron generar los tickets de la rifa",
    };
  }

  const batchSize = 500;

  for (let i = 0; i < numeros.length; i += batchSize) {
    const batch = numeros.slice(i, i + batchSize).map((numero) => ({
      rifa_id: rifaIdLimpio,
      numero_ticket: numero,
      compra_id: null,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("tickets")
      .insert(batch);

    if (insertError) {
      return {
        ok: false,
        error: insertError.message || "No se pudieron insertar los tickets",
      };
    }
  }

  return { ok: true, generados: true };
}

export async function POST(req) {
  try {
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
    } = body;

    const rifaIdRecibido =
      body.rifaId ?? body.rifa_id ?? body.idRifa ?? body.id_rifa;

    const nombreLimpio = limitarLongitud(limpiarTexto(nombre), 120);
    const emailLimpio = limitarLongitud(limpiarTexto(email).toLowerCase(), 254);
    const telefonoLimpio = limitarLongitud(limpiarTelefono(telefono), 15);
    const referenciaLimpia = limitarLongitud(limpiarTexto(referencia), 80);
    const metodoPago = limitarLongitud(limpiarTexto(paymentMethod), 30);
    const comprobante = limitarLongitud(limpiarTexto(comprobanteUrl), 500);
    const rifaIdLimpio = limitarLongitud(limpiarTexto(rifaIdRecibido), 100);

    const cantidadTickets = Number(tickets);
    const totalRecibido = Number(totalPagar);

    const metodosPermitidos = ["Binance", "Zelle", "App Pay", "PayPal", "Cash App"];

    if (!metodosPermitidos.includes(metodoPago)) {
      return errorResponse("Método de pago no válido", 400);
    }

    if (
      !nombreLimpio ||
      !emailLimpio ||
      !telefonoLimpio ||
      !metodoPago ||
      !rifaIdLimpio
    ) {
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

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaIdLimpio)
      .maybeSingle();

    if (rifaError) {
      console.error("Error consultando rifa:", {
        rifaIdLimpio,
        error: rifaError,
      });

      return errorResponse(
        `No se pudo consultar la rifa asociada: ${rifaError.message}`,
        500
      );
    }

    if (!rifa) {
      return errorResponse(
        `La rifa seleccionada no existe (ID: ${rifaIdLimpio})`,
        404
      );
    }

    const estadoRifa = String(rifa.estado || "").toLowerCase();

    if (!["activa", "disponible", "publicada", "agotada"].includes(estadoRifa)) {
      return errorResponse(
        "La rifa seleccionada no está disponible para comprar",
        400
      );
    }

    const totalNumeros = obtenerTotalNumeros(rifa);

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

    // Si la rifa no tiene tickets creados, los generamos automáticamente
    const generacion = await generarTicketsSiNoExisten(
      rifaIdLimpio,
      rifa,
      totalNumeros
    );

    if (!generacion.ok) {
      return errorResponse(generacion.error, 500);
    }

    // Disponibilidad real = tickets sin compra asignada
    const { count: ticketsLibresCount, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("rifa_id", rifaIdLimpio)
      .is("compra_id", null);

    if (ticketsError) {
      console.error("Error validando tickets:", ticketsError);
      return errorResponse(
        ticketsError.message || "No se pudo validar la disponibilidad de tickets",
        500
      );
    }

    const ticketsLibres = ticketsLibresCount ?? 0;
    const ticketsVendidos = Math.max(totalNumeros - ticketsLibres, 0);

    if (ticketsLibres <= 0) {
      return errorResponse(
        "La rifa ya alcanzó el 100% y no acepta más compras",
        409
      );
    }

    if (cantidadTickets > ticketsLibres) {
      return errorResponse(
        `Solo quedan ${ticketsLibres} ticket(s) disponibles para esta rifa`,
        409
      );
    }

    const totalEsperado = Number((cantidadTickets * precioTicket).toFixed(2));
    const totalEnviado = Number(totalRecibido.toFixed(2));

    if (totalEsperado !== totalEnviado) {
      return errorResponse(
        "El monto enviado no coincide con el precio actual de la rifa",
        400
      );
    }

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
      .select(
        "id, usuario_id, rifa_id, cantidad_tickets, monto_total, metodo_pago, referencia, comprobante_url, estado_pago, fecha_compra"
      )
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
        tickets_disponibles: ticketsLibres - cantidadTickets,
        porcentaje_vendido:
          totalNumeros > 0
            ? Number(((ticketsVendidos / totalNumeros) * 100).toFixed(2))
            : 0,
        sold_out: totalNumeros > 0 && ticketsLibres <= 0,
      },
    });
  } catch (error) {
    console.error("comprar route error:", error);

    return errorResponse("No se pudo procesar la compra", 500);
  }
}