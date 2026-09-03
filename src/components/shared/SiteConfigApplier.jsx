"use client";

import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function SiteConfigApplier() {
  const { config } = useSiteConfig();

  useEffect(() => {
    if (!config) return;

    const root = document.documentElement;

    root.style.setProperty("--site-primary", config.color_primario || "#dc2626");
    root.style.setProperty("--site-secondary", config.color_secundario || "#111827");
    root.style.setProperty("--site-bg", config.color_fondo || "#ffffff");
    root.style.setProperty("--site-text", config.color_texto || "#111827");
    root.style.setProperty("--site-button", config.color_boton || "#dc2626");
    root.style.setProperty("--site-warning", config.color_alerta || "#f97316");
    root.style.setProperty("--site-success", config.color_exito || "#16a34a");
    root.style.setProperty("--site-card", config.color_tarjeta || "#ffffff");
    root.style.setProperty("--site-border", config.color_borde || "#e5e7eb");
    root.style.setProperty("--site-error", config.color_error || "#dc2626");
    root.style.setProperty("--site-hover", config.color_hover || "#b91c1c");

    root.style.setProperty("--site-hue", `${config.tono_global ?? 0}deg`);
    root.style.setProperty("--site-saturation", `${config.saturacion_global ?? 100}%`);
    root.style.setProperty("--site-brightness", `${config.luminosidad_global ?? 100}%`);
    root.style.setProperty("--site-contrast", `${config.contraste_global ?? 100}%`);
  }, [config]);

  return null;
}