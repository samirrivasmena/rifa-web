"use client";

import { useRef, useState } from "react";

export function useAdminNavigation() {
  const topRef = useRef(null);
  const dashboardRef = useRef(null);
  const mapaTicketsRef = useRef(null);
  const dashboardFilterRef = useRef(null);
  const comprasSectionRef = useRef(null);
  const ganadorRef = useRef(null);
  const rankingRef = useRef(null);
  const rankingDetalleRef = useRef(null);

  const [seccionActiva, setSeccionActiva] = useState("dashboard");
  const [filtroDashboard, setFiltroDashboard] = useState(null);

  const scrollToRef = (ref, delay = 180) => {
    setTimeout(() => {
      ref?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, delay);
  };

  return {
    refs: {
      topRef,
      dashboardRef,
      mapaTicketsRef,
      dashboardFilterRef,
      comprasSectionRef,
      ganadorRef,
      rankingRef,
      rankingDetalleRef,
    },
    seccionActiva,
    setSeccionActiva,
    filtroDashboard,
    setFiltroDashboard,
    scrollToRef,
  };
}