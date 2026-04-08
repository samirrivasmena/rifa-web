"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ShareButtons.module.css";
import ShareButtons from "./ShareButtons";

export default function FloatingShareButton({
  url,
  title = "Compartir",
  text = "Participa y compra tus tickets aquí:",
  bottomOffset = 22,
}) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef(null);

  const canNativeShare = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return typeof navigator.share === "function";
  }, []);

  const close = () => {
    setOpen(false);
    openerRef.current?.focus?.();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpen = async () => {
    if (!url) return;

    if (canNativeShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // si cancelan o falla, abrimos sheet
      }
    }

    setOpen(true);
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={styles.fabCenter}
        style={{
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffset}px)`,
        }}
        onClick={handleOpen}
        aria-label="Compartir este evento"
      >
        <span className={styles.fabIcon} aria-hidden="true">⤴</span>
        <span className={styles.fabText}>Compartir</span>
      </button>

      {open && (
        <div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Compartir"
          onClick={close}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.handle} aria-hidden="true" />

            <div className={styles.modalHead}>
              <div>
                <h3 className={styles.modalTitle}>Compartir evento</h3>
                <p className={styles.modalSub}>Elige una plataforma o copia el enlace</p>
              </div>

              <button type="button" className={styles.closeBtn} onClick={close} aria-label="Cerrar">
                ✕
              </button>
            </div>

            <ShareButtons url={url} title={title} text={text} />
          </div>
        </div>
      )}
    </>
  );
}