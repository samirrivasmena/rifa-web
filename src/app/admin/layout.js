export const metadata = {
  title: "Admin",
  applicationName: "Sorteos LSD Admin",
  manifest: "/admin.webmanifest",

  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },

  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  themeColor: "#0b0b12",
};

export default function AdminLayout({ children }) {
  return children;
}