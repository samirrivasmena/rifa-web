"use client";

import CompactDashboardSummary from "../CompactDashboardSummary";
import WinnerCard from "../WinnerCard";

export default function AdminGanadorSection({
  ganadorRef,
  rifaSeleccionada,
  dashboardCompactSummary,
  irADashboardTotal,
  irAPendientes,
  irAAprobadas,
  irARechazadas,
  irAMapaTickets,
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
  guardandoGanador,
  formatearFecha,
}) {
  return (
    <div className="adminpro-page-stack" ref={ganadorRef}>
      <CompactDashboardSummary
        rifaSeleccionada={rifaSeleccionada}
        resumen={dashboardCompactSummary}
        onIrDashboard={irADashboardTotal}
        onIrPendientes={irAPendientes}
        onIrAprobadas={irAAprobadas}
        onIrRechazadas={irARechazadas}
        onIrMapaTickets={irAMapaTickets}
      />

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
              placeholder={padLength === 3 ? "001 - 999" : "0001 - 9999"}
              value={numeroGanador}
              maxLength={padLength}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, padLength);
                setNumeroGanador(value);
                setResultadoGanador(null);
                setMensajeBusqueda("");
                setEsNumeroGanador(false);
              }}
            />
          </div>

          <button className="adminpro-primary-btn" onClick={buscarGanador} type="button">
            Buscar
          </button>
        </div>

        <WinnerCard
          resultado={resultadoGanador}
          esGanador={esNumeroGanador}
          mensaje={mensajeBusqueda}
          onGuardar={guardarGanadorOficial}
          guardando={guardandoGanador}
          padLength={padLength}
          formatearFecha={formatearFecha}
        />
      </div>
    </div>
  );
}