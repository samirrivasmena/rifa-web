"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function RaffleDualImage({
  principalSrc,
  secondarySrc,
  alt = "Rifa",
  className = "",
}) {
  const { config } = useSiteConfig();

  const containerRef = useRef(null);
  const intervalRef = useRef(null);

  const [isVisible, setIsVisible] = useState(false);
  const [showSecondImage, setShowSecondImage] = useState(false);
  const [loadSecondary, setLoadSecondary] = useState(false);
  const [principalLoaded, setPrincipalLoaded] = useState(false);

  const logoUrl = String(config?.logo_url || "").trim();

  const principalFinal =
    String(principalSrc || "").trim() || logoUrl;

  const secundariaFinal = String(secondarySrc || "").trim();

  const tieneSecundaria =
    Boolean(secundariaFinal) &&
    secundariaFinal !== principalFinal;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.01,
        rootMargin: "300px 0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !tieneSecundaria) return;

    setLoadSecondary(true);
  }, [isVisible, tieneSecundaria]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!tieneSecundaria || !isVisible || !principalLoaded) {
      setShowSecondImage(false);
      return;
    }

    intervalRef.current = setInterval(() => {
      setShowSecondImage((prev) => !prev);
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, tieneSecundaria, principalLoaded]);

  const cambiarImagen = (mostrarSegunda) => {
    if (!tieneSecundaria) return;

    setLoadSecondary(true);
    setShowSecondImage(mostrarSegunda);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const imagenAnterior = (e) => {
    e.preventDefault();
    e.stopPropagation();

    cambiarImagen(false);
  };

  const imagenSiguiente = (e) => {
    e.preventDefault();
    e.stopPropagation();

    cambiarImagen(true);
  };

  if (!principalFinal) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`raffle-dual-image-wrap ${className}`}
    >
      <img
        src={principalFinal}
        alt={alt}
        className={`raffle-dual-image-layer ${
          showSecondImage && tieneSecundaria ? "hide" : "show"
        }`}
        loading="lazy"
        decoding="async"
        fetchPriority="auto"
        draggable={false}
        onLoad={() => setPrincipalLoaded(true)}
      />

      {tieneSecundaria && loadSecondary && (
        <img
          src={secundariaFinal}
          alt=""
          aria-hidden="true"
          className={`raffle-dual-image-layer ${
            showSecondImage ? "show" : "hide"
          }`}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
        />
      )}

      {tieneSecundaria && (
        <>
          <button
            type="button"
            className="raffle-dual-arrow raffle-dual-arrow-left"
            onClick={imagenAnterior}
            aria-label="Ver imagen anterior"
          >
            ‹
          </button>

          <button
            type="button"
            className="raffle-dual-arrow raffle-dual-arrow-right"
            onClick={imagenSiguiente}
            aria-label="Ver siguiente imagen"
          >
            ›
          </button>

          <div
            className="raffle-dual-dots"
            aria-hidden="true"
          >
            <span className={!showSecondImage ? "active" : ""} />
            <span className={showSecondImage ? "active" : ""} />
          </div>
        </>
      )}
    </div>
  );
}