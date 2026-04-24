"use client";

import RaffleProgressPanel from "../RaffleProgressPanel";

export default function AdminNumerosSection({
  numeroRef,
  ticketsFiltradosPorRifa,
  comprasFiltradasPorRifa,
  rifaSeleccionada,
  comprasPendientes,
  abrirAprobacionManualDesdeCuadricula,
  setSeccionActiva,
  scrollToRef,
  comprasSectionRef,
  numeroGanador,
  resultadoGanador,
}) {
  return (
    <div className="adminpro-page-stack">
      <div ref={numeroRef} id="numero">
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
          numeroGanador={numeroGanador}
          resultadoGanador={resultadoGanador}
        />
      </div>
    </div>
  );
}