"use client";

import HeroRifa from "../HeroRifa";
import KpiGrid from "../KpiGrid";
import PurchaseCard from "../PurchaseCard";
import RaffleProgressPanel from "../RaffleProgressPanel";

export default function AdminDashboardSection({
  dashboardRef,
  dashboardFilterRef,
  mapaTicketsRef,
  comprasSectionRef,
  ganadorRef,
  rankingRef,
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
  comprasPendientes,
  abrirAprobacionManualDesdeCuadricula,
}) {
  const comprasPorFiltro = {
    total: comprasFiltradasPorRifa,
    pendientes: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "pendiente"),
    aprobadas: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "aprobado"),
    rechazadas: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "rechazado"),
  };

  return (
    <>
      {rifaSeleccionada && (
        <>
          <HeroRifa
            rifaSeleccionada={rifaSeleccionada}
            padLength={padLength}
            formatearFecha={formatearFecha}
            totalCompras={comprasFiltradasPorRifa.length}
            totalTicketsVendidos={ticketsFiltradosPorRifa.length}
            totalComprasAprobadas={
              comprasFiltradasPorRifa.filter((c) => c.estado_pago === "aprobado").length
            }
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

          <KpiGrid
            compras={comprasFiltradasPorRifa}
            tickets={ticketsFiltradosPorRifa}
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
                  <h2>
                    {{
                      total: "Todas las compras de la rifa",
                      pendientes: "Compras pendientes de la rifa",
                      aprobadas: "Compras aprobadas de la rifa",
                      rechazadas: "Compras rechazadas de la rifa",
                      tickets: "Tickets vendidos de la rifa",
                    }[filtroDashboard]}
                  </h2>
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
                        mostrarEliminar={filtroDashboard === "rechazadas"}
                        formatearFecha={formatearFecha}
                      />
                    ))}
                  </div>
                ) : (
                  <p>No hay registros para mostrar.</p>
                )
              ) : ticketsFiltradosPorRifa.length > 0 ? (
                <div className="adminpro-compras-grid">
                  {ticketsFiltradosPorRifa.map((ticket) => (
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

        <div ref={mapaTicketsRef}>
          <RaffleProgressPanel
            tickets={ticketsFiltradosPorRifa}
            compras={comprasFiltradasPorRifa}
            rifaSeleccionada={rifaSeleccionada}
            tieneComprasPendientes={comprasPendientes.length > 0}
            onOpenManualFromGrid={abrirAprobacionManualDesdeCuadricula}
            onOpenCompra={() => {
              setSeccionActiva("compras");
              scrollToRef(comprasSectionRef, 180);
            }}
          />
        </div>
      </div>
    </>
  );
}