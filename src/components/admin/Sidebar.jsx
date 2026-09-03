"use client";

import { useEffect, useState } from "react";
import SiteLogo from "@/components/shared/SiteLogo";

/* =========================================================
   ICONOS
   ========================================================= */

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconNumero() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 8h8M8 12h5M8 16h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRifas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M3 9.5A2.5 2.5 0 0 0 5.5 7H18.5A2.5 2.5 0 0 0 21 9.5v5A2.5 2.5 0 0 0 18.5 17H5.5A2.5 2.5 0 0 0 3 14.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5v7M15 8.5v7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGanador() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M8 4h8v3a4 4 0 0 1-8 0V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 6H5a2 2 0 0 0 2 2h1M16 6h3a2 2 0 0 1-2 2h-1M12 11v4M9 20h6M10 15h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGanadores() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M12 3l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6 21h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRanking() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M4 19V10M12 19V5M20 19v-8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="4" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" />
      <circle cx="20" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconCompras() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M6 7h15l-1.5 7.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L5 4H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.5" fill="currentColor" />
      <circle cx="18" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M15 16l4-4-4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconConfig() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <path
        d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 0 1 7.03 4.24l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   SIDEBAR
   ========================================================= */

export default function Sidebar({
  activa,
  onNavigate,
  onLogout,
  adminEmail,
  logoUrl = "/logo.png",
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* =======================================================
     RESPONSIVE
     ======================================================= */

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 980) {
        setMobileMenuOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  /* =======================================================
     BLOQUEAR SCROLL EN MÓVIL
     ======================================================= */

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (mobileMenuOpen && window.innerWidth <= 980) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  /* =======================================================
     ITEMS DEL MENÚ
     ======================================================= */

  const items = [
    { id: "dashboard", icon: <IconDashboard />, label: "Dashboard" },
    { id: "numero", icon: <IconNumero />, label: "Números" },
    { id: "rifas", icon: <IconRifas />, label: "Crear Rifas" },
    { id: "compras", icon: <IconCompras />, label: "Gestión de Compras" },
    { id: "ganador", icon: <IconGanador />, label: "Validar Ganador" },
    { id: "ganadores", icon: <IconGanadores />, label: "Ganadores" },
    { id: "ranking", icon: <IconRanking />, label: "Ranking" },
    { id: "configuracion", icon: <IconConfig />, label: "Configuración" },
  ];

  /* =======================================================
     USUARIO
     ======================================================= */

  const inicial = (adminEmail || "A").charAt(0).toUpperCase();

  const nombreVisible =
    adminEmail?.split("@")[0]?.replace(/[._-]/g, " ") || "Administrador";

  /* =======================================================
     NAVEGACIÓN
     ======================================================= */

  const handleNavigate = (id) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  /* =======================================================
     BRAND
     ======================================================= */

  const Brand = ({ mobile = false }) => (
    <div className={mobile ? "adminpro-mobile-topbar-brand" : "adminpro-brand"}>
      <SiteLogo
        src={logoUrl}
        alt="RIFAS LSD"
        fallbackText={inicial}
        size="sidebar"
      />

      <div className={mobile ? "adminpro-mobile-brand-text" : "adminpro-brand-text"}>
        <strong>ADMIN PANEL</strong>
      </div>
    </div>
  );

  /* =======================================================
     BOTONES DEL MENÚ
     ======================================================= */

  const NavButtons = ({ mobile = false }) => (
    <nav
      className={mobile ? "adminpro-mobile-nav" : "adminpro-nav"}
      aria-label="Navegación administrativa"
    >
      {items.map((item) => {
        const isActive = activa === item.id;

        return (
          <button
            key={item.id}
            className={`adminpro-nav-btn ${isActive ? "active" : ""}`}
            onClick={() => handleNavigate(item.id)}
            type="button"
            aria-current={isActive ? "page" : undefined}
          >
            <span className="adminpro-nav-icon-wrap">{item.icon}</span>
            <span className="adminpro-nav-label">{item.label}</span>
            <span className="adminpro-nav-dot" />
          </button>
        );
      })}
    </nav>
  );

  /* =======================================================
     TARJETA DEL ADMINISTRADOR
     ======================================================= */

  const UserCard = () => (
    <div className="adminpro-user-card adminpro-user-card-bottom">
      <div className="adminpro-avatar">{inicial}</div>

      <div className="adminpro-user-meta">
        <strong style={{ textTransform: "capitalize" }}>{nombreVisible}</strong>
        <small>Administrador Principal</small>
      </div>

      <button
        className="adminpro-user-logout-icon"
        onClick={onLogout}
        type="button"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <IconLogout />
      </button>
    </div>
  );

  /* =======================================================
     RETURN
     ======================================================= */

  return (
    <>
      {/* TOPBAR MÓVIL */}
      <div className="adminpro-mobile-topbar">
        <Brand mobile />

        <button
          type="button"
          className={`adminpro-mobile-menu-btn ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Cerrar menú admin" : "Abrir menú admin"}
          aria-expanded={mobileMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* MENÚ MÓVIL */}
      {mobileMenuOpen && (
        <div
          className="adminpro-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="adminpro-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adminpro-mobile-drawer-head">
              <Brand mobile />

              <button
                type="button"
                className="adminpro-mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>

            <NavButtons mobile />
            <UserCard />
          </div>
        </div>
      )}

      {/* SIDEBAR PC */}
      <aside className="adminpro-sidebar">
        <div className="adminpro-sidebar-inner">
          <Brand />

          <div className="adminpro-sidebar-scroll">
            <NavButtons />
          </div>

          <UserCard />
        </div>
      </aside>
    </>
  );
}