"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";

const TABS = [
  { id: "general", label: "General", icon: "🏷️" },
  { id: "contacto", label: "Contacto", icon: "📞" },
  { id: "home", label: "Textos Home", icon: "🏠" },
  { id: "menus", label: "Menú público", icon: "🧭" },
  { id: "colores", label: "Colores", icon: "🎨" },
  { id: "pagos", label: "Métodos de pago", icon: "💳" },
  { id: "seo", label: "SEO", icon: "🌎" },
  { id: "popup", label: "Popup", icon: "📢" },
];

const COLOR_FIELDS = [
  ["color_primario", "Color principal / Marca"],
  ["color_secundario", "Títulos fuertes"],
  ["color_fondo", "Fondo general"],
  ["color_texto", "Texto principal"],
  ["color_boton", "Botones principales"],
  ["color_progreso_fondo", "Fondo de la barra"],
  ["color_progreso", "Barra de porcentaje"],
  ["color_tarjeta", "Tarjetas / Cajas"],
  ["color_borde", "Bordes suaves"],
  ["color_alerta", "Alertas"],
  ["color_exito", "Éxito / aprobado"],
  ["color_error", "Error / peligro"],
  ["color_hover", "Hover botones"],
];

const DEFAULT_METODOS = [
  {
    id: "binance",
    activo: true,
    orden: 1,
    nombre: "Binance",
    cuenta: "",
    titular: "",
    subtitulo: "ID",
    descripcion: "",
    logo: "/payment/binance.png",
    extra: [],
    nota: "",
  },
  {
    id: "zelle",
    activo: true,
    orden: 2,
    nombre: "Zelle",
    cuenta: "",
    titular: "",
    subtitulo: "EMAIL",
    descripcion: "",
    logo: "/payment/zelle.png",
    extra: [],
    nota: "",
  },
  {
    id: "paypal",
    activo: true,
    orden: 3,
    nombre: "PayPal",
    cuenta: "",
    titular: "",
    subtitulo: "USUARIO",
    descripcion: "",
    logo: "/payment/paypal.png",
    extra: [],
    nota: "",
  },
  {
    id: "cashapp",
    activo: true,
    orden: 4,
    nombre: "Cash App",
    cuenta: "",
    titular: "",
    subtitulo: "CASH TAG",
    descripcion: "",
    logo: "/payment/cashapp.png",
    extra: [],
    nota: "",
  },
  {
    id: "apppay",
    activo: true,
    orden: 5,
    nombre: "App Pay",
    cuenta: "",
    titular: "",
    subtitulo: "PAGO RÁPIDO",
    descripcion: "",
    logo: "/payment/apppay.png",
    extra: [],
    nota: "",
  },
];

function limpiarTextoBasico(texto = "") {
  return String(texto ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function limpiarTextoMarketing(texto = "") {
  return limpiarTextoBasico(texto)
    .replace(/\s*55\s*$/g, "")
    .trim();
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();

  if (!clean) return null;

  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  const num = parseInt(full, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function crearId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `metodo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function esVerdadero(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  );
}

function normalizarMetodosPago(lista) {
  if (!Array.isArray(lista) || lista.length === 0) {
    return DEFAULT_METODOS.map((item) => ({ ...item }));
  }

  return lista.map((metodo, index) => ({
    ...metodo,
    id: metodo?.id || crearId(),
    activo: metodo?.activo !== false,
    orden: Number.isFinite(Number(metodo?.orden))
      ? Number(metodo.orden)
      : index + 1,
    nombre: metodo?.nombre || "",
    cuenta: metodo?.cuenta || "",
    titular: metodo?.titular || "",
    subtitulo: metodo?.subtitulo || "",
    descripcion: metodo?.descripcion || "",
    logo: metodo?.logo || "",
    extra: Array.isArray(metodo?.extra) ? metodo.extra : [],
    nota: metodo?.nota || "",
  }));
}

function normalizarConfig(data) {
  return {
    ...data,
    logo_url: data?.logo_url || "",
    nombre_marca: data?.nombre_marca || "RIFAS LSD",
    slogan: data?.slogan || "",
    descripcion_home: data?.descripcion_home || "",
    descripcion_principal: data?.descripcion_principal || "",
    descripcion: data?.descripcion || "",
    home_titulo: data?.home_titulo || "",
    home_subtitulo: data?.home_subtitulo || "",
    home_mensaje: data?.home_mensaje || "",
    home_boton_comprar: data?.home_boton_comprar || "",
    home_boton_verificar: data?.home_boton_verificar || "",
    home_imagen_principal: data?.home_imagen_principal || "",
    home_imagen_secundaria: data?.home_imagen_secundaria || "",
    slogan_frase_1: data?.slogan_frase_1 || "",
    slogan_frase_2: data?.slogan_frase_2 || "",
    slogan_frase_3: data?.slogan_frase_3 || "",
    slogan_frase_4: data?.slogan_frase_4 || "",
    whatsapp: data?.whatsapp || "",
    instagram: data?.instagram || "",
    telegram: data?.telegram || "",
    correo: data?.correo || "",
    facebook: data?.facebook || "",
    tiktok: data?.tiktok || "",
    youtube: data?.youtube || "",
    principal_titulo_eventos: data?.principal_titulo_eventos || "",
    principal_texto_eventos: data?.principal_texto_eventos || "",
    principal_titulo_resultados: data?.principal_titulo_resultados || "",
    principal_titulo_ganadores: data?.principal_titulo_ganadores || "",
    principal_texto_contacto: data?.principal_texto_contacto || "",
    footer_texto: data?.footer_texto || "",
    footer_mostrar_redes: data?.footer_mostrar_redes !== false,
    menu_inicio: data?.menu_inicio || "",
    menu_eventos: data?.menu_eventos || "",
    menu_resultados: data?.menu_resultados || "",
    menu_ganadores: data?.menu_ganadores || "",
    menu_pagos: data?.menu_pagos || "",
    menu_contacto: data?.menu_contacto || "",
    menu_verificador: data?.menu_verificador || "",
    metodos_pago: normalizarMetodosPago(data?.metodos_pago),
    tono_global: Number(data?.tono_global ?? 0),
    luminosidad_global: Number(data?.luminosidad_global ?? 100),
    brillo_global: Number(data?.brillo_global ?? 100),
    contraste_global: Number(data?.contraste_global ?? 100),
    saturacion_global: Number(data?.saturacion_global ?? 100),
    notificaciones_activas: data?.notificaciones_activas !== false,
    notificaciones_duracion: Number(data?.notificaciones_duracion ?? 3),
    notificaciones_posicion: data?.notificaciones_posicion || "bottom-left",
    popup_activo: esVerdadero(data?.popup_activo),
    popup_titulo: data?.popup_titulo || "",
    popup_mensaje: data?.popup_mensaje || "",
    popup_boton: data?.popup_boton || "",
    popup_imagen: data?.popup_imagen || "",
    popup_link: data?.popup_link || "",
    seo_titulo: data?.seo_titulo || "",
    seo_descripcion: data?.seo_descripcion || "",
    seo_imagen: data?.seo_imagen || "",
    color_primario: data?.color_primario || "#dc2626",
    color_secundario: data?.color_secundario || "#111827",
    color_fondo: data?.color_fondo || "#ffffff",
    color_texto: data?.color_texto || "#111827",
    color_boton: data?.color_boton || "#dc2626",
    color_tarjeta: data?.color_tarjeta || "#ffffff",
    color_borde: data?.color_borde || "#e5e7eb",
    color_alerta: data?.color_alerta || "#f97316",
    color_exito: data?.color_exito || "#16a34a",
    color_error: data?.color_error || "#dc2626",
    color_hover: data?.color_hover || "#b91c1c",
    color_progreso: data?.color_progreso || "#dc2626",
    color_progreso_fondo: data?.color_progreso_fondo || "#e5e7eb",
  };
}

async function leerJsonSeguro(res, etiqueta = "API") {
  const raw = await res.text();

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      raw || `La respuesta de ${etiqueta} no devolvió un JSON válido.`
    );
  }
}

export default function AdminConfiguracionSection() {
  const [tab, setTab] = useState("general");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");

  const logoInputRef = useRef(null);

  useEffect(() => {
    cargarConfig();
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl && String(logoPreviewUrl).startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  async function cargarConfig() {
    try {
      setLoading(true);

      const res = await fetch("/api/admin-configuracion", {
        method: "GET",
        cache: "no-store",
      });

      const data = await leerJsonSeguro(res, "/api/admin-configuracion");

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "No se pudo cargar la configuración.");
      }

      setConfig(normalizarConfig(data.configuracion));
      setLogoPreviewUrl("");
    } catch (error) {
      console.error(error);

      Swal.fire({
        title: "Error",
        text: error.message || "No se pudo cargar la configuración.",
        icon: "error",
        background: "#111116",
        color: "#fff",
      });
    } finally {
      setLoading(false);
    }
  }

  function cambiarCampo(campo, valor) {
    setConfig((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function cambiarMetodo(index, campo, valor) {
    setConfig((prev) => {
      const lista = [...(prev?.metodos_pago || [])];

      lista[index] = {
        ...lista[index],
        [campo]: valor,
      };

      return {
        ...prev,
        metodos_pago: lista,
      };
    });
  }

  function agregarMetodoPago() {
    setConfig((prev) => {
      const lista = prev?.metodos_pago || [];

      return {
        ...prev,
        metodos_pago: [
          ...lista,
          {
            id: crearId(),
            activo: true,
            orden: lista.length + 1,
            nombre: "Nuevo método",
            cuenta: "",
            titular: "",
            subtitulo: "CUENTA",
            descripcion: "",
            logo: "",
            extra: [],
            nota: "",
          },
        ],
      };
    });

    setTab("pagos");
  }

  async function eliminarMetodoPago(index) {
    const metodo = config?.metodos_pago?.[index];

    const result = await Swal.fire({
      title: "¿Eliminar método?",
      text: `Se eliminará ${metodo?.nombre || "este método de pago"}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      background: "#15151b",
      color: "#fff",
    });

    if (!result.isConfirmed) return;

    setConfig((prev) => ({
      ...prev,
      metodos_pago: (prev?.metodos_pago || []).filter((_, i) => i !== index),
    }));
  }

  async function subirLogo(file) {
    if (!file) return;

    const tiposPermitidos = ["image/png", "image/jpeg", "image/webp"];

    if (!tiposPermitidos.includes(file.type)) {
      Swal.fire({
        title: "Formato no permitido",
        text: "Solo puedes utilizar PNG, JPG o WEBP.",
        icon: "warning",
        background: "#15151b",
        color: "#fff",
      });

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }

      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        title: "Archivo demasiado grande",
        text: "El logo no puede superar los 5 MB.",
        icon: "warning",
        background: "#15151b",
        color: "#fff",
      });

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }

      return;
    }

    let tempLogoUrl = "";

    try {
      setSubiendoLogo(true);

      tempLogoUrl = URL.createObjectURL(file);
      setLogoPreviewUrl(tempLogoUrl);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin-configuracion/logo", {
        method: "POST",
        body: formData,
      });

      const data = await leerJsonSeguro(res, "/api/admin-configuracion/logo");

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo subir el logo.");
      }

      setConfig(normalizarConfig(data.configuracion));
      setLogoPreviewUrl("");

      window.dispatchEvent(new Event("site-config-updated"));
      localStorage.setItem("site-config-updated", String(Date.now()));

      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("site-config-channel");
        channel.postMessage({ type: "site-config-updated" });
        channel.close();
      }

      Swal.fire({
        title: "Logo actualizado",
        text: "El logo fue subido correctamente.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#15151b",
        color: "#fff",
      });
    } catch (error) {
      console.error(error);
      setLogoPreviewUrl("");

      Swal.fire({
        title: "Error",
        text: error.message || "No se pudo subir el logo.",
        icon: "error",
        background: "#15151b",
        color: "#fff",
      });
    } finally {
      setSubiendoLogo(false);

      if (tempLogoUrl && String(tempLogoUrl).startsWith("blob:")) {
        URL.revokeObjectURL(tempLogoUrl);
      }

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  }

  async function guardarCambios() {
    if (!config) return;

    try {
      setGuardando(true);

      const payload = {
        logo_url: config.logo_url || null,
        nombre_marca: limpiarTextoBasico(config.nombre_marca) || null,
        slogan: limpiarTextoMarketing(config.slogan) || null,
        descripcion_home: limpiarTextoMarketing(config.descripcion_home) || null,

        whatsapp: config.whatsapp || null,
        instagram: config.instagram || null,
        telegram: config.telegram || null,
        correo: config.correo || null,
        facebook: config.facebook || null,
        tiktok: config.tiktok || null,
        youtube: config.youtube || null,

        home_titulo: limpiarTextoBasico(config.home_titulo) || null,
        home_subtitulo: limpiarTextoMarketing(config.home_subtitulo) || null,
        home_mensaje: limpiarTextoMarketing(config.home_mensaje) || null,
        home_boton_comprar:
          limpiarTextoBasico(config.home_boton_comprar) || "COMPRAR AHORA",
        home_boton_verificar:
          limpiarTextoBasico(config.home_boton_verificar) ||
          "VERIFICAR TICKETS",

        home_imagen_principal: config.home_imagen_principal || null,
        home_imagen_secundaria: config.home_imagen_secundaria || null,

        menu_inicio: limpiarTextoBasico(config.menu_inicio) || "INICIO",
        menu_eventos: limpiarTextoBasico(config.menu_eventos) || "EVENTOS",
        menu_resultados:
          limpiarTextoBasico(config.menu_resultados) || "RESULTADOS",
        menu_ganadores:
          limpiarTextoBasico(config.menu_ganadores) || "GANADORES",
        menu_pagos:
          limpiarTextoBasico(config.menu_pagos) || "CUENTAS DE PAGO",
        menu_contacto: limpiarTextoBasico(config.menu_contacto) || "CONTACTO",
        menu_verificador:
          limpiarTextoBasico(config.menu_verificador) || "✔ VERIFICADOR",

        color_primario: config.color_primario || "#dc2626",
        color_secundario: config.color_secundario || "#111827",
        color_fondo: config.color_fondo || "#ffffff",
        color_texto: config.color_texto || "#111827",
        color_boton: config.color_boton || "#dc2626",
        color_tarjeta: config.color_tarjeta || "#ffffff",
        color_borde: config.color_borde || "#e5e7eb",
        color_alerta: config.color_alerta || "#f97316",
        color_exito: config.color_exito || "#16a34a",
        color_error: config.color_error || "#dc2626",
        color_hover: config.color_hover || "#b91c1c",
        color_progreso: config.color_progreso || null,
        color_progreso_fondo: config.color_progreso_fondo || null,

        metodos_pago: normalizarMetodosPago(config.metodos_pago),

        seo_titulo:
          limpiarTextoBasico(config.seo_titulo) ||
          "Rifas LSD | Compra tus tickets",
        seo_descripcion:
          limpiarTextoMarketing(config.seo_descripcion) ||
          "Compra tus tickets, verifica tus números y consulta eventos disponibles.",
        seo_imagen: config.seo_imagen || "/og-image.png",

        popup_activo: Boolean(config.popup_activo),
        popup_titulo: limpiarTextoBasico(config.popup_titulo) || null,
        popup_mensaje: limpiarTextoMarketing(config.popup_mensaje) || null,
        popup_boton: limpiarTextoBasico(config.popup_boton) || null,
        popup_imagen: config.popup_imagen || null,
        popup_link: config.popup_link || null,

        notificaciones_activas: Boolean(config.notificaciones_activas),
        notificaciones_duracion: Number(config.notificaciones_duracion || 3),
        notificaciones_posicion: config.notificaciones_posicion || "bottom-left",

        principal_titulo_eventos:
          limpiarTextoBasico(config.principal_titulo_eventos) ||
          "EVENTOS DISPONIBLES",

        principal_texto_eventos:
          limpiarTextoMarketing(config.principal_texto_eventos) ||
          "Participa en nuestras rifas activas.",

        principal_titulo_resultados:
          limpiarTextoBasico(config.principal_titulo_resultados) ||
          "RESULTADOS OFICIALES",

        principal_titulo_ganadores:
          limpiarTextoBasico(config.principal_titulo_ganadores) ||
          "HISTORIAL DE GANADORES",

        principal_texto_contacto:
          limpiarTextoMarketing(config.principal_texto_contacto) ||
          "Conéctate con nosotros.",

        footer_texto:
          limpiarTextoMarketing(config.footer_texto) ||
          "Todos los derechos reservados.",

        footer_mostrar_redes: Boolean(config.footer_mostrar_redes),

        saturacion_global: Number(config.saturacion_global ?? 100),
        brillo_global: Number(config.brillo_global ?? 100),
        contraste_global: Number(config.contraste_global ?? 100),
        tono_global: Number(config.tono_global ?? 0),
        luminosidad_global: Number(config.luminosidad_global ?? 100),

        descripcion_principal:
          limpiarTextoMarketing(config.descripcion_principal) || null,

        slogan_frase_1: limpiarTextoMarketing(config.slogan_frase_1) || null,
        slogan_frase_2: limpiarTextoMarketing(config.slogan_frase_2) || null,
        slogan_frase_3: limpiarTextoMarketing(config.slogan_frase_3) || null,
        slogan_frase_4: limpiarTextoMarketing(config.slogan_frase_4) || null,

        descripcion: limpiarTextoMarketing(config.descripcion) || null,
      };

      const res = await fetch("/api/admin-configuracion", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await leerJsonSeguro(res, "/api/admin-configuracion");

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "No se pudo guardar la configuración.");
      }

      setConfig(normalizarConfig(data.configuracion));
      setLogoPreviewUrl("");

      window.dispatchEvent(new Event("site-config-updated"));
      localStorage.setItem("site-config-updated", String(Date.now()));

      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("site-config-channel");
        channel.postMessage({ type: "site-config-updated" });
        channel.close();
      }

      Swal.fire({
        icon: "success",
        title: "Configuración guardada",
        text: "Los cambios fueron guardados correctamente.",
        timer: 1600,
        showConfirmButton: false,
        background: "#15151b",
        color: "#fff",
      });
    } catch (error) {
      console.error(error);

      Swal.fire({
        title: "Error al guardar",
        text: error.message || "No se pudo guardar la configuración.",
        icon: "error",
        background: "#15151b",
        color: "#fff",
      });
    } finally {
      setGuardando(false);
    }
  }

  const previewData = useMemo(() => {
    return {
      logo: logoPreviewUrl || config?.logo_url || "/logo.png",

      nombreMarca: limpiarTextoBasico(config?.nombre_marca) || "RIFAS LSD",

      tituloPrincipal:
        limpiarTextoBasico(config?.home_titulo) ||
        limpiarTextoBasico(config?.nombre_marca) ||
        "RIFAS LSD",

      descripcionPrincipal:
        limpiarTextoMarketing(config?.descripcion_principal) ||
        "Participación segura, clara y profesional.",

      slogan1:
        limpiarTextoMarketing(config?.slogan_frase_1) ||
        "Visión, crecimiento y constancia.",

      slogan2:
        limpiarTextoMarketing(config?.slogan_frase_2) ||
        "Eventos creados con seriedad y compromiso.",

      slogan3:
        limpiarTextoMarketing(config?.slogan_frase_3) ||
        "Una marca enfocada en avanzar cada día.",

      slogan4:
        limpiarTextoMarketing(config?.slogan_frase_4) ||
        "Participación segura, clara y profesional.",

      descripcion:
        limpiarTextoMarketing(config?.descripcion) ||
        limpiarTextoMarketing(config?.home_mensaje) ||
        "Compra tus números, sube tu comprobante y participa de forma rápida y segura. ✅",

      botonComprar:
        limpiarTextoBasico(config?.home_boton_comprar) || "COMPRAR AHORA",

      colorPrimario: config?.color_primario || "#dc2626",
      colorBoton: config?.color_boton || "#dc2626",
    };
  }, [config, logoPreviewUrl]);

  const botonRgb = hexToRgb(previewData.colorBoton) || {
    r: 220,
    g: 38,
    b: 38,
  };

  const previewStyle = useMemo(
    () => ({
      background: config?.color_tarjeta || "#ffffff",
      color: config?.color_texto || "#111827",
      borderColor: config?.color_primario || "#dc2626",
    }),
    [config]
  );

  const metodosOrdenados = useMemo(() => {
    return [...(config?.metodos_pago || [])].sort(
      (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
    );
  }, [config?.metodos_pago]);

  if (loading) {
    return (
      <div className="admin-config-loading-screen">
        <div className="admin-config-loader">
          <div className="admin-spinner" />
          <strong>Cargando configuración...</strong>
          <span>Preparando panel administrativo</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="admin-config-empty">
        <div className="admin-empty-icon">⚙️</div>
        <h3>No se encontró configuración</h3>
        <p>No existe ningún registro en configuracion_sitio.</p>

        <button
          type="button"
          className="admin-config-primary-btn"
          onClick={cargarConfig}
        >
          🔄 Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <section className="admin-config-page">
      {/* HEADER */}
      <div className="admin-config-header">
        <div className="admin-config-title-area">
          <span className="admin-config-kicker">PANEL PREMIUM</span>

          <h2>⚙️ Configuración general</h2>

          <p>
            Controla la identidad, textos, colores, pagos, redes y apariencia
            de tu sitio desde un solo lugar.
          </p>
        </div>

        <button
          type="button"
          className="admin-config-save-top"
          onClick={guardarCambios}
          disabled={guardando || subiendoLogo}
        >
          {guardando ? (
            <>
              <span className="mini-spinner" />
              GUARDANDO...
            </>
          ) : (
            <>💾 GUARDAR CAMBIOS</>
          )}
        </button>
      </div>

      {/* TABS */}
      <div className="admin-config-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-config-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <span className="admin-config-tab-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENIDO */}
      <div className="admin-config-layout">
        <div className="admin-config-content">
          {/* =====================================================
              GENERAL / IDENTIDAD
          ===================================================== */}
          {tab === "general" && (
            <div className="admin-config-card identidad-sitio-card">
              <div className="identidad-header">
                <div>
                  <span className="identidad-kicker">
                    CONFIGURACIÓN DE MARCA
                  </span>

                  <h3>🏷️ IDENTIDAD DEL SITIO</h3>

                  <p>
                    Personaliza la identidad principal de tu sitio sin tocar
                    código.
                  </p>
                </div>
              </div>

              {/* LOGO */}
              <div className="identidad-section">
                <div className="section-title-row">
                  <div>
                    <h4>LOGO DE LA MARCA</h4>
                    <span>
                      Imagen principal utilizada para representar tu marca.
                    </span>
                  </div>
                </div>

                <div className="logo-upload-area">
                  <div className="logo-preview-large">
                    {logoPreviewUrl || config.logo_url ? (
                      <img
                        src={logoPreviewUrl || config.logo_url}
                        alt={config.nombre_marca || "Logo"}
                      />
                    ) : (
                      <div className="logo-placeholder">
                        <span>
                          {(config.nombre_marca || "R")
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <small>LOGO ACTUAL</small>
                      </div>
                    )}
                  </div>

                  <div className="logo-upload-actions">
                    <label
                      className={`btn-upload-logo ${
                        subiendoLogo ? "uploading" : ""
                      }`}
                    >
                      {subiendoLogo ? "⏳ SUBIENDO..." : "📤 CAMBIAR LOGO"}

                      <input
                        ref={logoInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        hidden
                        disabled={subiendoLogo}
                        onChange={(e) => subirLogo(e.target.files?.[0])}
                      />
                    </label>

                    <div className="logo-help">
                      <span>PNG • JPG • WEBP</span>
                      <small>Recomendado: PNG transparente</small>
                      <small>Tamaño máximo: 5 MB</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* NOMBRE */}
              <div className="identidad-section">
                <Field
                  label="NOMBRE DE LA MARCA"
                  help="Nombre principal que identificará tu sitio."
                >
                  <input
                    className="identidad-input"
                    value={config.nombre_marca || ""}
                    onChange={(e) =>
                      cambiarCampo("nombre_marca", e.target.value)
                    }
                    placeholder="RIFAS LSD"
                  />
                </Field>
              </div>

              {/* DESCRIPCIÓN PRINCIPAL */}
              <div className="identidad-section">
                <Field
                  label="DESCRIPCIÓN PRINCIPAL"
                  help="Texto corto que explica tu propuesta."
                >
                  <textarea
                    className="identidad-textarea"
                    value={config.descripcion_principal || ""}
                    onChange={(e) =>
                      cambiarCampo("descripcion_principal", e.target.value)
                    }
                    placeholder="Compra tus números, sube tu comprobante y participa de forma rápida y segura. ✅"
                    rows={4}
                  />
                </Field>
              </div>

              {/* SLOGAN */}
              <div className="identidad-section">
                <div className="identidad-subheading">
                  <h4>SLOGAN</h4>

                  <p>
                    Estas frases pueden utilizarse en diferentes áreas del sitio.
                  </p>
                </div>

                <div className="slogan-list">
                  <Field label="FRASE 1">
                    <input
                      value={config.slogan_frase_1 || ""}
                      onChange={(e) =>
                        cambiarCampo("slogan_frase_1", e.target.value)
                      }
                      placeholder="Visión, crecimiento y constancia."
                    />
                  </Field>

                  <Field label="FRASE 2">
                    <input
                      value={config.slogan_frase_2 || ""}
                      onChange={(e) =>
                        cambiarCampo("slogan_frase_2", e.target.value)
                      }
                      placeholder="Eventos creados con seriedad y compromiso."
                    />
                  </Field>

                  <Field label="FRASE 3">
                    <input
                      value={config.slogan_frase_3 || ""}
                      onChange={(e) =>
                        cambiarCampo("slogan_frase_3", e.target.value)
                      }
                      placeholder="Una marca enfocada en avanzar cada día."
                    />
                  </Field>

                  <Field label="FRASE 4">
                    <input
                      value={config.slogan_frase_4 || ""}
                      onChange={(e) =>
                        cambiarCampo("slogan_frase_4", e.target.value)
                      }
                      placeholder="Participación segura, clara y profesional."
                    />
                  </Field>
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div className="identidad-section">
                <Field
                  label="DESCRIPCIÓN"
                  help="Descripción amplia de la marca."
                >
                  <textarea
                    className="identidad-textarea identidad-descripcion"
                    value={config.descripcion || ""}
                    onChange={(e) => cambiarCampo("descripcion", e.target.value)}
                    placeholder={`Las metas grandes no se alcanzan por suerte.
Se construyen con enfoque, disciplina,
esfuerzo y la decisión firme de nunca
RENDIRSE🛑.`}
                    rows={7}
                  />
                </Field>
              </div>

              {/* BOTÓN */}
              <div className="identidad-save-area">
                <button
                  type="button"
                  className="identidad-save-button"
                  onClick={guardarCambios}
                  disabled={guardando || subiendoLogo}
                >
                  {guardando ? "⏳ GUARDANDO..." : "💾 GUARDAR CAMBIOS"}
                </button>
              </div>
            </div>
          )}

          {/* =====================================================
              CONTACTO
          ===================================================== */}
          {tab === "contacto" && (
            <ConfigCard
              icon="📞"
              title="Contacto y redes"
              description="Estos datos pueden mostrarse en Home, Principal, Evento y Footer."
            >
              <div className="admin-config-form-grid">
                <Field label="WhatsApp">
                  <input
                    value={config.whatsapp || ""}
                    onChange={(e) => cambiarCampo("whatsapp", e.target.value)}
                    placeholder="17738277463"
                  />
                </Field>

                <Field label="Instagram">
                  <input
                    value={config.instagram || ""}
                    onChange={(e) => cambiarCampo("instagram", e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </Field>

                <Field label="Telegram">
                  <input
                    value={config.telegram || ""}
                    onChange={(e) => cambiarCampo("telegram", e.target.value)}
                    placeholder="https://t.me/..."
                  />
                </Field>

                <Field label="Correo">
                  <input
                    type="email"
                    value={config.correo || ""}
                    onChange={(e) => cambiarCampo("correo", e.target.value)}
                    placeholder="correo@rifaslsd.com"
                  />
                </Field>

                <Field label="Facebook">
                  <input
                    value={config.facebook || ""}
                    onChange={(e) => cambiarCampo("facebook", e.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                </Field>

                <Field label="TikTok">
                  <input
                    value={config.tiktok || ""}
                    onChange={(e) => cambiarCampo("tiktok", e.target.value)}
                    placeholder="https://tiktok.com/@..."
                  />
                </Field>

                <Field label="YouTube">
                  <input
                    value={config.youtube || ""}
                    onChange={(e) => cambiarCampo("youtube", e.target.value)}
                    placeholder="https://youtube.com/..."
                  />
                </Field>
              </div>
            </ConfigCard>
          )}

          {/* =====================================================
              HOME
          ===================================================== */}
          {tab === "home" && (
            <ConfigCard
              icon="🏠"
              title="Textos del Home"
              description="Cambia los textos principales que verá el público."
            >
              <div className="admin-config-form-grid">
                <Field label="Título principal">
                  <input
                    value={config.home_titulo || ""}
                    onChange={(e) => cambiarCampo("home_titulo", e.target.value)}
                    placeholder="RIFAS LSD"
                  />
                </Field>

                <Field label="Subtítulo">
                  <input
                    value={config.home_subtitulo || ""}
                    onChange={(e) =>
                      cambiarCampo("home_subtitulo", e.target.value)
                    }
                    placeholder="Eventos creados con seriedad y compromiso"
                  />
                </Field>

                <Field label="Mensaje" full>
                  <textarea
                    value={config.home_mensaje || ""}
                    onChange={(e) => cambiarCampo("home_mensaje", e.target.value)}
                    placeholder="Participación segura, clara y profesional."
                  />
                </Field>

                <Field label="Texto botón comprar">
                  <input
                    value={config.home_boton_comprar || ""}
                    onChange={(e) =>
                      cambiarCampo("home_boton_comprar", e.target.value)
                    }
                    placeholder="COMPRAR AHORA"
                  />
                </Field>

                <Field label="Texto botón verificar">
                  <input
                    value={config.home_boton_verificar || ""}
                    onChange={(e) =>
                      cambiarCampo("home_boton_verificar", e.target.value)
                    }
                    placeholder="VERIFICAR TICKETS"
                  />
                </Field>

                <Field label="Imagen principal Home">
                  <input
                    value={config.home_imagen_principal || ""}
                    onChange={(e) =>
                      cambiarCampo("home_imagen_principal", e.target.value)
                    }
                    placeholder="/home/imagen-principal.png"
                  />
                </Field>

                <Field label="Imagen secundaria Home">
                  <input
                    value={config.home_imagen_secundaria || ""}
                    onChange={(e) =>
                      cambiarCampo("home_imagen_secundaria", e.target.value)
                    }
                    placeholder="/home/imagen-secundaria.png"
                  />
                </Field>
              </div>
            </ConfigCard>
          )}

          {/* =====================================================
              MENUS
          ===================================================== */}
          {tab === "menus" && (
            <ConfigCard
              icon="🧭"
              title="Menú público"
              description="Cambia los nombres del menú principal público."
            >
              <div className="admin-config-form-grid">
                <Field label="Inicio">
                  <input
                    value={config.menu_inicio || ""}
                    onChange={(e) => cambiarCampo("menu_inicio", e.target.value)}
                    placeholder="INICIO"
                  />
                </Field>

                <Field label="Eventos">
                  <input
                    value={config.menu_eventos || ""}
                    onChange={(e) => cambiarCampo("menu_eventos", e.target.value)}
                    placeholder="EVENTOS"
                  />
                </Field>

                <Field label="Resultados">
                  <input
                    value={config.menu_resultados || ""}
                    onChange={(e) =>
                      cambiarCampo("menu_resultados", e.target.value)
                    }
                    placeholder="RESULTADOS"
                  />
                </Field>

                <Field label="Ganadores">
                  <input
                    value={config.menu_ganadores || ""}
                    onChange={(e) => cambiarCampo("menu_ganadores", e.target.value)}
                    placeholder="GANADORES"
                  />
                </Field>

                <Field label="Pagos">
                  <input
                    value={config.menu_pagos || ""}
                    onChange={(e) => cambiarCampo("menu_pagos", e.target.value)}
                    placeholder="CUENTAS DE PAGO"
                  />
                </Field>

                <Field label="Contacto">
                  <input
                    value={config.menu_contacto || ""}
                    onChange={(e) =>
                      cambiarCampo("menu_contacto", e.target.value)
                    }
                    placeholder="CONTACTO"
                  />
                </Field>

                <Field label="Verificador">
                  <input
                    value={config.menu_verificador || ""}
                    onChange={(e) =>
                      cambiarCampo("menu_verificador", e.target.value)
                    }
                    placeholder="✔ VERIFICADOR"
                  />
                </Field>
              </div>
            </ConfigCard>
          )}

          {/* =====================================================
              COLORES
          ===================================================== */}
          {tab === "colores" && (
            <ConfigCard
              icon="🎨"
              title="Colores y apariencia"
              description="Controla la identidad visual completa del sitio."
            >
              <div className="admin-master-controls">
                <RangeControl
                  icon="🌈"
                  title="Tono Global"
                  description="Cambia completamente la tonalidad del sitio."
                  value={config.tono_global || 0}
                  min={-180}
                  max={180}
                  suffix="°"
                  onChange={(value) => cambiarCampo("tono_global", value)}
                />

                <RangeControl
                  icon="☀️"
                  title="Luminosidad Global"
                  description="Aclara u oscurece toda la web."
                  value={config.luminosidad_global || 100}
                  min={50}
                  max={150}
                  suffix="%"
                  onChange={(value) => cambiarCampo("luminosidad_global", value)}
                />

                <RangeControl
                  icon="◐"
                  title="Brillo Global"
                  description="Controla el brillo general de la interfaz."
                  value={config.brillo_global || 100}
                  min={50}
                  max={150}
                  suffix="%"
                  onChange={(value) => cambiarCampo("brillo_global", value)}
                />

                <RangeControl
                  icon="🌑"
                  title="Contraste Global"
                  description="Más fuerza visual en textos y botones."
                  value={config.contraste_global || 100}
                  min={50}
                  max={150}
                  suffix="%"
                  onChange={(value) => cambiarCampo("contraste_global", value)}
                />

                <RangeControl
                  icon="💎"
                  title="Saturación Global"
                  description="Controla la intensidad de los colores."
                  value={config.saturacion_global || 100}
                  min={0}
                  max={200}
                  suffix="%"
                  onChange={(value) => cambiarCampo("saturacion_global", value)}
                />
              </div>

              <div className="admin-color-grid-premium">
                {COLOR_FIELDS.map(([campo, label]) => (
                  <div className="admin-color-box" key={campo}>
                    <div className="admin-color-box-top">
                      <div>
                        <span>{label}</span>
                        <small>Personalización</small>
                      </div>

                      <input
                        className="admin-color-picker"
                        type="color"
                        value={config[campo] || "#000000"}
                        onChange={(e) => cambiarCampo(campo, e.target.value)}
                      />
                    </div>

                    <input
                      value={config[campo] || ""}
                      onChange={(e) => cambiarCampo(campo, e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                ))}
              </div>
            </ConfigCard>
          )}

          {/* =====================================================
              PAGOS
          ===================================================== */}
          {tab === "pagos" && (
            <ConfigCard
              icon="💳"
              title="Métodos de pago"
              description="Agrega, elimina, activa y edita tus cuentas de pago."
            >
              <div className="admin-config-card-head">
                <div />
                <button
                  type="button"
                  className="btn-add-method"
                  onClick={agregarMetodoPago}
                >
                  ➕ AGREGAR MÉTODO
                </button>
              </div>

              <div className="admin-payments-list">
                {metodosOrdenados.map((metodo) => {
                  const index = config.metodos_pago.findIndex(
                    (m) => m.id === metodo.id
                  );

                  return (
                    <div
                      key={metodo.id || index}
                      className={`admin-payment-card ${
                        metodo.activo ? "payment-active" : "payment-disabled"
                      }`}
                    >
                      <div className="admin-payment-head">
                        <div className="payment-title">
                          <div className="payment-logo-small">
                            {metodo.logo ? (
                              <img src={metodo.logo} alt={metodo.nombre} />
                            ) : (
                              <span>💳</span>
                            )}
                          </div>

                          <div>
                            <strong>{metodo.nombre || "Nuevo método"}</strong>
                            <small>Orden #{metodo.orden || index + 1}</small>
                          </div>
                        </div>

                        <div className="admin-payment-actions">
                          <label className="admin-switch">
                            <input
                              type="checkbox"
                              checked={Boolean(metodo.activo)}
                              onChange={(e) =>
                                cambiarMetodo(index, "activo", e.target.checked)
                              }
                            />
                            <span />
                          </label>

                          <button
                            type="button"
                            className="btn-delete-method"
                            onClick={() => eliminarMetodoPago(index)}
                          >
                            🗑 ELIMINAR
                          </button>
                        </div>
                      </div>

                      <div className="admin-config-form-grid">
                        <Field label="Nombre del método">
                          <input
                            value={metodo.nombre || ""}
                            onChange={(e) =>
                              cambiarMetodo(index, "nombre", e.target.value)
                            }
                            placeholder="Zelle, Binance, PayPal..."
                          />
                        </Field>

                        <Field label="Cuenta / Email / Usuario">
                          <input
                            value={metodo.cuenta || ""}
                            onChange={(e) =>
                              cambiarMetodo(index, "cuenta", e.target.value)
                            }
                            placeholder="Cuenta, correo, usuario o número"
                          />
                        </Field>

                        <Field label="Titular">
                          <input
                            value={metodo.titular || ""}
                            onChange={(e) =>
                              cambiarMetodo(index, "titular", e.target.value)
                            }
                            placeholder="Nombre del titular"
                          />
                        </Field>

                        <Field label="Subtítulo">
                          <input
                            value={metodo.subtitulo || ""}
                            onChange={(e) =>
                              cambiarMetodo(index, "subtitulo", e.target.value)
                            }
                            placeholder="ID, EMAIL, CASH TAG..."
                          />
                        </Field>

                        <Field label="Logo del método">
                          <input
                            value={metodo.logo || ""}
                            onChange={(e) =>
                              cambiarMetodo(index, "logo", e.target.value)
                            }
                            placeholder="/payment/zelle.png"
                          />
                        </Field>

                        <Field label="Orden">
                          <input
                            type="number"
                            value={metodo.orden || 0}
                            onChange={(e) =>
                              cambiarMetodo(
                                index,
                                "orden",
                                Number(e.target.value)
                              )
                            }
                          />
                        </Field>

                        <Field label="Descripción" full>
                          <textarea
                            value={metodo.descripcion || ""}
                            onChange={(e) =>
                              cambiarMetodo(index, "descripcion", e.target.value)
                            }
                            placeholder="Instrucciones para pagar con este método"
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-add-method full"
                onClick={agregarMetodoPago}
              >
                ➕ AGREGAR OTRO MÉTODO DE PAGO
              </button>
            </ConfigCard>
          )}

          {/* =====================================================
              SEO
          ===================================================== */}
          {tab === "seo" && (
            <ConfigCard
              icon="🌎"
              title="SEO y compartir"
              description="Controla cómo se ve tu página en Google, WhatsApp y redes."
            >
              <div className="admin-config-form-grid">
                <Field label="Título SEO" full>
                  <input
                    value={config.seo_titulo || ""}
                    onChange={(e) => cambiarCampo("seo_titulo", e.target.value)}
                    placeholder="Rifas LSD | Compra tus tickets"
                  />
                </Field>

                <Field label="Descripción SEO" full>
                  <textarea
                    value={config.seo_descripcion || ""}
                    onChange={(e) =>
                      cambiarCampo("seo_descripcion", e.target.value)
                    }
                    placeholder="Compra tus tickets, verifica tus números y consulta eventos disponibles."
                  />
                </Field>

                <Field label="Imagen para compartir" full>
                  <input
                    value={config.seo_imagen || ""}
                    onChange={(e) => cambiarCampo("seo_imagen", e.target.value)}
                    placeholder="/og-image.png"
                  />
                </Field>
              </div>
            </ConfigCard>
          )}

          {/* =====================================================
              POPUP
          ===================================================== */}
          {tab === "popup" && (
            <ConfigCard
              icon="📢"
              title="Popup promocional"
              description="Controla un anuncio flotante para promociones importantes."
            >
              <div className="admin-config-form-grid">
                <Field label="Activar popup" asLabel={false}>
                  <label className="admin-switch large">
                    <input
                      type="checkbox"
                      checked={Boolean(config.popup_activo)}
                      onChange={(e) =>
                        cambiarCampo("popup_activo", e.target.checked)
                      }
                    />
                    <span />
                  </label>
                </Field>

                <Field label="Título">
                  <input
                    value={config.popup_titulo || ""}
                    onChange={(e) =>
                      cambiarCampo("popup_titulo", e.target.value)
                    }
                    placeholder="🔥 Últimos números disponibles"
                  />
                </Field>

                <Field label="Mensaje" full>
                  <textarea
                    value={config.popup_mensaje || ""}
                    onChange={(e) =>
                      cambiarCampo("popup_mensaje", e.target.value)
                    }
                    placeholder="Participa antes de que se agoten los tickets."
                  />
                </Field>

                <Field label="Texto del botón">
                  <input
                    value={config.popup_boton || ""}
                    onChange={(e) =>
                      cambiarCampo("popup_boton", e.target.value)
                    }
                    placeholder="Comprar ahora"
                  />
                </Field>

                <Field label="Imagen del popup">
                  <input
                    value={config.popup_imagen || ""}
                    onChange={(e) =>
                      cambiarCampo("popup_imagen", e.target.value)
                    }
                    placeholder="/logo.png"
                  />
                </Field>

                <Field label="Link del popup">
                  <input
                    value={config.popup_link || ""}
                    onChange={(e) =>
                      cambiarCampo("popup_link", e.target.value)
                    }
                    placeholder="/principal#eventos-disponibles"
                  />
                </Field>
              </div>
            </ConfigCard>
          )}
        </div>

        {/* =====================================================
            PREVIEW
        ===================================================== */}
        <aside className="admin-config-preview">
          <div className="preview-sticky">
            <div className="preview-heading">
              <div>
                <span>LIVE PREVIEW</span>
                <h3>Vista previa</h3>
              </div>

              <div className="preview-live-dot">
                <i />
                EN VIVO
              </div>
            </div>

            <div
              className="admin-preview-card admin-preview-card-modern"
              style={previewStyle}
            >
              {/* Logo pequeño + nombre */}
              <div className="admin-preview-top">
                <div className="admin-preview-logo admin-preview-logo-small">
                  {previewData.logo ? (
                    <img
                      src={previewData.logo}
                      alt={`Logo ${previewData.nombreMarca}`}
                    />
                  ) : (
                    <span>
                      {(previewData.nombreMarca || "R")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="preview-brand-meta">
                  <strong>{previewData.nombreMarca}</strong>
                  <small>SITIO OFICIAL</small>
                </div>
              </div>

              <div className="preview-divider" />

              {/* Título principal */}
              <h4
                className="preview-brand-title"
                style={{ color: previewData.colorPrimario }}
              >
                {previewData.tituloPrincipal}
              </h4>

              {/* Descripción principal */}
              <p className="preview-description-main">
                {previewData.descripcionPrincipal}
              </p>

              {/* Slogans */}
              <div className="preview-slogans">
                <span>{previewData.slogan1}</span>
                <span>{previewData.slogan2}</span>
                <span>{previewData.slogan3}</span>
                <span>{previewData.slogan4}</span>
              </div>

              {/* Descripción */}
              <p className="preview-description">{previewData.descripcion}</p>

              {/* Botones */}
              <div className="preview-buttons-wrap">
                <button
                  type="button"
                  className="preview-btn-main"
                  style={{
                    background: previewData.colorBoton,
                    boxShadow: `0 14px 28px rgba(${botonRgb.r}, ${botonRgb.g}, ${botonRgb.b}, 0.38),
                                inset 0 2px 0 rgba(255,255,255,0.2)`,
                  }}
                >
                  {previewData.botonComprar}
                </button>

                <button
                  type="button"
                  className="preview-btn-secondary"
                  style={{
                    color: previewData.colorBoton,
                    borderColor: `rgba(${botonRgb.r}, ${botonRgb.g}, ${botonRgb.b}, 0.20)`,
                  }}
                >
                  ENTRAR AL EVENTO
                </button>
              </div>

              {/* Alertas de ejemplo */}
              <div className="admin-preview-badges">
                <div
                  className="admin-preview-alert"
                  style={{
                    borderColor: config?.color_alerta || "#f97316",
                    color: config?.color_alerta || "#f97316",
                  }}
                >
                  ⚠️ Alerta de ejemplo
                </div>

                <div
                  className="admin-preview-success"
                  style={{
                    borderColor: config?.color_exito || "#16a34a",
                    color: config?.color_exito || "#16a34a",
                  }}
                >
                  ✅ Compra aprobada
                </div>
              </div>
            </div>

            <div className="preview-info-box">
              <span>💡</span>
              <p>
                Los cambios de texto, color y logo se reflejan aquí
                inmediatamente.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* =========================================================
   COMPONENTES AUXILIARES
========================================================= */

function ConfigCard({ icon, title, description, children }) {
  return (
    <div className="admin-config-card">
      <div className="admin-config-card-heading">
        <div className="config-card-icon">{icon}</div>

        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="config-card-body">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
  help = "",
  asLabel = true,
}) {
  const Wrapper = asLabel ? "label" : "div";

  return (
    <Wrapper className={`admin-config-field ${full ? "full" : ""}`}>
      <div className="admin-field-label">
        <span>{label}</span>

        {help && <small>{help}</small>}
      </div>

      {children}
    </Wrapper>
  );
}

function RangeControl({
  icon,
  title,
  description,
  value,
  min,
  max,
  suffix,
  onChange,
}) {
  return (
    <div className="admin-master-control">
      <div className="master-control-info">
        <div className="master-control-icon">{icon}</div>

        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
      </div>

      <input
        className="admin-range"
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <b>
        {value}
        {suffix}
      </b>
    </div>
  );
}