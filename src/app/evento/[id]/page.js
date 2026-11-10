
import EventoDetallePageClient from "./EventoDetallePageClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { obtenerModoMantenimiento } from "@/lib/mantenimiento/obtenerModoMantenimiento";
import { obtenerConfiguracionPublica } from "@/lib/configuracion/obtenerConfiguracionPublica";
import MaintenancePage from "@/components/public/MaintenancePage";

/* =========================================================
   RENDER DINÁMICO

   Evita que Next.js conserve una versión estática
   de la página del evento.
========================================================= */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.sorteoslsd.com";

const SITE_NAME = "Sorteos LSD";

/* =========================================================
   HELPERS
========================================================= */

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function construirDescripcion(data) {
  const nombreEvento =
    limpiarTexto(data?.nombre) || "Evento";

  const descripcion =
    limpiarTexto(data?.descripcion);

  if (descripcion) {
    return descripcion;
  }

  return `Consulta todos los detalles de ${nombreEvento} en ${SITE_NAME}.`;
}

/* =========================================================
   OBTENER CONFIGURACIÓN DEL SITIO

   Reutiliza la función pública centralizada.

   - Conserva colores y configuración visual.
   - Conserva el logo configurado desde Admin.
   - Conserva la línea de anuncios.
   - No modifica la base de datos.
   - Mantiene el respaldo ante errores.
========================================================= */

async function obtenerConfiguracionSitio() {
  try {
    return await obtenerConfiguracionPublica();
  } catch (error) {
    console.error(
      "Error obteniendo configuración del sitio:",
      error
    );

    return null;
  }
}

/* =========================================================
   OBTENER LOGO ACTUAL DEL SITIO
========================================================= */

async function obtenerLogoActual() {
  const config =
    await obtenerConfiguracionSitio();

  return (
    limpiarTexto(config?.logo_url) ||
    `${SITE_URL}/icon`
  );
}

/* =========================================================
   CONSTRUIR IMAGEN PARA COMPARTIR
========================================================= */

async function construirImagen(data) {
  const portada =
    limpiarTexto(data?.portada_url);

  /*
   * Si el evento tiene portada, usamos esa imagen.
   *
   * WhatsApp, Facebook, Telegram, X, etc.
   * intentarán mostrarla al compartir el evento.
   */

  if (portada) {
    return portada;
  }

  /*
   * Si no tiene portada, utilizamos el logo
   * configurado desde el administrador.
   */

  return await obtenerLogoActual();
}

/* =========================================================
   METADATA DEL EVENTO
========================================================= */

export async function generateMetadata({ params }) {
  const { id } = await params;

  /* =======================================================
     SIN ID
  ======================================================= */

  if (!id) {
    return {
      metadataBase: new URL(SITE_URL),

      title: `Evento | ${SITE_NAME}`,

      description:
        `Consulta la información del evento en ${SITE_NAME}.`,
    };
  }

  try {
    /* =====================================================
       BUSCAR EVENTO
    ===================================================== */

    const { data, error } = await supabaseAdmin
      .from("rifas")
      .select(
        `
          id,
          nombre,
          descripcion,
          portada_url,
          publicada
        `
      )
      .eq("id", id)
      .maybeSingle();

    /* =====================================================
       ERROR DE SUPABASE
    ===================================================== */

    if (error) {
      console.error(
        "Error cargando metadata del evento:",
        error
      );

      return {
        metadataBase: new URL(SITE_URL),

        title: `Evento | ${SITE_NAME}`,

        description:
          `Consulta la información del evento en ${SITE_NAME}.`,
      };
    }

    /* =====================================================
       EVENTO NO ENCONTRADO / NO PUBLICADO
    ===================================================== */

    if (!data || !data.publicada) {
      return {
        metadataBase: new URL(SITE_URL),

        title:
          `Evento no encontrado | ${SITE_NAME}`,

        description:
          "Este evento no existe o no está disponible públicamente.",

        robots: {
          index: false,
          follow: false,
        },
      };
    }

    /* =====================================================
       DATOS DEL EVENTO
    ===================================================== */

    const nombreEvento =
      limpiarTexto(data.nombre) || "Evento";

    const titulo =
      `${nombreEvento} | ${SITE_NAME}`;

    const descripcion =
      construirDescripcion(data);

    const imagen =
      await construirImagen(data);

    const urlEvento =
      `${SITE_URL}/evento/${encodeURIComponent(id)}`;

    /* =====================================================
       METADATA FINAL
    ===================================================== */

    return {
      metadataBase: new URL(SITE_URL),

      title: titulo,

      description: descripcion,

      alternates: {
        canonical: urlEvento,
      },

      openGraph: {
        title: titulo,
        description: descripcion,
        url: urlEvento,
        siteName: SITE_NAME,
        locale: "es_US",
        type: "website",

        images: [
          {
            url: imagen,
            width: 1200,
            height: 630,
            alt: nombreEvento,
          },
        ],
      },

      twitter: {
        card: "summary_large_image",
        title: titulo,
        description: descripcion,
        images: [imagen],
      },

      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    console.error(
      "Error inesperado generando metadata del evento:",
      error
    );

    return {
      metadataBase: new URL(SITE_URL),

      title: `Evento | ${SITE_NAME}`,

      description:
        `Consulta la información del evento en ${SITE_NAME}.`,
    };
  }
}

/* =========================================================
   PÁGINA DEL EVENTO
========================================================= */

export default async function Page() {
  /* =======================================================
     VERIFICAR MODO MANTENIMIENTO
  ======================================================= */

  const modoMantenimiento =
    await obtenerModoMantenimiento();

  if (modoMantenimiento) {
    return <MaintenancePage />;
  }

  /* =======================================================
     OBTENER CONFIGURACIÓN PÚBLICA
  ======================================================= */

  const config =
    await obtenerConfiguracionSitio();

  /* =======================================================
     COLORES INICIALES

     Conservamos todas las variables CSS originales.
  ======================================================= */

  const coloresIniciales = {
    "--site-primary":
      config?.color_primario || "#dc2626",

    "--site-secondary":
      config?.color_secundario || "#111827",

    "--site-background":
      config?.color_fondo || "#ffffff",

    "--site-text":
      config?.color_texto || "#111827",

    "--site-button":
      config?.color_boton || "#dc2626",

    "--site-card":
      config?.color_tarjeta || "#ffffff",

    "--site-border":
      config?.color_borde || "#e5e7eb",

    "--site-alert":
      config?.color_alerta || "#f97316",

    "--site-success":
      config?.color_exito || "#16a34a",

    "--site-error":
      config?.color_error || "#dc2626",

    "--site-hover":
      config?.color_hover || "#b91c1c",

    "--site-progress":
      config?.color_progreso ||
      config?.color_boton ||
      config?.color_primario ||
      "#dc2626",

    "--site-progress-bg":
      config?.color_progreso_fondo ||
      "#e5e7eb",

    "--site-dots":
      config?.color_punticos ||
      "#dc2626",
  };

  /* =======================================================
     RENDER DEL EVENTO

     Conservamos el componente original y su configuración.
  ======================================================= */

  return (
    <div style={coloresIniciales}>
      <EventoDetallePageClient
        initialConfig={config}
      />
    </div>
  );
}
