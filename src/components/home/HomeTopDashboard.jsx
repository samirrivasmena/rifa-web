"use client";

export default function HomeTopDashboard({ onOpenVerifier }) {
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
          <img src="/logo.png" alt="Logo" className="home-top-logo" />
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