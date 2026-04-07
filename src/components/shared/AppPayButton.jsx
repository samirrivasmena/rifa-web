"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentRequestButtonElement,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Swal from "sweetalert2";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

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

  const amountInCents = useMemo(() => {
    const total = Number(totalPagar);
    return Number.isFinite(total) && total > 0 ? Math.round(total * 100) : 0;
  }, [totalPagar]);

  useEffect(() => {
    if (!stripe || !amountInCents || disabled) {
      setPaymentRequest(null);
      setAvailable(false);
      return;
    }

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: nombreRifa || "Compra de tickets",
        amount: amountInCents,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    let isMounted = true;

    pr.canMakePayment().then((result) => {
      if (!isMounted) return;

      if (result?.applePay) {
        setPaymentRequest(pr);
        setAvailable(true);
      } else {
        setPaymentRequest(null);
        setAvailable(false);
      }
    });

    const handlePaymentMethod = async (ev) => {
      try {
        if (disabled) {
          ev.complete("fail");
          return;
        }

        setProcessing(true);

        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountInCents,
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
        } else {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Pago no completado",
            text: "El pago no se completó correctamente.",
          });
        }
      } catch (error) {
        console.error("Apple Pay flow error:", error);
        try {
          ev.complete("fail");
        } catch {}
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Error inesperado",
          text: error?.message || "No se pudo procesar el pago",
        });
      } finally {
        setProcessing(false);
      }
    };

    pr.on("paymentmethod", handlePaymentMethod);

    return () => {
      isMounted = false;
      setPaymentRequest(null);
      setAvailable(false);
    };
  }, [
    stripe,
    amountInCents,
    nombreRifa,
    registrarCompra,
    swalConfig,
    disabled,
  ]);

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
  if (!stripePromise) {
    return null;
  }

  return (
    <Elements stripe={stripePromise}>
      <AppPayInner {...props} />
    </Elements>
  );
}