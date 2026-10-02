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
  rifaId,
  tickets,
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

  // =========================================================
  // MONTO VISUAL PARA APPLE PAY
  // =========================================================
  //
  // Este monto se usa solamente para mostrar el total
  // en la interfaz de Apple Pay.
  //
  // El monto REAL que cobra Stripe será calculado
  // nuevamente por el servidor usando:
  //
  // rifaId + tickets + precio_ticket de Supabase
  //
  // Por lo tanto, el navegador no decide el monto final.
  // =========================================================

  const amountInCents = useMemo(() => {
    const total = Number(totalPagar);

    return Number.isFinite(total) && total > 0
      ? Math.round(total * 100)
      : 0;
  }, [totalPagar]);

  // =========================================================
  // CANTIDAD NORMALIZADA
  // =========================================================

  const cantidadTickets = useMemo(() => {
    const cantidad = Number(tickets);

    return Number.isInteger(cantidad) && cantidad > 0
      ? cantidad
      : 0;
  }, [tickets]);

  // =========================================================
  // APPLE PAY
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function setupPaymentRequest() {
      // -----------------------------------------------------
      // VALIDACIONES PREVIAS
      // -----------------------------------------------------

      if (
        !stripe ||
        !rifaId ||
        !cantidadTickets ||
        !amountInCents ||
        disabled
      ) {
        setPaymentRequest(null);
        setAvailable(false);
        setCheckedAvailability(true);
        return;
      }

      setPaymentRequest(null);
      setAvailable(false);
      setCheckedAvailability(false);

      // -----------------------------------------------------
      // PAYMENT REQUEST
      // -----------------------------------------------------

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

      // -----------------------------------------------------
      // COMPROBAR DISPONIBILIDAD
      // -----------------------------------------------------

      let result;

      try {
        result = await pr.canMakePayment();
      } catch (error) {
        console.error(
          "Error comprobando disponibilidad de App Pay:",
          error
        );

        if (!cancelled) {
          setPaymentRequest(null);
          setAvailable(false);
          setCheckedAvailability(true);
        }

        return;
      }

      if (cancelled) {
        return;
      }

      // -----------------------------------------------------
      // APPLE PAY DISPONIBLE
      // -----------------------------------------------------

      if (result?.applePay) {
        pr.on("paymentmethod", async (ev) => {
          try {
            if (disabled) {
              ev.complete("fail");
              return;
            }

            setProcessing(true);

            // =================================================
            // CREAR PAYMENT INTENT
            // =================================================
            //
            // SEGURIDAD:
            //
            // Ya NO enviamos:
            //
            // amount
            // currency
            // description
            //
            // como datos confiables.
            //
            // Solamente enviamos:
            //
            // rifaId
            // tickets
            //
            // El servidor buscará la rifa en Supabase y
            // calculará el precio verdadero.
            // =================================================

            const res = await fetch("/api/create-payment-intent", {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
              },

              body: JSON.stringify({
                rifaId,
                tickets: cantidadTickets,
              }),
            });

            let data = null;

            try {
              data = await res.json();
            } catch {
              data = null;
            }

            // -------------------------------------------------
            // ERROR CREANDO PAYMENT INTENT
            // -------------------------------------------------

            if (
              !res.ok ||
              !data?.clientSecret
            ) {
              ev.complete("fail");

              await Swal.fire({
                ...swalConfig,
                icon: "error",
                title: "Error",
                text:
                  data?.error ||
                  "No se pudo iniciar el pago",
              });

              return;
            }

            // =================================================
            // CONFIRMAR MÉTODO DE PAGO
            // =================================================

            const firstConfirm =
              await stripe.confirmCardPayment(
                data.clientSecret,
                {
                  payment_method:
                    ev.paymentMethod.id,
                },
                {
                  handleActions: false,
                }
              );

            if (firstConfirm.error) {
              ev.complete("fail");

              await Swal.fire({
                ...swalConfig,
                icon: "error",
                title: "Pago rechazado",
                text:
                  firstConfirm.error.message ||
                  "No se pudo confirmar el pago",
              });

              return;
            }

            // Apple Pay ya aceptó el método.
            ev.complete("success");

            // =================================================
            // COMPLETAR AUTENTICACIÓN SI STRIPE LA NECESITA
            // =================================================

            const finalConfirm =
              await stripe.confirmCardPayment(
                data.clientSecret
              );

            if (finalConfirm.error) {
              await Swal.fire({
                ...swalConfig,
                icon: "error",
                title: "Error",
                text:
                  finalConfirm.error.message ||
                  "No se pudo completar el pago",
              });

              return;
            }

            // =================================================
            // PAGO EXITOSO
            // =================================================

            if (
              finalConfirm.paymentIntent?.status ===
              "succeeded"
            ) {
              await registrarCompra({
                referenciaPago:
                  finalConfirm.paymentIntent.id,

                emailWallet:
                  ev.payerEmail || "",

                nombreWallet:
                  ev.payerName || "",
              });

              return;
            }

            // =================================================
            // ESTADO INESPERADO
            // =================================================

            await Swal.fire({
              ...swalConfig,
              icon: "warning",
              title: "Pago no completado",
              text: `Estado actual: ${
                finalConfirm.paymentIntent?.status ||
                "desconocido"
              }`,
            });
          } catch (error) {
            console.error(
              "APPPAY flow error:",
              error
            );

            try {
              ev.complete("fail");
            } catch {
              // Evitamos que un error secundario
              // interrumpa el manejo principal.
            }

            await Swal.fire({
              ...swalConfig,
              icon: "error",
              title: "Error inesperado",
              text:
                "No se pudo procesar el pago. Intenta nuevamente.",
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
  }, [
    stripe,
    rifaId,
    cantidadTickets,
    amountInCents,
    nombreRifa,
    registrarCompra,
    swalConfig,
    disabled,
  ]);

  // =========================================================
  // DESHABILITADO
  // =========================================================

  if (disabled) {
    return null;
  }

  // =========================================================
  // APPLE PAY DISPONIBLE
  // =========================================================

  if (
    available &&
    paymentRequest
  ) {
    return (
      <div className="apppay-real-wrap">
        <PaymentRequestButtonElement
          key={`payment-request-${rifaId}-${cantidadTickets}-${amountInCents}`}
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

        {processing && (
          <p className="apppay-processing">
            Procesando pago...
          </p>
        )}
      </div>
    );
  }

  // =========================================================
  // APPLE PAY NO DISPONIBLE
  // =========================================================

  if (
    checkedAvailability &&
    !available
  ) {
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
              text:
                "App Pay no está disponible en este dispositivo o navegador.",
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
  if (!stripePromise) {
    return null;
  }

  return (
    <Elements stripe={stripePromise}>
      <AppPayInner {...props} />
    </Elements>
  );
}