"use client";

import { useEffect, useMemo } from "react";
import { Trophy, CheckCircle2 } from "lucide-react";

export default function ManualApprovalModal({
  open,
  onClose,
  compra,
  rifaSeleccionada,
  ticketsVendidos,
  seleccionados,
  setSeleccionados,
  onConfirmar,
  loading,
  preselectedNumber,
  formatearFecha,
}) {
  const padLength = rifaSeleccionada?.formato === "3digitos" ? 3 : 4;

  const vendidosSet = useMemo(() => {
    const set = new Set();

    ticketsVendidos.forEach((t) => {
      const n = Number(t.numero_ticket);
      if (!Number.isNaN(n)) set.add(n);
    });

    return set;
  }, [ticketsVendidos]);

  const numeroGanadorOficial = useMemo(() => {
    if (!rifaSeleccionada) return null;

    const valor =
      rifaSeleccionada?.numero_ganador ??
      rifaSeleccionada?.sorteo?.numero_ganador ??
      null;

    if (valor === null || valor === undefined || valor === "") return null;

    const numero = Number(valor);
    return Number.isNaN(numero) ? null : numero;
  }, [rifaSeleccionada]);

  const numeroInicio = useMemo(() => {
    if (!rifaSeleccionada) return 0;

    if (
      rifaSeleccionada.numero_inicio !== undefined &&
      rifaSeleccionada.numero_inicio !== null
    ) {
      return Number(rifaSeleccionada.numero_inicio);
    }

    return 0;
  }, [rifaSeleccionada]);

  const numeroFin = useMemo(() => {
    if (!rifaSeleccionada) return 0;

    if (
      rifaSeleccionada.numero_fin !== undefined &&
      rifaSeleccionada.numero_fin !== null
    ) {
      return Number(rifaSeleccionada.numero_fin);
    }

    return rifaSeleccionada.formato === "3digitos" ? 999 : 9999;
  }, [rifaSeleccionada]);

  const numeros = useMemo(() => {
    if (!rifaSeleccionada) return [];

    const arr = [];
    for (let i = numeroInicio; i <= numeroFin; i++) {
      arr.push(i);
    }

    return arr;
  }, [rifaSeleccionada, numeroInicio, numeroFin]);

  useEffect(() => {
    if (!open) return;
    if (preselectedNumber === null || preselectedNumber === undefined) return;
    if (vendidosSet.has(preselectedNumber)) return;
    if (numeroGanadorOficial !== null && preselectedNumber === numeroGanadorOficial) return;

    setSeleccionados((prev) => {
      if (prev.includes(preselectedNumber)) return prev;

      const maxSeleccion = Number(compra?.cantidad_tickets) || 0;
      if (prev.length >= maxSeleccion) return prev;

      return [...prev, preselectedNumber].sort((a, b) => a - b);
    });
  }, [
    open,
    preselectedNumber,
    vendidosSet,
    setSeleccionados,
    compra,
    numeroGanadorOficial,
  ]);

  if (!open || !compra || !rifaSeleccionada) return null;

  const maxSeleccion = Number(compra.cantidad_tickets) || 0;
  const faltan = maxSeleccion - seleccionados.length;

  const toggleNumero = (numero) => {
    if (vendidosSet.has(numero)) return;
    if (numeroGanadorOficial !== null && numero === numeroGanadorOficial) return;

    setSeleccionados((prev) => {
      const existe = prev.includes(numero);

      if (existe) {
        return prev.filter((n) => n !== numero);
      }

      if (prev.length >= maxSeleccion) return prev;

      return [...prev, numero].sort((a, b) => a - b);
    });
  };

  return (
    <div className="adminpro-modal-backdrop">
      <div className="adminpro-modal premium-manual-modal">
        <div className="adminpro-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Aprobación manual</h2>
            <p style={{ marginTop: "8px", color: "#64748b" }}>
              Selecciona exactamente {maxSeleccion} ticket(s) para esta compra
            </p>
          </div>

          <button
            className="adminpro-soft-btn dark"
            onClick={onClose}
            type="button"
            disabled={loading}
          >
            Cerrar
          </button>
        </div>

        <div className="adminpro-manual-topbar">
          <div className="adminpro-manual-pill">
            <strong>Compra ID:</strong> {compra.id}
          </div>

          <div className="adminpro-manual-pill">
            <strong>Seleccionados:</strong> {seleccionados.length}/{maxSeleccion}
          </div>

          <div className="adminpro-manual-pill warn">
            <strong>Faltan:</strong> {faltan}
          </div>

          {numeroGanadorOficial !== null && (
            <div className="adminpro-manual-pill gold">
              <Trophy size={14} />
              Ganador: {String(numeroGanadorOficial).padStart(padLength, "0")}
            </div>
          )}
        </div>

        <div className="adminpro-manual-info-grid">
          <div className="adminpro-manual-info-box">
            <p><strong>Usuario:</strong> {compra.usuarios?.nombre || "Sin nombre"}</p>
            <p><strong>Email:</strong> {compra.usuarios?.email || "Sin email"}</p>
            <p><strong>Teléfono:</strong> {compra.usuarios?.telefono || "Sin teléfono"}</p>
          </div>

          <div className="adminpro-manual-info-box">
            <p><strong>Referencia:</strong> {compra.referencia || "Sin referencia"}</p>
            <p><strong>Método:</strong> {compra.metodo_pago || "Sin método"}</p>
            <p>
              <strong>Fecha:</strong>{" "}
              {formatearFecha?.(compra.fecha_compra || compra.created_at) ||
                compra.fecha_compra ||
                compra.created_at ||
                "Sin fecha"}
            </p>
          </div>

          <div className="adminpro-manual-info-box highlight">
            <p><strong>Tickets a asignar:</strong> {compra.cantidad_tickets}</p>
            <p><strong>Rifa:</strong> {rifaSeleccionada.nombre}</p>
            <p><strong>Formato:</strong> {rifaSeleccionada.formato}</p>
          </div>
        </div>

        <div className="adminpro-legend">
          <div><span className="legend-box sold" /> Vendido</div>
          <div><span className="legend-box free" /> Disponible</div>
          <div><span className="legend-box selected" /> Seleccionado</div>
          <div><span className="legend-box winner" /> Ganador oficial</div>
        </div>

        <div className="adminpro-manual-grid-wrap">
          <div className="adminpro-manual-grid">
            {numeros.map((numero) => {
              const vendido = vendidosSet.has(numero);
              const seleccionado = seleccionados.includes(numero);
              const esGanador =
                numeroGanadorOficial !== null && numero === numeroGanadorOficial;

              let className = "free";
              if (esGanador) className = "winner";
              else if (vendido) className = "sold";
              else if (seleccionado) className = "selected";

              return (
                <button
                  key={numero}
                  type="button"
                  disabled={vendido || esGanador}
                  onClick={() => toggleNumero(numero)}
                  className={`adminpro-manual-ticket ${className}`}
                  title={
                    esGanador
                      ? "Número ganador oficial"
                      : vendido
                      ? "Vendido / aprobado"
                      : seleccionado
                      ? "Seleccionado"
                      : "Disponible"
                  }
                >
                  {String(numero).padStart(padLength, "0")}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          <strong>Tickets seleccionados:</strong>

          {seleccionados.length > 0 ? (
            <div className="adminpro-ticket-chips">
              {seleccionados.map((numero) => (
                <span key={numero}>
                  {String(numero).padStart(padLength, "0")}
                </span>
              ))}
            </div>
          ) : (
            <p className="adminpro-muted" style={{ marginTop: "8px" }}>
              No has seleccionado tickets todavía
            </p>
          )}
        </div>

        <div className="adminpro-actions-wrap" style={{ marginTop: "18px" }}>
          <button
            className="adminpro-primary-btn"
            onClick={onConfirmar}
            disabled={seleccionados.length !== maxSeleccion || loading}
            type="button"
          >
            <CheckCircle2 size={16} />
            {loading ? "Aprobando..." : "Confirmar asignación"}
          </button>

          <button
            className="adminpro-soft-btn dark"
            onClick={() => setSeleccionados([])}
            type="button"
            disabled={loading}
          >
            Limpiar selección
          </button>
        </div>
      </div>
    </div>
  );
}