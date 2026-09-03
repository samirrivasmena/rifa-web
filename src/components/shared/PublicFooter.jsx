"use client";

import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function PublicFooter() {
  const { config } = useSiteConfig();

  const whatsapp = String(config?.whatsapp || "17738277463").replace(/\D/g, "");
  const instagram = config?.instagram || "";
  const telegram = config?.telegram || "";
  const facebook = config?.facebook || "";
  const tiktok = config?.tiktok || "";
  const youtube = config?.youtube || "";
  const correo = config?.correo || "";

  const redes = [
    {
      label: "WhatsApp Soporte",
      href: `https://wa.me/${whatsapp}?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa`,
      show: Boolean(whatsapp),
    },
    {
      label: "Instagram",
      href: instagram,
      show: Boolean(instagram),
    },
    {
      label: "Telegram",
      href: telegram,
      show: Boolean(telegram),
    },
    {
      label: "Facebook",
      href: facebook,
      show: Boolean(facebook),
    },
    {
      label: "TikTok",
      href: tiktok,
      show: Boolean(tiktok),
    },
    {
      label: "YouTube",
      href: youtube,
      show: Boolean(youtube),
    },
    {
      label: "Correo",
      href: correo ? `mailto:${correo}` : "",
      show: Boolean(correo),
    },
  ];

  const footerPrimaryColor = config?.color_primario || "#dc2626";
  const footerHoverColor = config?.color_hover || "#b91c1c";

  return (
    <footer
      className="footer reveal-fade-up reveal-delay-4"
      id="contacto"
      style={{
        "--footer-link-color": footerPrimaryColor,
        "--footer-link-hover": footerHoverColor,
      }}
    >
      <h2>{config?.principal_texto_contacto || "Conéctate con nosotros"}</h2>

      {config?.footer_mostrar_redes !== false && (
        <div className="footer-links">
          {redes
            .filter((red) => red.show)
            .map((red) => (
              <a
                key={red.label}
                href={red.href}
                target={red.label === "Correo" ? "_self" : "_blank"}
                rel={red.label === "Correo" ? undefined : "noreferrer"}
                className="footer-link"
              >
                {red.label}
              </a>
            ))}
        </div>
      )}

      <p>© 2026 - {config?.footer_texto || "Todos los derechos reservados."}</p>
    </footer>
  );
}