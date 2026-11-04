
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useSiteConfig } from "@/hooks/useSiteConfig";
import SiteLogo from "@/components/shared/SiteLogo";

function mapHashToActive(hash) {
  const clean = String(hash || "")
    .replace("#", "")
    .toLowerCase();

  if (!clean || clean === "inicio") return "inicio";
  if (clean.includes("eventos-disponibles")) return "eventos";
  if (clean.includes("resultados-oficiales")) return "resultados";
  if (clean.includes("historial-ganadores")) return "ganadores";
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
  ganadoresHref = "/principal#historial-ganadores",
  pagosHref = "/principal#pagos",
  contactoHref = "/principal#contacto",
}) {
  const pathname = usePathname();
  const { config } = useSiteConfig();

  const logoUrl = config?.logo_url || "";
  const nombreMarca = config?.nombre_marca || "Sorteos LSD";

  const menuLabels = {
    inicio: config?.menu_inicio || "INICIO",
    eventos: config?.menu_eventos || "EVENTOS",
    resultados: config?.menu_resultados || "RESULTADOS",
    ganadores: config?.menu_ganadores || "GANADORES",
    pagos: config?.menu_pagos || "CUENTAS DE PAGO",
    contacto: config?.menu_contacto || "CONTACTO",
    verificador: config?.menu_verificador || "✔ VERIFICADOR",
  };

  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentActive, setCurrentActive] = useState(active);

  const navRef = useRef(null);

  const cerrarMenu = () => {
    setMobileMenuOpen(false);
    setHiddenOnMobile(false);
  };

  const marcarActivo = (id) => {
    setCurrentActive(id);
    cerrarMenu();
  };

  // Navegación rápida dentro de la página principal.
  // Conserva los enlaces normales en otras páginas.
  const navegarSeccion = (event, href, id) => {
    if (pathname !== "/principal") {
      marcarActivo(id);
      return;
    }

    const hash = href.split("#")[1];

    if (!hash) {
      marcarActivo(id);
      return;
    }

    const seccion = document.getElementById(hash);

    if (!seccion) {
      marcarActivo(id);
      return;
    }

    event.preventDefault();
    marcarActivo(id);

    const reducirMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const offset = window.innerWidth <= 768 ? 84 : 108;

    const posicion =
      seccion.getBoundingClientRect().top +
      window.scrollY -
      (hash === "inicio" ? 0 : offset);

    window.scrollTo({
      top: Math.max(0, posicion),
      behavior: reducirMovimiento ? "instant" : "smooth",
    });

    const nuevoHash = `#${hash}`;

    if (window.location.hash !== nuevoHash) {
      window.history.pushState(null, "", nuevoHash);
    }
  };

  const irAlInicio = (event) => {
    if (pathname !== "/principal") {
      marcarActivo("inicio");
      return;
    }

    event.preventDefault();
    marcarActivo("inicio");

    const reducirMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: reducirMovimiento ? "instant" : "smooth",
    });

    if (window.location.hash !== "#inicio") {
      window.history.pushState(null, "", "#inicio");
    }
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
    window.addEventListener("popstate", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  useEffect(() => {
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

      if (mobileMenuOpen) {
        setHiddenOnMobile(false);
        lastScrollY = currentScrollY;
        return;
      }

      if (currentScrollY <= 20) {
        setHiddenOnMobile(false);
      } else if (
        currentScrollY > lastScrollY &&
        currentScrollY > 80
      ) {
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

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") cerrarMenu();
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
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
      if (!mobileMenuOpen || !navRef.current) return;

      const menuButton = document.querySelector(
        ".public-topbar-menu-btn"
      );

      const clickedInsideNav = navRef.current.contains(
        event.target
      );

      const clickedMenuButton = menuButton?.contains(
        event.target
      );

      if (!clickedInsideNav && !clickedMenuButton) {
        cerrarMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
      document.removeEventListener(
        "touchstart",
        handleClickOutside
      );
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={`public-topbar ${
        hiddenOnMobile ? "mobile-hidden" : ""
      }`}
    >
      <div className="public-topbar-inner">
        <Link
          href={logoHref}
          prefetch={true}
          className="public-topbar-logo-link"
          onClick={irAlInicio}
          aria-label="Ir al inicio"
        >
          <SiteLogo
            src={logoUrl}
            alt={`Logo ${nombreMarca}`}
            fallbackText={nombreMarca}
            size="nav"
          />
        </Link>

        <button
          type="button"
          className={`public-topbar-menu-btn ${
            mobileMenuOpen ? "open" : ""
          }`}
          onClick={() =>
            setMobileMenuOpen((prev) => !prev)
          }
          aria-label={
            mobileMenuOpen ? "Cerrar menú" : "Abrir menú"
          }
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
          className={`public-topbar-nav ${
            mobileMenuOpen ? "open" : ""
          }`}
        >
          <TopbarLink
            href={inicioHref}
            id="inicio"
            label={menuLabels.inicio}
            currentActive={currentActive}
            onNavigate={navegarSeccion}
          />

          <TopbarLink
            href={eventosHref}
            id="eventos"
            label={menuLabels.eventos}
            currentActive={currentActive}
            onNavigate={navegarSeccion}
          />

          <TopbarLink
            href={resultadosHref}
            id="resultados"
            label={menuLabels.resultados}
            currentActive={currentActive}
            onNavigate={navegarSeccion}
          />

          <TopbarLink
            href={ganadoresHref}
            id="ganadores"
            label={menuLabels.ganadores}
            currentActive={currentActive}
            onNavigate={navegarSeccion}
          />

          <TopbarLink
            href={pagosHref}
            id="pagos"
            label={menuLabels.pagos}
            currentActive={currentActive}
            onNavigate={navegarSeccion}
          />

          <TopbarLink
            href={contactoHref}
            id="contacto"
            label={menuLabels.contacto}
            currentActive={currentActive}
            onNavigate={navegarSeccion}
          />

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
            {menuLabels.verificador}
          </button>
        </nav>
      </div>
    </header>
  );
}

function TopbarLink({
  href,
  id,
  label,
  currentActive,
  onNavigate,
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={`public-topbar-link ${
        currentActive === id ? "active" : ""
      }`}
      onClick={(event) => onNavigate(event, href, id)}
      aria-current={
        currentActive === id ? "page" : undefined
      }
    >
      {label}
    </Link>
  );
}
