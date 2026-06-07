"use client";

import WinnerCard from "../WinnerCard";

export default function AdminGanadorSection({
  ganadorRef,
  padLength,
  numeroGanador,
  setNumeroGanador,
  setResultadoGanador,
  setMensajeBusqueda,
  setEsNumeroGanador,
  buscarGanador,
  resultadoGanador,
  esNumeroGanador,
  mensajeBusqueda,
  guardarGanadorOficial,
  quitarGanadorOficial,
  guardandoGanador,
  quitandoGanador,
  numeroGanadorOficial,
  formatearFecha,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    buscarGanador();
  };

  return (
    <div className="adminpro-page-stack" ref={ganadorRef}>
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>Validar número por rifa</h2>
            <p>
              Consulta si un número fue vendido y luego regístralo como ganador
              oficial
            </p>
          </div>
        </div>

        {numeroGanadorOficial && (
          <div className="adminpro-winner-current-note">
            <strong>Ganador oficial actual:</strong> {numeroGanadorOficial}
          </div>
        )}

        <form className="adminpro-search-row" onSubmit={handleSubmit}>
          <div className="adminpro-search-input">
            <input
              type="text"
              placeholder={padLength === 3 ? "000 - 999" : "0000 - 9999"}
              value={numeroGanador}
              maxLength={padLength}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, padLength);
                setNumeroGanador(value);
                setResultadoGanador(null);
                setMensajeBusqueda("");
                setEsNumeroGanador(false);
              }}
              disabled={guardandoGanador || quitandoGanador}
            />
          </div>

          <button
            className="adminpro-primary-btn"
            type="submit"
            disabled={guardandoGanador || quitandoGanador || !numeroGanador}
          >
            Buscar
          </button>
        </form>

        <WinnerCard
          resultado={resultadoGanador}
          esGanador={esNumeroGanador}
          mensaje={mensajeBusqueda}
          onGuardar={guardarGanadorOficial}
          onQuitar={quitarGanadorOficial}
          guardando={guardandoGanador}
          quitando={quitandoGanador}
          padLength={padLength}
          formatearFecha={formatearFecha}
          numeroGanadorOficial={numeroGanadorOficial}
        />
      </div>
    </div>
  );
}