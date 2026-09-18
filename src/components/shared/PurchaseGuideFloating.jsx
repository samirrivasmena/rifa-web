"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PurchaseGuideFloating({ onOpenVerifier }) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);

    const updateMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    updateMobile();
    window.addEventListener("resize", updateMobile);

    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPendingAction(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

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
    if (!open && pendingAction) {
      const timer = setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 220);

      return () => clearTimeout(timer);
    }
  }, [open, pendingAction]);

  const scrollConOffset = (id) => {
    const section = document.getElementById(id);
    if (!section) return;

    const isMobileLocal = window.innerWidth <= 768;

    let offset = 100;

    if (id === "boletos") {
      offset = isMobileLocal ? 88 : 120;
    } else if (id === "pagos") {
      offset = isMobileLocal ? 88 : 120;
    } else {
      offset = isMobileLocal ? 82 : 110;
    }

    const top = section.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top,
      behavior: "smooth",
    });

    section.classList.remove("boletos-highlight");

    setTimeout(() => {
      section.classList.add("boletos-highlight");
    }, 120);

    setTimeout(() => {
      section.classList.remove("boletos-highlight");
    }, 2200);
  };

  const irASeccion = (id) => {
    setPendingAction(() => () => scrollConOffset(id));
    setOpen(false);
  };

  const abrirVerificador = () => {
    setPendingAction(() => () => {
      if (typeof onOpenVerifier === "function") {
        onOpenVerifier();
      }
    });
    setOpen(false);
  };

  const buttonPortal = mounted
    ? createPortal(
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir guía de compra"
          style={{
            position: "fixed",
            left: isMobile ? "12px" : "16px",
bottom: isMobile
  ? "14px"
  : "16px",
            zIndex: 2147483646,
            width: isMobile ? "50px" : "54px",
            height: isMobile ? "50px" : "54px",
            border: "none",
            borderRadius: "50%",
            background: "#1f1f1f",
            color: "#fff",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ?
          </span>
        </button>,
        document.body
      )
    : null;

  const modalPortal = mounted && open
    ? createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            background: "rgba(0,0,0,0.28)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "12px" : "16px",
            overflowY: "auto",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-guide-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: isMobile ? "100%" : "min(920px, 100%)",
              maxWidth: isMobile ? "100%" : "920px",
              maxHeight: isMobile ? "calc(100vh - 24px)" : "calc(100vh - 32px)",
              overflowY: "auto",
              background: "#ffffff",
              color: "#111111",
              borderRadius: isMobile ? "20px" : "24px",
              boxShadow: "0 18px 60px rgba(0, 0, 0, 0.24)",
              padding: isMobile ? "18px" : "24px",
              boxSizing: "border-box",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar guía"
              style={{
                position: "absolute",
                top: isMobile ? "12px" : "16px",
                right: isMobile ? "12px" : "16px",
                width: "42px",
                height: "42px",
                border: "none",
                borderRadius: "12px",
                background: "#f4f4f5",
                color: "#111111",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ✕
            </button>

            <div
              style={{
                textAlign: "center",
                paddingTop: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 14px",
                  borderRadius: "999px",
                  background: "rgba(220, 38, 38, 0.1)",
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                GUÍA INTERACTIVA DE COMPRA
              </div>

              <h2
                id="purchase-guide-title"
                style={{
                  margin: 0,
                  fontSize: "clamp(24px, 4vw, 34px)",
                  lineHeight: 1.05,
                }}
              >
                Aprende a comprar paso a paso
              </h2>

              <p
                style={{
                  margin: "12px auto 0",
                  maxWidth: "700px",
                  color: "#4b5563",
                }}
              >
                Sigue esta guía para completar tu compra correctamente, evitar errores
                y verificar tus tickets después.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
                marginBottom: "20px",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <GuideButton onClick={() => irASeccion("boletos")} dark>
                Ir a boletos
              </GuideButton>

              <GuideButton onClick={() => irASeccion("pagos")} dark>
                Ir a pagos
              </GuideButton>

              <GuideButton onClick={abrirVerificador} danger>
                Abrir verificador
              </GuideButton>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: "18px",
                padding: "18px",
                marginTop: "16px",
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
              }}
            >
              <div style={{ fontSize: "28px", flex: "0 0 auto" }}>🎯</div>
              <div>
                <h3 style={{ margin: "0 0 6px" }}>Objetivo</h3>
                <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
                  Queremos que completes tu compra bien desde el primer intento, con
                  los datos correctos y el método adecuado.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "14px",
                marginTop: "16px",
              }}
            >
              <Step
                number="1"
                title="Selecciona tus boletos"
                text="Elige la cantidad de tickets que deseas comprar. El total cambiará automáticamente según la cantidad seleccionada."
                buttonText="Ir ahora a boletos"
                onButtonClick={() => irASeccion("boletos")}
                isMobile={isMobile}
              />

              <Step
                number="2"
                title="Completa tus datos correctamente"
                text="Escribe tu nombre, email y teléfono sin errores. Esos datos se usarán para registrar la compra y luego verificar tus tickets."
                isMobile={isMobile}
              />

              <Step
                number="3"
                title="Escoge tu método de pago"
                text="Selecciona el método disponible que prefieras y revisa bien la cuenta, correo o identificador antes de realizar el pago."
                buttonText="Ver métodos de pago"
                onButtonClick={() => irASeccion("pagos")}
                isMobile={isMobile}
              />

              <Step
                number="4"
                title="Paga el monto exacto"
                text="Debes pagar exactamente el total indicado. Si el monto no coincide, la validación puede demorarse o fallar."
                isMobile={isMobile}
              />

              <Step
                number="5"
                title="Sube tu comprobante si el pago es manual"
                text="Adjunta una imagen clara o PDF del comprobante. Eso ayudará a que tu compra sea revisada más rápido."
                isMobile={isMobile}
              />

              <Step
                number="6"
                title="Confirma la compra"
                text="Cuando verifiques que todo está correcto, presiona confirmar. Tu compra quedará registrada como pendiente."
                isMobile={isMobile}
              />

              <Step
                number="7"
                title="Si usas App Pay"
                text="El pago se realiza únicamente desde el botón negro de Apple Pay dentro de la sección del método. El botón rojo inferior no procesa App Pay."
                special
                isMobile={isMobile}
              />

              <Step
                number="8"
                title="Verifica tus tickets"
                text="Después de la aprobación, usa el verificador con tu correo para consultar tus números asignados."
                buttonText="Abrir verificador"
                onButtonClick={abrirVerificador}
                isMobile={isMobile}
              />
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: "18px",
                padding: "18px",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <span>⚠</span>
                <h3 style={{ margin: 0 }}>Errores comunes que debes evitar</h3>
              </div>

              <ul style={{ margin: 0, paddingLeft: "20px", color: "#4b5563" }}>
                <li>Escribir mal tu correo electrónico.</li>
                <li>Pagar un monto diferente al mostrado.</li>
                <li>Subir una captura borrosa o incompleta.</li>
                <li>Colocar una referencia incorrecta.</li>
                <li>Intentar completar App Pay desde el botón rojo inferior.</li>
              </ul>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: "18px",
                padding: "18px",
                marginTop: "16px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 14px", color: "#4b5563" }}>
                Si sigues estos pasos correctamente, tu compra será mucho más rápida de validar.
              </p>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  borderRadius: "14px",
                  padding: "12px 18px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: "#dc2626",
                  color: "#fff",
                  minWidth: "160px",
                }}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {buttonPortal}
      {modalPortal}
    </>
  );
}

function GuideButton({ children, onClick, dark = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: "14px",
        padding: "12px 18px",
        fontWeight: 700,
        cursor: "pointer",
        background: danger ? "#dc2626" : dark ? "#111827" : "rgba(220, 38, 38, 0.1)",
        color: danger || dark ? "#fff" : "#dc2626",
        width: "100%",
        maxWidth: "320px",
      }}
    >
      {children}
    </button>
  );
}

function Step({
  number,
  title,
  text,
  buttonText,
  onButtonClick,
  special = false,
  isMobile = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        background: special ? "rgba(220, 38, 38, 0.04)" : "#fff",
        border: special ? "1px solid rgba(220, 38, 38, 0.35)" : "1px solid #e5e7eb",
        borderRadius: "18px",
        padding: "16px",
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          background: "#111827",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          flex: "0 0 auto",
        }}
      >
        {number}
      </div>

      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: "18px" }}>{title}</h3>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>{text}</p>

        {buttonText && onButtonClick && (
          <button
            type="button"
            onClick={onButtonClick}
            style={{
              marginTop: "10px",
              border: "none",
              borderRadius: "14px",
              padding: "12px 18px",
              fontWeight: 700,
              cursor: "pointer",
              background: special ? "#dc2626" : "rgba(220, 38, 38, 0.1)",
              color: special ? "#fff" : "#dc2626",
            }}
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
}