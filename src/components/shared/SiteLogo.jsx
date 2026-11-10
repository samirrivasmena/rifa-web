
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

  const [mounted, setMounted] = useState(false);
  const [brokenSrc, setBrokenSrc] = useState(null);

  // Evita diferencias entre el HTML del servidor
  // y el primer renderizado del navegador.
  useEffect(() => {
    setMounted(true);
  }, []);

  // El src manual tiene prioridad sobre la configuración.
  // No utilizamos /logo.png como fallback.
  const logoSrc = mounted
    ? String(src || config?.logo_url || "").trim()
    : "";

  const broken = Boolean(
    logoSrc && brokenSrc === logoSrc
  );

  const brandInitial =
    fallbackText ||
    String(
      mounted
        ? config?.nombre_marca || "R"
        : "R"
    )
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

  const imageAlt = mounted
    ? alt || `Logo ${config?.nombre_marca || "Sorteos LSD"}`
    : alt || "Logo Sorteos LSD";

  let content = null;

  if (mounted && broken) {
    content = (
      <span className="site-logo-fallback">
        {brandInitial}
      </span>
    );
  } else if (mounted && logoSrc) {
    content = (
      <img
        src={logoSrc}
        alt={imageAlt}
        className="site-logo-img"
        onError={() => setBrokenSrc(logoSrc)}
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
