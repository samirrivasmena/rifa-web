"use client";

import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function PublicFooter({ texto, mostrarRedes }) {
  const { config } = useSiteConfig();

  const nombreMarca = config?.nombre_marca || "RIFAS LSD";
  const logoUrl = config?.logo_url || "/logo.png";

  const whatsapp = String(config?.whatsapp || "17738277463").replace(/\D/g, "");
  const instagram = config?.instagram || "";
  const telegram = config?.telegram || "";
  const facebook = config?.facebook || "";
  const tiktok = config?.tiktok || "";
  const youtube = config?.youtube || "";
  const correo = config?.correo || "";
  const pais = config?.pais || "";
  const direccion = config?.direccion || "";
  const website = config?.web_url || config?.website || config?.pagina_web || "";

  const footerTexto =
    texto || config?.footer_texto || "Todos los derechos reservados.";

  const reviewText =
    config?.footer_reseña ||
    "Rifas LSD ofrece una experiencia seria, organizada y transparente para todos sus participantes.";

  const showRedes =
    typeof mostrarRedes === "boolean"
      ? mostrarRedes
      : config?.footer_mostrar_redes !== false;

  const secciones = [
    { label: "INICIO", href: "/principal#inicio" },
    { label: "EVENTOS", href: "/principal#eventos-disponibles" },
    { label: "RESULTADOS", href: "/principal#resultados-oficiales" },
    { label: "GANADORES", href: "/principal#historial-ganadores" },
    { label: "CUENTA DE PAGO", href: "/principal#pagos" },
    { label: "CONTACTO", href: "/principal#contacto" },
  ];

  const redes = [
    { label: "Instagram", href: instagram, show: Boolean(instagram) },
    { label: "Telegram", href: telegram, show: Boolean(telegram) },
    { label: "Facebook", href: facebook, show: Boolean(facebook) },
    { label: "TikTok", href: tiktok, show: Boolean(tiktok) },
    { label: "YouTube", href: youtube, show: Boolean(youtube) },
    { label: "Correo", href: correo ? `mailto:${correo}` : "", show: Boolean(correo) },
  ];

  return (
    <footer className="public-footer" id="site-footer">
      <div className="public-footer-topnav">
        {secciones.map((item) => (
          <a key={item.label} href={item.href} className="public-footer-navlink">
            {item.label}
          </a>
        ))}
      </div>

      <div className="public-footer-inner">
        {/* MARCA */}
        <div className="public-footer-col public-footer-brand">
          <h3 className="public-footer-title">{nombreMarca}</h3>

          <p className="public-footer-subtitle">
            {config?.principal_texto_eventos ||
              "Sorteos, eventos y experiencias creadas con seriedad, transparencia y compromiso."}
          </p>

          <div className="public-footer-logo-wrap">
            <img
              src={logoUrl}
              alt={nombreMarca}
              className="public-footer-logo"
            />
          </div>
        </div>

        {/* NOSOTROS */}
        <div className="public-footer-col">
          <h3 className="public-footer-heading">NOSOTROS</h3>
          <p className="public-footer-text">{footerTexto}</p>

          <div className="public-footer-review">
            <div className="public-footer-review-stars">★★★★★</div>
            <p className="public-footer-review-text">{reviewText}</p>
          </div>
        </div>

        {/* CONTACTO */}
        <div className="public-footer-col">
          <h3 className="public-footer-heading">CONTACTO</h3>

          {website && (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="public-footer-link"
            >
              <span className="public-footer-icon">🌐</span>
              <span>{website.replace(/^https?:\/\//, "")}</span>
            </a>
          )}

          {pais && (
            <div className="public-footer-link static">
              <span className="public-footer-icon">📍</span>
              <span>{pais}</span>
            </div>
          )}

          {direccion && (
            <div className="public-footer-link static">
              <span className="public-footer-icon">📌</span>
              <span>{direccion}</span>
            </div>
          )}

          <a
            href={`https://wa.me/${whatsapp}?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa`}
            target="_blank"
            rel="noreferrer"
            className="public-footer-link"
          >
            <span className="public-footer-icon">💬</span>
            <span>+{whatsapp}</span>
          </a>

          {correo && (
            <a href={`mailto:${correo}`} className="public-footer-link">
              <span className="public-footer-icon">✉️</span>
              <span>{correo}</span>
            </a>
          )}
        </div>

        {/* REDES */}
        <div className="public-footer-col">
          <h3 className="public-footer-heading">SÍGUENOS</h3>

          {showRedes ? (
            <div className="public-footer-socials">
              {redes
                .filter((red) => red.show)
                .map((red) => (
                  <a
                    key={red.label}
                    href={red.href}
                    target="_blank"
                    rel="noreferrer"
                    className="public-footer-social-link"
                  >
                    {red.label}
                  </a>
                ))}
            </div>
          ) : (
            <p className="public-footer-text">Redes sociales ocultas.</p>
          )}
        </div>
      </div>

      <div className="public-footer-bottom">
        <p>Condiciones | Privacidad | Responsabilidad</p>
        <p>
          © {new Date().getFullYear()} {footerTexto}
        </p>
      </div>
    </footer>
  );
}