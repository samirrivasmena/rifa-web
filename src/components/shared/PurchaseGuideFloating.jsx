"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PurchaseGuideFloating({ onOpenVerifier }) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  /* =========================================================
     MONTAJE + RESPONSIVE
  ========================================================= */

  useEffect(() => {
    setMounted(true);

    const updateMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    updateMobile();

    window.addEventListener("resize", updateMobile);

    return () => {
      window.removeEventListener("resize", updateMobile);
    };
  }, []);

  /* =========================================================
     CERRAR CON ESCAPE
  ========================================================= */

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPendingAction(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  /* =========================================================
     BLOQUEAR SCROLL DE LA PÁGINA
  ========================================================= */

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

  /* =========================================================
     EJECUTAR ACCIÓN DESPUÉS DE CERRAR MODAL
  ========================================================= */

  useEffect(() => {
    if (!open && pendingAction) {
      const timer = setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 220);

      return () => clearTimeout(timer);
    }
  }, [open, pendingAction]);

  /* =========================================================
     SCROLL A SECCIONES
  ========================================================= */

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

    const top =
      section.getBoundingClientRect().top +
      window.scrollY -
      offset;

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

  /* =========================================================
     ABRIR VERIFICADOR
  ========================================================= */

const abrirVerificador = () => {
  // Primero cerramos la guía
  setOpen(false);
  setPendingAction(null);

  // Después abrimos el verificador
  setTimeout(() => {
    if (typeof onOpenVerifier === "function") {
      onOpenVerifier();
    }
  }, 250);
};

  /* =========================================================
     BOTÓN FLOTANTE
  ========================================================= */

  const buttonPortal = mounted
    ? createPortal(
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir guía de compra"
          title="¿Cómo comprar?"
          style={{
            position: "fixed",
            left: isMobile ? "12px" : "16px",
            bottom: isMobile ? "14px" : "16px",
            zIndex: 2147483646,

            width: isMobile ? "50px" : "54px",
            height: isMobile ? "50px" : "54px",

            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "50%",

            background: "#111827",
            color: "#ffffff",

            boxShadow:
              "0 10px 28px rgba(0, 0, 0, 0.26)",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            ?
          </span>
        </button>,
        document.body
      )
    : null;

  /* =========================================================
     MODAL
  ========================================================= */

  const modalPortal =
    mounted && open
      ? createPortal(
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647,

              background: "rgba(15, 23, 42, 0.38)",

              backdropFilter: "blur(9px)",
              WebkitBackdropFilter: "blur(9px)",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              padding: isMobile ? "10px" : "18px",

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

                width: isMobile
                  ? "100%"
                  : "min(820px, 100%)",

                maxWidth: isMobile
                  ? "100%"
                  : "820px",

                maxHeight: isMobile
                  ? "calc(100vh - 20px)"
                  : "calc(100vh - 36px)",

                overflowY: "auto",
                overscrollBehavior: "contain",

                background: "#ffffff",
                color: "#111827",

                borderRadius: isMobile
                  ? "20px"
                  : "24px",

                boxShadow:
                  "0 24px 80px rgba(15, 23, 42, 0.28)",

                padding: isMobile
                  ? "18px 14px"
                  : "26px",

                boxSizing: "border-box",
              }}
            >
              {/* =================================================
                  CERRAR
              ================================================= */}

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar guía"
                style={{
                  position: "absolute",

                  top: isMobile ? "10px" : "14px",
                  right: isMobile ? "10px" : "14px",

                  width: isMobile ? "38px" : "42px",
                  height: isMobile ? "38px" : "42px",

                  border: "none",
                  borderRadius: "12px",

                  background: "#f3f4f6",
                  color: "#111827",

                  cursor: "pointer",

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  fontSize: "17px",
                  fontWeight: 800,

                  zIndex: 5,
                }}
              >
                ✕
              </button>

              {/* =================================================
                  ENCABEZADO
              ================================================= */}

              <div
                style={{
                  textAlign: "center",

                  paddingTop: isMobile
                    ? "20px"
                    : "10px",

                  marginBottom: isMobile
                    ? "18px"
                    : "22px",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",

                    padding: "7px 12px",

                    borderRadius: "999px",

                    background:
                      "rgba(220, 38, 38, 0.08)",

                    color: "#dc2626",

                    fontWeight: 900,
                    fontSize: "10px",

                    letterSpacing: "0.5px",

                    marginBottom: "10px",
                  }}
                >
                  GUÍA DE COMPRA
                </div>

                <h2
                  id="purchase-guide-title"
                  style={{
                    margin: 0,

                    fontSize: isMobile
                      ? "25px"
                      : "32px",

                    lineHeight: 1.08,

                    fontWeight: 900,

                    color: "#111827",
                  }}
                >
                  ¿Cómo comprar?
                </h2>

                <p
                  style={{
                    margin: "9px auto 0",

                    maxWidth: "570px",

                    color: "#6b7280",

                    fontSize: isMobile
                      ? "13px"
                      : "14px",

                    lineHeight: 1.45,
                  }}
                >
                  Completa tu compra en pocos pasos.
                  Te mostramos qué hacer desde elegir
                  tus tickets hasta verificarlos.
                </p>
              </div>

              {/* =================================================
                  ACCESOS RÁPIDOS
              ================================================= */}

              <div
                style={{
                  display: "grid",

                  gridTemplateColumns: isMobile
                    ? "repeat(3, 1fr)"
                    : "repeat(3, 1fr)",

                  gap: isMobile ? "7px" : "10px",

                  marginBottom: "18px",
                }}
              >
                <QuickAction
                  icon="🎟️"
                  title="Tickets"
                  subtitle={
                    isMobile ? null : "Elegir boletos"
                  }
                  onClick={() =>
                    irASeccion("boletos")
                  }
                  isMobile={isMobile}
                />

                <QuickAction
                  icon="💳"
                  title="Pagar"
                  subtitle={
                    isMobile ? null : "Ver métodos"
                  }
                  onClick={() =>
                    irASeccion("pagos")
                  }
                  isMobile={isMobile}
                />

                <QuickAction
                  icon="🔎"
                  title="Verificar"
                  subtitle={
                    isMobile ? null : "Ver tickets"
                  }
                  onClick={abrirVerificador}
                  isMobile={isMobile}
                  danger
                />
              </div>

              {/* =================================================
                  MENSAJE PRINCIPAL
              ================================================= */}

              <div
                style={{
                  display: "flex",

                  alignItems: "center",

                  gap: "11px",

                  padding: isMobile
                    ? "12px"
                    : "14px 16px",

                  marginBottom: "12px",

                  borderRadius: "16px",

                  background: "#f8fafc",

                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",

                    flex: "0 0 auto",

                    borderRadius: "50%",

                    display: "grid",
                    placeItems: "center",

                    background: "#ffffff",

                    border: "1px solid #e5e7eb",

                    fontSize: "18px",
                  }}
                >
                  🎯
                </div>

                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <strong
                    style={{
                      display: "block",

                      fontSize: "13px",

                      marginBottom: "2px",

                      color: "#111827",
                    }}
                  >
                    Compra fácil y sin errores
                  </strong>

                  <span
                    style={{
                      display: "block",

                      color: "#6b7280",

                      fontSize: "12px",

                      lineHeight: 1.4,
                    }}
                  >
                    Revisa tus datos y el monto antes
                    de confirmar.
                  </span>
                </div>
              </div>

              {/* =================================================
                  PASOS
              ================================================= */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",

                  gap: "9px",
                }}
              >
                <Step
                  number="1"
                  icon="🎟️"
                  title="Elige tus tickets"
                  text="Selecciona la cantidad que deseas comprar. El total se actualizará automáticamente."
                  buttonText="Ir a tickets"
                  onButtonClick={() =>
                    irASeccion("boletos")
                  }
                  isMobile={isMobile}
                />

                <Step
                  number="2"
                  icon="👤"
                  title="Completa tus datos"
                  text="Escribe correctamente tu nombre, email y teléfono. Los necesitarás para registrar y verificar tu compra."
                  isMobile={isMobile}
                />

                <Step
                  number="3"
                  icon="💳"
                  title="Elige cómo pagar"
                  text="Selecciona el método de pago que prefieras y revisa cuidadosamente los datos antes de enviar el dinero."
                  buttonText="Ver métodos"
                  onButtonClick={() =>
                    irASeccion("pagos")
                  }
                  isMobile={isMobile}
                />

                <Step
                  number="4"
                  icon="💵"
                  title="Realiza el pago"
                  text="Paga exactamente el total indicado. Si utilizas un método manual, adjunta un comprobante claro."
                  isMobile={isMobile}
                >
                  <div
                    style={{
                      marginTop: "9px",

                      padding: "9px 11px",

                      borderRadius: "11px",

                      background:
                        "rgba(220, 38, 38, 0.05)",

                      border:
                        "1px solid rgba(220, 38, 38, 0.16)",

                      color: "#7f1d1d",

                      fontSize: "11px",

                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Apple Pay:</strong>{" "}
                    realiza el pago únicamente desde
                    el botón negro de Apple Pay dentro
                    del método seleccionado. El botón
                    rojo inferior no procesa Apple Pay.
                  </div>
                </Step>

                <Step
                  number="5"
                  icon="✓"
                  title="Confirma tu compra"
                  text="Comprueba que tus datos y el pago estén correctos y presiona confirmar para registrar tu compra."
                  isMobile={isMobile}
                />

                <Step
                  number="6"
                  icon="🔎"
                  title="Verifica tus tickets"
                  text="Después de la aprobación, usa tu correo en el verificador para consultar los números que te fueron asignados."
                  buttonText="Abrir verificador"
                  onButtonClick={abrirVerificador}
                  isMobile={isMobile}
                  last
                />
              </div>

              {/* =================================================
                  ERRORES IMPORTANTES
              ================================================= */}

              <div
                style={{
                  marginTop: "14px",

                  padding: isMobile
                    ? "13px"
                    : "15px 16px",

                  borderRadius: "16px",

                  background: "#fff7f7",

                  border:
                    "1px solid rgba(220, 38, 38, 0.16)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",

                    gap: "8px",

                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                    }}
                  >
                    ⚠️
                  </span>

                  <strong
                    style={{
                      color: "#991b1b",

                      fontSize: "13px",
                    }}
                  >
                    Antes de confirmar
                  </strong>
                </div>

                <div
                  style={{
                    display: "grid",

                    gridTemplateColumns: isMobile
                      ? "1fr"
                      : "1fr 1fr",

                    gap: "5px 14px",

                    color: "#6b7280",

                    fontSize: "11px",

                    lineHeight: 1.4,
                  }}
                >
                  <span>
                    • Verifica bien tu correo.
                  </span>

                  <span>
                    • Paga el monto exacto.
                  </span>

                  <span>
                    • Usa un comprobante legible.
                  </span>

                  <span>
                    • Revisa la referencia del pago.
                  </span>
                </div>
              </div>

              {/* =================================================
                  FINAL
              ================================================= */}

              <div
                style={{
                  marginTop: "16px",

                  display: "flex",

                  flexDirection: isMobile
                    ? "column"
                    : "row",

                  alignItems: "center",

                  justifyContent: "space-between",

                  gap: "12px",

                  paddingTop: "15px",

                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <p
                  style={{
                    margin: 0,

                    color: "#6b7280",

                    fontSize: "12px",

                    lineHeight: 1.4,

                    textAlign: isMobile
                      ? "center"
                      : "left",
                  }}
                >
                  ¿Listo? Elige tus tickets y comienza
                  tu compra.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    irASeccion("boletos")
                  }
                  style={{
                    width: isMobile
                      ? "100%"
                      : "auto",

                    minWidth: isMobile
                      ? "auto"
                      : "180px",

                    border: "none",

                    borderRadius: "13px",

                    padding: "12px 18px",

                    background: "#dc2626",

                    color: "#ffffff",

                    fontSize: "12px",

                    fontWeight: 900,

                    cursor: "pointer",

                    boxShadow:
                      "0 7px 18px rgba(220, 38, 38, 0.18)",
                  }}
                >
                  COMPRAR TICKETS →
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

/* =========================================================
   ACCESO RÁPIDO
========================================================= */

function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
  isMobile = false,
  danger = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 0,

        border: danger
          ? "1px solid rgba(220, 38, 38, 0.18)"
          : "1px solid #e5e7eb",

        borderRadius: isMobile
          ? "13px"
          : "15px",

        padding: isMobile
          ? "10px 5px"
          : "11px 12px",

        background: danger
          ? "rgba(220, 38, 38, 0.04)"
          : "#ffffff",

        cursor: "pointer",

        display: "flex",

        flexDirection: isMobile
          ? "column"
          : "row",

        alignItems: "center",

        justifyContent: "center",

        gap: isMobile ? "4px" : "8px",

        color: "#111827",
      }}
    >
      <span
        style={{
          fontSize: isMobile
            ? "17px"
            : "18px",

          lineHeight: 1,
        }}
      >
        {icon}
      </span>

      <span
        style={{
          minWidth: 0,

          textAlign: isMobile
            ? "center"
            : "left",
        }}
      >
        <strong
          style={{
            display: "block",

            fontSize: isMobile
              ? "10px"
              : "12px",

            lineHeight: 1.2,

            whiteSpace: "nowrap",
          }}
        >
          {title}
        </strong>

        {subtitle && (
          <small
            style={{
              display: "block",

              marginTop: "2px",

              color: "#9ca3af",

              fontSize: "9px",

              lineHeight: 1.2,
            }}
          >
            {subtitle}
          </small>
        )}
      </span>
    </button>
  );
}

/* =========================================================
   PASO
========================================================= */

function Step({
  number,
  icon,
  title,
  text,
  buttonText,
  onButtonClick,
  isMobile = false,
  children,
  last = false,
}) {
  return (
    <div
      style={{
        display: "flex",

        gap: isMobile
          ? "10px"
          : "12px",

        alignItems: "flex-start",

        background: last
          ? "rgba(220, 38, 38, 0.025)"
          : "#ffffff",

        border: last
          ? "1px solid rgba(220, 38, 38, 0.16)"
          : "1px solid #e5e7eb",

        borderRadius: "15px",

        padding: isMobile
          ? "12px"
          : "13px 14px",

        boxSizing: "border-box",
      }}
    >
      {/* NÚMERO */}

      <div
        style={{
          position: "relative",

          width: isMobile
            ? "34px"
            : "36px",

          height: isMobile
            ? "34px"
            : "36px",

          borderRadius: "50%",

          background: "#111827",

          color: "#ffffff",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          fontWeight: 900,

          fontSize: "12px",

          flex: "0 0 auto",
        }}
      >
        {number}
      </div>

      {/* CONTENIDO */}

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",

            alignItems: "center",

            gap: "6px",

            marginBottom: "3px",
          }}
        >
          <span
            style={{
              fontSize: "13px",

              lineHeight: 1,
            }}
          >
            {icon}
          </span>

          <h3
            style={{
              margin: 0,

              color: "#111827",

              fontSize: isMobile
                ? "13px"
                : "14px",

              lineHeight: 1.25,

              fontWeight: 900,
            }}
          >
            {title}
          </h3>
        </div>

        <p
          style={{
            margin: 0,

            color: "#6b7280",

            fontSize: isMobile
              ? "11px"
              : "12px",

            lineHeight: 1.45,
          }}
        >
          {text}
        </p>

        {children}

        {buttonText && onButtonClick && (
          <button
            type="button"
            onClick={onButtonClick}
            style={{
              marginTop: "8px",

              border: "none",

              borderRadius: "10px",

              padding: "8px 11px",

              background:
                "rgba(220, 38, 38, 0.08)",

              color: "#dc2626",

              fontSize: "10px",

              fontWeight: 900,

              cursor: "pointer",
            }}
          >
            {buttonText} →
          </button>
        )}
      </div>
    </div>
  );
}