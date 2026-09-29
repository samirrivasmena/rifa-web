"use client";

import { useEffect, useRef, useState } from "react";
import "./floating-purchase-notifications.css";

function ocultarNombre(nombre = "Cliente") {
  const limpio = String(nombre || "Cliente").trim();

  if (!limpio) {
    return "Cliente";
  }

  return `${limpio.split(" ")[0]} ***`;
}

export default function FloatingPurchaseNotifications() {
  const [notificacion, setNotificacion] = useState(null);
  const [saliendo, setSaliendo] = useState(false);

  const ultimaCompraMostrada = useRef(null);

  const timerSalir = useRef(null);
  const timerCerrar = useRef(null);

  useEffect(() => {
    let activo = true;

    async function cargarUltimaCompra() {
      /*
       * No consultamos mientras la pestaña está oculta.
       * Así evitamos consumir recursos innecesariamente.
       */
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await fetch("/api/notificaciones-compras", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();

        if (!activo) {
          return;
        }

        const ultimaCompra = data?.compras?.[0];

        if (!ultimaCompra?.id) {
          return;
        }

        /*
         * Si ya mostramos esta compra,
         * no volvemos a enseñar la notificación.
         */
        if (ultimaCompraMostrada.current === ultimaCompra.id) {
          return;
        }

        ultimaCompraMostrada.current = ultimaCompra.id;

        setSaliendo(false);
        setNotificacion(ultimaCompra);

        clearTimeout(timerSalir.current);
        clearTimeout(timerCerrar.current);

        timerSalir.current = setTimeout(() => {
          if (!activo) {
            return;
          }

          setSaliendo(true);
        }, 2500);

        timerCerrar.current = setTimeout(() => {
          if (!activo) {
            return;
          }

          setNotificacion(null);
          setSaliendo(false);
        }, 3000);
      } catch (error) {
        console.log(
          "Error cargando última compra:",
          error
        );
      }
    }

    /*
     * Primera consulta al entrar a la página.
     */
    cargarUltimaCompra();

    /*
     * Actualización mucho más razonable.
     *
     * Antes:
     * cada 3 segundos = 20 consultas/minuto por visitante.
     *
     * Ahora:
     * cada 60 segundos = 1 consulta/minuto por visitante.
     */
    const intervalo = setInterval(() => {
      cargarUltimaCompra();
    }, 60000);

    /*
     * Cuando el usuario vuelve a la pestaña,
     * actualizamos inmediatamente.
     */
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        cargarUltimaCompra();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      activo = false;

      clearInterval(intervalo);
      clearTimeout(timerSalir.current);
      clearTimeout(timerCerrar.current);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  if (!notificacion) {
    return null;
  }

  return (
    <div
      className={`floating-purchase-notification ${
        saliendo ? "purchase-toast-exit" : ""
      }`}
    >
      <button
        className="purchase-close-btn"
        onClick={() => {
          setSaliendo(true);

          setTimeout(() => {
            setNotificacion(null);
            setSaliendo(false);
          }, 400);
        }}
      >
        ✕
      </button>

      <div className="floating-purchase-icon">
        🎟️
      </div>

      <div className="floating-purchase-content">
        <div className="purchase-live">
          🔴 ULTIMA COMPRA
        </div>

        <strong>
          {ocultarNombre(notificacion.nombre)}
        </strong>

        <p>
          acaba de comprar{" "}
          {notificacion.cantidad_tickets} ticket
          {Number(notificacion.cantidad_tickets) === 1
            ? ""
            : "s"}
        </p>

        <span>
          🏆 {notificacion.rifa || "Rifa"}
        </span>
      </div>
    </div>
  );
}