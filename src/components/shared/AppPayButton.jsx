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
  const [checkedAvailability, setCheckedAvailability] = useState(false);

  const amountInCents = useMemo(() => {
    const total = Number(totalPagar);
    return Number.isFinite(total) && total > 0 ? Math.round(total * 100) : 0;
  }, [totalPagar]);

  useEffect(() => {
    let cancelled = false;

    async function setupPaymentRequest() {
      if (!stripe || !amountInCents || disabled) {
        setPaymentRequest(null);
        setAvailable(false);
        setCheckedAvailability(true);
        return;
      }

      setPaymentRequest(null);
      setAvailable(false);
      setCheckedAvailability(false);

      console.log("SETUP APPPAY totalPagar:", totalPagar);
      console.log("SETUP APPPAY amountInCents:", amountInCents);

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

      const result = await pr.canMakePayment();

      console.log("APPPAY canMakePayment result:", result);

      if (cancelled) return;

      if (result?.applePay) {
        pr.on("paymentmethod", async (ev) => {
          try {
            if (disabled) {
              ev.complete("fail");
              return;
            }

            setProcessing(true);

            console.log("APPPAY paymentmethod event total:", totalPagar);
            console.log("APPPAY paymentmethod amountInCents:", amountInCents);

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
            console.log("APPPAY create-payment-intent:", data);

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

            const firstConfirm = await stripe.confirmCardPayment(
              data.clientSecret,
              {
                payment_method: ev.paymentMethod.id,
              },
              {
                handleActions: false,
              }
            );

            console.log("APPPAY firstConfirm:", firstConfirm);

            if (firstConfirm.error) {
              ev.complete("fail");
              await Swal.fire({
                ...swalConfig,
                icon: "error",
                title: "Pago rechazado",
                text: firstConfirm.error.message || "No se pudo confirmar el pago",
              });
              return;
            }

            ev.complete("success");

            const finalConfirm = await stripe.confirmCardPayment(data.clientSecret);

            console.log("APPPAY finalConfirm:", finalConfirm);

            if (finalConfirm.error) {
              await Swal.fire({
                ...swalConfig,
                icon: "error",
                title: "Error",
                text: finalConfirm.error.message || "No se pudo completar el pago",
              });
              return;
            }

            if (finalConfirm.paymentIntent?.status === "succeeded") {
              await registrarCompra({
                referenciaPago: finalConfirm.paymentIntent.id,
                emailWallet: ev.payerEmail || "",
                nombreWallet: ev.payerName || "",
              });
            } else {
              await Swal.fire({
                ...swalConfig,
                icon: "warning",
                title: "Pago no completado",
                text: `Estado actual: ${finalConfirm.paymentIntent?.status || "desconocido"}`,
              });
            }
          } catch (error) {
            console.error("APPPAY flow error:", error);
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
        });

        setPaymentRequest(pr);
        setAvailable(true);
      } else {
        setPaymentRequest(null);
        setAvailable(false);
      }

      setCheckedAvailability(true);
    }

    setupPaymentRequest();

    return () => {
      cancelled = true;
      setPaymentRequest(null);
      setAvailable(false);
    };
  }, [stripe, amountInCents, totalPagar, nombreRifa, registrarCompra, swalConfig, disabled]);

  if (disabled) return null;

  if (available && paymentRequest) {
    return (
      <div className="apppay-real-wrap">
        <PaymentRequestButtonElement
          key={`payment-request-${amountInCents}`}
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

  if (checkedAvailability && !available) {
    return (
      <div className="apppay-fallback-wrap">
        <button
          type="button"
          className="apppay-fallback-btn"
          onClick={() =>
            Swal.fire({
              ...swalConfig,
              icon: "info",
              title: "App Pay no disponible",
              text: "App Pay no está disponible en este dispositivo o navegador.",
            })
          }
        >
           App Pay no disponible aquí
        </button>
      </div>
    );
  }

  return null;
}

export default function AppPayButton(props) {
  if (!stripePromise) return null;

  return (
    <Elements stripe={stripePromise}>
      <AppPayInner {...props} />
    </Elements>
  );
}