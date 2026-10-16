import PrincipalPageClient from "./PrincipalPageClient";
import { obtenerRifasPublicas } from "@/lib/rifas/obtenerRifasPublicas";
import { obtenerConfiguracionPublica } from "@/lib/configuracion/obtenerConfiguracionPublica";

/* =========================================================
   RENDER DINÁMICO
========================================================= */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.sorteoslsd.com";

/* =========================================================
   OBTENER CONFIGURACIÓN SEGURA
========================================================= */

async function obtenerConfiguracion() {
  try {
    return await obtenerConfiguracionPublica();
  } catch (error) {
    console.error(
      "Error obteniendo configuración de /principal:",
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
    config?.nombre_marca || "Sorteos LSD";

  const titulo =
    config?.seo_titulo ||
    "Sorteos LSD | Eventos disponibles y finalizados";

  const descripcion =
    config?.seo_descripcion ||
    "Explora los eventos disponibles y finalizados de Sorteos LSD. Consulta cuentas de pago, contacto y verifica tus tickets.";

  const imagenCompartir =
    config?.seo_imagen ||
    config?.logo_url ||
    `${siteUrl}/icon`;

  return {
    metadataBase: new URL(siteUrl),

    title: titulo,
    description: descripcion,

    openGraph: {
      title: titulo,
      description: descripcion,
      url: `${siteUrl}/principal`,
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
  const [config, rifasIniciales] = await Promise.all([
    obtenerConfiguracion(),
    obtenerRifasPublicas().catch((error) => {
      console.error(
        "Error cargando rifas iniciales de /principal:",
        error
      );

      return [];
    }),
  ]);

  /* =======================================================
     COLORES INICIALES
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
    <div style={coloresIniciales}>
      <PrincipalPageClient
  initialConfig={config}
  initialRifas={rifasIniciales}
/>
    </div>
  );
}
