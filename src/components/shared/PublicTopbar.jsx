"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      } else if (currentScrollY > lastScrollY && currentScrollY > 80 && !mobileMenuOpen) {
        setHiddenOnMobile(true);
      } else if (currentScrollY < lastScrollY) {
        setHiddenOnMobile(false);
      }

      lastScrollY = currentScrollY;
    };

    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
        setHiddenOnMobile(false);
      }
      handleScroll();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const cerrarMenu = () => setMobileMenuOpen(false);

  return (
    <header className={`public-topbar ${hiddenOnMobile ? "mobile-hidden" : ""}`}>
      <div className="public-topbar-inner">
        <Link href={logoHref} className="public-topbar-logo-link" onClick={cerrarMenu}>
          <img src="/logo.png" alt="Logo Rifas LSD" className="public-topbar-logo" />
        </Link>

        <button
          type="button"
          className={`public-topbar-menu-btn ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`public-topbar-nav ${mobileMenuOpen ? "open" : ""}`}>
          <Link
            href={inicioHref}
            className={`public-topbar-link ${active === "inicio" ? "active" : ""}`}
            onClick={cerrarMenu}
          >
            INICIO
          </Link>

          <Link
            href={eventosHref}
            className={`public-topbar-link ${active === "eventos" ? "active" : ""}`}
            onClick={cerrarMenu}
          >
            EVENTOS
          </Link>

          <Link
            href={pagosHref}
            className={`public-topbar-link ${active === "pagos" ? "active" : ""}`}
            onClick={cerrarMenu}
          >
            CUENTAS DE PAGO
          </Link>

          <Link
            href={contactoHref}
            className={`public-topbar-link ${active === "contacto" ? "active" : ""}`}
            onClick={cerrarMenu}
          >
            CONTACTO
          </Link>

          <button
            type="button"
            className="public-topbar-link public-topbar-verifier"
            onClick={() => {
              cerrarMenu();
              onOpenVerifier?.();
            }}
          >
            ✔ VERIFICADOR
          </button>
        </nav>
      </div>
    </header>
  );
}