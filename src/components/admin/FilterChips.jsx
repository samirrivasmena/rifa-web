"use client";

export default function FilterChips({ filtros, onRemove }) {
  const chips = [];

  if (filtros.busqueda) {
    chips.push({
      key: "busqueda",
      label: `Búsqueda: "${filtros.busqueda}"`,
    });
  }

  if (filtros.estado) {
    chips.push({
      key: "estado",
      label: `Estado: ${filtros.estado}`,
    });
  }

  if (filtros.metodoPago) {
    chips.push({
      key: "metodoPago",
      label: `Método: ${filtros.metodoPago}`,
    });
  }

  if (filtros.fechaDesde) {
    chips.push({
      key: "fechaDesde",
      label: `Desde: ${filtros.fechaDesde}`,
    });
  }

  if (filtros.fechaHasta) {
    chips.push({
      key: "fechaHasta",
      label: `Hasta: ${filtros.fechaHasta}`,
    });
  }

  if (filtros.minTickets) {
    chips.push({
      key: "minTickets",
      label: `Tickets ≥ ${filtros.minTickets}`,
    });
  }

  if (filtros.maxTickets) {
    chips.push({
      key: "maxTickets",
      label: `Tickets ≤ ${filtros.maxTickets}`,
    });
  }

  if (filtros.minMonto) {
    chips.push({
      key: "minMonto",
      label: `Monto ≥ $${filtros.minMonto}`,
    });
  }

  if (filtros.maxMonto) {
    chips.push({
      key: "maxMonto",
      label: `Monto ≤ $${filtros.maxMonto}`,
    });
  }

  if (filtros.conComprobante) {
    chips.push({
      key: "conComprobante",
      label: filtros.conComprobante === "si" ? "Con comprobante" : "Sin comprobante",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="adminpro-filter-chips">
      {chips.map((chip) => (
        <span key={chip.key} className="adminpro-chip">
          {chip.label}
          <button
            type="button"
            className="adminpro-chip-remove"
            onClick={() => onRemove(chip.key)}
            title="Eliminar filtro"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}