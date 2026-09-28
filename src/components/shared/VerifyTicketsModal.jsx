"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

import {
  validarEmail,
  verificarTicketsPorEmail,
  verificarFreeCode,
} from "@/lib/verificaciones";

function formatearFechaSegura(valor) {
  if (!valor) return "Sin fecha";
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return String(valor);
  return date.toLocaleString();
}

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[match] || match;
  });
}

export default function VerifyTicketsModal({
  open,
  onClose,
  email,
  setEmail,
  rifaId = null,
  initialMode = "tickets",
  initialFreeCode = "",
}) {
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState(initialMode); // tickets | free
  const [codigoFree, setCodigoFree] = useState(initialFreeCode);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === "Escape" && !loading) {
        setEmail("");
        setCodigoFree("");
        setModo("tickets");
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleEscape);

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      clearTimeout(timer);
    };
  }, [open, loading, onClose, setEmail]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setModo(initialMode || "tickets");
    setCodigoFree(initialFreeCode || "");
  }, [open, initialMode, initialFreeCode]);

  if (!open) return null;

  const swalConfig = {
    background: "#1f1f1f",
    color: "#fff",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
  };

  const cerrarModal = () => {
    if (loading) return;
    setEmail("");
    setCodigoFree("");
    setModo("tickets");
    onClose?.();
  };

  const handleVerify = async () => {
    try {
      setLoading(true);

      if (modo === "tickets") {
        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!rifaId) {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Rifa no disponible",
            text: "No se pudo identificar la rifa que deseas verificar.",
          });
          return;
        }

        if (!cleanEmail) {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Email requerido",
            text: "Ingresa tu correo para verificar tus tickets",
          });
          return;
        }

        if (!validarEmail(cleanEmail)) {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Email inválido",
            text: "Ingresa un correo electrónico válido",
          });
          return;
        }

        const response = await verificarTicketsPorEmail(cleanEmail, rifaId);
        const data = response.data || {};

        if (!response.ok) {
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "Error",
            text: data.error || "No se pudieron verificar los tickets",
          });
          return;
        }

        if (!data.encontrado) {
          await Swal.fire({
            ...swalConfig,
            icon: "info",
            title: "Sin resultados",
            text:
              data.mensaje ||
              "No se encontraron compras con ese correo en esta rifa",
          });
          return;
        }

        const compras = Array.isArray(data.compras) ? data.compras : [];
        const ticketsData = Array.isArray(data.tickets) ? data.tickets : [];
        const rifaInfo =
          data.rifa || compras.find((compra) => compra?.rifas)?.rifas || null;

        const comprasPendientes = compras.filter(
          (compra) =>
            String(compra.estado_pago || "").toLowerCase() === "pendiente"
        );

        if (ticketsData.length === 0 && comprasPendientes.length > 0) {
          await Swal.fire({
            ...swalConfig,
            icon: "info",
            title: "Compra pendiente",
            html: `
              <div style="line-height:1.7;">
                <p>Encontramos tu compra, pero todavía está pendiente de aprobación.</p>
                <p>Soporte puede tardar hasta <strong>24 horas</strong> en validarla.</p>
              </div>
            `,
          });
          return;
        }

        if (ticketsData.length === 0) {
          await Swal.fire({
            ...swalConfig,
            icon: "info",
            title: "Sin tickets aprobados",
            text: "No se encontraron tickets aprobados para este correo en esta rifa.",
          });
          return;
        }

        const formatoRifa = rifaInfo?.formato || "4digitos";
        const nombreRifa = rifaInfo?.nombre || "Rifa";
        const padLength = formatoRifa === "3digitos" ? 3 : 4;

        const numerosOrdenados = [...ticketsData]
          .sort((a, b) => Number(a.numero_ticket) - Number(b.numero_ticket))
          .map((ticket) => String(ticket.numero_ticket).padStart(padLength, "0"))
          .join(", ");

        setLoading(false);
        setEmail("");
        setCodigoFree("");
        setModo("tickets");
        onClose?.();

        await Swal.fire({
          ...swalConfig,
          icon: "success",
          title: "Tickets encontrados",
          html: `
            <div style="text-align:left; line-height:1.8;">
              <p><strong>Correo:</strong> ${escaparHtml(cleanEmail)}</p>
              <p><strong>Rifa:</strong> ${escaparHtml(nombreRifa)}</p>
              <p><strong>Cantidad de tickets:</strong> ${ticketsData.length}</p>
              <p><strong>Formato:</strong> ${padLength} dígitos</p>
              <p style="margin-top:12px;"><strong>Números asignados:</strong></p>
              <div style="
                margin-top:8px;
                padding:12px;
                border-radius:12px;
                background:#2a2a2a;
                border:1px solid #3f3f46;
                line-height:1.8;
                word-break:break-word;
              ">
                ${escaparHtml(numerosOrdenados)}
              </div>
            </div>
          `,
          confirmButtonColor: "#991b1b",
        });

        return;
      }

      const codigoLimpio = String(codigoFree || "").trim().toUpperCase();

      if (!codigoLimpio) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Código FREE requerido",
          text: "Ingresa tu código FREE para verificar la participación gratis.",
        });
        return;
      }

      if (!codigoLimpio.startsWith("FREE-")) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Código inválido",
          text: "El código FREE debe comenzar con FREE-",
        });
        return;
      }

      const response = await verificarFreeCode(codigoLimpio);
      const data = response.data || {};

      if (!response.ok) {
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Código no válido",
          text: data.error || "No se pudo verificar el código FREE",
        });
        return;
      }

      const participacion = data?.participacion || null;
      const estadoFree = String(
        participacion?.estado_visual || participacion?.estado || "VÁLIDA"
      )
        .trim()
        .toUpperCase();

      const esValida = ["VÁLIDA", "VALIDA", "ASIGNADA", "ASSIGNED"].includes(estadoFree);
      const esPendiente = ["PENDIENTE", "RESERVADA", "RESERVED"].includes(estadoFree);
      const esAnulada = ["ANULADA", "CANCELADA", "CANCELLED"].includes(estadoFree);
      const esRechazada = ["RECHAZADA", "REJECTED"].includes(estadoFree);

      const iconoEstado = esValida
        ? "success"
        : esPendiente
        ? "info"
        : esAnulada || esRechazada
        ? "error"
        : "warning";

      const tituloEstado = esValida
        ? "Participación válida"
        : esPendiente
        ? "Participación pendiente"
        : esAnulada
        ? "Participación anulada"
        : esRechazada
        ? "Participación rechazada"
        : "Estado de participación";

      setLoading(false);
      setEmail("");
      setCodigoFree("");
      setModo("tickets");
      onClose?.();

      await Swal.fire({
        ...swalConfig,
        icon: iconoEstado,
        title: tituloEstado,
        html: `
          <div style="text-align:left; line-height:1.8;">
            <p><strong>Evento:</strong> ${escaparHtml(participacion?.evento || "Sin evento")}</p>
            <p><strong>FREE DROP:</strong> ${escaparHtml(participacion?.free_drop || "Sin drop")}</p>
            <p><strong>Número:</strong> ${escaparHtml(
              participacion?.numero_participacion_formateado ||
                participacion?.numero_participacion ||
                "Sin número"
            )}</p>
            <p><strong>Código:</strong> ${escaparHtml(
              participacion?.codigo || codigoLimpio
            )}</p>
            <p><strong>Estado:</strong> ${escaparHtml(estadoFree)}</p>
            <p><strong>Fecha:</strong> ${escaparHtml(
              formatearFechaSegura(participacion?.fecha_iso)
            )}</p>
          </div>
        `,
        confirmButtonColor: "#991b1b",
      });

    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text: error?.message || "No se pudo verificar la información",
      });
    } finally {
      setLoading(false);
    }
  };

  const titulo =
    modo === "tickets" ? "VERIFICA TUS TICKETS" : "VERIFICA TU FREE DROP";

  const descripcion =
    modo === "tickets"
      ? "Ingresa el correo electrónico que usaste al comprar para consultar tus tickets aprobados en esta rifa."
      : "Ingresa tu código FREE para consultar tu participación gratis.";

  return (
    <div className="verify-modal-overlay" onClick={cerrarModal}>
      <div
        className="verify-modal-box premium"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-modal-title"
        aria-describedby="verify-modal-description"
      >
        <div className="verify-modal-badge">🎟️ VERIFICADOR</div>

        <h2 id="verify-modal-title">{titulo}</h2>

        {modo === "tickets" ? (
          <p className="verify-modal-warning">
            ⚠️ Soporte tiene hasta 24 horas para revisar y aprobar tu compra
          </p>
        ) : (
          <p className="verify-modal-warning">
            ⚠️ Verifica tu participación gratis usando tu código FREE
          </p>
        )}

        <p className="verify-modal-text" id="verify-modal-description">
          {descripcion}
        </p>

        <div
          className="verify-modal-actions"
          style={{ marginBottom: "14px", gap: "10px", flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="verify-modal-btn confirm"
            onClick={() => setModo("tickets")}
            disabled={loading}
            style={{
              opacity: modo === "tickets" ? 1 : 0.75,
            }}
          >
            Tickets pagados
          </button>

          <button
            type="button"
            className="verify-modal-btn confirm"
            onClick={() => setModo("free")}
            disabled={loading}
            style={{
              opacity: modo === "free" ? 1 : 0.75,
            }}
          >
            FREE DROP
          </button>
        </div>

        {modo === "tickets" ? (
          <input
            ref={inputRef}
            type="email"
            placeholder="Ingresa tu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="verify-modal-input"
            disabled={loading}
            autoComplete="email"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleVerify();
              }
            }}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            placeholder="FREE-728491"
            value={codigoFree}
            onChange={(e) => setCodigoFree(e.target.value)}
            className="verify-modal-input"
            disabled={loading}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleVerify();
              }
            }}
          />
        )}

        <div className="verify-modal-actions">
          <button
            onClick={handleVerify}
            className="verify-modal-btn confirm"
            type="button"
            disabled={loading}
          >
            {loading
              ? "Verificando..."
              : modo === "tickets"
              ? "Verificar Tickets"
              : "Verificar FREE"}
          </button>

          <button
            onClick={cerrarModal}
            className="verify-modal-btn cancel"
            type="button"
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}