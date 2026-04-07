"use client";

export default function CompactDashboardSummary({
  rifaSeleccionada,
  resumen,
  onIrDashboard,
  onIrPendientes,
  onIrAprobadas,
  onIrRechazadas,
  onIrMapaTickets,
}) {
  if (!rifaSeleccionada) return null;

  return (
    <div className="adminpro-card adminpro-compact-summary-card">
      <div className="adminpro-compact-summary-head">
        <div>
          <h2>Resumen del dashboard</h2>
          <p>Haz clic en una tarjeta para ver el detalle filtrado</p>
        </div>
      </div>

      <div className="adminpro-compact-summary-grid">
        <button
          type="button"
          className="adminpro-compact-kpi purple"
          onClick={onIrDashboard}
        >
          <span>Total compras</span>
          <strong>{resumen.totalCompras}</strong>
          <small>Registros de esta rifa</small>
        </button>

        <button
          type="button"
          className="adminpro-compact-kpi amber"
          onClick={onIrPendientes}
        >
          <span>Compras pendientes</span>
          <strong>{resumen.comprasPendientesCount}</strong>
          <small>Esperando revisión</small>
        </button>

        <button
          type="button"
          className="adminpro-compact-kpi green"
          onClick={onIrAprobadas}
        >
          <span>Compras aprobadas</span>
          <strong>{resumen.comprasAprobadas}</strong>
          <small>Pagos validados</small>
        </button>

        <button
          type="button"
          className="adminpro-compact-kpi red"
          onClick={onIrRechazadas}
        >
          <span>Compras rechazadas</span>
          <strong>{resumen.comprasRechazadas}</strong>
          <small>Pagos rechazados</small>
        </button>

        <button
          type="button"
          className="adminpro-compact-kpi blue"
          onClick={onIrMapaTickets}
        >
          <span>Tickets vendidos</span>
          <strong>{resumen.ticketsVendidos}</strong>
          <small>Números ya asignados</small>
        </button>
      </div>
    </div>
  );
}