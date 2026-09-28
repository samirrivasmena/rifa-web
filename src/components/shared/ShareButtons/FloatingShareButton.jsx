"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

function getAbsoluteUrl(url) {
  if (typeof window === "undefined") return url;

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);

    return ok;
  } catch {
    return false;
  }
}

function openPopup(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function FloatingShareButton({
  url,
  whatsappUrl = "",
  title = "Evento",
  text = "",
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // =========================================================
  // URL NORMAL
  //
  // Se conserva para:
  // - compartir nativo
  // - Facebook
  // - X
  // - Telegram
  // - Instagram
  // - copiar enlace
  // =========================================================

  const safeUrl = useMemo(
    () => getAbsoluteUrl(url),
    [url]
  );

  // =========================================================
  // URL ESPECIAL DE WHATSAPP
  //
  // Si recibimos whatsappUrl, WhatsApp usa esa URL.
  //
  // Si NO recibimos whatsappUrl, utiliza safeUrl exactamente
  // como lo hacía este componente anteriormente.
  // =========================================================

  const safeWhatsAppUrl = useMemo(() => {
    if (!whatsappUrl) {
      return safeUrl;
    }

    return getAbsoluteUrl(whatsappUrl);
  }, [whatsappUrl, safeUrl]);

  const shareText = useMemo(
    () => text || `Mira este evento: ${title}`,
    [text, title]
  );

  // =========================================================
  // COMPARTIR NATIVO
  // =========================================================

  const handleNativeShare = async () => {
    try {
      if (
        typeof navigator !== "undefined" &&
        window.isSecureContext &&
        navigator.share
      ) {
        await navigator.share({
          title,
          text: shareText,
          url: safeUrl,
        });

        return true;
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Error compartiendo:", error);
      }
    }

    return false;
  };

  // =========================================================
  // ABRIR COMPARTIR
  // =========================================================

  const handleOpenShareModal = async () => {
    const ok = await handleNativeShare();

    if (!ok) {
      setOpen(true);
    }
  };

  // =========================================================
  // WHATSAPP
  //
  // IMPORTANTE:
  // Conservamos EXACTAMENTE la estrategia que ya comprobamos
  // que muestra correctamente los emojis:
  //
  // encodeURIComponent(`${shareText}\n${URL}`)
  //
  // La única diferencia es que ahora puede utilizar una URL
  // especial mediante whatsappUrl.
  // =========================================================

  const handleWhatsApp = () => {
    const mensajeWhatsApp =
      `${shareText}\n${safeWhatsAppUrl}`;

    openPopup(
      `https://wa.me/?text=${encodeURIComponent(
        mensajeWhatsApp
      )}`
    );
  };

  // =========================================================
  // FACEBOOK
  // =========================================================

  const handleFacebook = () => {
    openPopup(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        safeUrl
      )}`
    );
  };

  // =========================================================
  // X
  // =========================================================

  const handleX = () => {
    openPopup(
      `https://x.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(safeUrl)}`
    );
  };

  // =========================================================
  // TELEGRAM
  // =========================================================

  const handleTelegram = () => {
    openPopup(
      `https://t.me/share/url?url=${encodeURIComponent(
        safeUrl
      )}&text=${encodeURIComponent(shareText)}`
    );
  };

  // =========================================================
  // INSTAGRAM
  // =========================================================

  const handleInstagram = async () => {
    const copied = await copyText(
      `${shareText}\n${safeUrl}`
    );

    if (copied) {
      await Swal.fire({
        icon: "info",
        title: "Enlace copiado",
        text: "Instagram no permite compartir enlaces directos desde la web. Ya copié el enlace para que lo pegues.",
      });

      openPopup("https://www.instagram.com/");
    } else {
      await Swal.fire({
        icon: "warning",
        title: "No se pudo copiar",
        text: "Copia el enlace manualmente e inténtalo en Instagram.",
      });
    }
  };

  // =========================================================
  // COPIAR LINK
  // =========================================================

  const handleCopyLink = async () => {
    const copied = await copyText(safeUrl);

    if (copied) {
      await Swal.fire({
        icon: "success",
        title: "Copiado",
        text: "El enlace del evento fue copiado correctamente.",
        timer: 1200,
        showConfirmButton: false,
      });
    } else {
      await Swal.fire({
        icon: "error",
        title: "No se pudo copiar",
        text: "Tu navegador no permitió copiar el enlace.",
      });
    }
  };

  // =========================================================
  // ESPERAR MONTAJE
  // =========================================================

  if (!mounted) return null;

  // =========================================================
  // UI
  // =========================================================

  return createPortal(
    <>
      <button
        type="button"
        className="share-fab"
        onClick={handleOpenShareModal}
        aria-label="Compartir evento"
        style={{
          position: "fixed",
          left: "50%",
          bottom: "12px",
          transform: "translateX(-50%)",
          zIndex: 99999,
          width: "fit-content",
          minWidth: "0",
          padding: "5px 8px",
          borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          fontSize: "10px",
          lineHeight: "1",
          whiteSpace: "nowrap",
          pointerEvents: "auto",
          boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
        }}
      >
        <span className="share-fab-icon">📲</span>
        <span className="share-fab-text">
          Compartir
        </span>
      </button>

      {open && (
        <div
          className="share-modal-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: "16px",
          }}
        >
          <div
            className="share-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compartir evento"
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#fff",
              borderRadius: "18px",
              padding: "18px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div className="share-modal-header">
              <div>
                <h3>Compartir evento</h3>
                <p>
                  Elige una red o copia el enlace
                </p>
              </div>

              <button
                type="button"
                className="share-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="share-grid">
              <button
                type="button"
                className="share-btn whatsapp"
                onClick={handleWhatsApp}
              >
                💬 WhatsApp
              </button>

              <button
                type="button"
                className="share-btn facebook"
                onClick={handleFacebook}
              >
                📘 Facebook
              </button>

              <button
                type="button"
                className="share-btn x"
                onClick={handleX}
              >
                𝕏 X
              </button>

              <button
                type="button"
                className="share-btn telegram"
                onClick={handleTelegram}
              >
                ✈ Telegram
              </button>

              <button
                type="button"
                className="share-btn instagram"
                onClick={handleInstagram}
              >
                📸 Instagram
              </button>

              <button
                type="button"
                className="share-btn copy"
                onClick={handleCopyLink}
              >
                🔗 Copiar link
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}