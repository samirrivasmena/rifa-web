import PrincipalPageClient from "./PrincipalPageClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://rifaslsd.vercel.app";

async function obtenerConfiguracion() {
  try {
    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select(
        "logo_url, nombre_marca, seo_titulo, seo_descripcion, seo_imagen"
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Error obteniendo configuración SEO de /principal:",
        error
      );
      return null;
    }

    return data || null;
  } catch (error) {
    console.error(
      "Error inesperado obteniendo configuración SEO de /principal:",
      error
    );
    return null;
  }
}

export async function generateMetadata() {
  const config = await obtenerConfiguracion();

  const nombreMarca = config?.nombre_marca || "Sorteos LSD";

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

export default function Page() {
  return <PrincipalPageClient />;
}