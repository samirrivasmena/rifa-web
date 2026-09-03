"use client";

import Link from "next/link";
import { useState } from "react";
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

  const logoSrc = src || config?.logo_url || "/logo.png";

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
    `Logo ${config?.nombre_marca || "RIFAS LSD"}`;

  const content = broken ? (
    <span className="site-logo-fallback">{brandInitial}</span>
  ) : (
    <img
      src={logoSrc}
      alt={imageAlt}
      className="site-logo-img"
      onError={() => setBroken(true)}
      loading="eager"
      decoding="async"
    />
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClassName} aria-label={imageAlt}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClassName}>{content}</div>;
}