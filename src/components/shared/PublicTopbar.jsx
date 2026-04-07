"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function PublicTopbar({
  active = "eventos",
  onOpenVerifier,
  logoHref = "/principal",
  inicioHref = "/principal#inicio",
  eventosHref = "/principal#eventos-disponibles",
  resultadosHref = "/principal#resultados-oficiales",
  pagosHref = "/principal#pagos",
  contactoHref = "/principal#contacto",
}) {
  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);

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

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (mobileMenuOpen && window.innerWidth <= 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!mobileMenuOpen) return;
      if (!navRef.current) return;

      const menuButton = document.querySelector(".public-topbar-menu-btn");

      const clickedInsideNav = navRef.current.contains(event.target);
      const clickedMenuButton = menuButton?.contains(event.target);

      if (!clickedInsideNav && !clickedMenuButton) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [mobileMenuOpen]);

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
          aria-controls="public-topbar-nav"
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="public-topbar-nav"
          ref={navRef}
          className={`public-topbar-nav ${mobileMenuOpen ? "open" : ""}`}
        >
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
            href={resultadosHref}
            className={`public-topbar-link ${active === "resultados" ? "active" : ""}`}
            onClick={cerrarMenu}
          >
            RESULTADOS
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