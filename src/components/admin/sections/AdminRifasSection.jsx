"use client";

import RifasSection from "../RifasSection";

export default function AdminRifasSection({
  rifas,
  recargarTodo,
  setRifaSeleccionadaId,
  setSeccionActiva,
  setFiltroDashboard,
  topRef,
  scrollToRef,
  formatearFecha,
}) {
  return (
    <div className="adminpro-page-stack">
      <RifasSection
        rifas={rifas}
        onRecargarRifas={recargarTodo}
        onSeleccionarRifa={(rifaId) => {
          setRifaSeleccionadaId(rifaId);
          setSeccionActiva("dashboard");
          setFiltroDashboard(null);
          scrollToRef(topRef, 120);
        }}
        formatearFecha={formatearFecha}
      />
    </div>
  );
}