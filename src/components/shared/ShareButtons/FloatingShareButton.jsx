"use client";

import { useMemo, useState } from "react";
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
  title = "Evento",
  text = "",
}) {
  const [open, setOpen] = useState(false);

  const safeUrl = useMemo(() => getAbsoluteUrl(url), [url]);
  const shareText = useMemo(
    () => text || `Mira este evento: ${title}`,
    [text, title]
  );

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

  const handleOpenShareModal = async () => {
    const ok = await handleNativeShare();
    if (!ok) setOpen(true);
  };

  const handleWhatsApp = () => {
    openPopup(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${safeUrl}`)}`);
  };

  const handleFacebook = () => {
    openPopup(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeUrl)}`
    );
  };

  const handleX = () => {
    openPopup(
      `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(safeUrl)}`
    );
  };

  const handleTelegram = () => {
    openPopup(
      `https://t.me/share/url?url=${encodeURIComponent(safeUrl)}&text=${encodeURIComponent(shareText)}`
    );
  };

  const handleInstagram = async () => {
    const copied = await copyText(`${shareText}\n${safeUrl}`);

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

  return (
    <>
      <button
        type="button"
        className="share-fab"
        onClick={handleOpenShareModal}
        aria-label="Compartir evento"
      >
        <span className="share-fab-icon">📤</span>
        <span className="share-fab-text">Compartir</span>
      </button>

      {open && (
        <div
          className="share-modal-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="share-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compartir evento"
          >
            <div className="share-modal-header">
              <div>
                <h3>Compartir evento</h3>
                <p>Elige una red o copia el enlace</p>
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
              <button type="button" className="share-btn whatsapp" onClick={handleWhatsApp}>
                💬 WhatsApp
              </button>

              <button type="button" className="share-btn facebook" onClick={handleFacebook}>
                📘 Facebook
              </button>

              <button type="button" className="share-btn x" onClick={handleX}>
                𝕏 X
              </button>

              <button type="button" className="share-btn telegram" onClick={handleTelegram}>
                ✈ Telegram
              </button>

              <button type="button" className="share-btn instagram" onClick={handleInstagram}>
                📸 Instagram
              </button>

              <button type="button" className="share-btn copy" onClick={handleCopyLink}>
                🔗 Copiar link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}