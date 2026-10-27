export const metadata = {
  title: "Admin",

  applicationName: "Sorteos LSD Admin",

  manifest: "/admin.webmanifest",

  icons: {
    icon: "/admin-icon-192.png",
    shortcut: "/admin-icon-192.png",
    apple: "/admin-icon-192.png",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sorteos LSD Admin",
  },

  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  themeColor: "#0b0b12",
  viewportFit: "cover",
};

export default function AdminLayout({ children }) {
  return children;
}