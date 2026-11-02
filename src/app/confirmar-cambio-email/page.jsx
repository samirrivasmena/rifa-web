"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function ConfirmarCambioEmailPage() {
  const searchParams = useSearchParams();
  const [procesando, setProcesando] = useState(false);

  const confirmationUrl = useMemo(() => {
    const valor = searchParams.get("confirmation_url");

    if (!valor) return "";

    try {
      const url = new URL(valor);

      // Solo permitimos enlaces HTTPS de Supabase.
      if (url.protocol !== "https:") {
        return "";
      }

      if (
        !url.hostname.endsWith(".supabase.co") &&
        !url.hostname.endsWith(".supabase.in")
      ) {
        return "";
      }

      return url.toString();
    } catch {
      return "";
    }
  }, [searchParams]);

  const confirmarCambio = () => {
    if (!confirmationUrl || procesando) return;

    setProcesando(true);

    // Solo aquí, después del clic real del usuario,
    // utilizamos el enlace de confirmación de Supabase.
    window.location.assign(confirmationUrl);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #211235 0%, #0b0b10 45%, #050507 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "rgba(17, 17, 24, 0.96)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: "22px",
          padding: "34px 28px",
          boxShadow: "0 25px 70px rgba(0,0,0,.45)",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 20px",
            borderRadius: "18px",
            background: "rgba(124, 58, 237, 0.15)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "30px",
          }}
        >
          🔐
        </div>

        <div
          style={{
            color: "#a78bfa",
            fontSize: "11px",
            fontWeight: "800",
            letterSpacing: "1.5px",
            marginBottom: "8px",
          }}
        >
          SORTEOS LSD · SEGURIDAD
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "27px",
            fontWeight: "900",
          }}
        >
          Confirmar cambio de correo
        </h1>

        {confirmationUrl ? (
          <>
            <p
              style={{
                margin: "0 auto 24px",
                maxWidth: "390px",
                color: "#a8a8b3",
                fontSize: "14px",
                lineHeight: "1.7",
              }}
            >
              Se solicitó cambiar el correo de acceso de la cuenta
              administrativa.
              <br />
              <br />
              Presiona el botón solamente si tú realizaste esta solicitud.
            </p>

            <div
              style={{
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.18)",
                borderRadius: "13px",
                padding: "13px",
                marginBottom: "22px",
                color: "#86efac",
                fontSize: "12px",
                lineHeight: "1.6",
              }}
            >
              ✓ El enlace no será utilizado hasta que presiones
              manualmente el botón.
            </div>

            <button
              type="button"
              onClick={confirmarCambio}
              disabled={procesando}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "12px",
                padding: "14px 18px",
                background: procesando ? "#4c1d95" : "#7c3aed",
                color: "#fff",
                fontWeight: "900",
                fontSize: "13px",
                cursor: procesando ? "not-allowed" : "pointer",
              }}
            >
              {procesando
                ? "CONFIRMANDO..."
                : "✓ CONFIRMAR CAMBIO DE CORREO"}
            </button>

            <p
              style={{
                margin: "18px 0 0",
                color: "#71717a",
                fontSize: "11px",
                lineHeight: "1.6",
              }}
            >
              Si no solicitaste este cambio, cierra esta página y no
              presiones el botón.
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                color: "#fca5a5",
                lineHeight: "1.7",
                fontSize: "14px",
              }}
            >
              El enlace de confirmación no es válido o está incompleto.
            </p>

            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: "16px",
                color: "#c4b5fd",
                fontWeight: "800",
                textDecoration: "none",
              }}
            >
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </main>
  );
}