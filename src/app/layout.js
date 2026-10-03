import { Geist, Geist_Mono } from "next/font/google";
import SiteConfigApplier from "@/components/shared/SiteConfigApplier";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.sorteoslsd.com";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Sorteos LSD | Compra tus tickets",
    template: "%s | Sorteos LSD",
  },

  description:
    "Compra tus tickets, verifica tus números y consulta eventos disponibles.",

  applicationName: "Sorteos LSD",

  authors: [{ name: "Sorteos LSD" }],

  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },

  manifest: "/site.webmanifest",

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SiteConfigApplier />
        {children}
      </body>
    </html>
  );
}