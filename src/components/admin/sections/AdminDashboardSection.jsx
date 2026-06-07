"use client";

import { useMemo } from "react";

import HeroRifa from "../HeroRifa";
import KpiGrid from "../KpiGrid";
import PurchaseCard from "../PurchaseCard";

function normalizarTicketsUnicos(lista = []) {
  const seen = new Set();

  return (lista || [])
    .map((ticket) => {
      const numero = Number(ticket?.numero_ticket);
      if (!Number.isFinite(numero)) return null;

      return {
        ...ticket,
        numero_ticket: numero,
      };
    })
    .filter(Boolean)
    .filter((ticket) => {
      const key = String(ticket.numero_ticket);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.numero_ticket) - Number(b.numero_ticket));
}

export default function AdminDashboardSection({
  dashboardRef,
  dashboardFilterRef,
  comprasSectionRef,
  ganadorRef,
  rankingRef,
  premioRef,
  rifaSeleccionada,
  padLength,
  formatearFecha,
  comprasFiltradasPorRifa,
  ticketsFiltradosPorRifa,
  showSecondImage,
  setSeccionActiva,
  scrollToRef,
  abrirFiltroDashboard,
  filtroDashboard,
  setFiltroDashboard,
  ticketsPorCompra,
  aprobarCompra,
  abrirAprobacionManual,
  rechazarCompra,
  eliminarCompra,
  loadingAprobacion,
  loadingRechazo,
  loadingEliminacion,
  numeroGanadorOficial,
  dashboardCompactSummary,
}) {
  const estadoNormalizado = (valor) =>
    String(valor || "").toLowerCase().trim();

  const comprasAprobadas = comprasFiltradasPorRifa.filter((c) =>
    ["aprobado", "aprobada"].includes(estadoNormalizado(c.estado_pago))
  );

  const comprasPorFiltro = {
    total: comprasFiltradasPorRifa,
    pendientes: comprasFiltradasPorRifa.filter(
      (c) => estadoNormalizado(c.estado_pago) === "pendiente"
    ),
    aprobadas: comprasAprobadas,
    rechazadas: comprasFiltradasPorRifa.filter(
      (c) => estadoNormalizado(c.estado_pago) === "rechazado"
    ),
  };

  // Tickets reales únicos de la rifa
  const ticketsVendidosUnicos = useMemo(() => {
    return normalizarTicketsUnicos(ticketsFiltradosPorRifa);
  }, [ticketsFiltradosPorRifa]);

  const resumenRifa = dashboardCompactSummary || {};

  const totalTickets = Number(
    resumenRifa.totalTickets ??
      rifaSeleccionada?.total_numeros ??
      rifaSeleccionada?.cantidad_numeros ??
      ticketsVendidosUnicos.length ??
      0
  );

  const ticketsVendidos = Number(
    resumenRifa.ticketsVendidos ??
      rifaSeleccionada?.tickets_vendidos ??
      rifaSeleccionada?.stats?.vendidos ??
      ticketsVendidosUnicos.length ??
      0
  );

  const ticketsDisponibles = Number(
    resumenRifa.disponibles ??
      rifaSeleccionada?.tickets_disponibles ??
      Math.max(totalTickets - ticketsVendidos, 0)
  );

  const porcentajeVendido = Number(
    resumenRifa.porcentajeVendido ??
      rifaSeleccionada?.porcentaje_vendido ??
      rifaSeleccionada?.stats?.porcentaje ??
      (totalTickets > 0
        ? Number(((ticketsVendidos / totalTickets) * 100).toFixed(2))
        : 0)
  );

  const titulosFiltro = {
    total: "Todas las compras de la rifa",
    pendientes: "Compras pendientes de la rifa",
    aprobadas: "Compras aprobadas de la rifa",
    rechazadas: "Compras rechazadas de la rifa",
    tickets: "Tickets vendidos de la rifa",
  };

  return (
    <>
      {rifaSeleccionada && (
        <>
          <div ref={premioRef}>
            <HeroRifa
              rifaSeleccionada={rifaSeleccionada}
              padLength={padLength}
              formatearFecha={formatearFecha}
              totalCompras={comprasFiltradasPorRifa.length}
              totalTicketsVendidos={ticketsVendidos}
              totalComprasAprobadas={comprasAprobadas.length}
              showSecondImage={showSecondImage}
              onIrCompras={() => {
                setSeccionActiva("compras");
                scrollToRef(comprasSectionRef, 180);
              }}
              onIrGanador={() => {
                setSeccionActiva("ganador");
                scrollToRef(ganadorRef, 180);
              }}
              onIrRanking={() => {
                setSeccionActiva("ranking");
                scrollToRef(rankingRef, 180);
              }}
            />
          </div>

          <KpiGrid
            compras={comprasFiltradasPorRifa}
            tickets={ticketsVendidosUnicos}
            ticketsVendidos={ticketsVendidos}
            onCardClick={abrirFiltroDashboard}
          />
        </>
      )}

      <div className="adminpro-page-stack" ref={dashboardRef}>
        <div ref={dashboardFilterRef}>
          {filtroDashboard && (
            <div className="adminpro-card">
              <div className="adminpro-section-head">
                <div>
                  <h2>{titulosFiltro[filtroDashboard] || "Detalle de la rifa"}</h2>
                  <p>Detalle filtrado de la rifa seleccionada</p>
                </div>

                <button
                  className="adminpro-soft-btn dark"
                  onClick={() => setFiltroDashboard(null)}
                  type="button"
                >
                  Cerrar
                </button>
              </div>

              {filtroDashboard !== "tickets" ? (
                comprasPorFiltro[filtroDashboard]?.length > 0 ? (
                  <div className="adminpro-compras-grid">
                    {comprasPorFiltro[filtroDashboard].map((compra) => (
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
                        mostrarEliminar={
                          estadoNormalizado(compra.estado_pago) === "rechazado"
                        }
                        formatearFecha={formatearFecha}
                        numeroGanadorOficial={numeroGanadorOficial}
                        padLength={padLength}
                      />
                    ))}
                  </div>
                ) : (
                  <p>No hay registros para mostrar.</p>
                )
              ) : ticketsVendidosUnicos.length > 0 ? (
                <div className="adminpro-compras-grid">
                  {ticketsVendidosUnicos.map((ticket) => (
                    <div key={ticket.id} className="adminpro-purchase-card">
                      <div className="adminpro-purchase-head">
                        <div>
                          <h3>Ticket #{ticket.id}</h3>
                          <p>Registrado en la rifa actual</p>
                        </div>
                      </div>

                      <div className="adminpro-purchase-body">
                        <p>
                          <strong>Número:</strong>{" "}
                          {String(ticket.numero_ticket).padStart(padLength, "0")}
                        </p>
                        <p>
                          <strong>Compra ID:</strong> {ticket.compra_id}
                        </p>
                        <p>
                          <strong>Rifa ID:</strong> {ticket.rifa_id}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No hay tickets vendidos todavía.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="adminpro-top-info" style={{ display: "none" }}>
        {ticketsDisponibles} {porcentajeVendido}
      </div>
    </>
  );
}