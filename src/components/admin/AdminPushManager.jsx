"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
} from "react";
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

  const outputArray = new Uint8Array(rawData.length);

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
  onEstadoChange,
  controlRef,
}) {
  const ejecutadoRef = useRef(false);
  const procesandoRef = useRef(false);

  /* =======================================================
     INFORMAR ESTADO
  ======================================================= */

  const actualizarEstado = (activo) => {
    if (typeof onEstadoChange === "function") {
      onEstadoChange(Boolean(activo));
    }
  };

  /* =======================================================
     COMPROBAR COMPATIBILIDAD
  ======================================================= */

  const navegadorCompatible = () => {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  };

  /* =======================================================
     OBTENER REGISTRO DEL SERVICE WORKER
  ======================================================= */

  const obtenerRegistration = async () => {
    const registration =
      await navigator.serviceWorker.register(
        "/admin-sw.js",
        {
          scope: "/",
        }
      );

    await navigator.serviceWorker.ready;

    return registration;
  };

  /* =======================================================
     OBTENER VAPID PUBLIC KEY
  ======================================================= */

  const obtenerPublicKey = () => {
    return String(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
    ).trim();
  };

  /* =======================================================
     GUARDAR SUSCRIPCIÓN EN SUPABASE
  ======================================================= */

  const guardarSuscripcion = async (subscription) => {
    const headers = await getAdminAuthHeaders();

    if (!headers.Authorization) {
      throw new Error(
        "No hay sesión admin disponible."
      );
    }

    const response = await fetch(
      "/api/admin-push/subscribe",
      {
        method: "POST",

        headers: {
          ...headers,
          "Content-Type": "application/json",
        },

        cache: "no-store",

        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          "No se pudo registrar el dispositivo."
      );
    }

    return data;
  };

  /* =======================================================
     ELIMINAR SUSCRIPCIÓN DE SUPABASE
  ======================================================= */

  const eliminarSuscripcion = async (endpoint) => {
    const headers = await getAdminAuthHeaders();

    if (!headers.Authorization) {
      throw new Error(
        "No hay sesión admin disponible."
      );
    }

    const response = await fetch(
      "/api/admin-push/subscribe",
      {
        method: "DELETE",

        headers: {
          ...headers,
          "Content-Type": "application/json",
        },

        cache: "no-store",

        body: JSON.stringify({
          endpoint,
        }),
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          "No se pudieron desactivar las notificaciones."
      );
    }

    return data;
  };

  /* =======================================================
     ACTIVAR NOTIFICACIONES
  ======================================================= */

  const activarNotificaciones = async ({
    mostrarConfirmacion = true,
  } = {}) => {
    if (procesandoRef.current) return false;

    procesandoRef.current = true;

    try {
      if (!navegadorCompatible()) {
        actualizarEstado(false);

        if (mostrarConfirmacion) {
          await Swal.fire({
            icon: "warning",
            title: "Notificaciones no disponibles",
            text:
              "Este dispositivo o navegador no soporta notificaciones Push.",
          });
        }

        return false;
      }

      const publicKey = obtenerPublicKey();

      if (!publicKey) {
        actualizarEstado(false);

        console.error(
          "Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY."
        );

        return false;
      }

      const registration =
        await obtenerRegistration();

      /* ===================================================
         PERMISO DEL NAVEGADOR
      =================================================== */

      if (Notification.permission === "default") {
        const resultado = await Swal.fire({
          icon: "info",

          title: "🔔 Notificaciones del Admin",

          html: `
            <div
              style="
                text-align:center;
                line-height:1.55;
              "
            >
              <p>
                Activa las notificaciones para recibir
                avisos cuando llegue una nueva compra.
              </p>

              <p
                style="
                  margin-top:10px;
                  font-size:14px;
                  color:#64748b;
                "
              >
                Puedes cambiar este permiso posteriormente
                desde la configuración de tu teléfono
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
          actualizarEstado(false);
          return false;
        }

        const permiso =
          await Notification.requestPermission();

        if (permiso !== "granted") {
          actualizarEstado(false);

          await Swal.fire({
            icon: "warning",
            title: "Notificaciones desactivadas",
            text:
              "No se concedió permiso para enviar notificaciones.",
          });

          return false;
        }
      }

      if (Notification.permission !== "granted") {
        actualizarEstado(false);

        if (mostrarConfirmacion) {
          await Swal.fire({
            icon: "warning",
            title: "Permiso bloqueado",
            text:
              "Las notificaciones están bloqueadas en este navegador. Debes permitirlas desde la configuración del navegador o dispositivo.",
          });
        }

        return false;
      }

      /* ===================================================
         BUSCAR SUSCRIPCIÓN
      =================================================== */

      let subscription =
        await registration.pushManager
          .getSubscription();

      /* ===================================================
         COMPROBAR VAPID
      =================================================== */

      if (subscription) {
        const claveActual =
          subscription.options
            ?.applicationServerKey;

        const claveNueva =
          convertirVapidKey(publicKey);

        const actualBytes = claveActual
          ? new Uint8Array(claveActual)
          : null;

        const mismaClave =
          actualBytes &&
          actualBytes.length ===
            claveNueva.length &&
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

      /* ===================================================
         CREAR SUSCRIPCIÓN
      =================================================== */

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,

            applicationServerKey:
              convertirVapidKey(publicKey),
          });
      }

      /* ===================================================
         GUARDAR EN SUPABASE
      =================================================== */

      await guardarSuscripcion(subscription);

      actualizarEstado(true);

      console.log(
        "🔔 Sorteos LSD Admin: notificaciones activas en este dispositivo."
      );

      if (mostrarConfirmacion) {
        await Swal.fire({
          icon: "success",
          title: "🔔 Notificaciones activadas",
          text:
            "Este dispositivo recibirá las alertas del panel administrativo.",
          timer: 1800,
          showConfirmButton: false,
        });
      }

      return true;
    } catch (error) {
      actualizarEstado(false);

      console.error(
        "Error activando notificaciones del Admin:",
        error
      );

      if (mostrarConfirmacion) {
        await Swal.fire({
          icon: "error",
          title: "No se pudieron activar",
          text:
            error?.message ||
            "No se pudieron activar las notificaciones.",
        });
      }

      return false;
    } finally {
      procesandoRef.current = false;
    }
  };

  /* =======================================================
     DESACTIVAR NOTIFICACIONES
  ======================================================= */

  const desactivarNotificaciones = async () => {
    if (procesandoRef.current) return false;

    procesandoRef.current = true;

    try {
      if (!navegadorCompatible()) {
        actualizarEstado(false);
        return false;
      }

      const registration =
        await obtenerRegistration();

      const subscription =
        await registration.pushManager
          .getSubscription();

      /* ===================================================
         YA ESTÁ APAGADO
      =================================================== */

      if (!subscription) {
        actualizarEstado(false);

        return true;
      }

      /* ===================================================
         PRIMERO ELIMINAR DEL SERVIDOR

         Si falla el servidor, NO eliminamos todavía
         la suscripción local para evitar dejar un
         registro huérfano en Supabase.
      =================================================== */

      await eliminarSuscripcion(
        subscription.endpoint
      );

      /* ===================================================
         DESPUÉS CANCELAR EN EL NAVEGADOR
      =================================================== */

      const desuscrito =
        await subscription.unsubscribe();

      if (!desuscrito) {
        throw new Error(
          "El navegador no pudo cancelar la suscripción."
        );
      }

      actualizarEstado(false);

      console.log(
        "🔕 Sorteos LSD Admin: notificaciones desactivadas en este dispositivo."
      );

      await Swal.fire({
        icon: "success",
        title: "🔕 Notificaciones desactivadas",
        text:
          "Este dispositivo dejará de recibir las alertas del panel administrativo.",
        timer: 1800,
        showConfirmButton: false,
      });

      return true;
    } catch (error) {
      console.error(
        "Error desactivando notificaciones del Admin:",
        error
      );

      await Swal.fire({
        icon: "error",
        title: "No se pudieron desactivar",
        text:
          error?.message ||
          "No se pudieron desactivar las notificaciones.",
      });

      return false;
    } finally {
      procesandoRef.current = false;
    }
  };

  /* =======================================================
     CAMBIAR ON / OFF
  ======================================================= */

const alternarNotificaciones = async () => {
  console.log("🔔 Interruptor Push presionado");

  if (!navegadorCompatible()) {
    actualizarEstado(false);

    await Swal.fire({
      icon: "warning",
      title: "Notificaciones no disponibles",
      text: "Este dispositivo o navegador no soporta notificaciones Push.",
    });

    return false;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    console.log(
      "🔔 Estado actual Push:",
      subscription ? "ON" : "OFF"
    );

    if (subscription) {
      return await desactivarNotificaciones();
    }

    return await activarNotificaciones({
      mostrarConfirmacion: true,
    });
  } catch (error) {
    console.error(
      "Error cambiando estado Push:",
      error
    );

    await Swal.fire({
      icon: "error",
      title: "Error de notificaciones",
      text:
        error?.message ||
        "No se pudo cambiar el estado de las notificaciones.",
    });

    return false;
  }
};

  /* =======================================================
     EXPONER CONTROL AL PAGE.JS
  ======================================================= */

  useImperativeHandle(
    controlRef,
    () => ({
      alternar: alternarNotificaciones,
      activar: activarNotificaciones,
      desactivar: desactivarNotificaciones,
    })
  );

  /* =======================================================
     ESTADO INICIAL
  ======================================================= */

  useEffect(() => {
    if (!accesoPermitido) {
      actualizarEstado(false);
      return;
    }

    if (ejecutadoRef.current) return;

    ejecutadoRef.current = true;

    let cancelado = false;

    async function comprobarEstadoInicial() {
      try {
        if (!navegadorCompatible()) {
          if (!cancelado) {
            actualizarEstado(false);
          }

          return;
        }

        const registration =
          await obtenerRegistration();

        const subscription =
          await registration.pushManager
            .getSubscription();

        if (cancelado) return;

        /* =================================================
           SI YA EXISTE, SINCRONIZAR CON SUPABASE
        ================================================= */

        if (
          subscription &&
          Notification.permission === "granted"
        ) {
          try {
            await guardarSuscripcion(
              subscription
            );

            if (!cancelado) {
              actualizarEstado(true);
            }

            return;
          } catch (error) {
            console.error(
              "No se pudo sincronizar la suscripción Push:",
              error
            );

            if (!cancelado) {
              actualizarEstado(false);
            }

            return;
          }
        }

        /* =================================================
           SI NO EXISTE, NO ACTIVAR AUTOMÁTICAMENTE

           El administrador podrá hacerlo desde ON/OFF.
        ================================================= */

        if (!cancelado) {
          actualizarEstado(false);
        }
      } catch (error) {
        console.error(
          "Error comprobando estado Push:",
          error
        );

        if (!cancelado) {
          actualizarEstado(false);
        }
      }
    }

    comprobarEstadoInicial();

    return () => {
      cancelado = true;
    };
  }, [accesoPermitido]);

  return null;
}