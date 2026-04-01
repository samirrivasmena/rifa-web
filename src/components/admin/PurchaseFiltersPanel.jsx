"use client";

export default function PurchaseFiltersPanel({
  filtros,
  setFiltros,
  metodosPago = [],
}) {
  const handleChange = (field, value) => {
    setFiltros((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      busqueda: "",
      estado: "",
      metodoPago: "",
      fechaDesde: "",
      fechaHasta: "",
      minTickets: "",
      maxTickets: "",
      minMonto: "",
      maxMonto: "",
      conComprobante: "",
    });
  };

  const hayFiltros = Object.values(filtros).some(
    (value) => String(value).trim() !== ""
  );

  return (
    <div className="adminpro-filters-panel">
      <div className="adminpro-filters-grid">
        <div className="adminpro-filter-item full">
          <label>Búsqueda libre</label>
          <input
            type="text"
            className="adminpro-input"
            placeholder="Nombre, email, teléfono, referencia o ID..."
            value={filtros.busqueda}
            onChange={(e) => handleChange("busqueda", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Estado de pago</label>
          <select
            className="adminpro-input"
            value={filtros.estado}
            onChange={(e) => handleChange("estado", e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        <div className="adminpro-filter-item">
          <label>Método de pago</label>
          <select
            className="adminpro-input"
            value={filtros.metodoPago}
            onChange={(e) => handleChange("metodoPago", e.target.value)}
          >
            <option value="">Todos los métodos</option>
            {metodosPago.map((metodo) => (
              <option key={metodo} value={metodo}>
                {metodo}
              </option>
            ))}
          </select>
        </div>

        <div className="adminpro-filter-item">
          <label>Fecha desde</label>
          <input
            type="date"
            className="adminpro-input"
            value={filtros.fechaDesde}
            onChange={(e) => handleChange("fechaDesde", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Fecha hasta</label>
          <input
            type="date"
            className="adminpro-input"
            value={filtros.fechaHasta}
            onChange={(e) => handleChange("fechaHasta", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Tickets mínimo</label>
          <input
            type="number"
            min="0"
            className="adminpro-input"
            placeholder="Ej: 1"
            value={filtros.minTickets}
            onChange={(e) => handleChange("minTickets", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Tickets máximo</label>
          <input
            type="number"
            min="0"
            className="adminpro-input"
            placeholder="Ej: 100"
            value={filtros.maxTickets}
            onChange={(e) => handleChange("maxTickets", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Monto mínimo</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="adminpro-input"
            placeholder="0.00"
            value={filtros.minMonto}
            onChange={(e) => handleChange("minMonto", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Monto máximo</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="adminpro-input"
            placeholder="0.00"
            value={filtros.maxMonto}
            onChange={(e) => handleChange("maxMonto", e.target.value)}
          />
        </div>

        <div className="adminpro-filter-item">
          <label>Comprobante</label>
          <select
            className="adminpro-input"
            value={filtros.conComprobante}
            onChange={(e) => handleChange("conComprobante", e.target.value)}
          >
            <option value="">Todos</option>
            <option value="si">Con comprobante</option>
            <option value="no">Sin comprobante</option>
          </select>
        </div>
      </div>

      {hayFiltros && (
        <div className="adminpro-filters-actions">
          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={limpiarFiltros}
          >
            ✕ Limpiar todos los filtros
          </button>
        </div>
      )}
    </div>
  );
}