"use client";

import { useEffect, useState } from "react";

export default function PublicTopbar({
  active = "eventos",
  onOpenVerifier,
  logoHref = "/principal",
  inicioHref = "/principal#inicio",
  eventosHref = "/principal#eventos-disponibles",
  pagosHref = "/principal#pagos",
  contactoHref = "/principal#contacto",
}) {
  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isMobile = window.innerWidth <= 768;

      if (!isMobile) {
        setHiddenOnMobile(false);
        lastScrollY = currentScrollY;
        return;
      }

      if (currentScrollY <= 20) {
        setHiddenOnMobile(false);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setHiddenOnMobile(true);
      } else if (currentScrollY < lastScrollY) {
        setHiddenOnMobile(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <header className={`public-topbar ${hiddenOnMobile ? "mobile-hidden" : ""}`}>
      <div className="public-topbar-inner">
        <a href={logoHref} className="public-topbar-logo-link">
          <img src="/logo.png" alt="Logo Rifas LSD" className="public-topbar-logo" />
        </a>

        <nav className="public-topbar-nav">
          <a
            href={inicioHref}
            className={`public-topbar-link ${active === "inicio" ? "active" : ""}`}
          >
            INICIO
          </a>

          <a
            href={eventosHref}
            className={`public-topbar-link ${active === "eventos" ? "active" : ""}`}
          >
            EVENTOS
          </a>

          <a
            href={pagosHref}
            className={`public-topbar-link ${active === "pagos" ? "active" : ""}`}
          >
            CUENTAS DE PAGO
          </a>

          <a
            href={contactoHref}
            className={`public-topbar-link ${active === "contacto" ? "active" : ""}`}
          >
            CONTACTO
          </a>

          <button
            type="button"
            className="public-topbar-link public-topbar-verifier"
            onClick={onOpenVerifier}
          >
            ✔ VERIFICADOR
          </button>
        </nav>
      </div>
    </header>
  );
}