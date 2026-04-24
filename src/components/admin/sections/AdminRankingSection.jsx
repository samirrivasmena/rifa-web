"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AdminRankingSection({
  rankingRef,
  rankingDetalleRef,
  resumenRanking,
  irARankingDetallado,
  abrirDetalleParticipante,
  rankingFiltradoYOrdenado,
  busquedaRanking,
  setBusquedaRanking,
  ordenRanking,
  setOrdenRanking,
  itemsPorPaginaRanking,
  setItemsPorPaginaRanking,
  setPaginaRanking,
  exportarRankingCSV,
  ranking,
  rankingPaginado,
  paginaRanking,
  totalPaginasRanking,
  resumenPaginacionRanking,
}) {
  return (
    <div className="adminpro-page-stack" ref={rankingRef}>
      <div className="adminpro-ranking-kpis adminpro-ranking-kpis-premium">
        <button
          type="button"
          className="adminpro-ranking-kpi adminpro-ranking-kpi-purple clickable"
          onClick={irARankingDetallado}
        >
          <span className="adminpro-ranking-kpi-arrow">↗</span>
          <span>Participantes en ranking</span>
          <strong>{resumenRanking.totalParticipantes}</strong>
          <small>Total de personas con compras aprobadas</small>
        </button>

        <button
          type="button"
          className="adminpro-ranking-kpi adminpro-ranking-kpi-green clickable"
          onClick={irARankingDetallado}
        >
          <span className="adminpro-ranking-kpi-arrow">↗</span>
          <span>Tickets aprobados</span>
          <strong>{resumenRanking.totalTicketsAprobados}</strong>
          <small>Total global de tickets validados</small>
        </button>

        <button
          type="button"
          className="adminpro-ranking-kpi adminpro-ranking-kpi-orange clickable"
          onClick={() =>
            resumenRanking.topParticipante &&
            abrirDetalleParticipante(resumenRanking.topParticipante)
          }
        >
          <span className="adminpro-ranking-kpi-arrow">↗</span>
          <span>Líder actual</span>
          <strong title={resumenRanking.topParticipante?.nombre || "Sin datos"}>
            {resumenRanking.topParticipante?.nombre || "Sin datos"}
          </strong>
          <small>Participante con más tickets aprobados</small>
        </button>

        <button
          type="button"
          className="adminpro-ranking-kpi adminpro-ranking-kpi-indigo clickable"
          onClick={irARankingDetallado}
        >
          <span className="adminpro-ranking-kpi-arrow">↗</span>
          <span>Promedio por participante</span>
          <strong>{resumenRanking.promedioTicketsPorParticipante}</strong>
          <small>Promedio de tickets por persona</small>
        </button>

        <button
          type="button"
          className="adminpro-ranking-kpi adminpro-ranking-kpi-red clickable"
          onClick={() =>
            resumenRanking.topParticipante &&
            abrirDetalleParticipante(resumenRanking.topParticipante)
          }
        >
          <span className="adminpro-ranking-kpi-arrow">↗</span>
          <span>% del líder</span>
          <strong>{resumenRanking.porcentajeLider}%</strong>
          <small>Participación del líder sobre el total</small>
        </button>

        <button
          type="button"
          className="adminpro-ranking-kpi adminpro-ranking-kpi-slate clickable"
          onClick={() => {
            if (rankingFiltradoYOrdenado.length > 1) {
              abrirDetalleParticipante(rankingFiltradoYOrdenado[1]);
            } else if (rankingFiltradoYOrdenado.length > 0) {
              abrirDetalleParticipante(rankingFiltradoYOrdenado[0]);
            }
          }}
        >
          <span className="adminpro-ranking-kpi-arrow">↗</span>
          <span>Diferencia Top 1 vs Top 2</span>
          <strong>{resumenRanking.diferenciaTop2}</strong>
          <small>Brecha actual entre los dos primeros</small>
        </button>
      </div>

      <div className="adminpro-card adminpro-ranking-panel">
        <div className="adminpro-section-head">
          <div>
            <h2>Filtro y control del ranking</h2>
            <p>Busca participantes, cambia el orden y exporta resultados</p>
          </div>

          <button
            type="button"
            className="adminpro-soft-btn blue"
            onClick={exportarRankingCSV}
          >
            Exportar ranking CSV
          </button>
        </div>

        <div className="adminpro-ranking-toolbar">
          <div className="adminpro-ranking-field">
            <label>Buscar participante</label>
            <input
              type="text"
              className="adminpro-input"
              placeholder="Nombre, email o teléfono"
              value={busquedaRanking}
              onChange={(e) => setBusquedaRanking(e.target.value)}
            />
          </div>

          <div className="adminpro-ranking-field">
            <label>Ordenar ranking</label>
            <select
              className="adminpro-input"
              value={ordenRanking}
              onChange={(e) => setOrdenRanking(e.target.value)}
            >
              <option value="tickets_desc">Más tickets</option>
              <option value="tickets_asc">Menos tickets</option>
              <option value="compras_desc">Más compras</option>
              <option value="compras_asc">Menos compras</option>
              <option value="monto_desc">Mayor monto</option>
              <option value="monto_asc">Menor monto</option>
              <option value="nombre_asc">Nombre A-Z</option>
              <option value="nombre_desc">Nombre Z-A</option>
            </select>
          </div>

          <div className="adminpro-ranking-field">
            <label>Items por página</label>
            <select
              className="adminpro-input"
              value={itemsPorPaginaRanking}
              onChange={(e) => {
                setItemsPorPaginaRanking(Number(e.target.value));
                setPaginaRanking(1);
              }}
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
      </div>

      <div className="adminpro-card adminpro-ranking-panel">
        <div className="adminpro-section-head">
          <div>
            <h2>Participantes con más tickets aprobados</h2>
            <p>Top 10 de la rifa seleccionada</p>
          </div>
        </div>

        {ranking.length === 0 ? (
          <p>No hay datos todavía.</p>
        ) : (
          <div className="adminpro-ranking-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ranking}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={180}
                  tick={{ fontSize: 13, fill: "#cbd5e1" }}
                  stroke="#94a3b8"
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.18)",
                    borderRadius: "14px",
                    color: "#fff",
                  }}
                  formatter={(value) => [value, "Tickets"]}
                  labelFormatter={(label) => `Participante: ${label}`}
                />
                <Bar
                  dataKey="cantidad"
                  fill="#6366f1"
                  radius={[0, 8, 8, 0]}
                  onClick={(data) => abrirDetalleParticipante(data)}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="adminpro-card adminpro-ranking-panel">
        <div className="adminpro-section-head">
          <div>
            <h2>Top 3 destacados</h2>
            <p>Participantes con mejor desempeño</p>
          </div>
        </div>

        {rankingFiltradoYOrdenado.length === 0 ? (
          <p>No hay datos todavía.</p>
        ) : (
          <div className="adminpro-ranking-top3-premium">
            {rankingFiltradoYOrdenado.slice(0, 3).map((persona, index) => {
              const porcentaje =
                resumenRanking.totalTicketsAprobados > 0
                  ? ((persona.cantidad / resumenRanking.totalTicketsAprobados) * 100).toFixed(2)
                  : "0.00";

              return (
                <button
                  type="button"
                  key={`${persona.nombre}-${index}`}
                  className={`adminpro-ranking-top3-premium-card pos-${index + 1}`}
                  onClick={() => abrirDetalleParticipante(persona)}
                >
                  <span className="adminpro-ranking-top3-arrow">↗</span>

                  <div className="adminpro-ranking-top3-head">
                    <div className="adminpro-ranking-top3-badge">#{index + 1}</div>
                    <div className="adminpro-ranking-top3-avatar">
                      {String(persona.nombre || "?").charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="adminpro-ranking-top3-content">
                    <h3 title={persona.nombre}>{persona.nombre}</h3>
                    <strong>{persona.cantidad} tickets aprobados</strong>
                    <p>{porcentaje}% del total aprobado</p>

                    <div className="adminpro-ranking-top3-meta">
                      <span>{persona.compras} compras</span>
                      <span>${Number(persona.montoTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="adminpro-card adminpro-ranking-panel" ref={rankingDetalleRef}>
        <div className="adminpro-section-head">
          <div>
            <h2>Ranking detallado</h2>
            <p>
              Mostrando {resumenPaginacionRanking.desde} a {resumenPaginacionRanking.hasta} de{" "}
              {resumenPaginacionRanking.total} participante
              {resumenPaginacionRanking.total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {rankingPaginado.length === 0 ? (
          <p>No hay datos todavía.</p>
        ) : (
          <>
            <div className="adminpro-ranking-table-head-pro">
              <span>Posición</span>
              <span>Participante</span>
              <span>Participación</span>
              <span>Métricas</span>
            </div>

            <div className="adminpro-ranking-list-v3">
              {rankingPaginado.map((persona, index) => {
                const posicionReal = (paginaRanking - 1) * itemsPorPaginaRanking + index + 1;
                const porcentajeNumerico =
                  resumenRanking.totalTicketsAprobados > 0
                    ? (persona.cantidad / resumenRanking.totalTicketsAprobados) * 100
                    : 0;

                const porcentaje = porcentajeNumerico.toFixed(2);

                return (
                  <button
                    type="button"
                    key={`${persona.nombre}-${index}`}
                    className="adminpro-ranking-row-pro clickable"
                    onClick={() => abrirDetalleParticipante(persona)}
                  >
                    <div className="adminpro-ranking-rank-pro">
                      <span className="adminpro-ranking-rank-badge">#{posicionReal}</span>
                    </div>

                    <div className="adminpro-ranking-participant-pro">
                      <div className="adminpro-ranking-avatar-pro">
                        {String(persona.nombre || "?").charAt(0).toUpperCase()}
                      </div>

                      <div className="adminpro-ranking-participant-info-pro">
                        <strong title={persona.nombre}>{persona.nombre}</strong>
                        {persona.email ? <small>{persona.email}</small> : <small>Sin email</small>}
                        {persona.telefono ? <small>{persona.telefono}</small> : null}
                      </div>
                    </div>

                    <div className="adminpro-ranking-participation-pro">
                      <div className="adminpro-ranking-participation-top-pro">
                        <span>Participación</span>
                        <strong>{porcentaje}%</strong>
                      </div>

                      <div className="adminpro-ranking-progress-bar-pro">
                        <div
                          className="adminpro-ranking-progress-fill-pro"
                          style={{ width: `${Math.min(porcentajeNumerico, 100)}%` }}
                        />
                      </div>

                      <div className="adminpro-ranking-participation-sub-pro">
                        {persona.cantidad} ticket{persona.cantidad !== 1 ? "s" : ""} de{" "}
                        {resumenRanking.totalTicketsAprobados}
                      </div>
                    </div>

                    <div className="adminpro-ranking-metrics-pro">
                      <div className="adminpro-ranking-metric-pro">
                        <span>Tickets</span>
                        <strong>{persona.cantidad}</strong>
                      </div>

                      <div className="adminpro-ranking-metric-pro">
                        <span>Compras</span>
                        <strong>{persona.compras}</strong>
                      </div>

                      <div className="adminpro-ranking-metric-pro">
                        <span>Monto</span>
                        <strong>${Number(persona.montoTotal || 0).toFixed(2)}</strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="adminpro-pagination-wrap">
              <div className="adminpro-pagination-info">
                <label>Items por página</label>
                <select
                  className="adminpro-input"
                  value={itemsPorPaginaRanking}
                  onChange={(e) => {
                    setItemsPorPaginaRanking(Number(e.target.value));
                    setPaginaRanking(1);
                  }}
                >
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="adminpro-pagination-controls">
                <button
                  type="button"
                  className="adminpro-soft-btn dark"
                  onClick={() => setPaginaRanking((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaRanking === 1}
                >
                  Anterior
                </button>

                <div className="adminpro-pagination-page">
                  Página {paginaRanking} de {totalPaginasRanking}
                </div>

                <button
                  type="button"
                  className="adminpro-soft-btn dark"
                  onClick={() =>
                    setPaginaRanking((prev) => Math.min(prev + 1, totalPaginasRanking))
                  }
                  disabled={paginaRanking === totalPaginasRanking}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}