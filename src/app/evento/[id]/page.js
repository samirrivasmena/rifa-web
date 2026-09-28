import EventoDetallePageClient from "./EventoDetallePageClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   CONFIGURACIÓN GENERAL
   Cuando cambies de dominio, solo cambia esta línea.
========================================================= */

const SITE_URL = "https://rifaslsd.vercel.app";
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

function construirImagen(data) {
  const portada =
    limpiarTexto(data?.portada_url);

  /*
   * Si el evento tiene portada, usamos esa imagen.
   * Esa será la imagen que WhatsApp, Facebook,
   * Telegram, etc. intentarán mostrar.
   */
  if (portada) {
    return portada;
  }

  /*
   * Imagen de respaldo si el evento no tiene portada.
   */
  return `${SITE_URL}/logo.png`;
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

    /*
     * IMPORTANTE:
     * Aquí usamos SOLAMENTE el nombre del evento.
     *
     * Ejemplo:
     * X-PRESS LITE | Sorteos LSD
     *
     * NO:
     * LA FRUTA - X-PRESS LITE
     */
    const titulo =
      `${nombreEvento} | ${SITE_NAME}`;

    const descripcion =
      construirDescripcion(data);

    const imagen =
      construirImagen(data);

    const urlEvento =
      `${SITE_URL}/evento/${encodeURIComponent(id)}`;

    /* =====================================================
       METADATA FINAL
    ===================================================== */

    return {
      metadataBase: new URL(SITE_URL),

      /* ===================================================
         METADATA NORMAL
      =================================================== */

      title: titulo,

      description: descripcion,

      /* ===================================================
         URL CANÓNICA
      =================================================== */

      alternates: {
        canonical: urlEvento,
      },

      /* ===================================================
         OPEN GRAPH
         WhatsApp / Facebook / Telegram / etc.
      =================================================== */

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

      /* ===================================================
         TWITTER / X
      =================================================== */

      twitter: {
        card: "summary_large_image",

        title: titulo,

        description: descripcion,

        images: [imagen],
      },

      /* ===================================================
         INDEXACIÓN
      =================================================== */

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
   PÁGINA
========================================================= */

export default function Page() {
  return <EventoDetallePageClient />;
}