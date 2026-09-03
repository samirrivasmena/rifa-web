"use client";

import { useEffect, useRef, useState } from "react";
import "./floating-purchase-notifications.css";

function ocultarNombre(nombre = "Cliente") {
  const limpio = String(nombre || "Cliente").trim();
  if (!limpio) return "Cliente";
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
      try {
        const res = await fetch("/api/notificaciones-compras", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();
        if (!activo) return;

        const ultimaCompra = data?.compras?.[0];
        if (!ultimaCompra?.id) return;
        if (ultimaCompraMostrada.current === ultimaCompra.id) return;

        ultimaCompraMostrada.current = ultimaCompra.id;
        setSaliendo(false);
        setNotificacion(ultimaCompra);

        clearTimeout(timerSalir.current);
        clearTimeout(timerCerrar.current);

timerSalir.current = setTimeout(() => {
  setSaliendo(true);
}, 2500);

timerCerrar.current = setTimeout(() => {
  setNotificacion(null);
  setSaliendo(false);
}, 3000);
      } catch (error) {
        console.log("Error cargando última compra:", error);
      }
    }

    cargarUltimaCompra();
    const intervalo = setInterval(cargarUltimaCompra, 3000);

    return () => {
      activo = false;
      clearInterval(intervalo);
      clearTimeout(timerSalir.current);
      clearTimeout(timerCerrar.current);
    };
  }, []);

  if (!notificacion) return null;

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
      <div className="floating-purchase-icon">🎟️</div>

      <div className="floating-purchase-content">
        <div className="purchase-live">🔴 ULTIMA COMPRA</div>
        <strong>{ocultarNombre(notificacion.nombre)}</strong>

        <p>
          acaba de comprar {notificacion.cantidad_tickets} ticket
          {Number(notificacion.cantidad_tickets) === 1 ? "" : "s"}
        </p>

        <span>🏆 {notificacion.rifa || "Rifa"}</span>
      </div>
    </div>
  );
}