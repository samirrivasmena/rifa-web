import { Suspense } from "react";
import HomePageClient from "./HomePageClient";
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
      console.error("Error cargando configuración SEO:", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error("Error cargando configuración SEO:", error);
    return null;
  }
}

export async function generateMetadata() {
  const config = await obtenerConfiguracion();

  const nombreMarca = config?.nombre_marca || "Rifas LSD";

  const titulo =
    config?.seo_titulo || "Rifas LSD | Compra tus tickets";

  const descripcion =
    config?.seo_descripcion ||
    "Participa en la rifa activa de Rifas LSD. Compra tus tickets, verifica tus números y consulta eventos disponibles.";

  const imagenCompartir =
    config?.seo_imagen || config?.logo_url || "/og-image.png";

  return {
    metadataBase: new URL(siteUrl),

    title: titulo,

    description: descripcion,

    verification: {
      google: "lHL2_luXyFRFsSODxgMeqVUQNkzhAdDVrmaNBGJnKo4",
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

export default async function Page() {
  const config = await obtenerConfiguracion();

  const nombreMarca = config?.nombre_marca || "Rifas LSD";
  const logoUrl = config?.logo_url || `${siteUrl}/icon`;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: nombreMarca,
    url: siteUrl,
    logo: logoUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />

      <Suspense fallback={<div>Cargando...</div>}>
        <HomePageClient />
      </Suspense>
    </>
  );
}