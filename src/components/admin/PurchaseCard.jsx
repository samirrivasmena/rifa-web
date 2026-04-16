"use client";

function getEstadoBadgeStyle(estado) {
  switch (estado) {
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

export default function PurchaseCard({
  compra,
  ticketsAsignados,
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
}) {
  const comprobanteUrl =
    compra?.comprobante_url ||
    compra?.comprobante ||
    compra?.capture_url ||
    compra?.soporte_pago ||
    "";

  const monto = Number(compra?.monto_total ?? compra?.total ?? 0);

  const fechaVisible = compra?.fecha_compra || null;

  const abrirPreviewRapida = () => {
    if (!comprobanteUrl) return;
    onVerComprobante?.(comprobanteUrl);
  };

  return (
    <div className="adminpro-purchase-card">
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
              <h3>Compra #{compra.id}</h3>
              <p>{compra.usuarios?.nombre || compra.usuario_id || "Sin nombre"}</p>
            </div>

            <EstadoBadge estado={compra.estado_pago} />
          </div>
        </div>
      </div>

      <div className="adminpro-purchase-body">
        <p>
          <strong>Email:</strong> {compra.usuarios?.email || "Sin email"}
        </p>
        <p>
          <strong>Teléfono:</strong> {compra.usuarios?.telefono || "Sin teléfono"}
        </p>
        <p>
          <strong>Tickets comprados:</strong> {compra.cantidad_tickets ?? 0}
        </p>
        <p>
          <strong>Monto:</strong> ${monto.toFixed(2)}
        </p>
        <p>
          <strong>Referencia:</strong> {compra.referencia || "Sin referencia"}
        </p>
        <p>
          <strong>Método:</strong> {compra.metodo_pago || "Sin método"}
        </p>
        <p>
          <strong>Fecha:</strong>{" "}
          {formatearFecha?.(fechaVisible) || "Sin fecha"}
        </p>

        <div className="adminpro-tickets-box">
          <strong>Tickets asignados:</strong>

          {ticketsAsignados?.length > 0 ? (
            <div className="adminpro-ticket-chips">
              {ticketsAsignados.map((ticket) => (
                <span key={`${compra.id}-${ticket}`}>{ticket}</span>
              ))}
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
              }}
            >
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
          {compra.estado_pago === "pendiente" && (
            <>
              <button
                className="adminpro-soft-btn"
                style={{ background: "#16a34a", color: "#fff" }}
                onClick={() => onAprobar?.(compra)}
                disabled={loadingAprobacion === compra.id}
                type="button"
              >
                {loadingAprobacion === compra.id
                  ? "Aprobando..."
                  : "Aprobar automática"}
              </button>

              <button
                className="adminpro-soft-btn"
                style={{ background: "#7c3aed", color: "#fff" }}
                onClick={() => onAprobarManual?.(compra)}
                disabled={loadingAprobacion === compra.id}
                type="button"
              >
                Aprobar manual
              </button>

              <button
                className="adminpro-soft-btn"
                style={{ background: "#dc2626", color: "#fff" }}
                onClick={() => onRechazar?.(compra)}
                disabled={loadingRechazo === compra.id}
                type="button"
              >
                {loadingRechazo === compra.id ? "Rechazando..." : "Rechazar"}
              </button>
            </>
          )}

          {mostrarEliminar && compra.estado_pago === "rechazado" && (
            <button
              className="adminpro-soft-btn"
              style={{ background: "#450a0a", color: "#fff" }}
              onClick={() => onEliminar?.(compra)}
              disabled={loadingEliminacion === compra.id}
              type="button"
            >
              {loadingEliminacion === compra.id ? "Eliminando..." : "Eliminar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}