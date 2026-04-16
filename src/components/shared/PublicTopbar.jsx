"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function mapHashToActive(hash) {
  const clean = String(hash || "").replace("#", "").toLowerCase();

  if (!clean || clean === "inicio") return "inicio";
  if (clean.includes("eventos-disponibles")) return "eventos";
  if (clean.includes("resultados-oficiales")) return "resultados";
  if (clean.includes("pagos")) return "pagos";
  if (clean.includes("contacto")) return "contacto";

  return "inicio";
}

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
  const pathname = usePathname();

  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentActive, setCurrentActive] = useState(active);

  const navRef = useRef(null);

  const cerrarMenu = () => {
    setMobileMenuOpen(false);
    setHiddenOnMobile(false);

    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  };

  const marcarActivo = (id) => {
    setCurrentActive(id);
    cerrarMenu();
  };

  useEffect(() => {
    setCurrentActive(active);
  }, [active]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentActive(mapHashToActive(window.location.hash));
      cerrarMenu();
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    // Cerrar menú al cambiar de ruta
    cerrarMenu();
  }, [pathname]);

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

      // Si el menú está abierto, no ocultar el topbar
      if (mobileMenuOpen) {
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
      if (e.key === "Escape") cerrarMenu();
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
        cerrarMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  return (
    <header className={`public-topbar ${hiddenOnMobile ? "mobile-hidden" : ""}`}>
      <div className="public-topbar-inner">
        <Link
          href={logoHref}
          className="public-topbar-logo-link"
          onClick={() => marcarActivo("inicio")}
        >
          <Image
            src="/logo.png"
            alt="Logo Rifas LSD"
            width={58}
            height={58}
            priority
            className="public-topbar-logo"
          />
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
            className={`public-topbar-link ${currentActive === "inicio" ? "active" : ""}`}
            onClick={() => marcarActivo("inicio")}
            aria-current={currentActive === "inicio" ? "page" : undefined}
          >
            INICIO
          </Link>

          <Link
            href={eventosHref}
            className={`public-topbar-link ${currentActive === "eventos" ? "active" : ""}`}
            onClick={() => marcarActivo("eventos")}
            aria-current={currentActive === "eventos" ? "page" : undefined}
          >
            EVENTOS
          </Link>

          <Link
            href={resultadosHref}
            className={`public-topbar-link ${currentActive === "resultados" ? "active" : ""}`}
            onClick={() => marcarActivo("resultados")}
            aria-current={currentActive === "resultados" ? "page" : undefined}
          >
            RESULTADOS
          </Link>

          <Link
            href={pagosHref}
            className={`public-topbar-link ${currentActive === "pagos" ? "active" : ""}`}
            onClick={() => marcarActivo("pagos")}
            aria-current={currentActive === "pagos" ? "page" : undefined}
          >
            CUENTAS DE PAGO
          </Link>

          <Link
            href={contactoHref}
            className={`public-topbar-link ${currentActive === "contacto" ? "active" : ""}`}
            onClick={() => marcarActivo("contacto")}
            aria-current={currentActive === "contacto" ? "page" : undefined}
          >
            CONTACTO
          </Link>

          <button
            type="button"
            className={`public-topbar-link public-topbar-verifier ${
              currentActive === "verificador" ? "active" : ""
            }`}
            onClick={() => {
              marcarActivo("verificador");
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