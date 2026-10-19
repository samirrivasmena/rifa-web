export const metadata = {
  title: "Admin",

  applicationName: "Sorteos LSD Admin",

  manifest: "/admin.webmanifest",

  icons: {
    icon: "/admin-icon-192.png",
    shortcut: "/admin-icon-192.png",
    apple: "/admin-icon-192.png",
  },

  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  themeColor: "#0b0b12",
};

export default function AdminLayout({
  children,
}) {
  return children;
}