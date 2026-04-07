"use client";

export default function OfficialResultsSection({
  title = "RESULTADOS OFICIALES",
  subtitle = "Consulta aquí los resultados oficiales",
  description = "El número ganador de nuestras rifas se validará con base en los resultados oficiales publicados por Triple Táchira / Super Gana. Puedes consultarlos directamente en su plataforma oficial.",
  className = "",
}) {
  return (
    <section id="resultados-oficiales" className={`official-results-section ${className}`}>
      <div className="official-results-head">
        <h2>{title}</h2>
      </div>

      <div className="official-results-box">
        <div className="official-results-copy">
          <p className="official-results-kicker">TRANSPARENCIA Y CONFIANZA</p>
          <h3>{subtitle}</h3>
          <p>{description}</p>

          <a
            href="https://supergana.com.ve/resultados.php"
            target="_blank"
            rel="noreferrer"
            className="principal-red-btn"
          >
            VER RESULTADOS OFICIALES
          </a>
        </div>

        <div className="official-results-logos">
          <div className="official-results-logo-card">
            <img
              src="/resultados/triple-tachira.png"
              alt="Triple Táchira"
              className="official-results-logo"
            />
          </div>

          <div className="official-results-logo-card">
            <img
              src="/resultados/super-gana.png"
              alt="Super Gana"
              className="official-results-logo"
            />
          </div>
        </div>
      </div>
    </section>
  );
}