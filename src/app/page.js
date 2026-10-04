import { Suspense } from "react";
import HomePageClient from "./HomePageClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   RENDER DINÁMICO
   Evita que Vercel conserve colores/configuración anteriores
========================================================= */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.sorteoslsd.com";

/* =========================================================
   OBTENER CONFIGURACIÓN
========================================================= */

async function obtenerConfiguracion() {
  try {
    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select(
        `
        logo_url,
        nombre_marca,
        seo_titulo,
        seo_descripcion,
        seo_imagen,
        color_primario,
        color_secundario,
        color_fondo,
        color_texto,
        color_boton,
        color_tarjeta,
        color_borde,
        color_alerta,
        color_exito,
        color_error,
        color_hover,
        color_progreso,
        color_progreso_fondo,
        color_punticos
        `
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Error cargando configuración SEO:",
        error
      );

      return null;
    }

    return data || null;
  } catch (error) {
    console.error(
      "Error cargando configuración SEO:",
      error
    );

    return null;
  }
}

/* =========================================================
   METADATA
========================================================= */

export async function generateMetadata() {
  const config = await obtenerConfiguracion();

  const nombreMarca =
    config?.nombre_marca || "SORTEOS LSD";

  const titulo =
    config?.seo_titulo ||
    "SORTEOS LSD | Compra tus tickets";

  const descripcion =
    config?.seo_descripcion ||
    "Participa en la rifa activa de Sorteos LSD. Compra tus tickets, verifica tus números y consulta eventos disponibles.";

  const imagenCompartir =
    config?.seo_imagen ||
    config?.logo_url ||
    "/og-image.png";

  return {
    metadataBase: new URL(siteUrl),

    title: titulo,

    description: descripcion,

    verification: {
      google:
        "lHL2_luXyFRFsSODxgMeqVUQNkzhAdDVrmaNBGJnKo4",
    },

    icons: {
      icon: "/icon",
      shortcut: "/icon",
      apple: "/icon",
    },

    openGraph: {
      title: titulo,
      description: descripcion,
      url: siteUrl,
      siteName: nombreMarca,

      images: [
        {
          url: imagenCompartir,
          alt: nombreMarca,
        },
      ],

      locale: "es_US",
      type: "website",
    },

    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [imagenCompartir],
    },
  };
}

/* =========================================================
   PÁGINA
========================================================= */

export default async function Page() {
  const config = await obtenerConfiguracion();

  const nombreMarca =
    config?.nombre_marca || "Sorteos LSD";

  const logoUrl =
    config?.logo_url || `${siteUrl}/icon`;

  /* =======================================================
     SCHEMA.ORG
  ======================================================= */

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: nombreMarca,
    url: siteUrl,
    logo: logoUrl,
  };

  /* =======================================================
     COLORES INICIALES
     Se aplican desde el servidor antes de cargar React
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
     RENDER
  ======================================================= */

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            organizationSchema
          ),
        }}
      />

      <div style={coloresIniciales}>
        <Suspense fallback={null}>
          <HomePageClient />
        </Suspense>
      </div>
    </>
  );
}