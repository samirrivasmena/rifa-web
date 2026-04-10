import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook inválido:", error.message);
    return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const compraId = session.metadata?.compra_id;
      const rifaId = session.metadata?.rifa_id;
      const tickets = Number(session.metadata?.tickets || 0);

      if (!compraId) {
        console.warn("Webhook sin compra_id en metadata");
        return NextResponse.json({ received: true });
      }

      const paymentIntent = session.payment_intent || null;

      // Marcar compra como pagada/aprobada
      const { error: errorUpdate } = await supabaseAdmin
        .from("compras")
        .update({
          estado_pago: "aprobado",
          referencia: paymentIntent ? String(paymentIntent) : "GOOGLEPAY",
          stripe_payment_intent: paymentIntent,
          stripe_session_id: session.id,
          payment_status: session.payment_status || "paid",
          metodo_pago: "Google Pay",
        })
        .eq("id", compraId);

      if (errorUpdate) {
        console.error("Error actualizando compra:", errorUpdate);
        return NextResponse.json(
          { error: "No se pudo actualizar la compra" },
          { status: 500 }
        );
      }

      console.log("Pago confirmado en Stripe:", {
        compraId,
        rifaId,
        tickets,
        paymentIntent,
      });

      /**
       * IMPORTANTE:
       * Aquí es donde debes reutilizar tu lógica de "aprobar compra"
       * para asignar tickets automáticamente.
       *
       * Si tu /api/aprobar-compra ya asigna tickets, copia esa lógica a una función
       * compartida y llámala aquí.
       *
       * Ejemplo:
       * await asignarTicketsAutomaticamente({ compraId, rifaId, tickets });
       */
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error procesando webhook:", error);
    return NextResponse.json(
      { error: error.message || "Error en webhook" },
      { status: 500 }
    );
  }
}