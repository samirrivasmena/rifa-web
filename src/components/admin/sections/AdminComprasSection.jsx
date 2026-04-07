"use client";

import CompactDashboardSummary from "../CompactDashboardSummary";
import PurchaseFiltersPanel from "../PurchaseFiltersPanel";
import FilterChips from "../FilterChips";
import PurchaseCard from "../PurchaseCard";

export default function AdminComprasSection({
  comprasSectionRef,
  rifaSeleccionada,
  dashboardCompactSummary,
  irADashboardTotal,
  irAPendientes,
  irAAprobadas,
  irARechazadas,
  irAMapaTickets,
  cantidadFiltrosActivos,
  exportarComprasCSV,
  filtrosCompras,
  setFiltrosCompras,
  metodosPagoDisponibles,
  eliminarFiltroIndividual,
  ordenCompras,
  setOrdenCompras,
  comprasVisibles,
  comprasFiltradasYOrdenadas,
  resumenPaginacionCompras,
  comprasPaginadas,
  ticketsPorCompra,
  aprobarCompra,
  abrirAprobacionManual,
  rechazarCompra,
  eliminarCompra,
  loadingAprobacion,
  loadingRechazo,
  loadingEliminacion,
  formatearFecha,
  itemsPorPagina,
  setItemsPorPagina,
  setPaginaCompras,
  paginaCompras,
  totalPaginasCompras,
}) {
  return (
    <div className="adminpro-page-stack" ref={comprasSectionRef}>
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
            <h2>Compras de la rifa seleccionada</h2>
            <p>Filtra, ordena y exporta compras por múltiples criterios</p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            {cantidadFiltrosActivos > 0 && (
              <div className="adminpro-badge-box">
                🔍 {cantidadFiltrosActivos} filtro{cantidadFiltrosActivos !== 1 ? "s" : ""} activo
                {cantidadFiltrosActivos !== 1 ? "s" : ""}
              </div>
            )}

            <button
              type="button"
              className="adminpro-soft-btn blue"
              onClick={exportarComprasCSV}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <PurchaseFiltersPanel
          filtros={filtrosCompras}
          setFiltros={setFiltrosCompras}
          metodosPago={metodosPagoDisponibles}
        />

        <FilterChips
          filtros={filtrosCompras}
          onRemove={eliminarFiltroIndividual}
        />

        <div className="adminpro-sort-row">
          <div className="adminpro-sort-box">
            <label>Ordenar por</label>
            <select
              className="adminpro-input"
              value={ordenCompras}
              onChange={(e) => setOrdenCompras(e.target.value)}
            >
              <option value="fecha_desc">Más recientes</option>
              <option value="fecha_asc">Más antiguas</option>
              <option value="monto_desc">Mayor monto</option>
              <option value="monto_asc">Menor monto</option>
              <option value="tickets_desc">Más tickets</option>
              <option value="tickets_asc">Menos tickets</option>
              <option value="nombre_asc">Nombre A-Z</option>
              <option value="nombre_desc">Nombre Z-A</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          {comprasVisibles.length === 0 ? (
            <div className="adminpro-empty-box">
              <p>📋 No hay compras registradas para esta rifa todavía.</p>
            </div>
          ) : comprasFiltradasYOrdenadas.length === 0 ? (
            <div className="adminpro-empty-box">
              <p>🔍 No se encontraron compras que coincidan con los filtros aplicados.</p>
              <p style={{ marginTop: "8px", fontSize: "14px" }}>
                Intenta ajustar los filtros o cambiar el orden.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  marginBottom: "14px",
                  color: "#64748b",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  Mostrando {resumenPaginacionCompras.desde} a {resumenPaginacionCompras.hasta} de{" "}
                  {resumenPaginacionCompras.total} compra
                  {resumenPaginacionCompras.total !== 1 ? "s" : ""}
                </span>

                <span>
                  Orden actual:{" "}
                  {{
                    fecha_desc: "Más recientes",
                    fecha_asc: "Más antiguas",
                    monto_desc: "Mayor monto",
                    monto_asc: "Menor monto",
                    tickets_desc: "Más tickets",
                    tickets_asc: "Menos tickets",
                    nombre_asc: "Nombre A-Z",
                    nombre_desc: "Nombre Z-A",
                  }[ordenCompras]}
                </span>
              </div>

              <div className="adminpro-compras-grid">
                {comprasPaginadas.map((compra) => (
                  <PurchaseCard
                    key={compra.id}
                    compra={compra}
                    ticketsAsignados={ticketsPorCompra[String(compra.id)] || []}
                    onAprobar={aprobarCompra}
                    onAprobarManual={abrirAprobacionManual}
                    onRechazar={rechazarCompra}
                    onEliminar={eliminarCompra}
                    loadingAprobacion={loadingAprobacion}
                    loadingRechazo={loadingRechazo}
                    loadingEliminacion={loadingEliminacion}
                    mostrarEliminar={false}
                    formatearFecha={formatearFecha}
                  />
                ))}
              </div>

              <div className="adminpro-pagination-wrap">
                <div className="adminpro-pagination-info">
                  <label>Items por página</label>
                  <select
                    className="adminpro-input"
                    value={itemsPorPagina}
                    onChange={(e) => {
                      setItemsPorPagina(Number(e.target.value));
                      setPaginaCompras(1);
                    }}
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                  </select>
                </div>

                <div className="adminpro-pagination-controls">
                  <button
                    type="button"
                    className="adminpro-soft-btn dark"
                    onClick={() => setPaginaCompras((prev) => Math.max(prev - 1, 1))}
                    disabled={paginaCompras === 1}
                  >
                    Anterior
                  </button>

                  <div className="adminpro-pagination-page">
                    Página {paginaCompras} de {totalPaginasCompras}
                  </div>

                  <button
                    type="button"
                    className="adminpro-soft-btn dark"
                    onClick={() =>
                      setPaginaCompras((prev) => Math.min(prev + 1, totalPaginasCompras))
                    }
                    disabled={paginaCompras === totalPaginasCompras}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}