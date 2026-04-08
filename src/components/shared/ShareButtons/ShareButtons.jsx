"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "./ShareButtons.module.css";
import { buildShareText, copyToClipboard, openPopup, safeEncode } from "./shareUtils";

function Icon({ name }) {
  switch (name) {
    case "whatsapp":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.11 17.21c-.29-.15-1.71-.84-1.98-.93-.27-.1-.46-.15-.66.15-.19.29-.76.93-.93 1.12-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.19.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.49.07-.74.34-.24.27-.95.93-.95 2.28s.98 2.66 1.12 2.85c.15.19 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.26.18 1.73.11.53-.08 1.71-.7 1.95-1.38.24-.68.24-1.26.17-1.38-.07-.11-.27-.18-.56-.33Z"
          />
          <path
            fill="currentColor"
            d="M16.01 3C8.83 3 3 8.73 3 15.8c0 2.49.72 4.81 1.96 6.78L3.2 29l6.62-1.72a13.1 13.1 0 0 0 6.19 1.57h.01c7.18 0 13-5.73 13-12.8C29.02 8.73 23.19 3 16.01 3Zm0 23.54h-.01a10.8 10.8 0 0 1-5.5-1.5l-.39-.23-3.93 1.02 1.05-3.8-.25-.39a10.45 10.45 0 0 1-1.63-5.6C5.35 10.19 10.12 5.5 16 5.5c5.88 0 10.66 4.69 10.66 10.46 0 5.78-4.78 10.58-10.65 10.58Z"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.2-1.5 1.6-1.5h1.7V5c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.6v8h3.9z"
          />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.9 2H22l-6.8 7.8L23 22h-6.5l-5.1-6.7L5.6 22H2l7.3-8.4L1 2h6.7l4.6 6.1L18.9 2zm-1.1 18h1.8L6.8 3.9H4.9L17.8 20z"
          />
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9.7 15.4 9.5 19c.5 0 .7-.2 1-.4l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.2-.4-1.7-1.3-1.3L2.5 9.2c-1.1.4-1.1 1.1-.2 1.4l4.5 1.4L18 5.9c.5-.3 1-.1.6.2L9.7 15.4z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 4.5A5.5 5.5 0 1 1 6.5 14 5.5 5.5 0 0 1 12 8.5zm0 2A3.5 3.5 0 1 0 15.5 14 3.5 3.5 0 0 0 12 10.5zM18 6.8a1.2 1.2 0 1 1-1.2 1.2A1.2 1.2 0 0 1 18 6.8z"
          />
        </svg>
      );
    case "link":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10.6 13.4a1 1 0 0 1 0-1.4l3-3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0z"
          />
          <path
            fill="currentColor"
            d="M7.8 17.6a4 4 0 0 1 0-5.6l2-2a1 1 0 1 1 1.4 1.4l-2 2a2 2 0 0 0 2.8 2.8l2-2a1 1 0 1 1 1.4 1.4l-2 2a4 4 0 0 1-5.6 0z"
          />
          <path
            fill="currentColor"
            d="M16.2 6.4a4 4 0 0 1 0 5.6l-2 2a1 1 0 1 1-1.4-1.4l2-2a2 2 0 1 0-2.8-2.8l-2 2a1 1 0 1 1-1.4-1.4l2-2a4 4 0 0 1 5.6 0z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function ShareButtons({ url, title = "", text = "" }) {
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const tRef = useRef(null);

  const finalText = useMemo(() => buildShareText({ title, text }), [title, text]);
  const encodedUrl = useMemo(() => safeEncode(url), [url]);
  const encodedText = useMemo(() => safeEncode(finalText), [finalText]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setToast(""), 1600);
  }, []);

  const copiarLink = useCallback(async () => {
    if (!url) return;
    try {
      setBusy(true);
      const ok = await copyToClipboard(url);
      showToast(ok ? "Link copiado" : "No se pudo copiar. Copia manualmente.");
    } finally {
      setBusy(false);
    }
  }, [url, showToast]);

  const share = (type) => {
    if (!url) return;

    if (type === "whatsapp") openPopup(`https://wa.me/?text=${encodedText}%20${encodedUrl}`);
    if (type === "facebook") openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
    if (type === "x") openPopup(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
    if (type === "telegram") openPopup(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`);

    if (type === "instagram") {
      // IG no admite share intent web -> copiamos y abrimos IG
      copiarLink().then(() => openPopup("https://www.instagram.com/"));
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} role="group" aria-label="Opciones para compartir">
        <button type="button" className={`${styles.btn} ${styles.whatsapp}`} onClick={() => share("whatsapp")}>
          <span className={styles.icon}><Icon name="whatsapp" /></span>
          <span className={styles.label}>WhatsApp</span>
        </button>

        <button type="button" className={`${styles.btn} ${styles.facebook}`} onClick={() => share("facebook")}>
          <span className={styles.icon}><Icon name="facebook" /></span>
          <span className={styles.label}>Facebook</span>
        </button>

        <button type="button" className={`${styles.btn} ${styles.x}`} onClick={() => share("x")}>
          <span className={styles.icon}><Icon name="x" /></span>
          <span className={styles.label}>X</span>
        </button>

        <button type="button" className={`${styles.btn} ${styles.telegram}`} onClick={() => share("telegram")}>
          <span className={styles.icon}><Icon name="telegram" /></span>
          <span className={styles.label}>Telegram</span>
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.instagram}`}
          onClick={() => share("instagram")}
          disabled={busy}
        >
          <span className={styles.icon}><Icon name="instagram" /></span>
          <span className={styles.label}>Instagram</span>
          <span className={styles.subLabel}>Copia + abre</span>
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.copy}`}
          onClick={copiarLink}
          disabled={busy}
        >
          <span className={styles.icon}><Icon name="link" /></span>
          <span className={styles.label}>Copiar link</span>
        </button>
      </div>

      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  );
}