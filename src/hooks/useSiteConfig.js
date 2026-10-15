"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "site-config-updated";
const CHANNEL_NAME = "site-config-channel";

// ============================================================
// ESTADO COMPARTIDO ENTRE TODAS LAS INSTANCIAS DEL HOOK
// ============================================================

let sharedConfig = null;
let sharedLoading = true;
let sharedError = null;

let requestPromise = null;
let listenersInstalled = false;
let broadcastChannel = null;

const subscribers = new Set();

// ============================================================
// APLICAR CONFIGURACIÓN INICIAL DEL SERVIDOR
// ============================================================

function aplicarConfigInicial(initialConfig) {
  if (!initialConfig) {
    return;
  }

  if (!sharedConfig) {
    sharedConfig = initialConfig;
    sharedLoading = false;
    sharedError = null;
  }
}

// ============================================================
// NOTIFICAR A TODOS LOS COMPONENTES
// ============================================================

function notifySubscribers() {
  subscribers.forEach((callback) => {
    try {
      callback({
        config: sharedConfig,
        loadingConfig: sharedLoading,
        errorConfig: sharedError,
      });
    } catch (error) {
      console.error(
        "Error notificando configuración:",
        error
      );
    }
  });
}

// ============================================================
// ACTUALIZAR CONFIGURACIÓN COMPARTIDA
// ============================================================

function setSharedConfig(value) {
  sharedConfig = value;
  sharedLoading = false;
  sharedError = null;

  notifySubscribers();
}

// ============================================================
// CARGAR CONFIGURACIÓN
// ============================================================

async function cargarConfigCompartida({
  force = false,
  silent = false,
} = {}) {
  // Si ya existe una petición en curso,
  // todos los componentes esperan la misma.
  if (requestPromise) {
    return requestPromise;
  }

  // Si ya tenemos configuración y no estamos
  // forzando una actualización, no consultamos otra vez.
  if (!force && sharedConfig) {
    return sharedConfig;
  }

  if (!silent) {
    sharedLoading = true;
    sharedError = null;
    notifySubscribers();
  }

  requestPromise = (async () => {
    try {
      const res = await fetch(
        "/api/configuracion-publica",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control":
              "no-cache, no-store, max-age=0",
            Pragma: "no-cache",
          },
        }
      );

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "No se pudo cargar la configuración"
        );
      }

      sharedConfig =
        data.configuracion || null;

      sharedError = null;

      return sharedConfig;
    } catch (error) {
      console.error(
        "Error cargando configuración pública:",
        error
      );

      sharedError =
        error?.message ||
        "Error cargando configuración";

      return null;
    } finally {
      sharedLoading = false;
      requestPromise = null;

      notifySubscribers();
    }
  })();

  return requestPromise;
}

// ============================================================
// RECARGA GLOBAL
// ============================================================

function recargarConfigGlobal() {
  return cargarConfigCompartida({
    force: true,
    silent: true,
  });
}

// ============================================================
// LISTENERS GLOBALES
// ============================================================

function instalarListenersGlobales() {
  if (
    typeof window === "undefined" ||
    listenersInstalled
  ) {
    return;
  }

  listenersInstalled = true;

  // ----------------------------------------------------------
  // VOLVER A LA PESTAÑA
  // ----------------------------------------------------------

  const handleVisibilityChange = () => {
    // No recargamos la configuración simplemente
    // por volver a esta pestaña.
    //
    // Los cambios reales del Admin ya se sincronizan
    // mediante:
    // - site-config-updated
    // - storage
    // - BroadcastChannel
  };

  // ----------------------------------------------------------
  // EVENTO INTERNO DEL ADMIN
  // ----------------------------------------------------------

  const handleSiteConfigUpdated = () => {
    recargarConfigGlobal();
  };

  // ----------------------------------------------------------
  // LOCALSTORAGE ENTRE PESTAÑAS
  // ----------------------------------------------------------

  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      recargarConfigGlobal();
    }
  };

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.addEventListener(
    "site-config-updated",
    handleSiteConfigUpdated
  );

  window.addEventListener(
    "storage",
    handleStorage
  );

  // ----------------------------------------------------------
  // BROADCAST CHANNEL
  // ----------------------------------------------------------

  if ("BroadcastChannel" in window) {
    broadcastChannel =
      new BroadcastChannel(CHANNEL_NAME);

    broadcastChannel.onmessage = (event) => {
      if (
        event?.data?.type ===
        "site-config-updated"
      ) {
        recargarConfigGlobal();
      }
    };
  }
}

// ============================================================
// HOOK
// ============================================================

export function useSiteConfig(initialConfig = null) {
  // Si esta página recibió configuración directamente
  // desde el servidor, la usamos desde el primer render.
  aplicarConfigInicial(initialConfig);

  const [state, setState] = useState(() => ({
    config:
      sharedConfig ||
      initialConfig ||
      null,

    loadingConfig:
      sharedConfig || initialConfig
        ? false
        : sharedLoading,

    errorConfig: sharedError,
  }));

  // ==========================================================
  // SUSCRIPCIÓN
  // ==========================================================

  useEffect(() => {
    // Por seguridad, volvemos a aplicar la configuración
    // inicial si todavía no existe una compartida.
    aplicarConfigInicial(initialConfig);

    const actualizar = (nuevoEstado) => {
      setState(nuevoEstado);
    };

    subscribers.add(actualizar);

    instalarListenersGlobales();

    // Sincronizamos inmediatamente esta instancia
    // con el estado compartido actual.
    actualizar({
      config:
        sharedConfig ||
        initialConfig ||
        null,

      loadingConfig:
        sharedConfig || initialConfig
          ? false
          : sharedLoading,

      errorConfig: sharedError,
    });

    // Si ya recibimos configuración del servidor,
    // cargarConfigCompartida() reutiliza sharedConfig
    // y NO provoca una petición duplicada.
    cargarConfigCompartida();

    return () => {
      subscribers.delete(actualizar);
    };
  }, [initialConfig]);

  // ==========================================================
  // SET CONFIG
  // ==========================================================
  //
  // Conservamos setConfig para no romper ningún componente
  // que ya lo esté utilizando.
  // ==========================================================

  const setConfig = useCallback((value) => {
    if (typeof value === "function") {
      setSharedConfig(
        value(sharedConfig)
      );
      return;
    }

    setSharedConfig(value);
  }, []);

  // ==========================================================
  // RECARGAR CONFIG
  // ==========================================================

  const recargarConfig = useCallback(() => {
    return recargarConfigGlobal();
  }, []);

  // ==========================================================
  // RESPUESTA DEL HOOK
  // ==========================================================

  return {
    config: state.config,
    setConfig,
    loadingConfig: state.loadingConfig,
    errorConfig: state.errorConfig,
    recargarConfig,
  };
}