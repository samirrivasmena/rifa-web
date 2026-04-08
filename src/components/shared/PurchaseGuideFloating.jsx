"use client";

import { useEffect, useState } from "react";

export default function PurchaseGuideFloating({ onOpenVerifier }) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

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

    const isMobile = window.innerWidth <= 768;

    let offset = 100;

    if (id === "boletos") {
      offset = isMobile ? 88 : 120;
    } else if (id === "pagos") {
      offset = isMobile ? 88 : 120;
    } else {
      offset = isMobile ? 82 : 110;
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

  return (
    <>
      <button
        type="button"
        className="purchase-guide-float premium"
        onClick={() => setOpen(true)}
        aria-label="Abrir guía de compra"
      >
        <span className="purchase-guide-float-icon">?</span>
      </button>

      {open && (
        <div className="purchase-guide-overlay" onClick={() => setOpen(false)}>
          <div
            className="purchase-guide-modal premium"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-guide-title"
          >
            <button
              type="button"
              className="purchase-guide-close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar guía"
            >
              ✕
            </button>

            <div className="purchase-guide-header">
              <div className="purchase-guide-badge">GUÍA INTERACTIVA DE COMPRA</div>
              <h2 id="purchase-guide-title">Aprende a comprar paso a paso</h2>
              <p>
                Sigue esta guía para completar tu compra correctamente, evitar errores
                y verificar tus tickets después.
              </p>
            </div>

            <div className="purchase-guide-actions-top">
              <button
                type="button"
                className="purchase-guide-action-btn"
                onClick={() => irASeccion("boletos")}
              >
                Ir a boletos
              </button>

              <button
                type="button"
                className="purchase-guide-action-btn"
                onClick={() => irASeccion("pagos")}
              >
                Ir a pagos
              </button>

              <button
                type="button"
                className="purchase-guide-action-btn secondary"
                onClick={abrirVerificador}
              >
                Abrir verificador
              </button>
            </div>

            <div className="purchase-guide-highlight-box">
              <div className="purchase-guide-highlight-icon">🎯</div>
              <div>
                <h3>Objetivo</h3>
                <p>
                  Queremos que completes tu compra bien desde el primer intento, con
                  los datos correctos y el método adecuado.
                </p>
              </div>
            </div>

            <div className="purchase-guide-steps">
              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">1</div>
                <div>
                  <h3>Selecciona tus boletos</h3>
                  <p>
                    Elige la cantidad de tickets que deseas comprar. El total cambiará
                    automáticamente según la cantidad seleccionada.
                  </p>
                  <button
                    type="button"
                    className="purchase-guide-inline-btn"
                    onClick={() => irASeccion("boletos")}
                  >
                    Ir ahora a boletos
                  </button>
                </div>
              </div>

              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">2</div>
                <div>
                  <h3>Completa tus datos correctamente</h3>
                  <p>
                    Escribe tu nombre, email y teléfono sin errores. Esos datos se usarán
                    para registrar la compra y luego verificar tus tickets.
                  </p>
                </div>
              </div>

              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">3</div>
                <div>
                  <h3>Escoge tu método de pago</h3>
                  <p>
                    Selecciona el método disponible que prefieras y revisa bien la cuenta,
                    correo o identificador antes de realizar el pago.
                  </p>
                  <button
                    type="button"
                    className="purchase-guide-inline-btn"
                    onClick={() => irASeccion("pagos")}
                  >
                    Ver métodos de pago
                  </button>
                </div>
              </div>

              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">4</div>
                <div>
                  <h3>Paga el monto exacto</h3>
                  <p>
                    Debes pagar exactamente el total indicado. Si el monto no coincide,
                    la validación puede demorarse o fallar.
                  </p>
                </div>
              </div>

              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">5</div>
                <div>
                  <h3>Sube tu comprobante si el pago es manual</h3>
                  <p>
                    Adjunta una imagen clara o PDF del comprobante. Eso ayudará a que tu
                    compra sea revisada más rápido.
                  </p>
                </div>
              </div>

              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">6</div>
                <div>
                  <h3>Confirma la compra</h3>
                  <p>
                    Cuando verifiques que todo está correcto, presiona confirmar. Tu
                    compra quedará registrada como pendiente.
                  </p>
                </div>
              </div>

              <div className="purchase-guide-step special">
                <div className="purchase-guide-step-number">7</div>
                <div>
                  <h3>Si usas App Pay</h3>
                  <p>
                    El pago se realiza únicamente desde el botón negro de Apple Pay dentro
                    de la sección del método. El botón rojo inferior no procesa App Pay.
                  </p>
                </div>
              </div>

              <div className="purchase-guide-step">
                <div className="purchase-guide-step-number">8</div>
                <div>
                  <h3>Verifica tus tickets</h3>
                  <p>
                    Después de la aprobación, usa el verificador con tu correo para consultar
                    tus números asignados.
                  </p>
                  <button
                    type="button"
                    className="purchase-guide-inline-btn"
                    onClick={abrirVerificador}
                  >
                    Abrir verificador
                  </button>
                </div>
              </div>
            </div>

            <div className="purchase-guide-errors-box">
              <div className="purchase-guide-errors-head">
                <span>⚠</span>
                <h3>Errores comunes que debes evitar</h3>
              </div>

              <ul className="purchase-guide-errors-list">
                <li>Escribir mal tu correo electrónico.</li>
                <li>Pagar un monto diferente al mostrado.</li>
                <li>Subir una captura borrosa o incompleta.</li>
                <li>Colocar una referencia incorrecta.</li>
                <li>Intentar completar App Pay desde el botón rojo inferior.</li>
              </ul>
            </div>

            <div className="purchase-guide-footer">
              <p>
                Si sigues estos pasos correctamente, tu compra será mucho más rápida de validar.
              </p>

              <button
                type="button"
                className="purchase-guide-main-btn"
                onClick={() => setOpen(false)}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}