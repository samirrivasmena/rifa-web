import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rifaslsd.vercel.app";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rifas LSD | Compra tus tickets",
    template: "%s | Rifas LSD",
  },
  description: "Compra tus tickets, verifica tus números y consulta eventos disponibles.",
  applicationName: "Rifas LSD",
  authors: [{ name: "Rifas LSD" }],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/logo-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Rifas LSD",
    description: "Compra tus tickets, verifica tus números y consulta eventos disponibles.",
    url: siteUrl,
    siteName: "Rifas LSD",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Rifas LSD",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rifas LSD",
    description: "Compra tus tickets, verifica tus números y consulta eventos disponibles.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}