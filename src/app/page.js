import HomePageClient from "./HomePageClient";

export const metadata = {
  title: "Rifas LSD | Compra tus tickets",
  description:
    "Participa en la rifa activa de Rifas LSD. Compra tus tickets, verifica tus números y consulta eventos disponibles.",
  openGraph: {
    title: "Rifas LSD | Compra tus tickets",
    description:
      "Participa en la rifa activa de Rifas LSD. Compra tus tickets, verifica tus números y consulta eventos disponibles.",
    url: "https://tu-dominio.com/",
    siteName: "Rifas LSD",
    images: [
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

export default function Page() {
  return <HomePageClient />;
}