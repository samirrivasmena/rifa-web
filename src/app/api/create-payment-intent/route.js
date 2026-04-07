import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    })
  : null;

export async function POST(req) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe no está configurado correctamente" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const amount = Number(body?.amount);
    const currency = String(body?.currency || "usd").trim().toLowerCase();
    const description = String(body?.description || "Compra de tickets").trim();

    if (!Number.isInteger(amount) || amount < 1) {
      return NextResponse.json(
        { error: "Monto inválido" },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: "Moneda inválida" },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description: description || "Compra de tickets",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Stripe payment intent error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "No se pudo crear el intento de pago",
      },
      { status: 500 }
    );
  }
}