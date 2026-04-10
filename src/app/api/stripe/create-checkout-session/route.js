import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const esPublicada = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

const estaDisponibleParaCompra = (estado) =>
  ["activa", "disponible", "publicada"].includes(
    String(estado || "").toLowerCase()
  );

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      rifaId,
      tickets,
      nombre,
      email,
      telefono,
      paymentMethod = "Google Pay",
    } = body;

    if (!rifaId || !tickets || !nombre || !email || !telefono) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    const ticketsNum = Number(tickets);
    if (!Number.isFinite(ticketsNum) || ticketsNum < 1 || ticketsNum > 100) {
      return NextResponse.json(
        { error: "La cantidad de tickets no es válida" },
        { status: 400 }
      );
    }

    // Buscar la rifa
    const { data: rifa, error: errorRifa } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, precio_ticket, estado, publicada")
      .eq("id", rifaId)
      .single();

    if (errorRifa || !rifa) {
      return NextResponse.json(
        { error: "No se encontró la rifa" },
        { status: 404 }
      );
    }

    if (!esPublicada(rifa.publicada)) {
      return NextResponse.json(
        { error: "La rifa no está publicada" },
        { status: 400 }
      );
    }

    if (!estaDisponibleParaCompra(rifa.estado)) {
      return NextResponse.json(
        { error: "La rifa no está disponible para compra" },
        { status: 400 }
      );
    }

    const precioTicket = Number(rifa.precio_ticket);
    if (!Number.isFinite(precioTicket) || precioTicket <= 0) {
      return NextResponse.json(
        { error: "Precio de ticket inválido" },
        { status: 400 }
      );
    }

    const montoTotal = Number((precioTicket * ticketsNum).toFixed(2));
    if (montoTotal <= 0) {
      return NextResponse.json(
        { error: "Monto inválido" },
        { status: 400 }
      );
    }

    // Crear compra pendiente en Supabase
    const { data: compraInsertada, error: errorCompra } = await supabaseAdmin
      .from("compras")
      .insert({
        rifa_id: rifaId,
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        cantidad_tickets: ticketsNum,
        monto_total: montoTotal,
        metodo_pago: paymentMethod,
        referencia: "STRIPE_PENDING",
        comprobante_url: "",
        captura_inmediata: true,
        estado_pago: "pendiente_pago",
        stripe_session_id: null,
        stripe_payment_intent: null,
      })
      .select("id")
      .single();

    if (errorCompra || !compraInsertada) {
      console.error("Error insertando compra:", errorCompra);
      return NextResponse.json(
        { error: "No se pudo crear la compra pendiente" },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      customer_email: email.trim(),

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Compra de tickets - ${rifa.nombre || "Rifa"}`,
              description: `${ticketsNum} ticket(s)`,
            },
            unit_amount: Math.round(montoTotal * 100),
          },
        },
      ],

      success_url: `${siteUrl}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?rifa=${rifaId}#boletos`,

      metadata: {
        compra_id: String(compraInsertada.id),
        rifa_id: String(rifaId),
        tickets: String(ticketsNum),
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        payment_method: paymentMethod,
      },
    });

    const { error: errorUpdate } = await supabaseAdmin
      .from("compras")
      .update({
        stripe_session_id: session.id,
      })
      .eq("id", compraInsertada.id);

    if (errorUpdate) {
      console.error("No se pudo actualizar stripe_session_id:", errorUpdate);
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      compraId: compraInsertada.id,
    });
  } catch (error) {
    console.error("Error creando checkout:", error);
    return NextResponse.json(
      { error: error.message || "Error creando la sesión de Stripe" },
      { status: 500 }
    );
  }
}