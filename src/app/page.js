import { Suspense } from "react";
import HomePageClient from "./HomePageClient";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rifas LSD",
  url: "https://rifaslsd.vercel.app",
  logo: "https://rifaslsd.vercel.app/logo.png",
};

export const metadata = {
  metadataBase: new URL("https://rifaslsd.vercel.app"),
  title: "Rifas LSD | Compra tus tickets",
  description:
    "Participa en la rifa activa de Rifas LSD. Compra tus tickets, verifica tus números y consulta eventos disponibles.",
  verification: {
    google: "lHL2_luXyFRFsSODxgMeqVUQNkzhAdDVrmaNBGJnKo4",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Rifas LSD | Compra tus tickets",
    description:
      "Participa en la rifa activa de Rifas LSD. Compra tus tickets, verifica tus números y consulta eventos disponibles.",
    url: "https://rifaslsd.vercel.app/",
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