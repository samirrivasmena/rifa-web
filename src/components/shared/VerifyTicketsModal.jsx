"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import modalStyles from "./VerifyTicketsModal.module.css";

import {
  validarEmail,
  verificarTicketsPorEmail,
  verificarFreeCode,
  solicitarCodigoMisTickets,
  verificarMisTickets,
} from "@/lib/verificaciones";

function formatearFechaSegura(valor) {
  if (!valor) return "Sin fecha";

  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return String(valor);
  }

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

function obtenerPadLength(rifa) {
  return String(rifa?.formato || "").toLowerCase() === "3digitos"
    ? 3
    : 4;
}

function formatearNumeroTicket(numero, padLength = 4) {
  if (
    numero === null ||
    numero === undefined ||
    numero === ""
  ) {
    return "Sin número";
  }

  return String(numero).padStart(padLength, "0");
}

function obtenerEstadoEvento(rifa) {
  const estado = String(rifa?.estado || "")
    .trim()
    .toLowerCase();

  if (
    ["finalizada", "finalizado", "cerrada", "cerrado"].includes(
      estado
    )
  ) {
    return "Finalizado";
  }

  if (["agotada", "agotado"].includes(estado)) {
    return "Agotado";
  }

  if (
    ["activa", "activo", "disponible", "publicada"].includes(
      estado
    )
  ) {
    return "Activo";
  }

  return rifa?.estado || "Evento";
}

function obtenerColorEstadoEvento(estado) {
  const valor = String(estado || "").trim().toLowerCase();

  if (valor === "activo") {
    return {
      fondo: "#052e16",
      borde: "#166534",
      texto: "#86efac",
      punto: "#22c55e",
    };
  }

  if (valor === "finalizado") {
    return {
      fondo: "#27272a",
      borde: "#52525b",
      texto: "#d4d4d8",
      punto: "#a1a1aa",
    };
  }

  if (valor === "agotado") {
    return {
      fondo: "#431407",
      borde: "#9a3412",
      texto: "#fdba74",
      punto: "#f97316",
    };
  }

  return {
    fondo: "#172554",
    borde: "#1d4ed8",
    texto: "#93c5fd",
    punto: "#3b82f6",
  };
}
function TurnstileWidget({ onToken }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      console.warn(
        "Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY"
      );
      return;
    }

    let cancelled = false;
    let intentos = 0;
    let timerId = null;

    const limpiarWidget = () => {
      const widgetId = widgetIdRef.current;

      if (
        widgetId !== null &&
        widgetId !== undefined &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(widgetId);
        } catch (error) {
          console.warn(
            "No se pudo limpiar Turnstile:",
            error
          );
        }
      }

      widgetIdRef.current = null;

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };

    const renderWidget = () => {
      if (
        cancelled ||
        !containerRef.current ||
        !window.turnstile
      ) {
        return false;
      }

      limpiarWidget();

      if (
        cancelled ||
        !containerRef.current
      ) {
        return false;
      }

      try {
        const widgetId =
          window.turnstile.render(
            containerRef.current,
            {
              sitekey: siteKey,

              callback: (token) => {
                if (!cancelled) {
                  onToken(token);
                }
              },

              "expired-callback": () => {
                if (!cancelled) {
                  onToken("");
                }
              },

              "error-callback": () => {
                if (!cancelled) {
                  onToken("");
                }
              },
            }
          );

        widgetIdRef.current = widgetId;

        return true;
      } catch (error) {
        console.error(
          "No se pudo renderizar Turnstile:",
          error
        );

        if (!cancelled) {
          onToken("");
        }

        return false;
      }
    };

    const esperarTurnstile = () => {
      if (cancelled) return;

      if (
        window.turnstile &&
        containerRef.current
      ) {
        renderWidget();
        return;
      }

      intentos += 1;

      if (intentos >= 100) {
        console.error(
          "Cloudflare Turnstile no estuvo disponible después de esperar."
        );

        if (!cancelled) {
          onToken("");
        }

        return;
      }

      timerId = window.setTimeout(
        esperarTurnstile,
        100
      );
    };

    if (window.turnstile) {
      renderWidget();

      return () => {
        cancelled = true;

        if (timerId) {
          window.clearTimeout(timerId);
        }

        limpiarWidget();
      };
    }

    let script = document.querySelector(
      'script[data-turnstile="true"]'
    );

    if (!script) {
      script = document.createElement("script");

      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

      script.async = true;
      script.defer = true;

      script.dataset.turnstile = "true";

      document.head.appendChild(script);
    }

    esperarTurnstile();

    return () => {
      cancelled = true;

      if (timerId) {
        window.clearTimeout(timerId);
      }

      limpiarWidget();
    };
  }, [onToken]);

  return (
    <div
      className="turnstile-wrap"
      ref={containerRef}
    />
  );
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
  void modalStyles;

  const [loading, setLoading] = useState(false);

  // historial | tickets | free
  const [modo, setModo] = useState(initialMode);

  const [codigoFree, setCodigoFree] =
    useState(initialFreeCode);

  const [codigoMisTickets, setCodigoMisTickets] =
    useState("");

  const [codigoEnviado, setCodigoEnviado] =
    useState(false);

  const [
    emailCodigoEnviado,
    setEmailCodigoEnviado,
  ] = useState("");

  const [reenviarEn, setReenviarEn] = useState(0);

  const [
  misTicketsCaptchaToken,
  setMisTicketsCaptchaToken,
] = useState("");

const [
  misTicketsCaptchaResetKey,
  setMisTicketsCaptchaResetKey,
] = useState(0);

  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === "Escape" && !loading) {
        setEmail("");
        setCodigoFree("");
        setModo(initialMode || "tickets");
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
  }, [
    open,
    loading,
    onClose,
    setEmail,
    initialMode,
  ]);

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
    setCodigoMisTickets("");
    setCodigoEnviado(false);
    setEmailCodigoEnviado("");
    setReenviarEn(0);
    setMisTicketsCaptchaToken("");
setMisTicketsCaptchaResetKey(
  (actual) => actual + 1
);
  }, [open, initialMode, initialFreeCode]);

  useEffect(() => {
    if (!open || reenviarEn <= 0) return;

    const timer = window.setInterval(() => {
      setReenviarEn((actual) =>
        actual > 0 ? actual - 1 : 0
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, reenviarEn]);

  if (!open) return null;

  const swalConfig = {
    background: "#1f1f1f",
    color: "#fff",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    target: document.body,

    didOpen: () => {
      const container = Swal.getContainer();

      if (container) {
        document.body.appendChild(container);

        container.style.setProperty(
          "z-index",
          "2147483647",
          "important"
        );

        container.style.setProperty(
          "position",
          "fixed",
          "important"
        );
      }

      const popup = Swal.getPopup();

      if (popup) {
        popup.style.setProperty(
          "z-index",
          "2147483647",
          "important"
        );
      }
    },
  };

const limpiarYcerrar = () => {
  setEmail("");
  setCodigoFree("");
  setCodigoMisTickets("");
  setCodigoEnviado(false);
  setEmailCodigoEnviado("");
  setReenviarEn(0);

  setMisTicketsCaptchaToken("");
  setMisTicketsCaptchaResetKey(
    (actual) => actual + 1
  );

  setModo(initialMode || "tickets");
  onClose?.();
};

  const cerrarModal = () => {
    if (loading) return;

    limpiarYcerrar();
  };

  /* =========================================================
     MIS TICKETS
  ========================================================= */

  const handleMisTickets = async () => {
    try {
      setLoading(true);

      const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();

      if (!cleanEmail) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Email requerido",
          text: "Ingresa tu correo para consultar tus tickets.",
        });

        return;
      }

      if (!validarEmail(cleanEmail)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Email inválido",
          text: "Ingresa un correo electrónico válido.",
        });

        return;
      }

      /* =====================================================
         PASO 1 — SOLICITAR CÓDIGO
      ===================================================== */

if (!codigoEnviado) {
  if (!misTicketsCaptchaToken) {
    await Swal.fire({
      ...swalConfig,
      icon: "warning",
      title: "Verificación requerida",
      text: "Completa la verificación de seguridad antes de solicitar el código.",
    });

    return;
  }

const solicitud =
  await solicitarCodigoMisTickets(
    cleanEmail,
    misTicketsCaptchaToken
  );

// El token de Turnstile es de un solo uso.
// Lo limpiamos y preparamos un CAPTCHA nuevo.
setMisTicketsCaptchaToken("");
setMisTicketsCaptchaResetKey(
  (actual) => actual + 1
);

const solicitudData = solicitud.data || {};

        if (!solicitud.ok) {
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "No se pudo enviar el código",
            text:
              solicitudData.error ||
              "No se pudo enviar el código de verificación.",
          });

          return;
        }

        setEmailCodigoEnviado(cleanEmail);
        setCodigoMisTickets("");
        setCodigoEnviado(true);
        setReenviarEn(60);

        await Swal.fire({
          ...swalConfig,
          icon: "success",
          title: "Código enviado",
          text:
            solicitudData.mensaje ||
            "Si el correo está asociado a participaciones, recibirás un código de 6 dígitos.",
          confirmButtonText: "Continuar",
        });

        return;
      }

      /* =====================================================
         PASO 2 — VERIFICAR CÓDIGO
      ===================================================== */

      const codigoLimpio = String(
        codigoMisTickets || ""
      )
        .replace(/\D/g, "")
        .slice(0, 6);

      if (!/^\d{6}$/.test(codigoLimpio)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Código requerido",
          text: "Ingresa el código de 6 dígitos que enviamos a tu correo.",
        });

        return;
      }

      const response = await verificarMisTickets(
        emailCodigoEnviado || cleanEmail,
        codigoLimpio
      );

      const data = response.data || {};

      if (!response.ok) {
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "No se pudo consultar",
          text:
            data.error ||
            "No se pudo cargar tu historial de tickets.",
        });

        return;
      }

      if (!data.encontrado) {
        await Swal.fire({
          ...swalConfig,
          icon: "info",
          title: "Sin participaciones",
          text:
            data.mensaje ||
            "No encontramos participaciones asociadas con este correo.",
        });

        return;
      }

      const eventos = Array.isArray(data.eventos)
        ? data.eventos
        : [];

      if (eventos.length === 0) {
        await Swal.fire({
          ...swalConfig,
          icon: "info",
          title: "Sin participaciones",
          text:
            "No encontramos tickets aprobados ni participaciones FREE asociadas con este correo.",
        });

        return;
      }

      const nombreUsuario =
        data?.usuario?.nombre ||
        cleanEmail;

      const totalParticipaciones =
        Number(data?.total || 0);

      /* =====================================================
         CONSTRUIR HISTORIAL POR EVENTO
      ===================================================== */

      const eventosHtml = eventos
        .map((evento, index) => {
          const rifa =
            evento?.rifa || {};

          const ticketsPagados = Array.isArray(
            evento?.ticketsPagados
          )
            ? evento.ticketsPagados
            : [];

          const ticketsFree = Array.isArray(
            evento?.ticketsFree
          )
            ? evento.ticketsFree
            : [];

          const padLength =
            obtenerPadLength(rifa);

          const numerosPagados =
            ticketsPagados
              .filter(
                (ticket) =>
                  ticket?.numero_ticket !== null &&
                  ticket?.numero_ticket !== undefined
              )
              .sort(
                (a, b) =>
                  Number(a.numero_ticket) -
                  Number(b.numero_ticket)
              );

          const nombreRifa =
            rifa?.nombre ||
            `Evento ${index + 1}`;

          const estadoEvento =
            obtenerEstadoEvento(rifa);

          const colorEstado =
            obtenerColorEstadoEvento(
              estadoEvento
            );

          /* =================================================
             TICKETS PAGADOS
          ================================================= */

          let pagadosHtml = "";

          if (numerosPagados.length > 0) {
            const chips = numerosPagados
              .map((ticket) => {
                const numero =
                  formatearNumeroTicket(
                    ticket.numero_ticket,
                    padLength
                  );

                /*
                 * ÚNICO CAMBIO VISUAL:
                 * si el backend confirma que este ticket
                 * es ganador, lo mostramos dorado.
                 */
                if (ticket?.es_ganador === true) {
                  return `<span style="display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:58px;padding:6px 8px;border-radius:8px;background:linear-gradient(135deg,#78350f,#a16207);border:1px solid #facc15;box-shadow:0 0 12px rgba(250,204,21,.18);font-size:12px;font-weight:900;letter-spacing:.35px;color:#fef3c7;">🏆 #${escaparHtml(
                    numero
                  )} <span style="font-size:9px;color:#fde68a;">GANADOR</span></span>`;
                }

                /*
                 * Ticket normal:
                 * se conserva exactamente el diseño anterior.
                 */
                return `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:58px;padding:6px 8px;border-radius:8px;background:#172033;border:1px solid #334b72;font-size:12px;font-weight:800;letter-spacing:.35px;color:#dbeafe;">#${escaparHtml(
                  numero
                )}</span>`;
              })
              .join("");

            pagadosHtml = `
              <div style="margin-top:10px;padding:10px;border-radius:12px;background:#18181b;border:1px solid #303036;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                  <strong style="font-size:13px;color:#93c5fd;">🎟️ Tickets pagados</strong>
                  <span style="padding:3px 8px;border-radius:999px;background:#27272a;font-size:11px;font-weight:800;">${numerosPagados.length}</span>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${chips}
                </div>
              </div>`;
          }

          /* =================================================
             FREE DROP
          ================================================= */

          let freeHtml = "";

          if (ticketsFree.length > 0) {
            const freeCards = ticketsFree
              .map((free) => {
                const numero =
                  free?.numero_oficial ||
                  formatearNumeroTicket(
                    free?.numero_ticket,
                    padLength
                  );

                const codigo =
                  free?.codigo ||
                  "Sin código";

                const estado =
                  free?.estado ||
                  "Sin estado";

                const nombreDrop =
                  free?.free_drop ||
                  "FREE DROP";

                const fecha =
                  formatearFechaSegura(
                    free?.fecha
                  );

                /*
                 * Si el backend confirma que el FREE
                 * tiene el número ganador, solamente
                 * esta tarjeta cambia a dorado.
                 */
                if (free?.es_ganador === true) {
                  return `
                    <div style="padding:9px 10px;border-radius:10px;background:linear-gradient(135deg,#3f2b05,#713f12);border:1px solid #facc15;box-shadow:0 0 12px rgba(250,204,21,.18);">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                        <strong style="font-size:14px;color:#fef3c7;">
                          🏆 #${escaparHtml(numero)}
                          <span style="font-size:9px;color:#fde68a;">GANADOR</span>
                        </strong>

                        <span style="padding:3px 7px;border-radius:999px;background:#10261a;border:1px solid #245c38;color:#86efac;font-size:10px;font-weight:700;">${escaparHtml(
                          estado
                        )}</span>
                      </div>

                      <div style="margin-top:5px;font-size:11px;line-height:1.55;color:#d4d4d8;">
                        <strong>${escaparHtml(
                          nombreDrop
                        )}</strong> · ${escaparHtml(
                          codigo
                        )}<br/>

                        <span style="opacity:.72;">${escaparHtml(
                          fecha
                        )}</span>
                      </div>
                    </div>`;
                }

                /*
                 * FREE normal:
                 * diseño original sin cambios.
                 */
                return `
                  <div style="padding:9px 10px;border-radius:10px;background:#202024;border:1px solid #34343a;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                      <strong style="font-size:14px;color:#fff;">#${escaparHtml(
                        numero
                      )}</strong>

                      <span style="padding:3px 7px;border-radius:999px;background:#10261a;border:1px solid #245c38;color:#86efac;font-size:10px;font-weight:700;">${escaparHtml(
                        estado
                      )}</span>
                    </div>

                    <div style="margin-top:5px;font-size:11px;line-height:1.55;color:#d4d4d8;">
                      <strong>${escaparHtml(
                        nombreDrop
                      )}</strong> · ${escaparHtml(
                        codigo
                      )}<br/>

                      <span style="opacity:.72;">${escaparHtml(
                        fecha
                      )}</span>
                    </div>
                  </div>`;
              })
              .join("");

            freeHtml = `
              <div style="margin-top:10px;padding:10px;border-radius:12px;background:#18181b;border:1px solid #303036;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                  <strong style="font-size:13px;color:#c4b5fd;">🎁 FREE DROP</strong>
                  <span style="padding:3px 8px;border-radius:999px;background:#27272a;font-size:11px;font-weight:800;">${ticketsFree.length}</span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px;">
                  ${freeCards}
                </div>
              </div>`;
          }

          const totalEvento =
            numerosPagados.length +
            ticketsFree.length;

          return `
            <div style="margin-top:10px;padding:12px;border-radius:14px;background:#111113;border:1px solid #34343a;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <div style="min-width:0;">
                  <div style="font-size:9px;font-weight:800;letter-spacing:1px;color:#71717a;margin-bottom:2px;">
                    EVENTO
                  </div>

                  <strong style="display:block;font-size:15px;line-height:1.25;color:#fff;">
                    🏆 ${escaparHtml(nombreRifa)}
                  </strong>

                  <span style="display:block;margin-top:3px;font-size:10px;color:#a1a1aa;">
                    ${totalEvento} participación${
                      totalEvento === 1
                        ? ""
                        : "es"
                    }
                  </span>
                </div>

                <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;background:${colorEstado.fondo};border:1px solid ${colorEstado.borde};color:${colorEstado.texto};font-size:10px;font-weight:800;white-space:nowrap;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${colorEstado.punto};"></span>
                  ${escaparHtml(estadoEvento)}
                </span>
              </div>

              ${pagadosHtml}
              ${freeHtml}
            </div>`;
        })
        .join("");

      setLoading(false);

      limpiarYcerrar();

      await Swal.fire({
        ...swalConfig,
        width: 720,
        padding: "16px",
        showCloseButton: true,

        html: `
          <div style="text-align:left;color:#fff;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 2px 11px;border-bottom:1px solid #333338;">
              <div>
                <div style="font-size:10px;font-weight:900;letter-spacing:1.2px;color:#ef4444;margin-bottom:3px;">
                  🔎 MIS TICKETS
                </div>

                <div style="font-size:20px;font-weight:900;line-height:1.15;">
                  Tus participaciones
                </div>

                <div style="margin-top:4px;font-size:11px;color:#a1a1aa;">
                  Todo organizado por evento
                </div>
              </div>

              <div style="min-width:66px;padding:8px 10px;border-radius:12px;background:#2a1114;border:1px solid #7f1d1d;text-align:center;">
                <div style="font-size:22px;font-weight:900;line-height:1;color:#f87171;">
                  ${escaparHtml(
                    totalParticipaciones
                  )}
                </div>

                <div style="margin-top:3px;font-size:9px;font-weight:800;letter-spacing:.6px;color:#fecaca;">
                  TOTAL
                </div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:9px;margin-top:10px;padding:9px 10px;border-radius:11px;background:#18181b;border:1px solid #303036;">
              <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex:0 0 32px;border-radius:9px;background:#27272a;">
                👤
              </div>

              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escaparHtml(
                    nombreUsuario
                  )}
                </div>

                <div style="margin-top:1px;font-size:10px;color:#a1a1aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escaparHtml(
                    cleanEmail
                  )}
                </div>
              </div>
            </div>

            <div style="max-height:58vh;overflow-y:auto;margin-top:2px;padding-right:3px;">
              ${eventosHtml}
            </div>
          </div>
        `,

        confirmButtonText: "Cerrar",
        confirmButtonColor: "#991b1b",
      });
    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text:
          error?.message ||
          "No se pudo consultar tu historial.",
      });
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     VERIFICADOR ACTUAL
     Tickets pagados + FREE DROP
  ========================================================= */

  const handleVerify = async () => {
    try {
      setLoading(true);

      if (modo === "historial") {
        await handleMisTickets();
        return;
      }

      /* =====================================================
         TICKETS PAGADOS
      ===================================================== */

      if (modo === "tickets") {
        const cleanEmail = String(email || "")
          .trim()
          .toLowerCase();

        if (!rifaId) {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Rifa no disponible",
            text:
              "No se pudo identificar la rifa que deseas verificar.",
          });

          return;
        }

        if (!cleanEmail) {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Email requerido",
            text:
              "Ingresa tu correo para verificar tus tickets",
          });

          return;
        }

        if (!validarEmail(cleanEmail)) {
          await Swal.fire({
            ...swalConfig,
            icon: "warning",
            title: "Email inválido",
            text:
              "Ingresa un correo electrónico válido",
          });

          return;
        }

        const response =
          await verificarTicketsPorEmail(
            cleanEmail,
            rifaId
          );

        const data =
          response.data || {};

        if (!response.ok) {
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "Error",
            text:
              data.error ||
              "No se pudieron verificar los tickets",
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

        const compras =
          Array.isArray(data.compras)
            ? data.compras
            : [];

        const ticketsData =
          Array.isArray(data.tickets)
            ? data.tickets
            : [];

        const rifaInfo =
          data.rifa ||
          compras.find(
            (compra) =>
              compra?.rifas
          )?.rifas ||
          null;

        const comprasPendientes =
          compras.filter(
            (compra) =>
              String(
                compra.estado_pago || ""
              ).toLowerCase() ===
              "pendiente"
          );

        if (
          ticketsData.length === 0 &&
          comprasPendientes.length > 0
        ) {
          await Swal.fire({
            ...swalConfig,
            icon: "info",
            title: "Compra pendiente",

            html: `
              <div style="line-height:1.7;">
                <p>
                  Encontramos tu compra, pero todavía está
                  pendiente de aprobación.
                </p>

                <p>
                  Soporte puede tardar hasta
                  <strong>24 horas</strong>
                  en validarla.
                </p>
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
            text:
              "No se encontraron tickets aprobados para este correo en esta rifa.",
          });

          return;
        }

        const formatoRifa =
          rifaInfo?.formato ||
          "4digitos";

        const nombreRifa =
          rifaInfo?.nombre ||
          "Rifa";

        const padLength =
          formatoRifa === "3digitos"
            ? 3
            : 4;

        const numerosOrdenados = [
          ...ticketsData,
        ]
          .sort(
            (a, b) =>
              Number(
                a.numero_ticket
              ) -
              Number(
                b.numero_ticket
              )
          )
          .map((ticket) =>
            String(
              ticket.numero_ticket
            ).padStart(
              padLength,
              "0"
            )
          )
          .join(", ");

        setLoading(false);

        limpiarYcerrar();

        await Swal.fire({
          ...swalConfig,
          icon: "success",
          title: "Tickets encontrados",

          html: `
            <div
              style="
                text-align:left;
                line-height:1.8;
              "
            >
              <p>
                <strong>Correo:</strong>
                ${escaparHtml(
                  cleanEmail
                )}
              </p>

              <p>
                <strong>Rifa:</strong>
                ${escaparHtml(
                  nombreRifa
                )}
              </p>

              <p>
                <strong>Cantidad de tickets:</strong>
                ${ticketsData.length}
              </p>

              <p>
                <strong>Formato:</strong>
                ${padLength} dígitos
              </p>

              <p style="margin-top:12px;">
                <strong>
                  Números asignados:
                </strong>
              </p>

              <div
                style="
                  margin-top:8px;
                  padding:12px;
                  border-radius:12px;
                  background:#2a2a2a;
                  border:1px solid #3f3f46;
                  line-height:1.8;
                  word-break:break-word;
                "
              >
                ${escaparHtml(
                  numerosOrdenados
                )}
              </div>
            </div>
          `,

          confirmButtonColor:
            "#991b1b",
        });

        return;
      }

      /* =====================================================
         FREE DROP
      ===================================================== */

      const codigoLimpio =
        String(
          codigoFree || ""
        )
          .trim()
          .toUpperCase();

      if (!codigoLimpio) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Código FREE requerido",
          text:
            "Ingresa tu código FREE para verificar la participación gratis.",
        });

        return;
      }

      if (
        !codigoLimpio.startsWith(
          "FREE-"
        )
      ) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Código inválido",
          text:
            "El código FREE debe comenzar con FREE-",
        });

        return;
      }

      const response =
        await verificarFreeCode(
          codigoLimpio
        );

      const data =
        response.data || {};

      if (!response.ok) {
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Código no válido",
          text:
            data.error ||
            "No se pudo verificar el código FREE",
        });

        return;
      }

      const participacion =
        data?.participacion ||
        null;

      const estadoFree =
        String(
          participacion?.estado_visual ||
            participacion?.estado ||
            "VÁLIDA"
        )
          .trim()
          .toUpperCase();

      const esValida = [
        "VÁLIDA",
        "VALIDA",
        "ASIGNADA",
        "ASSIGNED",
      ].includes(estadoFree);

      const esPendiente = [
        "PENDIENTE",
        "RESERVADA",
        "RESERVED",
      ].includes(estadoFree);

      const esAnulada = [
        "ANULADA",
        "CANCELADA",
        "CANCELLED",
      ].includes(estadoFree);

      const esRechazada = [
        "RECHAZADA",
        "REJECTED",
      ].includes(estadoFree);

      const iconoEstado =
        esValida
          ? "success"
          : esPendiente
          ? "info"
          : esAnulada ||
            esRechazada
          ? "error"
          : "warning";

      const tituloEstado =
        esValida
          ? "Participación válida"
          : esPendiente
          ? "Participación pendiente"
          : esAnulada
          ? "Participación anulada"
          : esRechazada
          ? "Participación rechazada"
          : "Estado de participación";

      setLoading(false);

      limpiarYcerrar();

      await Swal.fire({
        ...swalConfig,
        icon: iconoEstado,
        title: tituloEstado,

        html: `
          <div
            style="
              text-align:left;
              line-height:1.8;
            "
          >
            <p>
              <strong>Evento:</strong>
              ${escaparHtml(
                participacion?.evento ||
                  "Sin evento"
              )}
            </p>

            <p>
              <strong>FREE DROP:</strong>
              ${escaparHtml(
                participacion?.free_drop ||
                  "Sin drop"
              )}
            </p>

            <p>
              <strong>Número:</strong>
              ${escaparHtml(
                participacion
                  ?.numero_participacion_formateado ||
                  participacion
                    ?.numero_participacion ||
                  "Sin número"
              )}
            </p>

            <p>
              <strong>Código:</strong>
              ${escaparHtml(
                participacion?.codigo ||
                  codigoLimpio
              )}
            </p>

            <p>
              <strong>Estado:</strong>
              ${escaparHtml(
                estadoFree
              )}
            </p>

            <p>
              <strong>Fecha:</strong>
              ${escaparHtml(
                formatearFechaSegura(
                  participacion?.fecha_iso
                )
              )}
            </p>
          </div>
        `,

        confirmButtonColor:
          "#991b1b",
      });
    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text:
          error?.message ||
          "No se pudo verificar la información",
      });
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     TEXTOS DEL MODAL
  ========================================================= */

  const titulo =
    modo === "historial"
      ? "MIS TICKETS"
      : modo === "tickets"
      ? "VERIFICA TUS TICKETS"
      : "VERIFICA TU FREE DROP";

  const descripcion =
    modo === "historial"
      ? codigoEnviado
        ? `Ingresa el código de 6 dígitos enviado a ${
            emailCodigoEnviado ||
            "tu correo"
          }.`
        : "Ingresa tu correo. Te enviaremos un código de 6 dígitos antes de mostrar tus participaciones."
      : modo === "tickets"
      ? "Ingresa el correo electrónico que usaste al comprar para consultar tus tickets aprobados en esta rifa."
      : "Ingresa tu código FREE para consultar tu participación gratis.";

  const warning =
    modo === "historial"
      ? "🔎 Consulta tus tickets comprados y participaciones FREE"
      : modo === "tickets"
      ? "⚠️ Soporte tiene hasta 24 horas para revisar y aprobar tu compra"
      : "⚠️ Verifica tu participación gratis usando tu código FREE";

  /* =========================================================
     RENDER PROFESIONAL
  ========================================================= */

 const cambiarModo = (nuevoModo) => {
  if (
    loading ||
    nuevoModo === modo
  ) {
    return;
  }

  setModo(nuevoModo);

  if (nuevoModo !== "historial") {
    setCodigoMisTickets("");
    setCodigoEnviado(false);
    setEmailCodigoEnviado("");
    setReenviarEn(0);

    setMisTicketsCaptchaToken("");
    setMisTicketsCaptchaResetKey(
      (actual) => actual + 1
    );
  }
};

  const cambiarCorreoHistorial =
    () => {
      if (loading) return;

      setCodigoEnviado(false);
      setCodigoMisTickets("");
      setEmailCodigoEnviado("");
      setReenviarEn(0);

      setMisTicketsCaptchaToken("");
setMisTicketsCaptchaResetKey(
  (actual) => actual + 1
);

      setTimeout(
        () =>
          inputRef.current?.focus(),
        50
      );
    };

const reenviarCodigoHistorial =
  async () => {
    if (
      loading ||
      reenviarEn > 0
    ) {
      return;
    }

    const cleanEmail =
      String(
        emailCodigoEnviado ||
          email ||
          ""
      )
        .trim()
        .toLowerCase();

    if (!validarEmail(cleanEmail)) {
      return;
    }

    if (!misTicketsCaptchaToken) {
      await Swal.fire({
        ...swalConfig,
        icon: "warning",
        title: "Verificación requerida",
        text: "Completa la verificación de seguridad antes de reenviar el código.",
      });

      return;
    }

    try {
      setLoading(true);

      const respuesta =
        await solicitarCodigoMisTickets(
          cleanEmail,
          misTicketsCaptchaToken
        );

      // El token de Turnstile es de un solo uso.
      // Lo eliminamos y generamos un CAPTCHA nuevo.
      setMisTicketsCaptchaToken("");

      setMisTicketsCaptchaResetKey(
        (actual) => actual + 1
      );

      const respuestaData =
        respuesta.data || {};

      if (respuesta.ok) {
        setReenviarEn(60);
      }

      await Swal.fire({
        ...swalConfig,

        icon:
          respuesta.ok
            ? "success"
            : "error",

        title:
          respuesta.ok
            ? "Código reenviado"
            : "No se pudo reenviar",

        text:
          respuestaData.mensaje ||
          respuestaData.error ||
          (respuesta.ok
            ? "Revisa tu correo para ver el nuevo código."
            : "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setLoading(false);
    }
  };

  const historialPasoCodigo =
    modo === "historial" &&
    codigoEnviado;

  return (
    <div
      className="verify-modal-overlay"
      onClick={cerrarModal}
    >
      <div
        className="verify-modal-box premium"
        onClick={(e) =>
          e.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-modal-title"
        aria-describedby="verify-modal-description"
      >
        <button
          type="button"
          className="verify-modal-close"
          onClick={cerrarModal}
          disabled={loading}
          aria-label="Cerrar"
        >
          ×
        </button>

        <div className="verify-modal-head">
          <div className="verify-modal-badge">
            {modo === "historial"
              ? "🔎 MIS TICKETS"
              : modo === "tickets"
              ? "🎟️ TICKETS PAGADOS"
              : "🎁 FREE DROP"}
          </div>

          <h2 id="verify-modal-title">
            {titulo}
          </h2>

          <p className="verify-modal-warning">
            {warning}
          </p>

          <p
            className="verify-modal-text"
            id="verify-modal-description"
          >
            {descripcion}
          </p>
        </div>

        <div
          className="verify-modal-tabs"
          role="tablist"
          aria-label="Tipo de consulta"
        >
          <button
            type="button"
            className={`verify-modal-tab ${
              modo === "historial"
                ? "active"
                : ""
            }`}
            onClick={() =>
              cambiarModo(
                "historial"
              )
            }
            disabled={loading}
          >
            <span>🔎</span>
            <strong>
              Mis Tickets
            </strong>
          </button>

          <button
            type="button"
            className={`verify-modal-tab ${
              modo === "tickets"
                ? "active"
                : ""
            }`}
            onClick={() =>
              cambiarModo(
                "tickets"
              )
            }
            disabled={loading}
          >
            <span>🎟️</span>
            <strong>
              Pagados
            </strong>
          </button>

          <button
            type="button"
            className={`verify-modal-tab ${
              modo === "free"
                ? "active"
                : ""
            }`}
            onClick={() =>
              cambiarModo("free")
            }
            disabled={loading}
          >
            <span>🎁</span>
            <strong>
              FREE
            </strong>
          </button>
        </div>

        {modo === "historial" && (
          <div className="verify-modal-progress">
            <div
              className={`verify-modal-step ${
                codigoEnviado
                  ? "done"
                  : "active"
              }`}
            >
              <span>
                {codigoEnviado
                  ? "✓"
                  : "1"}
              </span>

              <div>
                <strong>
                  Tu correo
                </strong>

                <small>
                  Identifica tu cuenta
                </small>
              </div>
            </div>

            <div
              className={`verify-modal-progress-line ${
                codigoEnviado
                  ? "done"
                  : ""
              }`}
            />

            <div
              className={`verify-modal-step ${
                codigoEnviado
                  ? "active"
                  : ""
              }`}
            >
              <span>2</span>

              <div>
                <strong>
                  Código
                </strong>

                <small>
                  Confirma que eres tú
                </small>
              </div>
            </div>
          </div>
        )}

        <div className="verify-modal-form">
          {modo === "free" ? (
            <div className="verify-modal-field">
              <label htmlFor="verify-free-code">
                Código FREE
              </label>

              <div className="verify-modal-input-shell">
                <span className="verify-modal-input-icon">
                  🎁
                </span>

                <input
                  id="verify-free-code"
                  ref={inputRef}
                  type="text"
                  placeholder="FREE-728491"
                  value={codigoFree}
                  onChange={(e) =>
                    setCodigoFree(
                      e.target.value
                    )
                  }
                  className="verify-modal-input"
                  disabled={loading}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (
                      e.key ===
                      "Enter"
                    ) {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                />
              </div>

              <small className="verify-modal-helper">
                Escribe el código que recibiste al participar en el FREE DROP.
              </small>
            </div>
          ) : historialPasoCodigo ? (
            <div className="verify-modal-code-wrap">
              <div className="verify-modal-code-email">
                <span>✉️</span>

                <div>
                  <small>
                    Código enviado a
                  </small>

                  <strong>
                    {emailCodigoEnviado ||
                      email}
                  </strong>
                </div>
              </div>

              <div className="verify-modal-field">
                <label htmlFor="verify-otp-code">
                  Código de seguridad
                </label>

                <input
                  id="verify-otp-code"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={
                    codigoMisTickets
                  }
                  onChange={(e) =>
                    setCodigoMisTickets(
                      e.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(
                          0,
                          6
                        )
                    )
                  }
                  className="verify-modal-input verify-modal-code-input"
                  disabled={loading}
                  autoComplete="one-time-code"
                  onKeyDown={(e) => {
                    if (
                      e.key ===
                      "Enter"
                    ) {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                />

                <small className="verify-modal-helper">
                  Ingresa los 6 dígitos que enviamos a tu correo.
                </small>
                
              <div
  style={{
    display: "flex",
    justifyContent: "center",
    width: "100%",
    marginTop: "12px",
  }}
>
  <TurnstileWidget
    key={misTicketsCaptchaResetKey}
    onToken={setMisTicketsCaptchaToken}
  />
</div>
              </div>

              <div className="verify-modal-code-actions">
                <button
                  type="button"
                  className="verify-modal-link-btn"
                  disabled={loading}
                  onClick={
                    cambiarCorreoHistorial
                  }
                >
                  ← Cambiar correo
                </button>

                <button
                  type="button"
                  className="verify-modal-link-btn"
                  disabled={
                    loading ||
                    reenviarEn > 0
                  }
                  onClick={
                    reenviarCodigoHistorial
                  }
                >
                  {reenviarEn > 0
                    ? `Reenviar en ${reenviarEn}s`
                    : "↻ Reenviar código"}
                </button>
              </div>
            </div>
          ) : (
            <div className="verify-modal-field">
              <label htmlFor="verify-email">
                {modo === "historial"
                  ? "Correo de tus participaciones"
                  : "Correo de compra"}
              </label>

              <div className="verify-modal-input-shell">
                <span className="verify-modal-input-icon">
                  ✉️
                </span>

                <input
                  id="verify-email"
                  ref={inputRef}
                  type="email"
                  placeholder="nombre@correo.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  className="verify-modal-input"
                  disabled={loading}
                  autoComplete="email"
                  onKeyDown={(e) => {
                    if (
                      e.key ===
                      "Enter"
                    ) {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                />
              </div>

              <small className="verify-modal-helper">
                {modo === "historial"
                  ? "Te enviaremos un código de 6 dígitos antes de mostrar tus participaciones."
                  : "Usa el mismo correo con el que realizaste la compra."}
              </small>
{modo === "historial" && !codigoEnviado && (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      width: "100%",
      marginTop: "12px",
    }}
  >
<TurnstileWidget
  key={misTicketsCaptchaResetKey}
  onToken={setMisTicketsCaptchaToken}
/>
  </div>
)}
            </div>
          )}
        </div>

        <div className="verify-modal-actions verify-modal-main-actions">
          <button
            onClick={handleVerify}
            className="verify-modal-btn confirm"
            type="button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="verify-modal-spinner" />
                Procesando...
              </>
            ) : modo ===
              "historial" ? (
              codigoEnviado
                ? "🔐 Verificar código"
                : "✉️ Enviar código"
            ) : modo ===
              "tickets" ? (
              "🎟️ Verificar tickets"
            ) : (
              "🎁 Verificar FREE"
            )}
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

        <div className="verify-modal-security">
          <span>🔒</span>

          <p>
            Tus datos se usan únicamente para localizar y verificar tus participaciones.
          </p>
        </div>
      </div>
    </div>
  );
}