"use client";

import { useEffect, useState } from "react";

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-nav-icon">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
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
      <path d="M9 8.5v7M15 8.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function IconBrand() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-brand-svg">
      <rect x="4" y="5" width="16" height="14" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 9h8M8 15h8M9 5v14M15 5v14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Sidebar({ activa, onNavigate, onLogout, adminEmail }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const items = [
    { id: "dashboard", icon: <IconDashboard />, label: "Dashboard" },
    { id: "numero", icon: <IconNumero />, label: "Números" },
    { id: "rifas", icon: <IconRifas />, label: "Crear Rifas" },
    { id: "compras", icon: <IconCompras />, label: "Gestión de Compras" },
    { id: "ganador", icon: <IconGanador />, label: "Validar Ganador" },
    { id: "ranking", icon: <IconRanking />, label: "Ranking" },
  ];

  const inicial = (adminEmail || "A").charAt(0).toUpperCase();
  const nombreVisible =
    adminEmail?.split("@")[0]?.replace(/[._-]/g, " ") || "Administrador";

  const handleNavigate = (id) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div className="adminpro-mobile-topbar">
        <div className="adminpro-mobile-topbar-brand">
          <div className="adminpro-brand-icon">
            <IconBrand />
          </div>
          <div>
            <strong>RIFAPRO</strong>
            <small>ADMIN PANEL</small>
          </div>
        </div>

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
              <div className="adminpro-mobile-topbar-brand">
                <div className="adminpro-brand-icon">
                  <IconBrand />
                </div>
                <div>
                  <strong>RIFAPRO</strong>
                  <small>ADMIN PANEL</small>
                </div>
              </div>

              <button
                type="button"
                className="adminpro-mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav className="adminpro-mobile-nav">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`adminpro-nav-btn ${activa === item.id ? "active" : ""}`}
                  onClick={() => handleNavigate(item.id)}
                  type="button"
                >
                  <span className="adminpro-nav-icon-wrap">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="adminpro-nav-dot" />
                </button>
              ))}
            </nav>

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
              >
                <IconLogout />
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="adminpro-sidebar">
        <div className="adminpro-brand">
          <div className="adminpro-brand-icon">
            <IconBrand />
          </div>

          <div>
            <h2>RIFAPRO</h2>
            <p>ADMIN PANEL</p>
          </div>
        </div>

        <nav className="adminpro-nav">
          {items.map((item) => (
            <button
              key={item.id}
              className={`adminpro-nav-btn ${activa === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <span className="adminpro-nav-icon-wrap">{item.icon}</span>
              <span>{item.label}</span>
              <span className="adminpro-nav-dot" />
            </button>
          ))}
        </nav>

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
          >
            <IconLogout />
          </button>
        </div>
      </aside>
    </>
  );
}