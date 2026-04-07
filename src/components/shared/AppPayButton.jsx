"use client";

import { useEffect, useState } from "react";
import {
  Elements,
  PaymentRequestButtonElement,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Swal from "sweetalert2";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function AppPayInner({
  totalPagar,
  nombreRifa,
  registrarCompra,
  swalConfig,
  disabled,
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [available, setAvailable] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!stripe || !totalPagar || disabled) return;

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: nombreRifa || "Compra de tickets",
        amount: Math.round(Number(totalPagar) * 100),
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result?.applePay) {
        setPaymentRequest(pr);
        setAvailable(true);
      } else {
        setAvailable(false);
      }
    });

    pr.on("paymentmethod", async (ev) => {
      try {
        setProcessing(true);

        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(Number(totalPagar) * 100),
            currency: "usd",
            description: nombreRifa || "Compra de tickets",
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.clientSecret) {
          ev.complete("fail");
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "Error",
            text: data.error || "No se pudo iniciar el pago",
          });
          return;
        }

        const { error: confirmError } = await stripe.confirmCardPayment(
          data.clientSecret,
          {
            payment_method: ev.paymentMethod.id,
          },
          {
            handleActions: false,
          }
        );

        if (confirmError) {
          ev.complete("fail");
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "Pago rechazado",
            text: confirmError.message || "No se pudo confirmar el pago",
          });
          return;
        }

        ev.complete("success");

        const { error: finalError, paymentIntent } = await stripe.confirmCardPayment(
          data.clientSecret
        );

        if (finalError) {
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "Error",
            text: finalError.message || "No se pudo completar el pago",
          });
          return;
        }

        if (paymentIntent?.status === "succeeded") {
          await registrarCompra({
            referenciaPago: paymentIntent.id,
            emailWallet: ev.payerEmail || "",
            nombreWallet: ev.payerName || "",
          });
        }
      } catch (error) {
        console.error("Apple Pay flow error:", error);
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Error inesperado",
          text: error.message || "No se pudo procesar el pago",
        });
      } finally {
        setProcessing(false);
      }
    });
  }, [stripe, totalPagar, nombreRifa, registrarCompra, swalConfig, disabled]);

  if (!available || !paymentRequest || disabled) return null;

  return (
    <div className="apppay-real-wrap">
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: {
            paymentRequestButton: {
              type: "buy",
              theme: "dark",
              height: "54px",
            },
          },
        }}
      />

      {processing && <p className="apppay-processing">Procesando pago...</p>}
    </div>
  );
}

export default function AppPayButton(props) {
  return (
    <Elements stripe={stripePromise}>
      <AppPayInner {...props} />
    </Elements>
  );
}