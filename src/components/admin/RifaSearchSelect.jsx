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
    return { label: "FINALIZADA", className: "estado-finalizada estado-finalizada-azul" };
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
    <svg viewBox="0 0 24 24" fill="none" className="adminpro-rifa-search-icon">
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

export default function RifaSearchSelect({
  rifas = [],
  rifaSeleccionadaId,
  setRifaSeleccionadaId,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const seleccionada = useMemo(() => {
    return rifas.find((r) => String(r.id) === String(rifaSeleccionadaId)) || null;
  }, [rifas, rifaSeleccionadaId]);

  const estadoSeleccionada = getEstadoMeta(seleccionada?.estado);

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
    const q = normalizarTexto(query);

    if (!q) return rifasOrdenadas;

    return rifasOrdenadas.filter((rifa) => {
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
        ].join(" ")
      );

      return texto.includes(q);
    });
  }, [rifasOrdenadas, query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const elegirRifa = (rifa) => {
    setRifaSeleccionadaId(rifa.id);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        Math.min(prev + 1, Math.max(rifasFiltradas.length - 1, 0))
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const rifa = rifasFiltradas[activeIndex];
      if (rifa) elegirRifa(rifa);
    }
  };

  const textoPrincipal = seleccionada?.nombre || "Selecciona una rifa";
  const textoSecundario = seleccionada
    ? `ID: ${seleccionada.id} · ${seleccionada.estado || "Sin estado"}`
    : "Busca por nombre, ID, estado o premio";

  return (
    <div className="adminpro-rifa-search" ref={wrapperRef}>
      <button
        type="button"
        className="adminpro-rifa-search-trigger"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setQuery("");
        }}
        aria-expanded={open}
      >
        <div className="adminpro-rifa-search-trigger-left">
          <span className="adminpro-rifa-search-trigger-icon">
            <IconSearch />
          </span>

          <div className="adminpro-rifa-search-trigger-main">
            <span className="adminpro-rifa-search-trigger-title">
              {textoPrincipal}
            </span>
            <span className="adminpro-rifa-search-trigger-subtitle">
              {textoSecundario}
            </span>
          </div>
        </div>

        <div className="adminpro-rifa-search-trigger-right">
          <span className={`adminpro-rifa-status-badge ${estadoSeleccionada.className}`}>
            {seleccionada ? estadoSeleccionada.label : "SIN RIFA"}
          </span>

          <span className={`adminpro-rifa-search-chevron ${open ? "open" : ""}`}>
            ⌄
          </span>
        </div>
      </button>

      {open && (
        <div className="adminpro-rifa-search-dropdown">
          <div className="adminpro-rifa-search-top">
            <div className="adminpro-rifa-search-input-wrap">
              <IconSearch />
              <input
                ref={inputRef}
                type="text"
                className="adminpro-rifa-search-input"
                placeholder="Buscar rifa por nombre, estado, ID, premio..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              type="button"
              className="adminpro-rifa-search-clear"
              onClick={() => setQuery("")}
              disabled={!query}
            >
              Limpiar
            </button>
          </div>

          <div className="adminpro-rifa-search-meta">
            <span>
              {rifasFiltradas.length} resultado
              {rifasFiltradas.length !== 1 ? "s" : ""}
            </span>
            <span>Total: {rifas.length}</span>
          </div>

          <div className="adminpro-rifa-search-list">
            {rifasFiltradas.length > 0 ? (
              rifasFiltradas.map((rifa, index) => {
                const estado = getEstadoMeta(rifa.estado);
                const active = index === activeIndex;
                const selected = String(rifa.id) === String(rifaSeleccionadaId);

                return (
                  <button
                    type="button"
                    key={rifa.id}
                    className={`adminpro-rifa-search-item ${active ? "active" : ""} ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() => elegirRifa(rifa)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="adminpro-rifa-search-item-main">
                      <div className="adminpro-rifa-search-item-row">
                        <strong>{rifa.nombre || "Sin nombre"}</strong>

                        {rifa.destacada && (
                          <span className="adminpro-rifa-mini-star">⭐ Destacada</span>
                        )}
                      </div>

                      <small>
                        ID #{rifa.id}
                        {rifa.fecha_sorteo ? ` · ${rifa.fecha_sorteo}` : ""}
                        {rifa.premio ? ` · ${rifa.premio}` : ""}
                      </small>
                    </div>

                    <span className={`adminpro-rifa-status-badge ${estado.className}`}>
                      {estado.label}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="adminpro-rifa-search-empty">
                No se encontraron rifas con ese criterio.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}