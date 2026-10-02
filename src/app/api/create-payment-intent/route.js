import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    })
  : null;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

/* =========================================================
   RESPUESTA DE ERROR
========================================================= */

function errorResponse(message, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: NO_CACHE_HEADERS,
    }
  );
}

/* =========================================================
   VALIDAR ID
========================================================= */

function normalizarId(value) {
  return String(value || "").trim();
}

/* =========================================================
   VALIDAR CANTIDAD DE TICKETS
========================================================= */

function normalizarCantidadTickets(value) {
  const cantidad = Number(value);

  if (!Number.isInteger(cantidad)) {
    return null;
  }

  if (cantidad < 1 || cantidad > 100) {
    return null;
  }

  return cantidad;
}

/* =========================================================
   VALIDAR ESTADO DE RIFA
========================================================= */

function estaDisponibleParaCompra(estado) {
  return ["activa", "disponible", "publicada"].includes(
    String(estado || "").trim().toLowerCase()
  );
}

/* =========================================================
   VALIDAR PUBLICADA
========================================================= */

function esPublicada(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  );
}

/* =========================================================
   DETECTAR TICKET FREE
========================================================= */

function esTicketFree(ticket) {
  const tipo = String(ticket?.tipo || "")
    .trim()
    .toLowerCase();

  return (
    tipo === "free" ||
    Boolean(ticket?.free_drop_id) ||
    Boolean(ticket?.free_drop_participation_id)
  );
}

/* =========================================================
   DETECTAR TICKET OCUPADO
========================================================= */

function esTicketOcupado(ticket) {
  if (!ticket) {
    return false;
  }

  if (esTicketFree(ticket)) {
    return true;
  }

  if (ticket.compra_id) {
    return true;
  }

  const estado = String(ticket.estado || "")
    .trim()
    .toLowerCase();

  if (estado && estado !== "disponible") {
    return true;
  }

  return false;
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  try {
    /* -------------------------------------------------------
       STRIPE CONFIGURADO
    ------------------------------------------------------- */

    if (!stripe) {
      console.error(
        "create-payment-intent: falta STRIPE_SECRET_KEY"
      );

      return errorResponse(
        "El sistema de pago no está disponible en este momento",
        500
      );
    }

    /* -------------------------------------------------------
       LEER BODY
    ------------------------------------------------------- */

    const body = await req.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return errorResponse(
        "Solicitud inválida",
        400
      );
    }

    /* -------------------------------------------------------
       DATOS RECIBIDOS
    ------------------------------------------------------- */

    const rifaId = normalizarId(body.rifaId);

    const cantidadTickets =
      normalizarCantidadTickets(body.tickets);

    if (!rifaId) {
      return errorResponse(
        "Rifa inválida",
        400
      );
    }

    if (!cantidadTickets) {
      return errorResponse(
        "La cantidad de tickets debe estar entre 1 y 100",
        400
      );
    }

    /* =======================================================
       OBTENER RIFA DESDE SUPABASE
       
       IMPORTANTE:
       El navegador NO proporciona el precio.
       El precio se obtiene directamente de la base de datos.
    ======================================================= */

    const {
      data: rifa,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .select(`
        id,
        nombre,
        estado,
        publicada,
        precio_ticket,
        numero_inicio,
        numero_fin,
        cantidad_numeros
      `)
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      console.error(
        "create-payment-intent error buscando rifa:",
        rifaError
      );

      return errorResponse(
        "No se pudo verificar la rifa",
        500
      );
    }

    if (!rifa) {
      return errorResponse(
        "La rifa no existe",
        404
      );
    }

    /* -------------------------------------------------------
       COMPROBAR QUE ESTÉ PUBLICADA
    ------------------------------------------------------- */

    if (!esPublicada(rifa.publicada)) {
      return errorResponse(
        "Esta rifa no está disponible para compra",
        400
      );
    }

    /* -------------------------------------------------------
       COMPROBAR ESTADO
    ------------------------------------------------------- */

    if (!estaDisponibleParaCompra(rifa.estado)) {
      return errorResponse(
        "Esta rifa no está disponible para compra",
        400
      );
    }

    /* =======================================================
       PRECIO REAL DEL SERVIDOR
    ======================================================= */

    const precioTicket = Number(rifa.precio_ticket);

    if (
      !Number.isFinite(precioTicket) ||
      precioTicket <= 0
    ) {
      console.error(
        "create-payment-intent: precio_ticket inválido",
        {
          rifaId: rifa.id,
        }
      );

      return errorResponse(
        "La rifa no tiene un precio válido",
        400
      );
    }

    /* =======================================================
       COMPROBAR DISPONIBILIDAD
    ======================================================= */

    const {
      data: ticketsRifa,
      error: ticketsError,
    } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        compra_id,
        estado,
        tipo,
        free_drop_id,
        free_drop_participation_id
      `)
      .eq("rifa_id", rifa.id);

    if (ticketsError) {
      console.error(
        "create-payment-intent error consultando tickets:",
        ticketsError
      );

      return errorResponse(
        "No se pudo verificar la disponibilidad de tickets",
        500
      );
    }

    const listaTickets = Array.isArray(ticketsRifa)
      ? ticketsRifa
      : [];

    const ticketsDisponibles = listaTickets.filter(
      (ticket) => !esTicketOcupado(ticket)
    ).length;

    if (ticketsDisponibles < cantidadTickets) {
      return errorResponse(
        ticketsDisponibles > 0
          ? `Solo quedan ${ticketsDisponibles} ticket${
              ticketsDisponibles === 1 ? "" : "s"
            } disponible${
              ticketsDisponibles === 1 ? "" : "s"
            }`
          : "No quedan tickets disponibles",
        409
      );
    }

    /* =======================================================
       CALCULAR TOTAL EN EL SERVIDOR
    ======================================================= */

    const totalUSD =
      precioTicket * cantidadTickets;

    if (
      !Number.isFinite(totalUSD) ||
      totalUSD <= 0
    ) {
      return errorResponse(
        "No se pudo calcular el total de la compra",
        400
      );
    }

    /*
      Stripe trabaja con centavos.

      Ejemplo:

      $3.00  -> 300
      $6.00  -> 600
      $15.00 -> 1500
    */

    const amountInCents =
      Math.round(totalUSD * 100);

    if (
      !Number.isInteger(amountInCents) ||
      amountInCents < 50
    ) {
      /*
        Para USD, Stripe normalmente exige un monto mínimo.
        Esto también evita PaymentIntents absurdamente pequeños.
      */

      return errorResponse(
        "El monto de la compra no es válido",
        400
      );
    }

    /* =======================================================
       CREAR PAYMENT INTENT
       
       SEGURIDAD:
       - amount viene del servidor
       - currency está fijada por servidor
       - description viene de la rifa
       - metadata viene de datos validados
    ======================================================= */

    const paymentIntent =
      await stripe.paymentIntents.create({
        amount: amountInCents,

        currency: "usd",

        description:
          rifa.nombre
            ? `Compra de tickets - ${rifa.nombre}`
            : "Compra de tickets",

        automatic_payment_methods: {
          enabled: true,
        },

        metadata: {
          rifa_id: String(rifa.id),
          cantidad_tickets: String(
            cantidadTickets
          ),
          precio_ticket: precioTicket.toFixed(2),
          total_usd: (
            amountInCents / 100
          ).toFixed(2),
        },
      });

    /* =======================================================
       VALIDAR RESPUESTA DE STRIPE
    ======================================================= */

    if (
      !paymentIntent?.id ||
      !paymentIntent?.client_secret
    ) {
      console.error(
        "create-payment-intent: Stripe no devolvió PaymentIntent válido"
      );

      return errorResponse(
        "No se pudo iniciar el pago",
        500
      );
    }

    /* =======================================================
       RESPUESTA
    ======================================================= */

    return NextResponse.json(
      {
        ok: true,

        clientSecret:
          paymentIntent.client_secret,

        paymentIntentId:
          paymentIntent.id,

        /*
          Estos datos son informativos.
          El frontend NO decide el cobro con ellos.
        */

        amount:
          paymentIntent.amount,

        currency:
          paymentIntent.currency,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    /* =======================================================
       ERROR INTERNO
    ======================================================= */

    console.error(
      "Stripe create-payment-intent error:",
      error
    );

    /*
      No devolvemos error.message de Stripe al navegador.
      Los detalles quedan solamente en el servidor.
    */

    return errorResponse(
      "No se pudo iniciar el pago. Intenta nuevamente.",
      500
    );
  }
}