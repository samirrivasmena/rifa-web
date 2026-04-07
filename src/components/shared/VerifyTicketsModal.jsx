"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

const validarEmail = (email) => /\S+@\S+\.\S+/.test(email);

export default function VerifyTicketsModal({
  open,
  onClose,
  email,
  setEmail,
  rifaId = null,
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === "Escape" && !loading) {
        setEmail("");
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
    onClose?.();
  };

  const handleVerify = async () => {
    const cleanEmail = email.trim().toLowerCase();

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

    try {
      setLoading(true);

      const response = await fetch("/api/verificar-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          rifaId,
        }),
      });

      const data = await response.json();

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
          text: data.mensaje || "No se encontraron compras con ese correo en esta rifa",
        });
        return;
      }

      const compras = Array.isArray(data.compras) ? data.compras : [];
      const ticketsData = Array.isArray(data.tickets) ? data.tickets : [];

      const comprasPendientes = compras.filter(
        (compra) => compra.estado_pago === "pendiente"
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

      const formatoRifa =
        compras.find((compra) => compra?.rifas?.formato)?.rifas?.formato || "4digitos";

      const nombreRifa =
        compras.find((compra) => compra?.rifas?.nombre)?.rifas?.nombre || "Rifa";

      const padLength = formatoRifa === "3digitos" ? 3 : 4;

      const numeros = ticketsData
        .map((ticket) => String(ticket.numero_ticket).padStart(padLength, "0"))
        .join(", ");

      await Swal.fire({
        ...swalConfig,
        icon: "success",
        title: "Tickets encontrados",
        html: `
          <div style="text-align:left; line-height:1.8;">
            <p><strong>Correo:</strong> ${cleanEmail}</p>
            <p><strong>Rifa:</strong> ${nombreRifa}</p>
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
              ${numeros}
            </div>
          </div>
        `,
        confirmButtonColor: "#991b1b",
      });

      setEmail("");
      onClose?.();
    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text: error.message || "No se pudo verificar la información",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-modal-overlay" onClick={cerrarModal}>
      <div
        className="verify-modal-box premium"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-modal-title"
      >
        <div className="verify-modal-badge">🎟️ VERIFICADOR</div>

        <h2 id="verify-modal-title">VERIFICA TUS TICKETS</h2>

        <p className="verify-modal-warning">
          ⚠️ Soporte tiene hasta 24 horas para revisar y aprobar tu compra
        </p>

        <p className="verify-modal-text">
          Ingresa el correo electrónico que usaste al comprar para consultar tus tickets
          aprobados en esta rifa.
        </p>

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

        <div className="verify-modal-actions">
          <button
            onClick={handleVerify}
            className="verify-modal-btn confirm"
            type="button"
            disabled={loading}
          >
            {loading ? "Verificando..." : "Verificar Tickets"}
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