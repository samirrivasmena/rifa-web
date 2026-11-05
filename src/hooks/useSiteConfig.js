
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "site-config-updated";
const CHANNEL_NAME = "site-config-channel";

// ============================================================
// ESTADO COMPARTIDO
// ============================================================

let sharedConfig = null;
let sharedLoading = true;
let sharedError = null;

let requestPromise = null;
let listenersInstalled = false;
let broadcastChannel = null;

const subscribers = new Set();

// ============================================================
// NOTIFICAR A TODOS LOS COMPONENTES
// ============================================================

function notifySubscribers() {
  const estado = {
    config: sharedConfig,
    loadingConfig: sharedLoading,
    errorConfig: sharedError,
  };

  subscribers.forEach((callback) => {
    try {
      callback(estado);
    } catch (error) {
      console.error(
        "Error notificando configuración:",
        error
      );
    }
  });
}

// ============================================================
// APLICAR CONFIGURACIÓN
// ============================================================

function setSharedConfig(value) {
  sharedConfig = value;
  sharedLoading = false;
  sharedError = null;

  notifySubscribers();
}

// ============================================================
// CONFIGURACIÓN INICIAL DEL SERVIDOR
// ============================================================

function aplicarConfigInicial(initialConfig) {
  if (!initialConfig) {
    return;
  }

  // La configuración recibida del servidor debe poder
  // reemplazar una configuración anterior de otra página.
  if (sharedConfig !== initialConfig) {
    setSharedConfig(initialConfig);
  }
}

// ============================================================
// CARGAR CONFIGURACIÓN PÚBLICA
// ============================================================

async function cargarConfigCompartida({
  force = false,
  silent = false,
} = {}) {
  if (requestPromise) {
    return requestPromise;
  }

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
        }
      );

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
          "No se pudo cargar la configuración"
        );
      }

      setSharedConfig(
        data.configuracion || null
      );

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

  const handleSiteConfigUpdated = () => {
    recargarConfigGlobal();
  };

  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      recargarConfigGlobal();
    }
  };

  window.addEventListener(
    "site-config-updated",
    handleSiteConfigUpdated
  );

  window.addEventListener(
    "storage",
    handleStorage
  );

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
// HOOK PRINCIPAL
// ============================================================

export function useSiteConfig(initialConfig = null) {
  const [state, setState] = useState(() => ({
    config: sharedConfig || initialConfig || null,

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
    const actualizar = (nuevoEstado) => {
      setState(nuevoEstado);
    };

    subscribers.add(actualizar);

    instalarListenersGlobales();

    // Aplicar configuración actual recibida del servidor.
    if (initialConfig) {
      aplicarConfigInicial(initialConfig);
    } else {
      actualizar({
        config: sharedConfig,
        loadingConfig: sharedLoading,
        errorConfig: sharedError,
      });
    }

    // Si no existe configuración, consultarla una sola vez.
    if (!sharedConfig) {
      cargarConfigCompartida();
    }

    return () => {
      subscribers.delete(actualizar);
    };
  }, [initialConfig]);

  // ==========================================================
  // ACTUALIZAR CONFIGURACIÓN
  // ==========================================================

  const setConfig = useCallback((value) => {
    if (typeof value === "function") {
      setSharedConfig(
        value(sharedConfig)
      );
    } else {
      setSharedConfig(value);
    }
  }, []);

  // ==========================================================
  // RECARGAR CONFIGURACIÓN
  // ==========================================================

  const recargarConfig = useCallback(() => {
    return recargarConfigGlobal();
  }, []);

  // ==========================================================
  // RESPUESTA
  // ==========================================================

  return {
    config: state.config,
    setConfig,
    loadingConfig: state.loadingConfig,
    errorConfig: state.errorConfig,
    recargarConfig,
  };
}
