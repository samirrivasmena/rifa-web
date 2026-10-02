import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// =========================================================
// CONFIGURACIÓN
// =========================================================

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;

const PATH_COMPROBANTES =
  "/storage/v1/object/public/comprobantes/";

/*
 * Obtenemos el host autorizado directamente desde
 * NEXT_PUBLIC_SUPABASE_URL.
 *
 * Ejemplo:
 * https://xxxx.supabase.co
 *
 * No exponemos la SERVICE_ROLE_KEY.
 */

function obtenerSupabaseHostPermitido() {
  try {
    const supabaseUrl =
      String(
        process.env.NEXT_PUBLIC_SUPABASE_URL || ""
      ).trim();

    if (!supabaseUrl) {
      return "";
    }

    return new URL(supabaseUrl).host.toLowerCase();
  } catch {
    return "";
  }
}

// =========================================================
// RATE LIMIT BÁSICO
// =========================================================

const globalForRateLimit = globalThis;

if (!globalForRateLimit.__comprarRateLimitStore) {
  globalForRateLimit.__comprarRateLimitStore =
    new Map();
}

const rateLimitStore =
  globalForRateLimit.__comprarRateLimitStore;

// =========================================================
// VALIDACIONES BÁSICAS
// =========================================================

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function limpiarTelefono(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function limitarLongitud(valor, max = 120) {
  return String(valor || "")
    .trim()
    .slice(0, max);
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

// =========================================================
// TICKETS
// =========================================================

/**
 * Determina si un ticket pertenece al sistema FREE.
 *
 * No dependemos únicamente de "tipo",
 * porque también comprobamos las relaciones FREE.
 */
function esTicketFree(ticket = {}) {
  const tipo = normalizarTexto(ticket?.tipo);

  return (
    Boolean(
      ticket?.free_drop_id !== null &&
        ticket?.free_drop_id !== undefined
    ) ||
    Boolean(
      ticket?.free_drop_participation_id !== null &&
        ticket?.free_drop_participation_id !==
          undefined
    ) ||
    tipo === "free"
  );
}

/**
 * Regla oficial de disponibilidad para compra normal.
 *
 * Un ticket solamente puede venderse si:
 *
 * - compra_id = null
 * - free_drop_id = null
 * - free_drop_participation_id = null
 * - tipo != free
 * - estado = disponible
 */
function esTicketDisponible(ticket = {}) {
  const sinCompra =
    ticket?.compra_id === null ||
    ticket?.compra_id === undefined;

  const sinFreeDrop =
    ticket?.free_drop_id === null ||
    ticket?.free_drop_id === undefined;

  const sinParticipacionFree =
    ticket?.free_drop_participation_id === null ||
    ticket?.free_drop_participation_id ===
      undefined;

  const tipo = normalizarTexto(ticket?.tipo);
  const estado = normalizarTexto(ticket?.estado);

  return (
    sinCompra &&
    sinFreeDrop &&
    sinParticipacionFree &&
    tipo !== "free" &&
    estado === "disponible"
  );
}

function esTicketOcupado(ticket = {}) {
  return !esTicketDisponible(ticket);
}

/**
 * Cuenta números únicos realmente ocupados.
 *
 * Incluye:
 *
 * - compra normal
 * - FREE
 * - reservado
 * - asignado
 * - vendido
 * - ocupado
 */
function contarNumerosUnicosOcupados(
  lista = []
) {
  return new Set(
    lista
      .filter(esTicketOcupado)
      .map((ticket) =>
        Number(ticket?.numero_ticket)
      )
      .filter(Number.isFinite)
  ).size;
}

/**
 * Cuenta números únicos realmente disponibles.
 */
function contarNumerosUnicosDisponibles(
  lista = []
) {
  return new Set(
    lista
      .filter(esTicketDisponible)
      .map((ticket) =>
        Number(ticket?.numero_ticket)
      )
      .filter(Number.isFinite)
  ).size;
}

// =========================================================
// IP / RATE LIMIT
// =========================================================

function obtenerIp(req) {
  const forwardedFor =
    req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor
      .split(",")[0]
      .trim();
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

  let record =
    rateLimitStore.get(key);

  if (
    !record ||
    now > record.resetAt
  ) {
    record = {
      count: 0,
      resetAt:
        now +
        RATE_LIMIT_WINDOW_MS,
    };
  }

  record.count += 1;

  rateLimitStore.set(
    key,
    record
  );

  if (
    record.count >
    RATE_LIMIT_MAX
  ) {
    return {
      limited: true,
      retryAfter:
        Math.ceil(
          (record.resetAt -
            now) /
            1000
        ),
    };
  }

  return {
    limited: false,
  };
}

// =========================================================
// COMPROBANTE
// =========================================================

function esComprobanteValido(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed =
      new URL(url);

    // -------------------------------------------------------
    // HTTPS obligatorio
    // -------------------------------------------------------

    if (
      parsed.protocol !==
      "https:"
    ) {
      return false;
    }

    // -------------------------------------------------------
    // HOST EXACTO DE SUPABASE
    // -------------------------------------------------------

    const hostPermitido =
      obtenerSupabaseHostPermitido();

    if (!hostPermitido) {
      console.error(
        "SEGURIDAD: NEXT_PUBLIC_SUPABASE_URL no está configurada correctamente"
      );

      return false;
    }

    if (
      parsed.host.toLowerCase() !==
      hostPermitido
    ) {
      return false;
    }

    // -------------------------------------------------------
    // BUCKET / PATH PERMITIDO
    // -------------------------------------------------------

    if (
      !parsed.pathname.startsWith(
        PATH_COMPROBANTES
      )
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// =========================================================
// RESPUESTAS
// =========================================================

function errorResponse(
  mensaje,
  status = 400
) {
  return NextResponse.json(
    {
      error: mensaje,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}

// =========================================================
// RIFA
// =========================================================

function obtenerTotalNumeros(
  rifa = {}
) {
  const inicio =
    Number(
      rifa?.numero_inicio
    );

  const fin =
    Number(
      rifa?.numero_fin
    );

  if (
    Number.isFinite(inicio) &&
    Number.isFinite(fin) &&
    fin >= inicio
  ) {
    return (
      fin -
      inicio +
      1
    );
  }

  const cantidad =
    Number(
      rifa?.cantidad_numeros
    );

  return Number.isFinite(
    cantidad
  )
    ? cantidad
    : 0;
}

function construirNumerosTickets(
  rifa = {},
  totalNumeros = 0
) {
  const inicio =
    Number(
      rifa?.numero_inicio
    );

  const fin =
    Number(
      rifa?.numero_fin
    );

  if (
    Number.isFinite(inicio) &&
    Number.isFinite(fin) &&
    fin >= inicio
  ) {
    const numeros = [];

    for (
      let n = inicio;
      n <= fin;
      n++
    ) {
      numeros.push(n);
    }

    return numeros;
  }

  const cantidad =
    Number(
      rifa?.cantidad_numeros
    );

  const limite =
    Number.isFinite(
      cantidad
    ) &&
    cantidad > 0
      ? cantidad
      : totalNumeros;

  return Array.from(
    {
      length: limite,
    },
    (_, index) =>
      index + 1
  );
}

// =========================================================
// GENERAR INVENTARIO SI NO EXISTE
// =========================================================

async function generarTicketsSiNoExisten(
  rifaIdLimpio,
  rifa,
  totalNumeros
) {
  const {
    count,
    error,
  } = await supabaseAdmin
    .from("tickets")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "rifa_id",
      rifaIdLimpio
    );

  if (error) {
    console.error(
      "Error comprobando inventario:",
      error
    );

    return {
      ok: false,
      error:
        "No se pudo validar el inventario de tickets",
    };
  }

  const ticketsExistentes =
    count ?? 0;

  /*
   * Si ya existe inventario,
   * no lo regeneramos.
   */
  if (
    ticketsExistentes > 0
  ) {
    return {
      ok: true,
      generados: false,
    };
  }

  const numeros =
    construirNumerosTickets(
      rifa,
      totalNumeros
    );

  if (
    !Array.isArray(
      numeros
    ) ||
    numeros.length === 0
  ) {
    return {
      ok: false,
      error:
        "No se pudieron generar los tickets de la rifa",
    };
  }

  const batchSize = 500;

  for (
    let i = 0;
    i < numeros.length;
    i += batchSize
  ) {
    const batch =
      numeros
        .slice(
          i,
          i + batchSize
        )
        .map(
          (numero) => ({
            rifa_id:
              rifaIdLimpio,

            numero_ticket:
              numero,

            compra_id:
              null,
          })
        );

    /*
     * IMPORTANTE:
     *
     * Usamos UPSERT + ignoreDuplicates.
     *
     * Si dos solicitudes llegan al mismo tiempo y ambas
     * detectan inicialmente que no existe inventario,
     * la restricción UNIQUE de:
     *
     * rifa_id,numero_ticket
     *
     * evita duplicados sin provocar el error que
     * anteriormente podía producir insert().
     */

    const {
      error: insertError,
    } = await supabaseAdmin
      .from("tickets")
      .upsert(
        batch,
        {
          onConflict:
            "rifa_id,numero_ticket",
          ignoreDuplicates:
            true,
        }
      );

    if (insertError) {
      console.error(
        "Error generando inventario:",
        insertError
      );

      return {
        ok: false,
        error:
          "No se pudieron generar los tickets",
      };
    }
  }

  return {
    ok: true,
    generados: true,
  };
}

// =========================================================
// OBTENER INVENTARIO REAL
// =========================================================

async function obtenerInventarioRifa(
  rifaId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      numero_ticket,
      compra_id,
      rifa_id,
      tipo,
      estado,
      free_drop_id,
      free_drop_participation_id
    `)
    .eq(
      "rifa_id",
      rifaId
    );

  if (error) {
    console.error(
      "Error consultando inventario:",
      error
    );

    return {
      ok: false,
      error:
        "No se pudo consultar el inventario de tickets",
      tickets: [],
    };
  }

  return {
    ok: true,
    tickets:
      Array.isArray(data)
        ? data
        : [],
  };
}

// =========================================================
// POST
// =========================================================

export async function POST(req) {
  try {
    // -------------------------------------------------------
    // RATE LIMIT
    // -------------------------------------------------------

    const rateLimit =
      aplicarRateLimit(req);

    if (
      rateLimit.limited
    ) {
      return NextResponse.json(
        {
          error:
            "Demasiadas solicitudes. Intenta nuevamente más tarde.",
        },
        {
          status: 429,
          headers: {
            "Retry-After":
              String(
                rateLimit.retryAfter ||
                  60
              ),

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // -------------------------------------------------------
    // BODY
    // -------------------------------------------------------

    let body;

    try {
      body =
        await req.json();
    } catch {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
    }

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(body)
    ) {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
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
      body.rifaId ??
      body.rifa_id ??
      body.idRifa ??
      body.id_rifa;

    // -------------------------------------------------------
    // NORMALIZACIÓN
    // -------------------------------------------------------

    const nombreLimpio =
      limitarLongitud(
        limpiarTexto(nombre),
        120
      );

    const emailLimpio =
      limitarLongitud(
        limpiarTexto(
          email
        ).toLowerCase(),
        254
      );

    const telefonoLimpio =
      limitarLongitud(
        limpiarTelefono(
          telefono
        ),
        15
      );

    const referenciaLimpia =
      limitarLongitud(
        limpiarTexto(
          referencia
        ),
        80
      );

    const metodoPago =
      limitarLongitud(
        limpiarTexto(
          paymentMethod
        ),
        30
      );

    const comprobante =
      limitarLongitud(
        limpiarTexto(
          comprobanteUrl
        ),
        500
      );

    const rifaIdLimpio =
      limitarLongitud(
        limpiarTexto(
          rifaIdRecibido
        ),
        100
      );

    const cantidadTickets =
      Number(tickets);

    const totalRecibido =
      Number(totalPagar);

    // -------------------------------------------------------
    // MÉTODOS DE PAGO
    // -------------------------------------------------------

    const metodosPermitidos = [
      "Binance",
      "Zelle",
      "App Pay",
      "PayPal",
      "Cash App",
    ];

    if (
      !metodosPermitidos.includes(
        metodoPago
      )
    ) {
      return errorResponse(
        "Método de pago no válido",
        400
      );
    }

    // -------------------------------------------------------
    // CAMPOS OBLIGATORIOS
    // -------------------------------------------------------

    if (
      !nombreLimpio ||
      !emailLimpio ||
      !telefonoLimpio ||
      !metodoPago ||
      !rifaIdLimpio
    ) {
      return errorResponse(
        "Faltan datos obligatorios",
        400
      );
    }

    if (
      !validarEmail(
        emailLimpio
      )
    ) {
      return errorResponse(
        "El correo electrónico no es válido",
        400
      );
    }

    if (
      telefonoLimpio.length <
        8 ||
      telefonoLimpio.length >
        15
    ) {
      return errorResponse(
        "El número de teléfono no es válido",
        400
      );
    }

    if (
      !Number.isInteger(
        cantidadTickets
      ) ||
      cantidadTickets < 1 ||
      cantidadTickets > 100
    ) {
      return errorResponse(
        "La cantidad de tickets debe estar entre 1 y 100",
        400
      );
    }

    if (
      !Number.isFinite(
        totalRecibido
      ) ||
      totalRecibido <= 0
    ) {
      return errorResponse(
        "El monto total es inválido",
        400
      );
    }

    // -------------------------------------------------------
    // COMPROBANTE
    // -------------------------------------------------------

    const esAppPay =
      metodoPago ===
      "App Pay";

    if (
      !esAppPay &&
      !referenciaLimpia
    ) {
      return errorResponse(
        "La referencia es obligatoria para este método de pago",
        400
      );
    }

    if (
      !esAppPay &&
      !comprobante
    ) {
      return errorResponse(
        "El comprobante es obligatorio para este método de pago",
        400
      );
    }

    if (
      !esAppPay &&
      !esComprobanteValido(
        comprobante
      )
    ) {
      return errorResponse(
        "El comprobante no proviene de una fuente permitida",
        400
      );
    }

    // -------------------------------------------------------
    // CARGAR RIFA
    // -------------------------------------------------------

    /*
     * Aquí no necesitamos select("*").
     *
     * Solamente cargamos los campos que utiliza esta ruta.
     */

    const {
      data: rifa,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .select(`
        id,
        numero_inicio,
        numero_fin,
        cantidad_numeros,
        estado,
        precio_ticket,
        publicada
      `)
      .eq(
        "id",
        rifaIdLimpio
      )
      .eq(
        "publicada",
        true
      )
      .maybeSingle();

    if (rifaError) {
      console.error(
        "Error consultando rifa:",
        {
          rifaIdLimpio,
          error:
            rifaError,
        }
      );

      return errorResponse(
        "No se pudo consultar la rifa seleccionada",
        500
      );
    }

    if (!rifa) {
      return errorResponse(
        "La rifa seleccionada no existe o no está disponible",
        404
      );
    }

    const estadoRifa =
      normalizarTexto(
        rifa.estado
      );

    /*
     * No aceptamos "agotada".
     *
     * Una rifa agotada no debe iniciar nuevas compras.
     */

    if (
      ![
        "activa",
        "disponible",
        "publicada",
      ].includes(
        estadoRifa
      )
    ) {
      return errorResponse(
        "La rifa seleccionada no está disponible para comprar",
        400
      );
    }

    // -------------------------------------------------------
    // TOTAL DE NÚMEROS
    // -------------------------------------------------------

    const totalNumeros =
      obtenerTotalNumeros(
        rifa
      );

    if (
      totalNumeros <= 0
    ) {
      return errorResponse(
        "La rifa no tiene una cantidad de números válida configurada",
        400
      );
    }

    // -------------------------------------------------------
    // PRECIO
    // -------------------------------------------------------

    /*
     * SEGURIDAD:
     *
     * El precio utilizado para crear la compra viene
     * de la base de datos.
     *
     * Nunca confiamos en el precio calculado por
     * el navegador.
     */

    const precioTicket =
      Number(
        rifa.precio_ticket
      );

    if (
      !Number.isFinite(
        precioTicket
      ) ||
      precioTicket <= 0
    ) {
      return errorResponse(
        "La rifa no tiene un precio de ticket válido configurado",
        400
      );
    }

    // -------------------------------------------------------
    // INVENTARIO
    // -------------------------------------------------------

    const generacion =
      await generarTicketsSiNoExisten(
        rifaIdLimpio,
        rifa,
        totalNumeros
      );

    if (!generacion.ok) {
      return errorResponse(
        generacion.error,
        500
      );
    }

    /*
     * Necesitamos consultar:
     *
     * compra_id
     * free_drop_id
     * free_drop_participation_id
     * tipo
     * estado
     *
     * para determinar la disponibilidad real.
     */

    const inventario =
      await obtenerInventarioRifa(
        rifaIdLimpio
      );

    if (!inventario.ok) {
      return errorResponse(
        "No se pudo validar la disponibilidad de tickets",
        500
      );
    }

    const ticketsInventario =
      inventario.tickets;

    /*
     * DISPONIBILIDAD REAL:
     *
     * compra_id                  = NULL
     * free_drop_id               = NULL
     * free_drop_participation_id = NULL
     * tipo                       != free
     * estado                     = disponible
     */

    const ticketsLibres =
      contarNumerosUnicosDisponibles(
        ticketsInventario
      );

    /*
     * OCUPACIÓN REAL:
     *
     * Incluye compras normales y FREE.
     */

    const ticketsOcupados =
      contarNumerosUnicosOcupados(
        ticketsInventario
      );

    /*
     * Por compatibilidad con el frontend mantenemos
     * el nombre ticketsVendidos.
     *
     * Representa la ocupación real de la rifa.
     */

    const ticketsVendidos =
      Math.min(
        ticketsOcupados,
        totalNumeros
      );

    // -------------------------------------------------------
    // SOLD OUT
    // -------------------------------------------------------

    if (
      ticketsLibres <= 0
    ) {
      return errorResponse(
        "La rifa ya alcanzó el 100% y no acepta más compras",
        409
      );
    }

    if (
      cantidadTickets >
      ticketsLibres
    ) {
      return errorResponse(
        `Solo quedan ${ticketsLibres} ticket(s) disponibles para esta rifa`,
        409
      );
    }

    // -------------------------------------------------------
    // TOTAL
    // -------------------------------------------------------

    /*
     * Recalculamos el monto completamente en el servidor.
     */

    const totalEsperado =
      Number(
        (
          cantidadTickets *
          precioTicket
        ).toFixed(2)
      );

    const totalEnviado =
      Number(
        totalRecibido.toFixed(
          2
        )
      );

    if (
      totalEsperado !==
      totalEnviado
    ) {
      return errorResponse(
        "El monto enviado no coincide con el precio actual de la rifa",
        400
      );
    }

    // -------------------------------------------------------
    // REFERENCIA DUPLICADA
    // -------------------------------------------------------

    if (!esAppPay) {
      const {
        data:
          compraDuplicada,
        error:
          compraDuplicadaError,
      } = await supabaseAdmin
        .from("compras")
        .select(
          "id, referencia, estado_pago, rifa_id"
        )
        .eq(
          "referencia",
          referenciaLimpia
        )
        .eq(
          "rifa_id",
          rifaIdLimpio
        )
        .maybeSingle();

      if (
        compraDuplicadaError
      ) {
        console.error(
          "Error validando duplicidad:",
          compraDuplicadaError
        );

        return errorResponse(
          "No se pudo validar la referencia de pago",
          500
        );
      }

      if (
        compraDuplicada
      ) {
        return errorResponse(
          "Ya existe una compra registrada con esa referencia para esta rifa",
          409
        );
      }
    }

    // -------------------------------------------------------
    // BUSCAR USUARIO
    // -------------------------------------------------------

    const {
      data:
        usuarioExistente,
      error:
        usuarioBusquedaError,
    } = await supabaseAdmin
      .from("usuarios")
      .select(
        "id, nombre, email, telefono"
      )
      .eq(
        "email",
        emailLimpio
      )
      .maybeSingle();

    if (
      usuarioBusquedaError
    ) {
      console.error(
        "Error buscando usuario:",
        usuarioBusquedaError
      );

      return errorResponse(
        "No se pudo procesar la información del participante",
        500
      );
    }

    let usuarioId =
      usuarioExistente?.id ||
      null;

    // -------------------------------------------------------
    // CREAR USUARIO
    // -------------------------------------------------------

    if (!usuarioId) {
      const {
        data:
          nuevoUsuario,
        error:
          crearUsuarioError,
      } = await supabaseAdmin
        .from("usuarios")
        .insert([
          {
            nombre:
              nombreLimpio,

            email:
              emailLimpio,

            telefono:
              telefonoLimpio,
          },
        ])
        .select(
          "id, nombre, email, telefono"
        )
        .single();

      if (
        crearUsuarioError ||
        !nuevoUsuario
      ) {
        console.error(
          "Error creando usuario:",
          crearUsuarioError
        );

        return errorResponse(
          "No se pudo registrar la información del participante",
          500
        );
      }

      usuarioId =
        nuevoUsuario.id;
    } else {
      // -----------------------------------------------------
      // ACTUALIZAR USUARIO EXISTENTE
      // -----------------------------------------------------

      const {
        error:
          actualizarUsuarioError,
      } = await supabaseAdmin
        .from("usuarios")
        .update({
          nombre:
            nombreLimpio,

          telefono:
            telefonoLimpio,
        })
        .eq(
          "id",
          usuarioId
        );

      if (
        actualizarUsuarioError
      ) {
        console.error(
          "Error actualizando usuario:",
          actualizarUsuarioError
        );

        return errorResponse(
          "No se pudo actualizar la información del participante",
          500
        );
      }
    }

    // -------------------------------------------------------
    // REFERENCIA FINAL
    // -------------------------------------------------------

    const referenciaFinal =
      esAppPay
        ? referenciaLimpia ||
          `APPPAY-${Date.now()}`
        : referenciaLimpia;

    const comprobanteFinal =
      esAppPay
        ? null
        : comprobante;

    // -------------------------------------------------------
    // CREAR COMPRA
    // -------------------------------------------------------

    /*
     * IMPORTANTE:
     *
     * estado_pago se establece exclusivamente aquí
     * en el servidor.
     *
     * El navegador no puede decidir que una compra
     * está aprobada.
     */

    const payloadCompra = {
      usuario_id:
        usuarioId,

      rifa_id:
        rifaIdLimpio,

      cantidad_tickets:
        cantidadTickets,

      monto_total:
        totalEsperado,

      metodo_pago:
        metodoPago,

      referencia:
        referenciaFinal,

      comprobante_url:
        comprobanteFinal,

      estado_pago:
        "pendiente",

      fecha_compra:
        new Date().toISOString(),
    };

    const {
      data:
        compraCreada,
      error:
        compraError,
    } = await supabaseAdmin
      .from("compras")
      .insert([
        payloadCompra,
      ])
      .select(`
        id,
        usuario_id,
        rifa_id,
        cantidad_tickets,
        monto_total,
        metodo_pago,
        referencia,
        comprobante_url,
        estado_pago,
        fecha_compra
      `)
      .single();

    if (
      compraError ||
      !compraCreada
    ) {
      console.error(
        "Error creando compra:",
        compraError
      );

      return errorResponse(
        "No se pudo registrar la compra",
        500
      );
    }

    // -------------------------------------------------------
    // ESTADÍSTICAS DE RESPUESTA
    // -------------------------------------------------------

    /*
     * Una compra pendiente todavía NO tiene números
     * asignados.
     *
     * Por eso no restamos cantidadTickets de la
     * disponibilidad física.
     *
     * Los números se ocuparán cuando la compra sea
     * aprobada y se asignen realmente.
     */

    const ticketsDisponiblesDespues =
      ticketsLibres;

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(
            (
              (ticketsVendidos /
                totalNumeros) *
              100
            ).toFixed(2)
          )
        : 0;

    const soldOut =
      totalNumeros > 0 &&
      ticketsDisponiblesDespues <=
        0;

    // -------------------------------------------------------
    // RESPUESTA
    // -------------------------------------------------------

    return NextResponse.json(
      {
        ok: true,

        message:
          "Compra registrada correctamente",

        compra: {
          id:
            compraCreada.id,

          rifa_id:
            compraCreada.rifa_id,

          cantidad_tickets:
            compraCreada.cantidad_tickets,

          monto_total:
            compraCreada.monto_total,

          estado_pago:
            compraCreada.estado_pago,
        },

        disponibilidad: {
          total_numeros:
            totalNumeros,

          tickets_vendidos:
            ticketsVendidos,

          tickets_ocupados:
            ticketsOcupados,

          tickets_disponibles:
            ticketsDisponiblesDespues,

          porcentaje_vendido:
            porcentajeVendido,

          sold_out:
            soldOut,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "comprar route error:",
      error
    );

    return errorResponse(
      "No se pudo procesar la compra",
      500
    );
  }
}