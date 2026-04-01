import PrincipalPageClient from "./PrincipalPageClient";

export const metadata = {
  title: "Rifas LSD | Eventos disponibles y finalizados",
  description:
    "Explora los eventos disponibles y finalizados de Rifas LSD. Consulta cuentas de pago, contacto y verifica tus tickets.",
  openGraph: {
    title: "Rifas LSD | Eventos disponibles y finalizados",
    description:
      "Explora los eventos disponibles y finalizados de Rifas LSD. Consulta cuentas de pago, contacto y verifica tus tickets.",
    url: "https://tu-dominio.com/principal",
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
  return <PrincipalPageClient />;
}