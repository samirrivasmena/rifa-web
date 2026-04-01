import EventoDetallePageClient from "./EventoDetallePageClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function generateMetadata({ params }) {
  const id = params?.id;

  if (!id) {
    return {
      title: "Evento | Rifas LSD",
      description: "Consulta la información del evento en Rifas LSD.",
    };
  }

  try {
    const { data } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data || !data.publicada) {
      return {
        title: "Evento no encontrado | Rifas LSD",
        description: "Este evento no existe o no está disponible públicamente.",
      };
    }

    return {
      title: `${data.nombre || "Evento"} | Rifas LSD`,
      description:
        data.descripcion ||
        `Consulta la información del evento ${data.nombre || "de Rifas LSD"}.`,
      openGraph: {
        title: `${data.nombre || "Evento"} | Rifas LSD`,
        description:
          data.descripcion ||
          `Consulta la información del evento ${data.nombre || "de Rifas LSD"}.`,
        url: `https://tu-dominio.com/evento/${id}`,
        siteName: "Rifas LSD",
        images: data.portada_url
          ? [
              {
                url: data.portada_url,
                width: 1200,
                height: 630,
                alt: data.nombre || "Evento Rifas LSD",
              },
            ]
          : [
              {
                url: "/logo.png",
                width: 1200,
                height: 630,
                alt: "Rifas LSD",
              },
            ],
        locale: "es_US",
        type: "website",
      },
    };
  } catch {
    return {
      title: "Evento | Rifas LSD",
      description: "Consulta la información del evento en Rifas LSD.",
    };
  }
}

export default function Page() {
  return <EventoDetallePageClient />;
}