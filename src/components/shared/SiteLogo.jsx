"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const SIZE_MAP = {
  nav: "site-logo--nav",
  sidebar: "site-logo--sidebar",
  footer: "site-logo--footer",
  preview: "site-logo--preview",
  hero: "site-logo--hero",
};

export default function SiteLogo({
  size = "nav",
  href = null,
  className = "",
  alt = "",
  src = "",
  fallbackText = "",
}) {
  const { config } = useSiteConfig();

  const [broken, setBroken] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | LOGO
  |--------------------------------------------------------------------------
  |
  | IMPORTANTE:
  |
  | Antes usábamos:
  |
  | config?.logo_url || "/logo.png"
  |
  | Eso provocaba que apareciera primero el logo viejo mientras
  | cargaba la configuración global.
  |
  | Ahora, si no se pasó un src manual, esperamos a que exista
  | config.logo_url antes de mostrar la imagen.
  |
  */

  const logoSrc =
    src ||
    config?.logo_url ||
    "";

  /*
  |--------------------------------------------------------------------------
  | Si cambia el logo, quitamos cualquier estado de error anterior
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    setBroken(false);
  }, [logoSrc]);

  const brandInitial =
    fallbackText ||
    String(config?.nombre_marca || "R")
      .trim()
      .charAt(0)
      .toUpperCase();

  const wrapperClassName = [
    "site-logo-wrap",
    SIZE_MAP[size] || SIZE_MAP.nav,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const imageAlt =
    alt ||
    `Logo ${
      config?.nombre_marca ||
      "Sorteos LSD"
    }`;

  /*
  |--------------------------------------------------------------------------
  | CONTENIDO
  |--------------------------------------------------------------------------
  |
  | - Si tenemos logo válido: mostramos el logo.
  | - Si el logo falla: mostramos la inicial.
  | - Mientras config todavía está cargando: dejamos el espacio vacío.
  |
  | Así nunca aparece /logo.png viejo antes del logo actual.
  |
  */

  let content = null;

  if (broken) {
    content = (
      <span className="site-logo-fallback">
        {brandInitial}
      </span>
    );
  } else if (logoSrc) {
    content = (
      <img
        src={logoSrc}
        alt={imageAlt}
        className="site-logo-img"
        onError={() => setBroken(true)}
        loading="eager"
        decoding="async"
      />
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={wrapperClassName}
        aria-label={imageAlt}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={wrapperClassName}>
      {content}
    </div>
  );
}