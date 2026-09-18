"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function FloatingWhatsAppButton({ whatsappNumber }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const number = String(whatsappNumber || "").replace(/\D/g, "");

  if (!number) return null;

  const button = (
    <a
      href={`https://wa.me/${number}?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa`}
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir WhatsApp"
      className="whatsapp-float"
      style={{
        position: "fixed",
        right: "16px",
        bottom: "calc(8px + env(safe-area-inset-bottom))",
        zIndex: 2147483646,
        width: "60px",
        height: "60px",
        borderRadius: "50%",
        background: "#25d366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
        textDecoration: "none",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="whatsapp-icon"
        style={{ width: "33px", height: "33px" }}
      >
        <path
          fill="white"
          d="M19.11 17.21c-.29-.15-1.71-.84-1.98-.93-.27-.1-.46-.15-.66.15-.19.29-.76.93-.93 1.12-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.19.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.49.07-.74.34-.24.27-.95.93-.95 2.28s.98 2.66 1.12 2.85c.15.19 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.26.18 1.73.11.53-.08 1.71-.7 1.95-1.38.24-.68.24-1.26.17-1.38-.07-.11-.27-.18-.56-.33Z"
        />
        <path
          fill="white"
          d="M16.01 3C8.83 3 3 8.73 3 15.8c0 2.49.72 4.81 1.96 6.78L3.2 29l6.62-1.72a13.1 13.1 0 0 0 6.19 1.57h.01c7.18 0 13-5.73 13-12.8C29.02 8.73 23.19 3 16.01 3Zm0 23.54h-.01a10.8 10.8 0 0 1-5.5-1.5l-.39-.23-3.93 1.02 1.05-3.8-.25-.39a10.45 10.45 0 0 1-1.63-5.6C5.35 10.19 10.12 5.5 16 5.5c5.88 0 10.66 4.69 10.66 10.46 0 5.78-4.78 10.58-10.65 10.58Z"
        />
      </svg>
    </a>
  );

  return mounted ? createPortal(button, document.body) : null;
}