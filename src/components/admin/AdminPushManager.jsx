"use client";

import { useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";

/* =========================================================
   CONVERTIR VAPID PUBLIC KEY
========================================================= */

function convertirVapidKey(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  const outputArray = new Uint8Array(
    rawData.length
  );

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/* =========================================================
   ADMIN PUSH MANAGER
========================================================= */

export default function AdminPushManager({
  accesoPermitido,
}) {
  const ejecutadoRef = useRef(false);

useEffect(() => {
    console.log("🔔 AdminPushManager EJECUTADO", {
      accesoPermitido,
      permiso:
        typeof Notification !== "undefined"
          ? Notification.permission
          : "no-disponible",
      serviceWorker:
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator,
      pushManager:
        typeof window !== "undefined" &&
        "PushManager" in window,
    });

    if (!accesoPermitido) return;

    if (ejecutadoRef.current) return;

    ejecutadoRef.current = true;

    let cancelado = false;

    async function configurarPush() {
      try {
        /* =================================================
           COMPROBAR COMPATIBILIDAD
        ================================================= */

        if (
          typeof window === "undefined" ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          console.warn(
            "Este dispositivo no soporta Web Push."
          );

          return;
        }

        /* =================================================
           VAPID PUBLIC KEY
        ================================================= */

        const publicKey = String(
          process.env
            .NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
        ).trim();

        if (!publicKey) {
          console.error(
            "Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY."
          );

          return;
        }

        /* =================================================
           REGISTRAR SERVICE WORKER

           IMPORTANTE:
           admin-sw.js NO tiene fetch handler.
           No cachea compras, tickets ni APIs.
        ================================================= */

        const registration =
          await navigator.serviceWorker.register(
            "/admin-sw.js",
            {
              scope: "/",
            }
          );

        await navigator.serviceWorker.ready;

        if (cancelado) return;

        /* =================================================
           PEDIR PERMISO

           Solo preguntamos si el usuario todavía
           no ha tomado una decisión.
        ================================================= */

        if (
          Notification.permission === "default"
        ) {
          const resultado = await Swal.fire({
            icon: "info",

            title:
              "🔔 Notificaciones del Admin",

            html: `
              <div
                style="
                  text-align:center;
                  line-height:1.55;
                "
              >
                <p>
                  Activa las notificaciones para
                  recibir avisos cuando llegue
                  una nueva compra.
                </p>

                <p
                  style="
                    margin-top:10px;
                    font-size:14px;
                    color:#64748b;
                  "
                >
                  Puedes cambiar este permiso
                  posteriormente desde la
                  configuración de tu teléfono
                  o navegador.
                </p>
              </div>
            `,

            showCancelButton: true,

            confirmButtonText:
              "🔔 Activar notificaciones",

            cancelButtonText: "Ahora no",

            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#6b7280",
          });

          if (!resultado.isConfirmed) {
            return;
          }

          const permiso =
            await Notification.requestPermission();

          if (permiso !== "granted") {
            await Swal.fire({
              icon: "warning",

              title:
                "Notificaciones desactivadas",

              text:
                "No se concedió permiso para enviar notificaciones.",
            });

            return;
          }
        }

        /* =================================================
           SI ESTÁ BLOQUEADO, NO SEGUIMOS
        ================================================= */

        if (
          Notification.permission !== "granted"
        ) {
          console.warn(
            "Las notificaciones no tienen permiso."
          );

          return;
        }

        /* =================================================
           BUSCAR SUSCRIPCIÓN EXISTENTE
        ================================================= */

let subscription =
  await registration.pushManager
    .getSubscription();

/* =================================================
   RENOVAR SUSCRIPCIÓN SI CAMBIÓ LA CLAVE VAPID
================================================= */

if (subscription) {
  const claveActual =
    subscription.options?.applicationServerKey;

  const claveNueva =
    convertirVapidKey(publicKey);

  const actualBytes = claveActual
    ? new Uint8Array(claveActual)
    : null;

  const mismaClave =
    actualBytes &&
    actualBytes.length === claveNueva.length &&
    actualBytes.every(
      (byte, index) =>
        byte === claveNueva[index]
    );

  if (!mismaClave) {
    console.log(
      "🔄 Clave VAPID cambió. Renovando suscripción Push..."
    );

    await subscription.unsubscribe();
    subscription = null;
  }
}

/* =================================================
   CREAR SUSCRIPCIÓN
================================================= */

if (!subscription) {
  subscription =
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        convertirVapidKey(publicKey),
  });
}

        if (cancelado) return;

        /* =================================================
           OBTENER AUTENTICACIÓN DEL ADMIN
        ================================================= */

        const headers =
          await getAdminAuthHeaders();

        if (!headers.Authorization) {
          console.warn(
            "No hay sesión admin lista para registrar las notificaciones."
          );

          return;
        }

        /* =================================================
           GUARDAR DISPOSITIVO EN SUPABASE
           A TRAVÉS DE NUESTRA API PROTEGIDA
        ================================================= */

        const response = await fetch(
          "/api/admin-push/subscribe",
          {
            method: "POST",

            headers: {
              ...headers,
              "Content-Type":
                "application/json",
            },

            cache: "no-store",

            body: JSON.stringify({
              subscription:
                subscription.toJSON(),
            }),
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (
          !response.ok ||
          !data?.ok
        ) {
          console.error(
            "No se pudo registrar el dispositivo:",
            data?.error ||
              response.status
          );

          return;
        }

        console.log(
          "🔔 Sorteos LSD Admin: dispositivo registrado para notificaciones."
        );
      } catch (error) {
        console.error(
          "Error configurando notificaciones del Admin:",
          error
        );
      }
    }

    configurarPush();

    return () => {
      cancelado = true;
    };
  }, [accesoPermitido]);

  return null;
}