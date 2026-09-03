"use client";

import { useEffect, useState } from "react";

export default function FloatingStatsNotifications({
  viewers = 14,
  comprasUltimaHora = 7,
  vendidos = 824,
  total = 999,
}) {
  const mensajes = [
    {
      icono: "👥",
      texto: `${viewers} personas viendo esta rifa`,
    },
    {
      icono: "🔥",
      texto: `${comprasUltimaHora} compras en la última hora`,
    },
    {
      icono: "🎟️",
      texto: `${vendidos} de ${total} números vendidos`,
    },
  ];

  const [visible, setVisible] = useState(false);
  const [indice, setIndice] = useState(0);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const iniciar = () => {
      setSaliendo(false);
      setVisible(true);

      setTimeout(() => {
        setSaliendo(true);
      }, 2500);

      setTimeout(() => {
        setVisible(false);

        setTimeout(() => {
          setIndice((prev) => (prev + 1) % mensajes.length);
        }, 500);
      }, 3000);
    };

    iniciar();

    const intervalo = setInterval(() => {
      iniciar();
    }, 12000);

    return () => clearInterval(intervalo);
  }, [mensajes.length]);

  if (!visible) return null;

  return (
    <div
      className={`floating-stats-notification ${
        saliendo ? "stats-toast-exit" : ""
      }`}
    >
      <span className="floating-stats-icon">
        {mensajes[indice].icono}
      </span>

      <span className="floating-stats-text">
        {mensajes[indice].texto}
      </span>
    </div>
  );
}