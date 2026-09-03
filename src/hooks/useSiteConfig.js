"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INTERVALO_ACTUALIZACION = 3000;
const STORAGE_KEY = "site-config-updated";

export function useSiteConfig() {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [errorConfig, setErrorConfig] = useState(null);

  const mountedRef = useRef(true);
  const primeraCargaRef = useRef(true);
  const requestRef = useRef(0);
  const channelRef = useRef(null);

  const cargarConfig = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestRef.current;

    try {
      if (!silent) {
        setErrorConfig(null);
      }

      const res = await fetch(
        `/api/configuracion-publica?_=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, max-age=0",
            Pragma: "no-cache",
          },
        }
      );

      const data = await res.json();

      if (!mountedRef.current) return null;
      if (requestId !== requestRef.current) return null;

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || "No se pudo cargar la configuración"
        );
      }

      setConfig(data.configuracion || null);
      setErrorConfig(null);

      return data.configuracion || null;
    } catch (error) {
      console.error("Error cargando configuración pública:", error);

      if (!mountedRef.current) return null;
      if (requestId !== requestRef.current) return null;

      setErrorConfig(
        error?.message || "Error cargando configuración"
      );

      return null;
    } finally {
      if (
        mountedRef.current &&
        primeraCargaRef.current
      ) {
        setLoadingConfig(false);
        primeraCargaRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Primera carga
    cargarConfig();

    // Actualización automática cada 3 segundos
    const intervalo = setInterval(() => {
      cargarConfig({ silent: true });
    }, INTERVALO_ACTUALIZACION);

    // Si el usuario vuelve a la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        cargarConfig({ silent: true });
      }
    };

    // Si la ventana vuelve a tener foco
    const handleFocus = () => {
      cargarConfig({ silent: true });
    };

    // Si desde Admin se dispara una actualización manual
    const handleSiteConfigUpdated = () => {
      cargarConfig({ silent: true });
    };

    // Si otra pestaña cambia la configuración usando localStorage
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        cargarConfig({ silent: true });
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener("focus", handleFocus);
    window.addEventListener(
      "site-config-updated",
      handleSiteConfigUpdated
    );
    window.addEventListener("storage", handleStorage);

    // BroadcastChannel si está disponible
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channelRef.current = new BroadcastChannel("site-config-channel");

      channelRef.current.onmessage = (event) => {
        if (event?.data?.type === "site-config-updated") {
          cargarConfig({ silent: true });
        }
      };
    }

    return () => {
      mountedRef.current = false;
      clearInterval(intervalo);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        "site-config-updated",
        handleSiteConfigUpdated
      );
      window.removeEventListener("storage", handleStorage);

      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [cargarConfig]);

  const recargarConfig = useCallback(() => {
    return cargarConfig({ silent: true });
  }, [cargarConfig]);

  return {
    config,
    setConfig,
    loadingConfig,
    errorConfig,
    recargarConfig,
  };
}