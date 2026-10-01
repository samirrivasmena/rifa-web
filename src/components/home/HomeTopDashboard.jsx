"use client";

import { useSiteConfig } from "@/hooks/useSiteConfig";
import SiteLogo from "@/components/shared/SiteLogo";

export default function HomeTopDashboard({ onOpenVerifier }) {
  const { config } = useSiteConfig();

  const logoUrl = config?.logo_url || "";
  const nombreMarca = config?.nombre_marca || "RIFAS LSD";

  return (
    <header className="home-top-dashboard">
      <div className="home-top-dashboard-inner">
        <a
          href="/principal"
          target="_blank"
          rel="noopener noreferrer"
          className="home-top-logo-link"
          title="Abrir página principal"
        >
          <SiteLogo
            src={logoUrl}
            alt={`Logo ${nombreMarca}`}
            fallbackText={nombreMarca}
            className="home-top-logo"
          />
        </a>

        <nav className="home-top-dashboard-nav">
          <a href="#inicio" className="home-top-link">
            INICIO
          </a>

          <a href="#eventos" className="home-top-link active">
            EVENTOS
          </a>

          <a href="#pagos" className="home-top-link">
            CUENTAS DE PAGO
          </a>

          <a href="#contacto" className="home-top-link">
            CONTACTO
          </a>

          <button
            type="button"
            className="home-top-link verifier"
            onClick={onOpenVerifier}
          >
            ✔ VERIFICADOR
          </button>
        </nav>
      </div>
    </header>
  );
}