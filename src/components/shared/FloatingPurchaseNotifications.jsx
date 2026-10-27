"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import "./floating-purchase-notifications.css";

const STORAGE_KEY =
  "sorteoslsd_ultima_compra_notificacion_mostrada";

export default function FloatingPurchaseNotifications() {
  const { config } = useSiteConfig();

  const [notificacion, setNotificacion] = useState(null);
  const [saliendo, setSaliendo] = useState(false);

  // Deslizamiento táctil
  const [desplazamientoX, setDesplazamientoX] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);

  /*
   * Guarda en memoria la última aprobación mostrada.
   *
   * También usamos sessionStorage para evitar que
   * la misma compra vuelva a aparecer al:
   *
   * - recargar la página
   * - cambiar entre páginas del sitio
   * - desmontar y volver a montar el componente
   *
   * sessionStorage dura solamente durante
   * la sesión/pestaña actual del navegador.
   */
  const ultimaCompraMostrada = useRef(null);

  const timerSalir = useRef(null);
  const timerCerrar = useRef(null);

  const touchStartX = useRef(null);
  const touchActualX = useRef(0);

  useEffect(() => {
    let activo = true;

    /*
     * Recuperamos la última notificación mostrada
     * durante esta sesión del navegador.
     */
    try {
      ultimaCompraMostrada.current =
        sessionStorage.getItem(STORAGE_KEY);
    } catch {
      ultimaCompraMostrada.current = null;
    }

    async function cargarUltimaCompra() {
      /*
       * No consultamos mientras la pestaña está oculta.
       * Así evitamos consumir recursos innecesariamente.
       */
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await fetch(
          "/api/notificaciones-compras",
          {
            method: "GET",
            cache: "no-store",
          }
        );

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
         * Si esta aprobación ya fue mostrada
         * durante la sesión actual, no repetimos
         * la notificación.
         */
        if (
          ultimaCompraMostrada.current ===
          ultimaCompra.id
        ) {
          return;
        }

        /*
         * Marcamos esta aprobación como mostrada.
         */
        ultimaCompraMostrada.current =
          ultimaCompra.id;

        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            ultimaCompra.id
          );
        } catch {
          /*
           * Si sessionStorage no está disponible,
           * el useRef continúa evitando duplicados
           * mientras el componente siga montado.
           */
        }

        setSaliendo(false);
        setDesplazamientoX(0);
        setArrastrando(false);
        setNotificacion(ultimaCompra);

        clearTimeout(timerSalir.current);
        clearTimeout(timerCerrar.current);

        /*
         * Comienza animación de salida.
         */
        timerSalir.current = setTimeout(() => {
          if (!activo) {
            return;
          }

          setSaliendo(true);
        }, 2500);

        /*
         * Respaldo:
         * eliminamos la notificación aunque por algún
         * motivo la animación no termine correctamente.
         */
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
     * Actualización cada 30 segundos.
     *
     * Evitamos consultas demasiado frecuentes,
     * pero reducimos el retraso respecto a los
     * 60 segundos anteriores.
     */
    const intervalo = setInterval(() => {
      cargarUltimaCompra();
    }, 30000);

    /*
     * Si el usuario regresa a esta pestaña,
     * comprobamos inmediatamente si existe
     * una nueva compra aprobada.
     */
    const manejarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        cargarUltimaCompra();
      }
    };

    /*
     * También comprobamos cuando la ventana
     * recupera el foco.
     */
    const manejarFocus = () => {
      cargarUltimaCompra();
    };

    document.addEventListener(
      "visibilitychange",
      manejarVisibilidad
    );

    window.addEventListener(
      "focus",
      manejarFocus
    );

    return () => {
      activo = false;

      clearInterval(intervalo);
      clearTimeout(timerSalir.current);
      clearTimeout(timerCerrar.current);

      document.removeEventListener(
        "visibilitychange",
        manejarVisibilidad
      );

      window.removeEventListener(
        "focus",
        manejarFocus
      );
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
    if (
      touchStartX.current === null ||
      saliendo
    ) {
      return;
    }

    const touch = e.touches?.[0];

    if (!touch) {
      return;
    }

    const diferencia =
      touch.clientX - touchStartX.current;

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
     *
     * Si supera 60px, no lo devolvemos
     * al centro. Lo enviamos fuera.
     */
    if (distancia <= -60) {
      clearTimeout(timerSalir.current);
      clearTimeout(timerCerrar.current);

      setDesplazamientoX(distancia);
      setSaliendo(true);

      return;
    }

    /*
     * Si no llegó a 60px,
     * vuelve al centro.
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
    "--purchase-swipe-x":
      `${desplazamientoX}px`,

    "--purchase-accent":
      config?.notificaciones_color_acento ||
      "#dc2626",
  };

  return (
    <div
      className={`floating-purchase-notification ${
        saliendo ? "purchase-toast-exit" : ""
      } ${
        arrastrando
          ? "purchase-toast-dragging"
          : ""
      }`}
      style={estiloDeslizamiento}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onAnimationEnd={(e) => {
        if (
          saliendo &&
          e.animationName ===
            "purchaseToastOutLeft"
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

        {/*
         * El nombre YA viene anonimizado
         * desde el servidor.
         *
         * Ejemplo:
         * Samir ***
         */}
        <strong>
          {notificacion.nombre || "Cliente ***"}
        </strong>

        <p>
          acaba de comprar{" "}
          {notificacion.cantidad_tickets} ticket
          {Number(
            notificacion.cantidad_tickets
          ) === 1
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