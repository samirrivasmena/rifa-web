
"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import "./floating-purchase-notifications.css";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const STORAGE_KEY =
  "sorteoslsd_ultima_compra_notificacion_mostrada";

// Consulta periódica cada 60 segundos.
const INTERVALO_CONSULTA = 60 * 1000;

// Evita consultas repetidas por focus y visibilitychange.
const INTERVALO_MINIMO = 10 * 1000;

// Duración de la notificación.
const TIEMPO_SALIDA = 2500;
const TIEMPO_CIERRE = 3000;

export default function FloatingPurchaseNotifications() {
  const { config } = useSiteConfig();

  const [notificacion, setNotificacion] = useState(null);
  const [saliendo, setSaliendo] = useState(false);

  /* =======================================================
     ESTADOS DEL DESLIZAMIENTO TÁCTIL
  ======================================================= */

  const [desplazamientoX, setDesplazamientoX] =
    useState(0);

  const [arrastrando, setArrastrando] =
    useState(false);

  /* =======================================================
     REFERENCIAS
  ======================================================= */

  const ultimaCompraMostrada = useRef(null);

  const ultimaConsulta = useRef(0);
  const consultaEnCurso = useRef(false);

  const timerSalir = useRef(null);
  const timerCerrar = useRef(null);

  const touchStartX = useRef(null);
  const touchActualX = useRef(0);

  /* =======================================================
     CERRAR NOTIFICACIÓN
  ======================================================= */

  const cerrarNotificacion = () => {
    clearTimeout(timerSalir.current);
    clearTimeout(timerCerrar.current);

    touchStartX.current = null;
    touchActualX.current = 0;

    setArrastrando(false);
    setDesplazamientoX(0);
    setSaliendo(true);

    // Respaldo por si no termina la animación CSS.
    timerCerrar.current = setTimeout(() => {
      setNotificacion(null);
      setSaliendo(false);
      setDesplazamientoX(0);
      setArrastrando(false);
    }, 500);
  };

  /* =======================================================
     CONSULTAR ÚLTIMA COMPRA APROBADA
  ======================================================= */

  useEffect(() => {
    let activo = true;

    /*
     * Recuperar la última notificación mostrada
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
       * No consultar cuando la pestaña está oculta.
       */
      if (document.visibilityState !== "visible") {
        return;
      }

      /*
       * Evitar solicitudes simultáneas.
       */
      if (consultaEnCurso.current) {
        return;
      }

      /*
       * Evitar consultas demasiado cercanas.
       *
       * Esto controla las solicitudes que se disparan
       * al recuperar el foco de la ventana.
       */
      const ahora = Date.now();

      if (
        ahora - ultimaConsulta.current <
        INTERVALO_MINIMO
      ) {
        return;
      }

      ultimaConsulta.current = ahora;
      consultaEnCurso.current = true;

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
         * Evitar mostrar una aprobación repetida.
         */
        if (
          ultimaCompraMostrada.current ===
          ultimaCompra.id
        ) {
          return;
        }

        /*
         * Guardar el identificador público.
         */
        ultimaCompraMostrada.current =
          ultimaCompra.id;

        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            ultimaCompra.id
          );
        } catch {
          // useRef sigue evitando duplicados.
        }

        /*
         * Preparar nueva notificación.
         */
        clearTimeout(timerSalir.current);
        clearTimeout(timerCerrar.current);

        touchStartX.current = null;
        touchActualX.current = 0;

        setSaliendo(false);
        setDesplazamientoX(0);
        setArrastrando(false);
        setNotificacion(ultimaCompra);

        /*
         * Iniciar animación de salida.
         */
        timerSalir.current = setTimeout(() => {
          if (!activo) {
            return;
          }

          setSaliendo(true);
        }, TIEMPO_SALIDA);

        /*
         * Cierre de respaldo.
         */
        timerCerrar.current = setTimeout(() => {
          if (!activo) {
            return;
          }

          setNotificacion(null);
          setSaliendo(false);
          setDesplazamientoX(0);
          setArrastrando(false);
        }, TIEMPO_CIERRE);
      } catch (error) {
        console.error(
          "Error cargando última compra:",
          error
        );
      } finally {
        consultaEnCurso.current = false;
      }
    }

    /* =====================================================
       CONSULTA INICIAL
    ===================================================== */

    cargarUltimaCompra();

    /* =====================================================
       CONSULTA PERIÓDICA CADA 60 SEGUNDOS
    ===================================================== */

    const intervalo = setInterval(() => {
      cargarUltimaCompra();
    }, INTERVALO_CONSULTA);

    /* =====================================================
       DETECTAR REGRESO A LA PESTAÑA
    ===================================================== */

    const manejarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        cargarUltimaCompra();
      }
    };

    /* =====================================================
       DETECTAR FOCO DE LA VENTANA
    ===================================================== */

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

    /* =====================================================
       LIMPIEZA
    ===================================================== */

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

  /* =======================================================
     GESTOS TÁCTILES
  ======================================================= */

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

  const handleTouchEnd = () => {
    if (touchStartX.current === null) {
      return;
    }

    const distancia = touchActualX.current;

    touchStartX.current = null;
    touchActualX.current = 0;

    setArrastrando(false);

    /*
     * Deslizar hacia la izquierda para cerrar.
     */
    if (distancia <= -60) {
      clearTimeout(timerSalir.current);
      clearTimeout(timerCerrar.current);

      setDesplazamientoX(distancia);
      setSaliendo(true);

      timerCerrar.current = setTimeout(() => {
        setNotificacion(null);
        setSaliendo(false);
        setDesplazamientoX(0);
        setArrastrando(false);
      }, 500);

      return;
    }

    /*
     * Si el gesto fue corto, regresar al centro.
     */
    setDesplazamientoX(0);

    clearTimeout(timerSalir.current);
    clearTimeout(timerCerrar.current);

    timerSalir.current = setTimeout(() => {
      setSaliendo(true);
    }, 1800);

    timerCerrar.current = setTimeout(() => {
      setNotificacion(null);
      setSaliendo(false);
      setDesplazamientoX(0);
      setArrastrando(false);
    }, 2300);
  };

  const handleTouchCancel = () => {
    touchStartX.current = null;
    touchActualX.current = 0;

    setArrastrando(false);
    setDesplazamientoX(0);
  };

  /* =======================================================
     NO MOSTRAR SI NO EXISTE NOTIFICACIÓN
  ======================================================= */

  if (!notificacion) {
    return null;
  }

  /* =======================================================
     COLORES Y DESLIZAMIENTO
  ======================================================= */

  const estiloDeslizamiento = {
    "--purchase-swipe-x":
      `${desplazamientoX}px`,

    "--purchase-accent":
      config?.notificaciones_color_acento ||
      "#dc2626",
  };

  /* =======================================================
     INTERFAZ ORIGINAL
  ======================================================= */

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
          clearTimeout(timerCerrar.current);

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
