"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function normalizarTexto(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getEstadoMeta(estado) {
  const valor = String(estado || "").toLowerCase();

  if (["activa", "disponible", "publicada"].includes(valor)) {
    return { label: "ACTIVA", className: "estado-activa" };
  }

  if (["cerrada", "cerrado"].includes(valor)) {
    return { label: "CERRADA", className: "estado-cerrada" };
  }

  if (["finalizada", "finalizado"].includes(valor)) {
    return { label: "FINALIZADA", className: "estado-finalizada" };
  }

  if (["agotada", "agotado"].includes(valor)) {
    return { label: "AGOTADA", className: "estado-agotada" };
  }

  return {
    label: estado ? String(estado).toUpperCase() : "SIN ESTADO",
    className: "estado-default",
  };
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-rifas-search-icon">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16l4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RifasSmartSearch({
  rifas = [],
  busqueda,
  setBusqueda,
  filtroEstado,
  setFiltroEstado,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const estados = [
    { id: "todas", label: "Todas" },
    { id: "activa", label: "Activas" },
    { id: "cerrada", label: "Cerradas" },
    { id: "finalizada", label: "Finalizadas" },
    { id: "destacada", label: "Destacadas" },
  ];

  const rifasOrdenadas = useMemo(() => {
    return [...rifas].sort((a, b) => {
      const destacadaA = Boolean(a.destacada);
      const destacadaB = Boolean(b.destacada);

      if (destacadaA !== destacadaB) {
        return Number(destacadaB) - Number(destacadaA);
      }

      const fechaA = new Date(a.created_at || a.fecha_sorteo || 0).getTime();
      const fechaB = new Date(b.created_at || b.fecha_sorteo || 0).getTime();

      return fechaB - fechaA;
    });
  }, [rifas]);

  const rifasFiltradas = useMemo(() => {
    const q = normalizarTexto(busqueda);

    return rifasOrdenadas.filter((rifa) => {
      const estado = String(rifa.estado || "").toLowerCase();
      const estadoVisible =
        filtroEstado === "todas"
          ? true
          : filtroEstado === "destacada"
          ? Boolean(rifa.destacada)
          : estado === filtroEstado ||
            (filtroEstado === "activa" &&
              ["activa", "disponible", "publicada"].includes(estado)) ||
            (filtroEstado === "cerrada" && ["cerrada", "cerrado"].includes(estado)) ||
            (filtroEstado === "finalizada" &&
              ["finalizada", "finalizado"].includes(estado));

      if (!estadoVisible) return false;

      if (!q) return true;

      const texto = normalizarTexto(
        [
          rifa.id,
          rifa.nombre,
          rifa.estado,
          rifa.premio,
          rifa.descripcion,
          rifa.fecha_sorteo,
          rifa.hora_sorteo,
          rifa.formato,
          rifa.cantidad_numeros,
          rifa.precio_ticket,
        ].join(" ")
      );

      return texto.includes(q);
    });
  }, [rifasOrdenadas, busqueda, filtroEstado]);

  useEffect(() => {
    setActiveIndex(0);
  }, [busqueda, filtroEstado]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(rifasFiltradas.length - 1, 0)));
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="adminpro-rifas-search-box">
      <div className="adminpro-rifas-search-top">
        <div className="adminpro-rifas-search-input-wrap">
          <IconSearch />
          <input
            ref={inputRef}
            type="text"
            className="adminpro-rifas-search-input"
            placeholder="Buscar rifa por nombre, ID, estado, premio o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          type="button"
          className="adminpro-rifas-search-clear"
          onClick={() => setBusqueda("")}
          disabled={!busqueda}
        >
          Limpiar
        </button>
      </div>

      <div className="adminpro-rifas-search-filters">
        {estados.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`adminpro-rifas-filter-btn ${filtroEstado === item.id ? "active" : ""}`}
            onClick={() => setFiltroEstado(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="adminpro-rifas-search-meta">
        <span>
          {rifasFiltradas.length} resultado{rifasFiltradas.length !== 1 ? "s" : ""}
        </span>
        <span>Total: {rifas.length}</span>
      </div>

      <div className="adminpro-rifas-search-results">
        {rifasFiltradas.length > 0 ? (
          rifasFiltradas.map((rifa, index) => {
            const estado = getEstadoMeta(rifa.estado);
            const activa = index === activeIndex;

            return (
              <div
                key={rifa.id}
                className={`adminpro-rifas-search-item ${activa ? "active" : ""}`}
              >
                <div className="adminpro-rifas-search-item-main">
                  <div className="adminpro-rifas-search-item-row">
                    <strong>{rifa.nombre || "Sin nombre"}</strong>

                    {rifa.destacada && (
                      <span className="adminpro-rifas-mini-star">⭐ Destacada</span>
                    )}
                  </div>

                  <small>
                    ID #{rifa.id}
                    {rifa.fecha_sorteo ? ` · ${rifa.fecha_sorteo}` : ""}
                    {rifa.premio ? ` · ${rifa.premio}` : ""}
                  </small>

                  {rifa.descripcion ? (
                    <p className="adminpro-rifas-search-desc">{rifa.descripcion}</p>
                  ) : null}
                </div>

                <span className={`adminpro-rifas-status-badge ${estado.className}`}>
                  {estado.label}
                </span>
              </div>
            );
          })
        ) : (
          <div className="adminpro-rifas-search-empty">
            No se encontraron rifas con ese criterio.
          </div>
        )}
      </div>
    </div>
  );
}