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
  return (
    <div className="adminpro-page-stack" ref={ganadorRef}>
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>Validar número por rifa</h2>
            <p>Consulta si un número fue vendido y regístralo como ganador oficial</p>
          </div>
        </div>

        <div className="adminpro-search-row">
          <div className="adminpro-search-input">
            <input
              type="text"
              placeholder={padLength === 3 ? "000 - 999" : "0000 - 9999"}
              value={numeroGanador}
              maxLength={padLength}
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
            onClick={buscarGanador}
            type="button"
            disabled={guardandoGanador || quitandoGanador}
          >
            Buscar
          </button>
        </div>

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