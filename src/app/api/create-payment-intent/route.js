import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { amount, currency = "usd", description = "Compra de tickets" } = body;

    if (!amount || amount < 1) {
      return Response.json({ error: "Monto inválido" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe payment intent error:", error);
    return Response.json(
      { error: "No se pudo crear el intento de pago" },
      { status: 500 }
    );
  }
}