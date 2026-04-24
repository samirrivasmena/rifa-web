"use client";

import { useMemo } from "react";

function getEstadoBadgeStyle(estado) {
  switch (String(estado || "").toLowerCase()) {
    case "aprobado":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
      };
    case "pendiente":
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fcd34d",
      };
    case "rechazado":
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fca5a5",
      };
    default:
      return {
        background: "#e5e7eb",
        color: "#374151",
        border: "1px solid #d1d5db",
      };
  }
}

function EstadoBadge({ estado }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "700",
        textTransform: "capitalize",
        ...getEstadoBadgeStyle(estado),
      }}
    >
      {estado || "Sin estado"}
    </span>
  );
}

function normalizarNumero(valor, padLength = 4) {
  if (valor === undefined || valor === null || valor === "") return null;

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");
  if (!soloNumeros) return null;

  return String(Number(soloNumeros)).padStart(padLength, "0");
}

function extraerNumeroGanadorProfundo(valor, padLength = 4, visitados = new Set()) {
  if (valor === undefined || valor === null) return null;

  if (typeof valor === "number" || typeof valor === "string") {
    return normalizarNumero(valor, padLength);
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = extraerNumeroGanadorProfundo(item, padLength, visitados);
      if (encontrado) return encontrado;
    }
    return null;
  }

  if (typeof valor === "object") {
    if (visitados.has(valor)) return null;
    visitados.add(valor);

    const clavesPrioritarias = [
      "numero_ganador",
      "numeroGanador",
      "numero_ticket",
      "numeroTicket",
      "numero",
      "ganador",
      "winner",
      "ticket",
      "resultado",
      "data",
    ];

    for (const key of clavesPrioritarias) {
      if (Object.prototype.hasOwnProperty.call(valor, key)) {
        const encontrado = extraerNumeroGanadorProfundo(valor[key], padLength, visitados);
        if (encontrado) return encontrado;
      }
    }

    for (const [, v] of Object.entries(valor)) {
      const encontrado = extraerNumeroGanadorProfundo(v, padLength, visitados);
      if (encontrado) return encontrado;
    }
  }

  return null;
}

export default function PurchaseCard({
  compra,
  ticketsAsignados = [],
  onAprobar,
  onAprobarManual,
  onRechazar,
  onEliminar,
  onVerComprobante,
  loadingAprobacion,
  loadingRechazo,
  loadingEliminacion,
  mostrarEliminar = false,
  formatearFecha,
  numeroGanador = null,
  resultadoGanador = null,
  padLength = 4,
}) {
  const comprobanteUrl =
    compra?.comprobante_url ||
    compra?.comprobante ||
    compra?.capture_url ||
    compra?.soporte_pago ||
    "";

  const monto = Number(compra?.monto_total ?? compra?.total ?? 0);
  const fechaVisible = compra?.fecha_compra || compra?.created_at || null;
  const estado = String(compra?.estado_pago || "").toLowerCase();

  const esPdfComprobante = useMemo(() => {
    if (!comprobanteUrl) return false;
    return /\.pdf(\?|#|$)/i.test(comprobanteUrl);
  }, [comprobanteUrl]);

  const numeroGanadorFormateado = useMemo(() => {
    return (
      extraerNumeroGanadorProfundo(numeroGanador, padLength) ||
      extraerNumeroGanadorProfundo(resultadoGanador, padLength) ||
      null
    );
  }, [numeroGanador, resultadoGanador, padLength]);

  const ticketsFormateados = useMemo(() => {
    return (ticketsAsignados || []).map(
      (t) => normalizarNumero(t, padLength) || String(t).padStart(padLength, "0")
    );
  }, [ticketsAsignados, padLength]);

  const compraTieneGanador = useMemo(() => {
    if (!numeroGanadorFormateado) return false;
    return ticketsFormateados.includes(String(numeroGanadorFormateado));
  }, [numeroGanadorFormateado, ticketsFormateados]);

  const esTicketGanador = (ticket) => {
    const ticketFormateado = normalizarNumero(ticket, padLength);
    return Boolean(numeroGanadorFormateado) && ticketFormateado === String(numeroGanadorFormateado);
  };

  const abrirPreviewRapida = () => {
    if (!comprobanteUrl) return;
    onVerComprobante?.(comprobanteUrl);
  };

  return (
    <div
      className="adminpro-purchase-card"
      style={
        compraTieneGanador
          ? {
              border: "1px solid #fde047",
              boxShadow: "0 0 16px rgba(250, 204, 21, 0.18)",
            }
          : undefined
      }
    >
      <div className="adminpro-purchase-head">
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                Compra #{compra?.id}
                {compraTieneGanador && (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
                      color: "#111827",
                      border: "1px solid #fde047",
                    }}
                  >
                    🏆 GANADOR
                  </span>
                )}
              </h3>
              <p>{compra?.usuarios?.nombre || compra?.usuario_id || "Sin nombre"}</p>
            </div>

            <EstadoBadge estado={estado} />
          </div>
        </div>
      </div>

      <div className="adminpro-purchase-body">
        <p>
          <strong>Email:</strong> {compra?.usuarios?.email || "Sin email"}
        </p>
        <p>
          <strong>Teléfono:</strong> {compra?.usuarios?.telefono || "Sin teléfono"}
        </p>
        <p>
          <strong>Tickets comprados:</strong> {compra?.cantidad_tickets ?? 0}
        </p>
        <p>
          <strong>Monto:</strong> ${Number.isFinite(monto) ? monto.toFixed(2) : "0.00"}
        </p>
        <p>
          <strong>Referencia:</strong> {compra?.referencia || "Sin referencia"}
        </p>
        <p>
          <strong>Método:</strong> {compra?.metodo_pago || "Sin método"}
        </p>
        <p>
          <strong>Fecha:</strong> {formatearFecha?.(fechaVisible) || "Sin fecha"}
        </p>

        <div className="adminpro-tickets-box">
          <strong>Tickets asignados:</strong>

          {ticketsFormateados?.length > 0 ? (
            <div className="adminpro-ticket-chips">
              {ticketsFormateados.map((ticket) => {
                const ganador = esTicketGanador(ticket);

                return (
                  <span
                    key={`${compra?.id}-${ticket}`}
                    style={
                      ganador
                        ? {
                            background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
                            color: "#111827",
                            border: "1px solid #fde047",
                            fontWeight: 900,
                            boxShadow: "0 0 12px rgba(250, 204, 21, 0.45)",
                          }
                        : undefined
                    }
                    title={ganador ? "Ticket ganador oficial" : "Ticket asignado"}
                  >
                    {ticket}
                    {ganador ? " 🏆" : ""}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="adminpro-muted" style={{ marginTop: "8px" }}>
              Aún no asignados
            </p>
          )}
        </div>

        {comprobanteUrl ? (
          <div style={{ marginTop: "14px" }}>
            <strong>Comprobante:</strong>

            <div
              onClick={abrirPreviewRapida}
              style={{
                marginTop: "8px",
                width: "100%",
                height: "180px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {esPdfComprobante ? (
                <div style={{ textAlign: "center", padding: "16px" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>PDF comprobante</p>
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
                    Haz clic para abrirlo
                  </p>
                </div>
              ) : (
                <img
                  src={comprobanteUrl}
                  alt="Comprobante"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.objectFit = "contain";
                    e.currentTarget.style.padding = "18px";
                  }}
                />
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={abrirPreviewRapida}
              >
                Ver comprobante
              </button>

              <a
                href={comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="adminpro-soft-btn"
                style={{
                  textDecoration: "none",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                }}
              >
                Abrir archivo
              </a>
            </div>
          </div>
        ) : (
          <p style={{ marginTop: "14px" }}>
            <strong>Comprobante:</strong> No disponible
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "16px",
            flexWrap: "wrap",
          }}
        >
          {estado === "pendiente" && (
            <>
              <button
                className="adminpro-soft-btn"
                style={{ background: "#16a34a", color: "#fff" }}
                onClick={() => onAprobar?.(compra)}
                disabled={loadingAprobacion === compra?.id}
                type="button"
              >
                {loadingAprobacion === compra?.id ? "Aprobando..." : "Aprobar automática"}
              </button>

              <button
                className="adminpro-soft-btn"
                style={{ background: "#7c3aed", color: "#fff" }}
                onClick={() => onAprobarManual?.(compra)}
                disabled={loadingAprobacion === compra?.id}
                type="button"
              >
                Aprobar manual
              </button>

              <button
                className="adminpro-soft-btn"
                style={{ background: "#dc2626", color: "#fff" }}
                onClick={() => onRechazar?.(compra)}
                disabled={loadingRechazo === compra?.id}
                type="button"
              >
                {loadingRechazo === compra?.id ? "Rechazando..." : "Rechazar"}
              </button>
            </>
          )}

          {mostrarEliminar && estado === "rechazado" && (
            <button
              className="adminpro-soft-btn"
              style={{ background: "#450a0a", color: "#fff" }}
              onClick={() => onEliminar?.(compra)}
              disabled={loadingEliminacion === compra?.id}
              type="button"
            >
              {loadingEliminacion === compra?.id ? "Eliminando..." : "Eliminar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}