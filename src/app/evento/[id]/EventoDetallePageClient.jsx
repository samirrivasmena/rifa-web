"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";

import styles from "./EventoDetallePageClient.module.css";

import VerifyTicketsModal from "@/components/shared/VerifyTicketsModal";
import PublicTopbar from "@/components/shared/PublicTopbar";
import RaffleDualImage from "@/components/shared/RaffleDualImage";
import FloatingShareButton from "@/components/shared/ShareButtons/FloatingShareButton";
import ProgressVentaBar from "@/components/shared/ProgressVentaBar";
import SiteLogo from "@/components/shared/SiteLogo";
import { getRifaProgress } from "@/lib/getRifaProgress";
import { enriquecerRifaConResumen } from "@/lib/rifas/enriquecerRifaConResumen";

const PAISES_TELEFONO = [
  { codigo: "US", bandera: "🇺🇸", nombre: "Estados Unidos", prefijo: "+1" },
  { codigo: "DO", bandera: "🇩🇴", nombre: "República Dominicana", prefijo: "+1" },
  { codigo: "PR", bandera: "🇵🇷", nombre: "Puerto Rico", prefijo: "+1" },
  { codigo: "MX", bandera: "🇲🇽", nombre: "México", prefijo: "+52" },
  { codigo: "CO", bandera: "🇨🇴", nombre: "Colombia", prefijo: "+57" },
  { codigo: "VE", bandera: "🇻🇪", nombre: "Venezuela", prefijo: "+58" },
  { codigo: "EC", bandera: "🇪🇨", nombre: "Ecuador", prefijo: "+593" },
  { codigo: "PE", bandera: "🇵🇪", nombre: "Perú", prefijo: "+51" },
  { codigo: "CL", bandera: "🇨🇱", nombre: "Chile", prefijo: "+56" },
  { codigo: "AR", bandera: "🇦🇷", nombre: "Argentina", prefijo: "+54" },
  { codigo: "BR", bandera: "🇧🇷", nombre: "Brasil", prefijo: "+55" },
  { codigo: "PA", bandera: "🇵🇦", nombre: "Panamá", prefijo: "+507" },
  { codigo: "CR", bandera: "🇨🇷", nombre: "Costa Rica", prefijo: "+506" },
  { codigo: "GT", bandera: "🇬🇹", nombre: "Guatemala", prefijo: "+502" },
  { codigo: "HN", bandera: "🇭🇳", nombre: "Honduras", prefijo: "+504" },
  { codigo: "SV", bandera: "🇸🇻", nombre: "El Salvador", prefijo: "+503" },
  { codigo: "NI", bandera: "🇳🇮", nombre: "Nicaragua", prefijo: "+505" },
  { codigo: "CU", bandera: "🇨🇺", nombre: "Cuba", prefijo: "+53" },
  { codigo: "BO", bandera: "🇧🇴", nombre: "Bolivia", prefijo: "+591" },
  { codigo: "PY", bandera: "🇵🇾", nombre: "Paraguay", prefijo: "+595" },
  { codigo: "UY", bandera: "🇺🇾", nombre: "Uruguay", prefijo: "+598" },
  { codigo: "ES", bandera: "🇪🇸", nombre: "España", prefijo: "+34" },
  { codigo: "CA", bandera: "🇨🇦", nombre: "Canadá", prefijo: "+1" },
];

const freeDropFormInicial = {
  nombre: "",
  apellido: "",
  email: "",
  paisTelefono: "US",
  telefono: "",
  estado: "",

  confirmaFollow: false,
  confirmaLike: false,
  confirmaComment: false,
  confirmaShare: false,

  aceptaReglas: false,

  // Se mantiene porque el backend actual espera este campo.
  // Su valor real se calcula al enviar según los requisitos activos.
  elegibilidad: false,

  captchaToken: "",
};

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
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

    // =========================================================
    // LIMPIAR WIDGET
    // =========================================================

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

    // =========================================================
    // RENDERIZAR
    // =========================================================

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

    // =========================================================
    // ESPERAR A QUE CLOUDFLARE ESTÉ DISPONIBLE
    //
    // Esto evita depender únicamente del evento "load".
    // Si el script ya estaba cargado, seguimos comprobando
    // window.turnstile hasta que esté disponible.
    // =========================================================

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

      /*
       * 100 intentos x 100 ms = aproximadamente 10 segundos.
       */
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

    // =========================================================
    // SI TURNSTILE YA EXISTE
    // =========================================================

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

    // =========================================================
    // BUSCAR SCRIPT EXISTENTE
    // =========================================================

    let script = document.querySelector(
      'script[data-turnstile="true"]'
    );

    // =========================================================
    // SI NO EXISTE, CREARLO
    // =========================================================

    if (!script) {
      script = document.createElement("script");

      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

      script.async = true;
      script.defer = true;

      script.dataset.turnstile = "true";

      document.head.appendChild(script);
    }

    // =========================================================
    // IMPORTANTE
    //
    // No dependemos del evento load.
    // Comenzamos a comprobar inmediatamente si
    // window.turnstile está disponible.
    // =========================================================

    esperarTurnstile();

    // =========================================================
    // CLEANUP
    // =========================================================

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

function formatearFechaSegura(valor) {
  if (!valor) return "Sin fecha";
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return String(valor);
  return date.toLocaleString();
}

function calcularCuentaRegresiva(fechaObjetivo, ahoraMs) {
  if (!fechaObjetivo) return null;

  const objetivo = new Date(fechaObjetivo).getTime();

  if (Number.isNaN(objetivo)) return null;

  const diferencia = objetivo - ahoraMs;

  if (diferencia <= 0) {
    return "ACTIVANDO...";
  }

  const totalSegundos = Math.floor(diferencia / 1000);
  const dias = Math.floor(totalSegundos / 86400);
  const horas = Math.floor((totalSegundos % 86400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  if (dias > 0) {
    return `${dias}d ${String(horas).padStart(2, "0")}h ${String(
      minutos
    ).padStart(2, "0")}m ${String(segundos).padStart(2, "0")}s`;
  }

  return `${String(horas).padStart(2, "0")}h ${String(minutos).padStart(
    2,
    "0"
  )}m ${String(segundos).padStart(2, "0")}s`;
}

export default function EventoDetallePageClient() {
  const params = useParams();
  const eventoId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorRed, setErrorRed] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificarEmail, setVerificarEmail] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const [showFreeDropModal, setShowFreeDropModal] = useState(false);
  const [submittingFreeDrop, setSubmittingFreeDrop] = useState(false);
  const [freeDropForm, setFreeDropForm] = useState(freeDropFormInicial);

  const [freeDropActivo, setFreeDropActivo] = useState(null);
  const [freeDropProximo, setFreeDropProximo] = useState(null);
  const [freeDropSettings, setFreeDropSettings] = useState(null);
  const [loadingFreeDrop, setLoadingFreeDrop] = useState(true);
  const [ahoraFreeDrop, setAhoraFreeDrop] = useState(() => Date.now());

  const [showFreeDropConfirmacion, setShowFreeDropConfirmacion] =
    useState(false);
  const [freeDropConfirmacion, setFreeDropConfirmacion] = useState(null);

  const [freeDropRegistrado, setFreeDropRegistrado] = useState(false);
  const [freeDropRegistradoData, setFreeDropRegistradoData] = useState(null);

  const [verificadorModoInicial, setVerificadorModoInicial] =
    useState("tickets");
  const [verificadorCodigoFreeInicial, setVerificadorCodigoFreeInicial] =
    useState("");

  const freeDropSectionRef = useRef(null);

  const esEstadoFinalizado = (estado) =>
    ["finalizada", "finalizado", "cerrada"].includes(
      String(estado || "").toLowerCase()
    );

  const esEstadoAgotado = (estado) =>
    ["agotada", "agotado"].includes(String(estado || "").toLowerCase());

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowVerifyModal(false);
        setShowFreeDropModal(false);
        setShowFreeDropConfirmacion(false);
        setFreeDropConfirmacion(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!eventoId || typeof window === "undefined") return;

    try {
      const key = `free_drop_registrado_${eventoId}`;
      const raw = window.localStorage.getItem(key);

      if (!raw) {
        setFreeDropRegistrado(false);
        setFreeDropRegistradoData(null);
        return;
      }

      const parsed = JSON.parse(raw);
      setFreeDropRegistrado(true);
      setFreeDropRegistradoData(parsed || null);

      // localStorage conserva el comprobante, pero el estado real vive en el servidor.
      // Si Admin anula/rechaza/aprueba la participación, sincronizamos la tarjeta pública.
      const codigoGuardado = String(parsed?.codigoFree || "").trim().toUpperCase();

      if (codigoGuardado) {
        fetch("/api/verificar-free-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ codigo: codigoGuardado }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.participacion) return;

            const participacion = data.participacion;
            const estadoServidor = String(
              participacion?.estado_visual || participacion?.estado || parsed?.estado || ""
            )
              .trim()
              .toUpperCase();

            const actualizado = {
              ...parsed,
              estado: estadoServidor || parsed?.estado,
              numeroParticipacion:
                participacion?.numero_participacion ?? parsed?.numeroParticipacion,
              codigoFree: participacion?.codigo || codigoGuardado,
              fecha: participacion?.fecha_iso || parsed?.fecha,
              freeDrop: participacion?.free_drop || parsed?.freeDrop,
              evento: participacion?.evento || parsed?.evento,
            };

            setFreeDropRegistradoData(actualizado);
            window.localStorage.setItem(key, JSON.stringify(actualizado));
          })
          .catch((error) => {
            // Si falla la red, conservamos el comprobante local sin inventar un estado nuevo.
            console.warn("No se pudo sincronizar el estado FREE guardado:", error);
          });
      }
    } catch (error) {
      console.warn("No se pudo leer la participación gratis guardada:", error);
      setFreeDropRegistrado(false);
      setFreeDropRegistradoData(null);
    }
  }, [eventoId]);

  useEffect(() => {
    const cargarEvento = async () => {
      try {
        setLoading(true);
        setErrorRed(false);

        if (!eventoId) {
          setEvento(null);
          setLoading(false);
          return;
        }

        const res = await fetch(
          "/api/rifa-resumen?rifaId=" + encodeURIComponent(eventoId),
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const raw = await res.text();

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          console.error("Respuesta inválida en /api/rifa-resumen");
          setEvento(null);
          setErrorRed(true);
          return;
        }

        if (!res.ok) {
          console.error(data.error || "No se pudo cargar el evento");
          setEvento(null);
          setErrorRed(true);
          return;
        }

        const rifa = data.rifa || null;

        if (!rifa) {
          setEvento(null);
          return;
        }

        const rifaNormalizada = await enriquecerRifaConResumen(rifa);
        setEvento(rifaNormalizada);
      } catch (error) {
        console.error("Error cargando evento:", error);
        setEvento(null);
        setErrorRed(true);
      } finally {
        setLoading(false);
      }
    };

    cargarEvento();
  }, [eventoId]);

  const cargarFreeDrop = useCallback(async () => {
    if (!eventoId) return;

    try {
      setLoadingFreeDrop(true);

      const [resActivo, resSettings] = await Promise.all([
        fetch(`/api/free-drops/activo?rifaId=${encodeURIComponent(eventoId)}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/free-drops/settings?rifaId=${encodeURIComponent(eventoId)}`, {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const dataActivo = await resActivo.json().catch(() => ({}));
      const dataSettings = await resSettings.json().catch(() => ({}));

      if (resActivo.ok) {
        setFreeDropActivo(dataActivo.drop || null);
        setFreeDropProximo(dataActivo.proximo_drop || null);
      } else {
        setFreeDropActivo(null);
        setFreeDropProximo(null);
      }

      if (resSettings.ok) {
        setFreeDropSettings(dataSettings.settings || null);
      } else {
        setFreeDropSettings(null);
      }
    } catch (error) {
      console.error("Error cargando free drop:", error);
      setFreeDropActivo(null);
      setFreeDropProximo(null);
      setFreeDropSettings(null);
    } finally {
      setLoadingFreeDrop(false);
    }
  }, [eventoId]);

  useEffect(() => {
    cargarFreeDrop();
  }, [cargarFreeDrop]);

  /*
   * Mantiene la información pública sincronizada con la activación automática.
   * pg_cron trabaja en el servidor; esta actualización permite que una página
   * que ya estaba abierta refleje el cambio sin obligar al usuario a recargar.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !eventoId) return;

    const intervalId = window.setInterval(() => {
      cargarFreeDrop();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [eventoId, cargarFreeDrop]);

  /*
   * Reloj exclusivamente visual para la cuenta regresiva real.
   * No decide si un Drop está activo: el estado real siempre viene del servidor.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const intervalId = window.setInterval(() => {
      setAhoraFreeDrop(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!eventoId) {
      setShareUrl("");
      return;
    }

    let base = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      window.location.origin ||
      ""
    ).trim();

    if (base && !/^https?:\/\//i.test(base)) {
      base = `https://${base}`;
    }

    try {
      base = new URL(base).origin;
    } catch {
      base = window.location.origin;
    }

    setShareUrl(`${base}/evento/${eventoId}`);
  }, [eventoId]);

  const estaFinalizado = useMemo(
    () => esEstadoFinalizado(evento?.estado),
    [evento?.estado]
  );

  const estaAgotada = useMemo(
    () => esEstadoAgotado(evento?.estado),
    [evento?.estado]
  );

  const progreso = useMemo(() => getRifaProgress(evento || {}), [evento]);

  const premios = useMemo(() => {
    if (!evento) return [];
    if (Array.isArray(evento.premios) && evento.premios.length > 0) {
      return evento.premios;
    }
    if (evento.premio) return [evento.premio];
    return [];
  }, [evento]);

  const fecha =
    evento?.fecha_sorteo || evento?.fecha || evento?.fecha_rifa || "";
  const hora = evento?.hora_sorteo || evento?.hora || evento?.hora_rifa || "";

  const precioRaw = Number(evento?.precio_ticket);
  const precio = Number.isFinite(precioRaw) ? precioRaw : 0;

  const padLength = evento?.formato === "3digitos" ? 3 : 4;

  const descripcion = evento?.descripcion || "Sin descripción disponible.";

  const totalNumeros = Number(progreso.total || 0);
  const ticketsVendidos = Number(progreso.vendidos || 0);
  const porcentajeVendido = Number(progreso.porcentaje || 0);
  const rifaCompleta = progreso.soldOut || estaFinalizado || estaAgotada;

  const freeDropTotal = Number(
    freeDropActivo?.cupos_total ?? freeDropSettings?.total_free_allowed ?? 250
  );
  const freeDropUsados = Number(
    freeDropActivo?.cupos_usados ?? freeDropSettings?.released_total ?? 0
  );
  const freeDropDisponibles = Number(
    freeDropActivo?.cupos_disponibles ??
      Math.max(freeDropTotal - freeDropUsados, 0)
  );

  const freeDropPorcentaje =
    freeDropTotal > 0 ? (freeDropUsados / freeDropTotal) * 100 : 0;

  const freeDropEstado = useMemo(() => {
    if (!freeDropSettings?.enabled) return "desactivado";
    if (!freeDropActivo) return "sin_activo";

    const estadoReal = String(freeDropActivo?.estado || "")
      .trim()
      .toLowerCase();

    if (estadoReal === "pausado") return "pausado";
    if (estadoReal === "agotado" || freeDropDisponibles <= 0) return "agotado";
    if (estadoReal === "programado") return "programado";
    if (estadoReal === "cerrado") return "cerrado";
    if (estadoReal === "activo") return "activo";

    return "sin_activo";
  }, [freeDropSettings?.enabled, freeDropActivo, freeDropDisponibles]);

  const freeDropEstadoLabel =
    {
      activo: "ACTIVO",
      pausado: "PAUSADO",
      agotado: "AGOTADO",
      programado: "PROGRAMADO",
      cerrado: "CERRADO",
      desactivado: "DESACTIVADO",
      sin_activo: "SIN ACTIVO",
    }[freeDropEstado] || "DESCONOCIDO";

  const freeDropPuedeParticipar =
    freeDropEstado === "activo" &&
    freeDropDisponibles > 0 &&
    Boolean(freeDropActivo?.id);

  /*
   * Si el Drop principal ya es PROGRAMADO, él mismo representa el próximo Drop.
   * Si hay un ACTIVO/PAUSADO/AGOTADO y la API devuelve proximo_drop, usamos ese.
   */
  const freeDropProgramadoVisible = useMemo(() => {
    const candidato =
      freeDropEstado === "programado" ? freeDropActivo : freeDropProximo;

    if (!candidato) return null;

    const estado = String(candidato?.estado || "")
      .trim()
      .toLowerCase();

    if (estado !== "programado" || !candidato?.fecha_inicio) return null;

    const fechaMs = new Date(candidato.fecha_inicio).getTime();

    if (Number.isNaN(fechaMs)) return null;

    return candidato;
  }, [freeDropEstado, freeDropActivo, freeDropProximo]);

  const freeDropCuentaRegresiva = useMemo(
    () =>
      calcularCuentaRegresiva(
        freeDropProgramadoVisible?.fecha_inicio,
        ahoraFreeDrop
      ),
    [freeDropProgramadoVisible?.fecha_inicio, ahoraFreeDrop]
  );

  const estadoParticipacionGuardada = String(
    freeDropRegistradoData?.estado || ""
  )
    .trim()
    .toUpperCase();

  const participacionGuardadaValida = ["VÁLIDA", "VALIDA", "ASIGNADA", "ASSIGNED"].includes(
    estadoParticipacionGuardada
  );
  const participacionGuardadaPendiente = ["PENDIENTE", "RESERVADA", "RESERVED"].includes(
    estadoParticipacionGuardada
  );
  const participacionGuardadaAnulada = ["ANULADA", "CANCELADA", "CANCELLED"].includes(
    estadoParticipacionGuardada
  );
  const participacionGuardadaRechazada = ["RECHAZADA", "REJECTED"].includes(
    estadoParticipacionGuardada
  );

  const mensajeParticipacionGuardada = participacionGuardadaAnulada
    ? "❌ Tu participación gratis fue anulada"
    : participacionGuardadaRechazada
    ? "❌ Tu participación gratis fue rechazada"
    : participacionGuardadaPendiente
    ? "⏳ Tu participación gratis está pendiente de revisión"
    : participacionGuardadaValida
    ? "✅ Tu participación gratis es válida"
    : "ℹ️ Consulta el estado actual de tu participación";

  const textoBotonParticipacionGuardada = participacionGuardadaAnulada
    ? "PARTICIPACIÓN ANULADA"
    : participacionGuardadaRechazada
    ? "PARTICIPACIÓN RECHAZADA"
    : participacionGuardadaPendiente
    ? "PARTICIPACIÓN PENDIENTE"
    : participacionGuardadaValida
    ? "TU PARTICIPACIÓN GRATIS YA FUE VALIDA"
    : "CONSULTAR PARTICIPACIÓN";

  const mostrarFreeDrop = true;

  const abrirVerificadorTickets = () => {
    setVerificadorModoInicial("tickets");
    setVerificadorCodigoFreeInicial("");
    setShowVerifyModal(true);
  };

  const abrirVerificadorFree = (codigoFree) => {
    setVerificadorModoInicial("free");
    setVerificadorCodigoFreeInicial(codigoFree || "");
    setShowVerifyModal(true);
    setShowFreeDropConfirmacion(false);
  };

  const abrirFreeDropModal = async () => {
    if (freeDropRegistrado) {
      await Swal.fire({
        icon: "info",
        title: "Participación gratis exitosa",
        text: "Ya registraste tu participación gratis en este evento.",
      });
      return;
    }

    if (freeDropEstado === "desactivado") {
      await Swal.fire({
        icon: "info",
        title: "Participación gratis desactivada",
        text: "El administrador todavía no activó los free drops para este evento.",
      });
      return;
    }

    if (freeDropEstado === "sin_activo") {
      await Swal.fire({
        icon: "info",
        title: "Sin free drop activo",
        text: "Todavía no hay un FREE DROP activo para este evento.",
      });
      return;
    }

    if (freeDropEstado === "pausado") {
      await Swal.fire({
        icon: "info",
        title: "FREE DROP pausado",
        text: "La participación gratuita está temporalmente pausada. Vuelve más tarde.",
      });
      return;
    }

    if (freeDropEstado === "programado") {
      await Swal.fire({
        icon: "info",
        title: "FREE DROP programado",
        text: "Este FREE DROP todavía no está activo.",
      });
      return;
    }

    if (freeDropEstado === "cerrado") {
      await Swal.fire({
        icon: "info",
        title: "FREE DROP cerrado",
        text: "Este FREE DROP ya fue cerrado.",
      });
      return;
    }

    if (freeDropEstado === "agotado") {
      await Swal.fire({
        icon: "warning",
        title: "FREE DROP agotado",
        text: "Por ahora no quedan participaciones gratis disponibles.",
      });
      return;
    }

    if (!freeDropPuedeParticipar) {
      await Swal.fire({
        icon: "info",
        title: "Participación no disponible",
        text: "La participación gratuita no está disponible en este momento.",
      });
      return;
    }

    setFreeDropForm(freeDropFormInicial);
    setShowFreeDropModal(true);
  };

  const cerrarFreeDropModal = () => {
    if (submittingFreeDrop) return;
    setShowFreeDropModal(false);
    setFreeDropForm(freeDropFormInicial);
  };

  const cerrarConfirmacionFreeDrop = () => {
    setShowFreeDropConfirmacion(false);
    setFreeDropConfirmacion(null);
  };

  const handleFreeDropChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFreeDropForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTurnstileToken = useCallback((token) => {
    setFreeDropForm((prev) => ({
      ...prev,
      captchaToken: token,
    }));
  }, []);
const compartirFreeDrop = async () => {
  const urlBase =
    shareUrl ||
    (typeof window !== "undefined"
      ? window.location.href
      : "");

  const nombreEvento =
    String(evento?.nombre || "Evento").trim();

  const premioRaw =
    Array.isArray(premios) && premios.length > 0
      ? premios[0]
      : "Disponible";

  const premioPrincipal =
    typeof premioRaw === "string"
      ? premioRaw
      : String(
          premioRaw?.nombre ||
            premioRaw?.titulo ||
            premioRaw?.premio ||
            "Disponible"
        ).trim();

  const disponibles = Math.max(
    Number(freeDropDisponibles || 0),
    0
  );

  // =========================================================
  // MENSAJE
  // =========================================================

  const construirTexto = () => {
    switch (freeDropEstado) {
      case "activo":
        return `🔥 *${nombreEvento}*

🎁 *¡FREE DROP ACTIVO!*

🏆 *Premio:* ${premioPrincipal}
🎟️ *Participación:* GRATIS
⚡ *Cupos disponibles:* ${disponibles}

📸 Completa los requisitos y consigue tu participación gratis.

⏳ Los cupos son limitados y están sujetos a disponibilidad.

✅ *PARTICIPA DESDE LA PÁGINA OFICIAL*

👇 Entra aquí:`;

      case "pausado":
        return `🔥 *${nombreEvento}*

⏸️ *FREE DROP PAUSADO TEMPORALMENTE*

🏆 *Premio:* ${premioPrincipal}

🎁 El FREE DROP está pausado en este momento.

👀 Entra a la página oficial para consultar cuándo vuelve a estar disponible.

👇 Ver evento:`;

      case "programado": {
        const fechaProgramada =
          freeDropProgramadoVisible?.fecha_inicio
            ? formatearFechaSegura(
                freeDropProgramadoVisible.fecha_inicio
              )
            : "";

        return `🔥 *${nombreEvento}*

⏳ *PRÓXIMO FREE DROP*

🏆 *Premio:* ${premioPrincipal}
🎟️ *Participación:* GRATIS${
          fechaProgramada
            ? `\n📅 *Disponible desde:* ${fechaProgramada}`
            : ""
        }

🎁 Próximamente podrás participar gratis.

👀 Entra a la página oficial para consultar el estado y los requisitos.

👇 Ver evento:`;
      }

      case "agotado":
        return `🔥 *${nombreEvento}*

🚫 *FREE DROP AGOTADO*

🏆 *Premio:* ${premioPrincipal}

⚡ Los cupos gratis de este FREE DROP ya fueron utilizados.

👀 Entra a la página oficial para consultar próximos FREE DROPS.

👇 Ver evento:`;

      case "cerrado":
        return `🔥 *${nombreEvento}*

🔒 *FREE DROP CERRADO*

🏆 *Premio:* ${premioPrincipal}

🎁 Este FREE DROP ya no está aceptando nuevas participaciones.

👀 Entra a la página oficial para consultar futuras oportunidades.

👇 Ver evento:`;

      case "desactivado":
      case "sin_activo":
      default:
        return `🔥 *${nombreEvento}*

🏆 *Premio:* ${premioPrincipal}

🎟️ Actualmente no hay un FREE DROP disponible para participar gratis.

👀 Entra a la página oficial y mantente pendiente de los próximos FREE DROPS.

👇 Ver evento:`;
    }
  };

  // =========================================================
  // DETECTAR MÓVIL
  // =========================================================

  const esDispositivoMovil =
    typeof navigator !== "undefined" &&
    (
      navigator.userAgentData?.mobile === true ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(
        navigator.userAgent || ""
      )
    );

  // =========================================================
  // TELÉFONOS
  //
  // Conservamos el comportamiento que ya estaba funcionando.
  // =========================================================

  if (
    esDispositivoMovil &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        title: nombreEvento,
        text: construirTexto(),
        url: urlBase,
      });

      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      console.warn(
        "No se pudo usar el menú nativo para compartir:",
        error
      );
    }
  }

  // =========================================================
  // LAPTOP / PC
  //
  // Generamos URL especial SOLO para WhatsApp.
  // Esto evita la vista previa vieja que WhatsApp tenía
  // guardada en caché.
  // =========================================================

  if (typeof window !== "undefined") {
    let urlWhatsApp = urlBase;

    try {
      const urlObj = new URL(
        urlBase,
        window.location.origin
      );

      const ahora = new Date();

      const versionDiaria =
        `${ahora.getFullYear()}` +
        `${String(ahora.getMonth() + 1).padStart(2, "0")}` +
        `${String(ahora.getDate()).padStart(2, "0")}`;

      urlObj.searchParams.set(
        "share",
        versionDiaria
      );

      urlWhatsApp = urlObj.toString();
    } catch (error) {
      console.warn(
        "No se pudo generar la URL de WhatsApp:",
        error
      );
    }

    // =======================================================
    // MISMO FORMATO QUE FloatingShareButton
    //
    // 1. Texto normal con emojis.
    // 2. Salto de línea.
    // 3. URL.
    // 4. encodeURIComponent UNA SOLA VEZ.
    // =======================================================

    const shareText =
      construirTexto();

    const mensajeWhatsApp =
      `${shareText}\n${urlWhatsApp}`;

    const whatsappUrl =
      `https://wa.me/?text=${encodeURIComponent(
        mensajeWhatsApp
      )}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }

  // =========================================================
  // FALLBACK
  // =========================================================

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      urlBase
    ) {
      await navigator.clipboard.writeText(urlBase);
    }
  } catch (error) {
    console.warn(
      "No se pudo copiar el enlace:",
      error
    );
  }
};

const registrarParticipacionGratis = async (e) => {
  e.preventDefault();

  const nombre = String(freeDropForm.nombre || "").trim();
  const apellido = String(freeDropForm.apellido || "").trim();
  const email = String(freeDropForm.email || "").trim();
  const telefonoLocal = String(freeDropForm.telefono || "").trim();
  const estado = String(freeDropForm.estado || "").trim();
  const captchaToken = String(
    freeDropForm.captchaToken || ""
  ).trim();

  const aceptaReglas = Boolean(
    freeDropForm.aceptaReglas
  );

  // ==========================================================
  // TELÉFONO INTERNACIONAL
  // ==========================================================

  const paisTelefono =
    PAISES_TELEFONO.find(
      (pais) =>
        pais.codigo === freeDropForm.paisTelefono
    ) || PAISES_TELEFONO[0];

  const telefonoDigitos =
    telefonoLocal.replace(/[^\d]/g, "");

  const prefijoDigitos =
    String(paisTelefono.prefijo || "").replace(
      /[^\d]/g,
      ""
    );

  const telefonoCompletoDigitos =
    `${prefijoDigitos}${telefonoDigitos}`;

  const telefono =
    `+${telefonoCompletoDigitos}`;

  // ==========================================================
  // REQUISITOS CONFIGURADOS DESDE ADMIN
  // ==========================================================

  const requiereFollow = Boolean(
    freeDropSettings?.require_follow
  );

  const requiereLike = Boolean(
    freeDropSettings?.require_like
  );

  const requiereComment = Boolean(
    freeDropSettings?.require_comment
  );

  const requiereShare = Boolean(
    freeDropSettings?.require_share
  );

  // ==========================================================
  // CONFIRMACIONES
  // ==========================================================

  const cumpleFollow =
    !requiereFollow ||
    Boolean(freeDropForm.confirmaFollow);

  const cumpleLike =
    !requiereLike ||
    Boolean(freeDropForm.confirmaLike);

  const cumpleComment =
    !requiereComment ||
    Boolean(freeDropForm.confirmaComment);

  const cumpleShare =
    !requiereShare ||
    Boolean(freeDropForm.confirmaShare);

  // ==========================================================
  // ELEGIBILIDAD
  //
  // Conservamos este booleano porque tu API/backend actual
  // ya lo utiliza.
  // ==========================================================

  const elegibilidad =
    cumpleFollow &&
    cumpleLike &&
    cumpleComment &&
    cumpleShare;

  // ==========================================================
  // VALIDACIONES BÁSICAS
  // ==========================================================

  if (
    !nombre ||
    !apellido ||
    !email ||
    !telefonoLocal ||
    !estado ||
    !captchaToken
  ) {
    await Swal.fire({
      icon: "warning",
      title: "Faltan datos",
      text:
        "Completa nombre, apellido, email, teléfono, estado y CAPTCHA.",
    });

    return;
  }

  if (!validarEmail(email)) {
    await Swal.fire({
      icon: "warning",
      title: "Email inválido",
      text: "Escribe un correo válido.",
    });

    return;
  }

  // ==========================================================
  // VALIDAR TELÉFONO
  // E.164 permite máximo 15 dígitos incluyendo código de país.
  // ==========================================================

  if (
    telefonoDigitos.length < 7 ||
    telefonoCompletoDigitos.length > 15
  ) {
    await Swal.fire({
      icon: "warning",
      title: "Teléfono inválido",
      text:
        "Escribe un número de teléfono válido para el país seleccionado.",
    });

    return;
  }

  // ==========================================================
  // VALIDAR REQUISITOS SOCIALES
  // ==========================================================

  if (!elegibilidad) {
    await Swal.fire({
      icon: "warning",
      title: "Completa los pasos requeridos",
      text:
        "Debes confirmar todos los requisitos activos antes de participar gratis.",
    });

    return;
  }

  // ==========================================================
  // REGLAS
  // ==========================================================

  if (!aceptaReglas) {
    await Swal.fire({
      icon: "warning",
      title: "Debes aceptar las reglas",
      text:
        "Debes aceptar las reglas oficiales para continuar.",
    });

    return;
  }

  // ==========================================================
  // COMPROBAR DROP
  // ==========================================================

  if (
    !freeDropPuedeParticipar ||
    !freeDropActivo?.id
  ) {
    await Swal.fire({
      icon: "warning",
      title: "FREE DROP no disponible",
      text:
        "Este FREE DROP ya no está activo. Actualiza la página e intenta nuevamente cuando vuelva a estar disponible.",
    });

    await cargarFreeDrop();

    return;
  }

  // ==========================================================
  // REQUEST
  // ==========================================================

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    setSubmittingFreeDrop(true);

    const res = await fetch(
      "/api/free-drops/join",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        signal: controller.signal,

        body: JSON.stringify({
          nombre,
          apellido,
          email,

          // Se envía ya normalizado:
          // +1..., +58..., +57..., etc.
          telefono,

          estado,
          aceptaReglas,
          elegibilidad,

          freeDropId: freeDropActivo.id,
          captchaToken,
        }),
      }
    );

    const data =
      await res.json().catch(() => ({}));

    // ========================================================
    // ERROR DEL BACKEND
    // ========================================================

    if (!res.ok) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo registrar",
        text:
          data.error ||
          "Ocurrió un error al registrar la participación.",
      });

      return;
    }

    // ========================================================
    // PARTICIPACIÓN EXITOSA
    // ========================================================

    const numeroParticipacion =
      data?.numero_participacion ??
      data?.ticket?.numero_ticket ??
      null;

    const codigoFree =
      data?.codigo_free ??
      data?.participacion?.codigo_unico ??
      "Sin código";

    const estadoVisual =
      data?.estado_visual ||
      (data?.requires_review
        ? "PENDIENTE"
        : "VÁLIDO");

    const registroGuardado = {
      evento:
        evento?.nombre ||
        "Evento",

      freeDrop:
        data?.drop?.nombre ||
        freeDropActivo?.nombre ||
        "FREE DROP #1",

      numeroParticipacion,
      codigoFree,
      estado: estadoVisual,

      fecha:
        data?.participacion?.created_at ||
        new Date().toISOString(),
    };

    // ========================================================
    // GUARDAR COMPROBANTE LOCAL
    // ========================================================

    try {
      if (
        typeof window !== "undefined"
      ) {
        const storageKey =
          `free_drop_registrado_${eventoId}`;

        window.localStorage.setItem(
          storageKey,
          JSON.stringify(registroGuardado)
        );
      }
    } catch (error) {
      console.warn(
        "No se pudo guardar la participación gratis en localStorage:",
        error
      );
    }

    // ========================================================
    // ACTUALIZAR ESTADO LOCAL
    // ========================================================

    setFreeDropRegistradoData(
      registroGuardado
    );

    setFreeDropRegistrado(true);

    setFreeDropConfirmacion(
      registroGuardado
    );

    // ========================================================
    // IMPORTANTE:
    // quitamos inmediatamente el estado "Enviando..."
    // antes de refrescar información del servidor.
    // ========================================================

    clearTimeout(timeoutId);

    setSubmittingFreeDrop(false);

    setShowFreeDropModal(false);

    setFreeDropForm(
      freeDropFormInicial
    );

    setShowFreeDropConfirmacion(true);

    // ========================================================
    // REFRESCAR DROP SIN BLOQUEAR LA CONFIRMACIÓN
    // ========================================================

    cargarFreeDrop().catch((error) => {
      console.warn(
        "No se pudo refrescar el FREE DROP después del registro:",
        error
      );
    });
  } catch (error) {
    console.error(error);

    if (error?.name === "AbortError") {
      await Swal.fire({
        icon: "error",
        title: "Tiempo agotado",
        text:
          "La solicitud tardó demasiado. Intenta nuevamente.",
      });
    } else {
      await Swal.fire({
        icon: "error",
        title: "Error inesperado",
        text:
          "No se pudo completar la participación gratis.",
      });
    }
  } finally {
    clearTimeout(timeoutId);

    setSubmittingFreeDrop(false);
  }
};

  return (
    <>
      <main className={`${styles.root} evento-page`}>
        <PublicTopbar
          active="eventos"
          onOpenVerifier={abrirVerificadorTickets}
          logoHref="/principal"
          inicioHref="/principal#inicio"
          eventosHref="/principal#eventos-disponibles"
          resultadosHref="/principal#resultados-oficiales"
          pagosHref="/principal#pagos"
          contactoHref="/principal#contacto"
        />

        {loading ? (
          <section className="evento-loading-wrap">
            <div className="evento-loading-grid">
              <div className="evento-loading-image" />
              <div className="evento-loading-side">
                <div className="evento-loading-card">
                  <div className="evento-loading-line large" />
                  <div className="evento-loading-line medium" />
                  <div className="evento-loading-line small" />
                </div>
                <div className="evento-loading-card">
                  <div className="evento-loading-line large" />
                  <div className="evento-loading-line medium" />
                  <div className="evento-loading-line small" />
                </div>
                <div className="evento-loading-card">
                  <div className="evento-loading-line large" />
                  <div className="evento-loading-line medium" />
                  <div className="evento-loading-line small" />
                </div>
              </div>
            </div>
          </section>
        ) : errorRed ? (
          <div className="evento-empty-state premium">
            <SiteLogo
              size="preview"
              className="evento-empty-logo"
              fallbackText="R"
            />

            <h2>Error de conexión</h2>
            <p>
              No se pudo cargar el evento. Verifica tu conexión e intenta de nuevo.
            </p>

            <button
              type="button"
              className="principal-red-btn"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          </div>
        ) : !evento ? (
          <div className="evento-empty-state premium">
            <SiteLogo
              size="preview"
              className="evento-empty-logo"
              fallbackText="R"
            />

            <h2>Evento no encontrado</h2>
            <p>
              Este evento no existe, no está publicado o ya no está disponible.
            </p>

            <Link href="/principal" className="principal-red-btn">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <section className="evento-wrap reveal-fade-up">
            <div className="evento-title-row">
              <div className="evento-title-center">
                {evento.destacada && (
                  <div className="evento-destacada-badge">⭐ Evento destacado</div>
                )}

                <h2>{evento.nombre || "Evento"}</h2>
                <p>{descripcion}</p>
              </div>
            </div>

            <div className="evento-grid">
              <div className="evento-image-panel">
                <RaffleDualImage
                  principalSrc={evento.portada_url}
                  secondarySrc={evento.portada_scroll_url}
                  alt={evento.nombre || "Evento"}
                  className={`evento-image-dual-wrap ${
                    estaFinalizado || estaAgotada ? "finalizada" : ""
                  }`}
                />

                <div className="evento-overlay" />

                {estaFinalizado && <div className="evento-ribbon">FINALIZADO</div>}
                {!estaFinalizado && estaAgotada && (
                  <div className="evento-ribbon">AGOTADO</div>
                )}

                <div className="evento-image-content">
                  <div
                    className={`evento-status ${
                      estaFinalizado || estaAgotada ? "off" : "on"
                    }`}
                  >
                    {estaFinalizado
                      ? "● Finalizada"
                      : estaAgotada
                      ? "● Agotada"
                      : "● Disponible"}
                  </div>

                  <h1>{evento.nombre || "Evento"}</h1>
                </div>
              </div>

              <div className="evento-side">
                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">ACCIONES</p>
                  <h2>Participar</h2>

                  <div className="evento-actions">
                    {!estaFinalizado && !estaAgotada ? (
                      <Link
                        href={`/?rifa=${evento.id}#boletos`}
                        className="principal-red-btn"
                      >
                        COMPRAR TICKETS
                      </Link>
                    ) : estaAgotada ? (
                      <button type="button" className="evento-disabled-btn" disabled>
                        BOLETOS AGOTADOS
                      </button>
                    ) : (
                      <button type="button" className="evento-disabled-btn" disabled>
                        EVENTO FINALIZADO
                      </button>
                    )}
                  </div>
                </div>

                {mostrarFreeDrop && (
                  <section
                    id="participacion-gratis"
                    ref={freeDropSectionRef}
                    className="evento-card premium-card-hover evento-free-drop-card"
                  >
                    <p className="evento-kicker">🎁 PARTICIPACIÓN GRATIS</p>

                    <div className={`evento-free-drop-status-line ${freeDropEstado}`}>
                      {freeDropEstadoLabel}
                    </div>

                    <h2>
                      {freeDropActivo?.nombre ||
                        freeDropProximo?.nombre ||
                        "PARTICIPACIÓN GRATIS"}
                      {freeDropEstado === "agotado" ? " — AGOTADO 🔴" : ""}
                    </h2>

                    <p className="evento-free-drop-subtitle">
                      {loadingFreeDrop
                        ? "Cargando participación gratis..."
                        : freeDropEstado === "desactivado"
                        ? "Participación gratis desactivada"
                        : freeDropEstado === "pausado"
                        ? "Participación temporalmente pausada. Vuelve más tarde."
                        : freeDropEstado === "programado"
                        ? freeDropActivo?.fecha_inicio
                          ? `Programado para ${formatearFechaSegura(
                              freeDropActivo.fecha_inicio
                            )}`
                          : "Este FREE DROP está programado y todavía no está activo."
                        : freeDropEstado === "cerrado"
                        ? "Este FREE DROP ya fue cerrado."
                        : freeDropEstado === "sin_activo"
                        ? freeDropProximo
                          ? `Próximo: ${freeDropProximo.nombre || "FREE DROP"}${
                              freeDropProximo.fecha_inicio
                                ? ` · ${formatearFechaSegura(
                                    freeDropProximo.fecha_inicio
                                  )}`
                                : ""
                            }`
                          : "Todavía no hay un FREE DROP activo"
                        : freeDropEstado === "agotado"
                        ? `${freeDropUsados} de ${freeDropTotal} participaciones utilizadas`
                        : `${freeDropDisponibles} participaciones gratis disponibles`}
                    </p>

                    {freeDropProgramadoVisible && (
                      <div
                        className="evento-free-drop-message"
                        style={{
                          display: "grid",
                          gap: "6px",
                          marginTop: "12px",
                          padding: "14px",
                        }}
                      >
                        <strong>⏰ PRÓXIMO FREE DROP</strong>

                        <span>
                          {freeDropProgramadoVisible.nombre || "FREE DROP"}
                        </span>

                        <span>
                          Disponible:{" "}
                          <strong>
                            {formatearFechaSegura(
                              freeDropProgramadoVisible.fecha_inicio
                            )}
                          </strong>
                        </span>

                        {freeDropCuentaRegresiva && (
                          <span>
                            Se activa en:{" "}
                            <strong>{freeDropCuentaRegresiva}</strong>
                          </span>
                        )}

                        <span style={{ opacity: 0.82 }}>
                          Se activará automáticamente.
                        </span>
                      </div>
                    )}

                    {freeDropActivo &&
                      !["sin_activo", "desactivado", "programado"].includes(
                        freeDropEstado
                      ) && (
                        <div className="evento-free-drop-progress">
                          <ProgressVentaBar
                            value={freeDropPorcentaje}
                            soldOut={freeDropEstado === "agotado"}
                            text={`${freeDropUsados} de ${freeDropTotal} participaciones utilizadas`}
                          />
                        </div>
                      )}

                    <button
                      type="button"
                      className={`principal-red-btn evento-free-drop-btn ${
                        loadingFreeDrop ||
                        !freeDropSettings?.enabled ||
                        !freeDropPuedeParticipar ||
                        freeDropRegistrado
                          ? "is-disabled"
                          : ""
                      }`}
                      onClick={abrirFreeDropModal}
                      disabled={
                        loadingFreeDrop ||
                        !freeDropSettings?.enabled ||
                        !freeDropPuedeParticipar ||
                        freeDropRegistrado
                      }
                    >
                      {freeDropRegistrado
                        ? textoBotonParticipacionGuardada
                        : freeDropEstado === "pausado"
                        ? "PARTICIPACIÓN PAUSADA"
                        : freeDropEstado === "agotado"
                        ? "FREE DROP AGOTADO"
                        : freeDropEstado === "programado"
                        ? "FREE DROP PROGRAMADO"
                        : freeDropEstado === "cerrado"
                        ? "FREE DROP CERRADO"
                        : freeDropEstado === "desactivado"
                        ? "PARTICIPACIÓN DESACTIVADA"
                        : freeDropEstado === "sin_activo"
                        ? "SIN FREE DROP ACTIVO"
                        : "PARTICIPAR GRATIS"}
                    </button>

                    {freeDropRegistrado && (
                      <div
                        className="evento-free-drop-message"
                        style={{
                          display: "grid",
                          gap: "8px",
                          marginTop: "6px",
                        }}
                      >
                        <strong>{mensajeParticipacionGuardada}</strong>

                        {freeDropRegistradoData?.numeroParticipacion != null && (
                          <span>
                            NÚMERO: #
                            {String(
                              freeDropRegistradoData.numeroParticipacion
                            ).padStart(padLength, "0")}
                          </span>
                        )}

                        {freeDropRegistradoData?.codigoFree && (
                          <span>CÓDIGO: {freeDropRegistradoData.codigoFree}</span>
                        )}

                        <span>ESTADO: {freeDropRegistradoData?.estado || "VÁLIDO"}</span>

                        {freeDropRegistradoData?.codigoFree && (
                          <button
                            type="button"
                            className="free-drop-btn-secondary"
                            onClick={() =>
                              abrirVerificadorFree(
                                freeDropRegistradoData.codigoFree
                              )
                            }
                          >
                            🔎 Verificar participación
                          </button>
                        )}
                      </div>
                    )}

                    <p className="evento-free-drop-note">
                      Solo una participación gratis por persona, por evento.
                    </p>

                    <p className="evento-free-drop-note">
                      Consulta las reglas oficiales.
                    </p>

                    {freeDropSettings?.public_message && (
                      <p className="evento-free-drop-message">
                        {freeDropSettings.public_message}
                      </p>
                    )}
                  </section>
                )}

                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">RESUMEN</p>
                  <h2>Datos principales</h2>

                  <div className="evento-mini-grid">
                    <div className="evento-mini-box">
                      <span>ESTADO</span>
                      <strong
                        className={
                          estaFinalizado || estaAgotada ? "text-red" : "text-green"
                        }
                      >
                        {evento.estado || "Disponible"}
                      </strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>VALOR TICKET</span>
                      <strong className="text-red">${precio.toFixed(2)}</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>FECHA</span>
                      <strong>{fecha || "Por confirmar"}</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>HORA</span>
                      <strong>{hora || "Por confirmar"}</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>PROGRESO</span>
                      <strong>{porcentajeVendido.toFixed(1)}%</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>VENDIDOS</span>
                      <strong>
                        {ticketsVendidos}
                        {totalNumeros > 0 ? ` / ${totalNumeros}` : ""}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">AVANCE DE VENTAS</p>
                  <h2>Progreso del evento</h2>

                  <ProgressVentaBar
                    value={porcentajeVendido}
                    soldOut={rifaCompleta}
                    text={
                      totalNumeros > 0
                        ? `${ticketsVendidos} de ${totalNumeros} boletos vendidos`
                        : "Progreso de venta"
                    }
                  />

                  {rifaCompleta && (
                    <p className="evento-description" style={{ marginTop: "12px" }}>
                      {estaFinalizado
                        ? "Este evento ya finalizó."
                        : estaAgotada
                        ? "Todos los boletos fueron vendidos. El evento está agotado y pendiente de sorteo."
                        : "Todos los boletos fueron vendidos."}
                    </p>
                  )}
                </div>

                {estaAgotada && !estaFinalizado && (
                  <div className="evento-card premium-card-hover">
                    <p className="evento-kicker">ESTADO DEL EVENTO</p>
                    <h2>Rifa completa</h2>
                    <p className="evento-description">
                      Todos los boletos fueron vendidos. Este evento está agotado y
                      pendiente del sorteo oficial.
                    </p>
                  </div>
                )}

                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">PREMIACIÓN</p>
                  <h2>Premios del evento</h2>

                  {premios.length > 0 ? (
                    <div className="evento-premios">
                      {premios.map((premio, index) => (
                        <div key={`${premio}-${index}`} className="evento-premio-item">
                          🎁 {premio}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="evento-premio-empty">
                      No hay premios definidos todavía.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {evento?.id && shareUrl && (
        <div className="evento-share-fab">
          <FloatingShareButton
            url={shareUrl}
            title={evento?.nombre || "Evento"}
            text={`🔥 *${evento?.nombre || "Evento"}*

🎉 *¡No te quedes por fuera!*
🏆 *Premio:* ${premios.length > 0 ? premios[0] : "Disponible"}
🎟️ *Valor del ticket:* $${precio.toFixed(2)}
📈 *Ventas del evento:* ${porcentajeVendido.toFixed(1)}%

✅ *Compra tus tickets en la PAGINA OFICIAL*
👇 Mira todos los detalles aquí:`}
          />
        </div>
      )}

{showFreeDropModal && (
  <div
    className="free-drop-modal-backdrop"
    onClick={cerrarFreeDropModal}
  >
    <div
      className="free-drop-modal"
      onClick={(e) => e.stopPropagation()}
    >
      {/* =====================================================
          CABECERA
      ====================================================== */}

      <div className="free-drop-modal-head">
        <div>
          <p className="evento-kicker">
            🎁 PARTICIPACIÓN GRATIS
          </p>

          <h2>
            {freeDropActivo?.nombre ||
              "FREE DROP #1"}
          </h2>
        </div>

        <button
          type="button"
          className="free-drop-modal-close"
          onClick={cerrarFreeDropModal}
          aria-label="Cerrar modal"
        >
          ✕
        </button>
      </div>

      <p className="free-drop-modal-description">
        ✨ Completa los pasos para participar gratis
      </p>

      {/* =====================================================
          MENSAJE PÚBLICO CONFIGURADO DESDE ADMIN
      ====================================================== */}

      {freeDropSettings?.public_message && (
        <div className="free-drop-modal-box">
          {freeDropSettings.public_message}
        </div>
      )}

      <form
        className="free-drop-form"
        onSubmit={registrarParticipacionGratis}
      >
        {/* ===================================================
            REQUISITOS
        ==================================================== */}

        {(freeDropSettings?.require_follow ||
          freeDropSettings?.require_like ||
          freeDropSettings?.require_comment ||
          freeDropSettings?.require_share) && (
          <div
            style={{
              display: "grid",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            {/* ===============================================
                1. SEGUIR INSTAGRAM
            ================================================ */}

            {freeDropSettings?.require_follow && (
              <div className="free-drop-modal-box">
                <strong>
                  ① 📸 Sigue nuestra cuenta de Instagram
                </strong>

                <div
                  style={{
                    marginTop: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <a
                    href={
                      freeDropSettings?.instagram_profile_url ||
                      "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="free-drop-btn-primary"
                    onClick={(e) => {
                      if (
                        !freeDropSettings
                          ?.instagram_profile_url
                      ) {
                        e.preventDefault();

                        Swal.fire({
                          icon: "info",
                          title:
                            "Instagram no configurado",
                          text:
                            "La cuenta de Instagram todavía no está configurada para este evento.",
                        });
                      }
                    }}
                  >
                    📸 ABRIR INSTAGRAM ↗
                  </a>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="confirmaFollow"
                    checked={
                      freeDropForm.confirmaFollow
                    }
                    onChange={
                      handleFreeDropChange
                    }
                  />

                  <span>
                    ✅ Confirmo que ya sigo la cuenta
                  </span>
                </label>
              </div>
            )}

            {/* ===============================================
                2. LIKE / COMENTARIO
            ================================================ */}

            {(freeDropSettings?.require_like ||
              freeDropSettings?.require_comment) && (
              <div className="free-drop-modal-box">
                <strong>
                  ② ❤️ Dale Me gusta y comenta la
                  publicación
                </strong>

                <div
                  style={{
                    marginTop: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <a
                    href={
                      freeDropSettings
                        ?.instagram_post_url ||
                      "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="free-drop-btn-primary"
                    onClick={(e) => {
                      if (
                        !freeDropSettings
                          ?.instagram_post_url
                      ) {
                        e.preventDefault();

                        Swal.fire({
                          icon: "info",
                          title:
                            "Publicación no configurada",
                          text:
                            "La publicación de Instagram todavía no está configurada para este evento.",
                        });
                      }
                    }}
                  >
                    ❤️ VER PUBLICACIÓN ↗
                  </a>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "9px",
                  }}
                >
                  {freeDropSettings?.require_like && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="confirmaLike"
                        checked={
                          freeDropForm.confirmaLike
                        }
                        onChange={
                          handleFreeDropChange
                        }
                      />

                      <span>
                        ❤️ Confirmo que di Me gusta
                      </span>
                    </label>
                  )}

                  {freeDropSettings
                    ?.require_comment && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="confirmaComment"
                        checked={
                          freeDropForm.confirmaComment
                        }
                        onChange={
                          handleFreeDropChange
                        }
                      />

                      <span>
                        💬 Confirmo que dejé mi
                        comentario
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* ===============================================
                3. COMPARTIR
            ================================================ */}

            {freeDropSettings?.require_share && (
              <div className="free-drop-modal-box">
                <strong>
                  ③ 📲 Comparte este evento con{" "}
                  {Math.max(
                    Number(
                      freeDropSettings?.share_to_count ||
                        0
                    ),
                    1
                  )}{" "}
                  {Math.max(
                    Number(
                      freeDropSettings?.share_to_count ||
                        0
                    ),
                    1
                  ) === 1
                    ? "persona"
                    : "personas"}
                </strong>

                <div
                  style={{
                    marginTop: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <button
                    type="button"
                    className="free-drop-btn-primary"
                    onClick={compartirFreeDrop}
                  >
                    📤 COMPARTIR EVENTO
                  </button>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="confirmaShare"
                    checked={
                      freeDropForm.confirmaShare
                    }
                    onChange={
                      handleFreeDropChange
                    }
                  />

                  <span>
                    📲 Confirmo que lo compartí
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* ===================================================
            RESUMEN
        ==================================================== */}

        <div
          className="free-drop-modal-box"
          style={{
            display: "grid",
            gap: "7px",
            marginBottom: "18px",
          }}
        >
          <span>
            🎟️ Una participación gratis por
            persona/evento
          </span>

          <span>
            ⚡ Sujeto a disponibilidad de cupos
          </span>

          <span>
            🛡️ Algunas participaciones pueden
            requerir revisión
          </span>
        </div>

        {/* ===================================================
            DATOS PERSONALES
        ==================================================== */}

        <div
          style={{
            marginBottom: "10px",
          }}
        >
          <strong>👤 Tus datos</strong>
        </div>

        <div className="free-drop-form-grid">
          {/* NOMBRE */}

          <label className="free-drop-form-field">
            <span>Nombre *</span>

            <input
              type="text"
              name="nombre"
              value={freeDropForm.nombre}
              onChange={handleFreeDropChange}
              placeholder="Tu nombre"
              autoComplete="given-name"
              required
            />
          </label>

          {/* APELLIDO */}

          <label className="free-drop-form-field">
            <span>Apellido *</span>

            <input
              type="text"
              name="apellido"
              value={freeDropForm.apellido}
              onChange={handleFreeDropChange}
              placeholder="Tu apellido"
              autoComplete="family-name"
              required
            />
          </label>

          {/* EMAIL */}

          <label className="free-drop-form-field">
            <span>Correo electrónico *</span>

            <input
              type="email"
              name="email"
              value={freeDropForm.email}
              onChange={handleFreeDropChange}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </label>

          {/* =================================================
              TELÉFONO + BANDERA + PAÍS
          ================================================== */}

          <div className="free-drop-form-field">
            <span>📱 Teléfono *</span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(150px, 0.9fr) minmax(150px, 1.1fr)",
                gap: "8px",
              }}
            >
              <select
                name="paisTelefono"
                value={
                  freeDropForm.paisTelefono
                }
                onChange={
                  handleFreeDropChange
                }
                aria-label="País del teléfono"
                required
              >
                {PAISES_TELEFONO.map(
                  (pais) => (
                    <option
                      key={pais.codigo}
                      value={pais.codigo}
                    >
                      {pais.bandera}{" "}
                      {pais.prefijo} ·{" "}
                      {pais.nombre}
                    </option>
                  )
                )}
              </select>

              <input
                type="tel"
                name="telefono"
                value={
                  freeDropForm.telefono
                }
                onChange={
                  handleFreeDropChange
                }
                placeholder="Número de teléfono"
                inputMode="tel"
                autoComplete="tel-national"
                required
              />
            </div>
          </div>

          {/* ESTADO / PROVINCIA */}

          <label className="free-drop-form-field">
            <span>
              Estado / provincia *
            </span>

            <input
              type="text"
              name="estado"
              value={freeDropForm.estado}
              onChange={handleFreeDropChange}
              placeholder="Tu estado / provincia"
              autoComplete="address-level1"
              required
            />
          </label>

          {/* CAPTCHA */}

          <div className="free-drop-form-field full">
            <span>
              🤖 Verificación CAPTCHA *
            </span>

            <TurnstileWidget
              onToken={
                handleTurnstileToken
              }
            />
          </div>

          {/* REGLAS */}

          <label
            className="free-drop-form-field full"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="aceptaReglas"
              checked={
                freeDropForm.aceptaReglas
              }
              onChange={
                handleFreeDropChange
              }
            />

            <span>
              📋 He leído y acepto las reglas de
              participación del FREE DROP *
            </span>
          </label>
        </div>

        {/* ===================================================
            BOTONES
        ==================================================== */}

        <div className="free-drop-form-actions">
          <button
            type="button"
            className="free-drop-btn-secondary"
            onClick={cerrarFreeDropModal}
            disabled={
              submittingFreeDrop
            }
          >
            CANCELAR
          </button>

          <button
            type="submit"
            className="free-drop-btn-primary"
            disabled={
              submittingFreeDrop ||
              !freeDropForm.captchaToken
            }
          >
            {submittingFreeDrop
              ? "Enviando..."
              : "🎁 PARTICIPAR GRATIS"}
          </button>
        </div>

        {/* ===================================================
            INFORMACIÓN IMPORTANTE
            DEBE QUEDAR DEBAJO DE LOS BOTONES
        ==================================================== */}

        <div
          className="free-drop-modal-box"
          style={{
            marginTop: "18px",
          }}
        >
          <strong>
            Información importante ⚠️
          </strong>

          <div
            style={{
              display: "grid",
              gap: "7px",
              marginTop: "10px",
            }}
          >
            <span>
              • 🎟️ Se permite una sola
              participación gratis por persona y
              por evento.
            </span>

            <span>
              • ⏳ El registro está sujeto a
              disponibilidad de cupos del FREE
              DROP.
            </span>

            <span>
              • 🚫 No se permiten
              participaciones duplicadas con el
              mismo email o teléfono.
            </span>

            <span>
              • 🛡️ Algunas participaciones
              pueden quedar pendientes para
              revisión antes de ser consideradas
              válidas.
            </span>

            <span>
              • ⏱️ Una participación pendiente
              no debe considerarse aprobada
              hasta que su estado cambie a
              válida.
            </span>

            <span>
              • ⚠️ Las participaciones que no
              cumplan los requisitos o las
              reglas pueden ser rechazadas o
              anuladas.
            </span>

            <span>
              • 🔐 Conserva tu código FREE para
              consultar posteriormente el estado
              de tu participación.
            </span>
          </div>
        </div>
      </form>
    </div>
  </div>
)}

      {showFreeDropConfirmacion && freeDropConfirmacion && (
        <div
          className="free-drop-modal-backdrop"
          onClick={cerrarConfirmacionFreeDrop}
        >
          <div
            className="free-drop-modal free-drop-confirmation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="free-drop-modal-head">
              <div>
                <p className="evento-kicker">🎉 ¡PARTICIPACIÓN CONFIRMADA!</p>
                <h2>{evento?.nombre || "Evento"}</h2>
              </div>

              <button
                type="button"
                className="free-drop-modal-close"
                onClick={cerrarConfirmacionFreeDrop}
                aria-label="Cerrar confirmación"
              >
                ✕
              </button>
            </div>

            <p className="free-drop-modal-description">
              Tu participación gratis ha sido registrada correctamente.
            </p>

            <div
              className="free-drop-modal-box"
              style={{
                textAlign: "center",
                lineHeight: 1.8,
                padding: "18px",
              }}
            >
              <p>
                <strong>Evento:</strong> {freeDropConfirmacion.evento}
              </p>

              <p>
                <strong>FREE DROP:</strong> {freeDropConfirmacion.freeDrop}
              </p>

              <p>
                <strong>NÚMERO DE PARTICIPACIÓN:</strong>{" "}
                <span style={{ fontSize: "22px", fontWeight: 800 }}>
                  #
                  {String(freeDropConfirmacion.numeroParticipacion || "").padStart(
                    padLength,
                    "0"
                  )}
                </span>
              </p>

              <p>
                <strong>CÓDIGO DE VERIFICACIÓN:</strong>{" "}
                <span style={{ fontWeight: 800, letterSpacing: "1px" }}>
                  {freeDropConfirmacion.codigoFree}
                </span>
              </p>

              <p>
                <strong>ESTADO:</strong>{" "}
                <span style={{ fontWeight: 800 }}>{freeDropConfirmacion.estado}</span>
              </p>

              <p style={{ marginTop: "12px" }}>
                <strong>1 participación gratis por persona, por evento.</strong>
              </p>

              <p style={{ marginTop: "8px" }}>
                <strong>Fecha:</strong> {formatearFechaSegura(freeDropConfirmacion.fecha)}
              </p>
            </div>

            <div className="free-drop-form-actions">
              <button
                type="button"
                className="free-drop-btn-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      freeDropConfirmacion.codigoFree
                    );
                    await Swal.fire({
                      icon: "success",
                      title: "Copiado",
                      text: "El código FREE fue copiado al portapapeles",
                      timer: 1200,
                      showConfirmButton: false,
                    });
                  } catch {
                    await Swal.fire({
                      icon: "error",
                      title: "Error",
                      text: "No se pudo copiar el código",
                    });
                  }
                }}
              >
                Copiar código
              </button>

              <button
                type="button"
                className="free-drop-btn-primary"
                onClick={() =>
                  abrirVerificadorFree(freeDropConfirmacion.codigoFree)
                }
              >
                🔎 Verificar participación
              </button>
            </div>

            <div className="free-drop-form-actions">
              <button
                type="button"
                className="principal-white-btn"
                onClick={cerrarConfirmacionFreeDrop}
              >
                ↩ Volver al evento
              </button>
            </div>
          </div>
        </div>
      )}

      <VerifyTicketsModal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        email={verificarEmail}
        setEmail={setVerificarEmail}
        rifaId={evento?.id || null}
        initialMode={verificadorModoInicial}
        initialFreeCode={verificadorCodigoFreeInicial}
      />
    </>
  );
}