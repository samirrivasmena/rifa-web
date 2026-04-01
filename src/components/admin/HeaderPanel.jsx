"use client";

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-header-icon">
      <path
        d="M20 11a8 8 0 1 1-2.34-5.66L20 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4v4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HeaderPanel({
  rifas = [],
  rifaSeleccionadaId,
  setRifaSeleccionadaId,
  onRecargar,
  dataLoading,
}) {
  const rifaSeleccionada =
    rifas.find((rifa) => String(rifa.id) === String(rifaSeleccionadaId)) || null;

  const estado = String(rifaSeleccionada?.estado || "").toLowerCase();

  const estadoLabel = {
    activa: "ACTIVA",
    cerrada: "CERRADA",
    finalizada: "FINALIZADA",
    borrador: "BORRADOR",
    inactiva: "INACTIVA",
  }[estado] || "SIN RIFA";

  const estadoClase = {
    activa: "activa",
    cerrada: "cerrada",
    finalizada: "finalizada",
    borrador: "borrador",
    inactiva: "inactiva",
  }[estado] || "default";

  return (
    <section className="adminpro-header adminpro-header-premium">
      <div className="adminpro-header-left">
        <div className="adminpro-header-select-wrap">
          <select
            value={rifaSeleccionadaId}
            onChange={(e) => setRifaSeleccionadaId(e.target.value)}
            className="adminpro-header-select"
          >
            <option value="">Selecciona una rifa</option>
            {rifas.map((rifa) => (
              <option key={rifa.id} value={rifa.id}>
                {rifa.nombre} - {rifa.estado}
              </option>
            ))}
          </select>
        </div>

        <div className={`adminpro-header-status ${estadoClase}`}>
          <span className="adminpro-header-status-dot" />
          <span>{estadoLabel}</span>
        </div>
      </div>

      <div className="adminpro-header-right">
        <button
          className="adminpro-header-refresh"
          onClick={onRecargar}
          type="button"
          disabled={dataLoading}
        >
          <IconRefresh />
          {dataLoading ? "Actualizando..." : "Actualizar"}
        </button>

        <div className="adminpro-header-panelinfo">
          <strong>Panel de Control</strong>
          <small>v24.3.1 • LIVE</small>
        </div>
      </div>
    </section>
  );
}