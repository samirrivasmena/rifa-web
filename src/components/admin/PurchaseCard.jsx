"use client";
import { useMemo, useEffect, useState } from "react";
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
  const soloNumeros = String(valor).trim().replace(/\D/g, "");
  if (!soloNumeros) return null;
  return String(Number(soloNumeros)).padStart(padLength, "0");
}
function limpiarTelefonoWhatsapp(valor) {
  const numeros = String(valor || "").replace(/\D/g, "");
  if (!numeros) return "";
  if (numeros.length === 10) return `1${numeros}`;
  return numeros;
}
function crearMensajeWhatsapp({
  compra,
  ticketsFormateados,
  padLength,
}) {
  const nombre =
    compra?.nombre_cliente ||
    compra?.usuarios?.nombre ||
    "cliente";
  const rifaNombre =
    compra?.rifas?.nombre ||
    compra?.rifa_nombre ||
    "Rifa";
  const premio =
    compra?.rifas?.premio ||
    compra?.premio ||
    rifaNombre;
  const fechaSorteo =
    compra?.rifas?.fecha_sorteo ||
    "Por confirmar";
  const horaSorteo =
    compra?.rifas?.hora_sorteo ||
    "";
  const eventoUrl = compra?.rifa_id
    ? `${(typeof window !== "undefined" ? window.location.origin : "")}/evento/${compra.rifa_id}`
    : `${(typeof window !== "undefined" ? window.location.origin : "")}/principal`;
  const ticketsTexto =
    ticketsFormateados?.length > 0
      ? ticketsFormateados
          .map(
            (t) =>
              `🎟️ ${String(t).padStart(
                padLength,
                "0"
              )}`
          )
          .join("\n")
      : "⏳ Pendiente de asignar";
  return `🎉 *¡COMPRA APROBADA!*
Hola *${nombre}* 👋
Tu compra fue aprobada correctamente en *Sorteos LSD*.
━━━━━━━━━━━━━━
🎁 *Premio:* ${premio}
🎯 *Rifa:* ${rifaNombre}
📅 *Sorteo:* ${fechaSorteo} ${horaSorteo}
━━━━━━━━━━━━━━
✅ *Tus tickets asignados:*
${ticketsTexto}
🔎 *Ver tu rifa aquí:*
${eventoUrl}
🍀 Mucha suerte.
Gracias por participar con nosotros.
*Sorteos LSD* 🏆`;
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
  numeroGanadorOficial = null,
  padLength = 4,
}) {
  const comprobanteUrl =
    compra?.comprobante_url ||
    compra?.comprobante ||
    compra?.capture_url ||
    compra?.soporte_pago ||
    "";
  const monto = Number(
    compra?.monto_total ??
      compra?.total ??
      0
  );
  const fechaVisible =
    compra?.fecha_compra ||
    compra?.created_at ||
    null;
  const estado = String(
    compra?.estado_pago || ""
  ).toLowerCase();
  // =====================================================
  // DATOS HISTÓRICOS DE ESTA COMPRA
  // =====================================================
  // Las compras nuevas utilizan los datos que el cliente
  // escribió específicamente al realizar esta compra.
  //
  // Las compras antiguas, que no tienen estos campos,
  // siguen utilizando la información de usuarios.
  // =====================================================
  const nombreCliente =
    compra?.nombre_cliente ||
    compra?.usuarios?.nombre ||
    compra?.usuario_id ||
    "Sin nombre";
  const emailCliente =
    compra?.email_cliente ||
    compra?.usuarios?.email ||
    "Sin email";
  const telefonoCliente =
    compra?.telefono_cliente ||
    compra?.usuarios?.telefono ||
    "";
  const telefonoWhatsapp =
    limpiarTelefonoWhatsapp(telefonoCliente);
  const esPdfComprobante = useMemo(() => {
    if (!comprobanteUrl) return false;
    return /\.pdf(\?|#|$)/i.test(comprobanteUrl);
  }, [comprobanteUrl]);
  const numeroGanadorFormateado = useMemo(() => {
    return normalizarNumero(
      numeroGanadorOficial,
      padLength
    );
  }, [numeroGanadorOficial, padLength]);
  const pendiente = estado === "pendiente";
  const modo = compra?.modo_compra_pendiente;
  const reservados = Array.isArray(compra?.numeros_reservados) ? compra.numeros_reservados : [];
  const manual = pendiente && (modo === "manual" || reservados.length > 0);
  const revision = pendiente && (modo === "revision" || (!modo && ticketsAsignados.length > 0));
  const expira = Date.parse(compra?.reserva_expira_at || "");
  const [ahora, setAhora] = useState(null);
  useEffect(() => {
    if (!manual || !Number.isFinite(expira)) return;
    const actualizar = () => setAhora(Date.now());
    actualizar();
    const timer = setInterval(actualizar, 1000);
    return () => clearInterval(timer);
  }, [manual, expira]);
  const restante = Number.isFinite(expira) && ahora !== null ? Math.max(0, expira - ahora) : null;
  const vencida = manual && (compra?.reserva_vencida === true || restante === 0);
  const incompleta = manual && (compra?.reserva_incompleta === true || !Number.isFinite(expira) || reservados.length !== Number(compra?.cantidad_tickets));
  const segundos = Math.ceil((restante || 0) / 1000);
  const contador = `${Math.floor(segundos / 3600)}h ${String(Math.floor(segundos / 60) % 60).padStart(2, "0")}m ${String(segundos % 60).padStart(2, "0")}s`;
  const bloquearAprobacion = revision || vencida || incompleta || (manual && ahora === null) || loadingAprobacion === compra?.id || loadingRechazo === compra?.id;
  const ticketsFormateados = useMemo(() => {
    const numeros = manual ? reservados : estado === "aprobado" ? ticketsAsignados : [];
    return [...new Set(numeros.map(t => normalizarNumero(t?.numero_ticket ?? t, padLength)).filter(Boolean))];
  }, [manual, reservados, estado, ticketsAsignados, padLength]);
  const mensajeWhatsapp = useMemo(() => {
    if (estado !== "aprobado") return `Hola ${nombreCliente}, te contactamos de Sorteos LSD sobre tu compra.`;
    return crearMensajeWhatsapp({
      compra,
      ticketsFormateados,
      padLength,
    });
  }, [
    compra, estado, nombreCliente,
    ticketsFormateados,
    padLength,
  ]);
  const whatsappUrl = telefonoWhatsapp
    ? `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(
        mensajeWhatsapp
      )}`
    : "";
  const compraTieneGanador = useMemo(() => {
    if (estado !== "aprobado" || !numeroGanadorFormateado) {
      return false;
    }
    return ticketsFormateados.includes(
      numeroGanadorFormateado
    );
  }, [
    estado, numeroGanadorFormateado,
    ticketsFormateados,
  ]);
  const esTicketGanador = (ticket) => {
    const ticketFormateado =
      normalizarNumero(
        ticket,
        padLength
      );
    return (
      estado === "aprobado" && Boolean(numeroGanadorFormateado) &&
      ticketFormateado ===
        numeroGanadorFormateado
    );
  };
  const abrirPreviewRapida = () => {
    if (!comprobanteUrl) return;
    if (onVerComprobante) onVerComprobante(comprobanteUrl);
    else window.open(comprobanteUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <div
      className="adminpro-purchase-card"
      style={
        compraTieneGanador
          ? {
              border:
                "1px solid #fde047",
              boxShadow:
                "0 0 16px rgba(250, 204, 21, 0.18)",
            }
          : undefined
      }
    >
      <div className="adminpro-purchase-head">
        <div
          style={{
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: "12px",
              flexWrap: "wrap",
              alignItems:
                "flex-start",
            }}
          >
            <div>
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Compra #{compra?.id}
                {compraTieneGanador && (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      padding:
                        "4px 10px",
                      borderRadius:
                        "999px",
                      background:
                        "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
                      color:
                        "#111827",
                      border:
                        "1px solid #fde047",
                    }}
                  >
                    🏆 GANADOR
                  </span>
                )}
              </h3>
              <p>
                {nombreCliente}
              </p>
            </div>
            <EstadoBadge
              estado={estado}
            />
          </div>
        </div>
      </div>
      <div className="adminpro-purchase-body">
        <p>
          <strong>
            Email:
          </strong>{" "}
          {emailCliente}
        </p>
        <p>
          <strong>
            Teléfono:
          </strong>{" "}
          {telefonoCliente ||
            "Sin teléfono"}
        </p>
        {telefonoWhatsapp ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="adminpro-whatsapp-btn"
          >
            📱 Contactar por
            WhatsApp
          </a>
        ) : (
          <p
            className="adminpro-muted"
            style={{
              marginTop: "8px",
            }}
          >
            📱 Sin teléfono para
            WhatsApp
          </p>
        )}
        <p>
          <strong>
            Tickets comprados:
          </strong>{" "}
          {compra?.cantidad_tickets ??
            0}
        </p>
        <p>
          <strong>
            Monto:
          </strong>{" "}
          $
          {Number.isFinite(monto)
            ? monto.toFixed(2)
            : "0.00"}
        </p>
        {compra?.metodo_pago === "PAGO MOVIL BDV" &&
  Number.isFinite(Number(compra?.monto_bolivares)) &&
  Number.isFinite(Number(compra?.tasa_bcv)) && (
    <>
      <p>
        <strong>Monto Pago Móvil:</strong>{" "}
        Bs.{" "}
        {new Intl.NumberFormat("es-VE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(compra.monto_bolivares))}
      </p>
      <p>
        <strong>Tasa BCV:</strong>{" "}
        Bs.{" "}
        {new Intl.NumberFormat("es-VE", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }).format(Number(compra.tasa_bcv))}{" "}
        / USD
      </p>
    </>
  )}
        <p>
          <strong>
            Referencia:
          </strong>{" "}
          {compra?.referencia ||
            "Sin referencia"}
        </p>
        <p>
          <strong>
            Método:
          </strong>{" "}
          {compra?.metodo_pago ||
            "Sin método"}
        </p>
        <p>
          <strong>
            Fecha:
          </strong>{" "}
          {formatearFecha?.(
            fechaVisible
          ) || "Sin fecha"}
        </p>
        <div className="adminpro-tickets-box">
          <strong>
            {manual ? "🎯 Números reservados por el cliente:" : pendiente ? "🎲 Números pendientes de asignación:" : "Tickets asignados:"}
          </strong>
          {ticketsFormateados?.length >
          0 ? (
            <div className="adminpro-ticket-chips">
              {ticketsFormateados.map(
                (ticket) => {
                  const ganador =
                    esTicketGanador(
                      ticket
                    );
                  return (
                    <span
                      key={`${compra?.id}-${ticket}`}
                      style={
                        ganador
                          ? {
                              background:
                                "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
                              color:
                                "#111827",
                              border:
                                "1px solid #fde047",
                              fontWeight: 900,
                              boxShadow:
                                "0 0 12px rgba(250, 204, 21, 0.45)",
                            }
                          : undefined
                      }
                      title={
                        ganador
                          ? "Ticket ganador oficial"
                          : manual ? "Número reservado" : "Ticket asignado"
                      }
                    >
                      {ticket}
                      {ganador
                        ? " 🏆"
                        : ""}
                    </span>
                  );
                }
              )}
            </div>
          ) : (
            <p
              className="adminpro-muted"
              style={{
                marginTop: "8px",
              }}
            >
              Aún no asignados
            </p>
          )}
        </div>
        {manual && (
          <div style={{marginTop:12,padding:12,border:"1px solid #f59e0b",borderRadius:12,background:"#fffbeb",color:"#92400e"}}>
            <strong>{incompleta ? "Reserva incompleta: requiere revisión" : vencida ? "Reserva vencida" : "⏳ Reserva activa"}</strong>
            {!incompleta && <div style={{fontSize:22,fontWeight:800,fontVariantNumeric:"tabular-nums"}}>{vencida ? "00h 00m 00s" : restante === null ? "Calculando…" : contador}</div>}
            <div style={{height:6,background:"#fde68a",borderRadius:8,overflow:"hidden",margin:"8px 0"}}><div style={{height:"100%",background:vencida ? "#dc2626" : "#16a34a",width:`${Math.min(100,(restante || 0)/864000)}%`}} /></div>
            <small>Los números elegidos no se pueden cambiar. La liberación se realiza en el servidor.</small>
          </div>
        )}
        {revision && <p style={{color:"#b45309",fontWeight:700}}>Compra pendiente de revisión. Actualiza los datos antes de aprobar.</p>}
        {comprobanteUrl ? (
          <div
            style={{
              marginTop: "14px",
            }}
          >
            <strong>
              Comprobante:
            </strong>
            <div
              onClick={
                abrirPreviewRapida
              }
              style={{
                marginTop: "8px",
                width: "100%",
                height: "180px",
                borderRadius:
                  "16px",
                overflow: "hidden",
                border:
                  "1px solid #e2e8f0",
                background:
                  "#f8fafc",
                cursor: "pointer",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >
              {esPdfComprobante ? (
                <div
                  style={{
                    textAlign:
                      "center",
                    padding:
                      "16px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 700,
                    }}
                  >
                    PDF comprobante
                  </p>
                  <p
                    style={{
                      margin:
                        "6px 0 0",
                      fontSize:
                        "13px",
                      color:
                        "#6b7280",
                    }}
                  >
                    Haz clic para
                    abrirlo
                  </p>
                </div>
              ) : (
                <img
                  src={
                    comprobanteUrl
                  }
                  alt="Comprobante"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit:
                      "cover",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.objectFit =
                      "contain";
                    e.currentTarget.style.padding =
                      "18px";
                  }}
                />
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop:
                  "10px",
                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={
                  abrirPreviewRapida
                }
              >
                Ver comprobante
              </button>
              <a
                href={
                  comprobanteUrl
                }
                target="_blank"
                rel="noreferrer"
                className="adminpro-soft-btn"
                style={{
                  textDecoration:
                    "none",
                  background:
                    "#eff6ff",
                  color:
                    "#1d4ed8",
                }}
              >
                Abrir archivo
              </a>
            </div>
          </div>
        ) : (
          <p
            style={{
              marginTop: "14px",
            }}
          >
            <strong>
              Comprobante:
            </strong>{" "}
            No disponible
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
          {estado ===
            "pendiente" && (
            <>
              <button
                className="adminpro-soft-btn"
                style={{
                  background:
                    "#16a34a",
                  color: "#fff",
                }}
                onClick={() =>
                  onAprobar?.(
                    compra
                  )
                }
                disabled={
                  bloquearAprobacion
                }
                type="button"
              >
                {loadingAprobacion ===
                compra?.id
                  ? "Aprobando..."
                  : manual ? "Aprobar números reservados" : "Aprobar automática"}
              </button>
              {!manual && !revision && (
              <button
                className="adminpro-soft-btn"
                style={{
                  background:
                    "#7c3aed",
                  color: "#fff",
                }}
                onClick={() =>
                  onAprobarManual?.(
                    compra
                  )
                }
                disabled={
                  bloquearAprobacion
                }
                type="button"
              >
                Aprobar manual
              </button>
              )}
              <button
                className="adminpro-soft-btn"
                style={{
                  background:
                    "#dc2626",
                  color: "#fff",
                }}
                onClick={() =>
                  onRechazar?.(
                    compra
                  )
                }
                disabled={
                  loadingRechazo === compra?.id || loadingAprobacion === compra?.id
                }
                type="button"
              >
                {loadingRechazo ===
                compra?.id
                  ? "Rechazando..."
                  : "Rechazar"}
              </button>
            </>
          )}
          {mostrarEliminar &&
            estado ===
              "rechazado" && (
              <button
                className="adminpro-soft-btn"
                style={{
                  background:
                    "#450a0a",
                  color: "#fff",
                }}
                onClick={() =>
                  onEliminar?.(
                    compra
                  )
                }
                disabled={
                  loadingEliminacion ===
                  compra?.id
                }
                type="button"
              >
                {loadingEliminacion ===
                compra?.id
                  ? "Eliminando..."
                  : "Eliminar"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}