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

  // Deslizamiento táctil
  const [desplazamientoX, setDesplazamientoX] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);

  const ultimaCompraMostrada = useRef(null);

  const timerSalir = useRef(null);
  const timerCerrar = useRef(null);

  const touchStartX = useRef(null);
  const touchActualX = useRef(0);

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
        setDesplazamientoX(0);
        setArrastrando(false);
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
          setDesplazamientoX(0);
          setArrastrando(false);
        }, 3000);
      } catch (error) {
        console.log("Error cargando última compra:", error);
      }
    }

    /*
     * Primera consulta al entrar a la página.
     */
    cargarUltimaCompra();

    /*
     * Actualización cada 60 segundos.
     */
    const intervalo = setInterval(() => {
      cargarUltimaCompra();
    }, 60000);


    return () => {
      activo = false;

      clearInterval(intervalo);
      clearTimeout(timerSalir.current);
      clearTimeout(timerCerrar.current);

    };
  }, []);

  /*
   * Cerrar notificación manualmente.
   */
const cerrarNotificacion = () => {
  clearTimeout(timerSalir.current);
  clearTimeout(timerCerrar.current);

  setArrastrando(false);
  setDesplazamientoX(0);
  setSaliendo(true);
};
  /*
   * Comienza el gesto táctil.
   */
  const handleTouchStart = (e) => {
    if (saliendo) {
      return;
    }

    const touch = e.touches?.[0];

    if (!touch) {
      return;
    }

    clearTimeout(timerSalir.current);
    clearTimeout(timerCerrar.current);

    touchStartX.current = touch.clientX;
    touchActualX.current = 0;

    setArrastrando(true);
  };

  /*
   * Mueve la notificación siguiendo el dedo.
   */
  const handleTouchMove = (e) => {
    if (touchStartX.current === null || saliendo) {
      return;
    }

    const touch = e.touches?.[0];

    if (!touch) {
      return;
    }

    const diferencia = touch.clientX - touchStartX.current;

    touchActualX.current = diferencia;
    setDesplazamientoX(diferencia);
  };

  /*
   * Cuando el usuario levanta el dedo:
   *
   * - Si movió suficiente -> cerramos.
   * - Si no -> vuelve suavemente al centro.
   */
const handleTouchEnd = () => {
  if (touchStartX.current === null) {
    return;
  }

  const distancia = touchActualX.current;

  touchStartX.current = null;
  touchActualX.current = 0;

  setArrastrando(false);

  /*
   * DESLIZÓ HACIA LA IZQUIERDA
   * Si supera 60px, NO lo devolvemos al centro.
   * Lo mandamos completamente fuera de la pantalla.
   */
  if (distancia <= -60) {
    clearTimeout(timerSalir.current);
    clearTimeout(timerCerrar.current);

    /*
     * IMPORTANTE:
     * mantenemos el desplazamiento donde soltó el dedo.
     */
    setDesplazamientoX(distancia);

    /*
     * Activamos la salida.
     */
    setSaliendo(true);

    return;
  }

  /*
   * Si NO llegó a 60px,
   * entonces sí vuelve al centro.
   */
  setDesplazamientoX(0);

  timerSalir.current = setTimeout(() => {
    setSaliendo(true);
  }, 1800);
};

  const handleTouchCancel = () => {
    touchStartX.current = null;
    touchActualX.current = 0;

    setArrastrando(false);
    setDesplazamientoX(0);
  };

  if (!notificacion) {
    return null;
  }

  /*
   * Mientras se arrastra usamos una variable CSS.
   * Esto permite mantener separado el centrado
   * de la tarjeta de su movimiento horizontal.
   */
  const estiloDeslizamiento = {
    "--purchase-swipe-x": `${desplazamientoX}px`,
  };

  return (
<div
  className={`floating-purchase-notification ${
    saliendo ? "purchase-toast-exit" : ""
  } ${arrastrando ? "purchase-toast-dragging" : ""}`}
  style={estiloDeslizamiento}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  onTouchCancel={handleTouchCancel}
  onAnimationEnd={(e) => {
    if (
      saliendo &&
      e.animationName === "purchaseToastOutLeft"
    ) {
      setNotificacion(null);
      setSaliendo(false);
      setDesplazamientoX(0);
      setArrastrando(false);

      touchStartX.current = null;
      touchActualX.current = 0;
    }
  }}
>
      <button
        type="button"
        className="purchase-close-btn"
        onClick={cerrarNotificacion}
        aria-label="Cerrar notificación"
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