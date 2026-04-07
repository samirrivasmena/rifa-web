"use client";

import { useEffect, useRef, useState } from "react";

export default function RaffleDualImage({
  principalSrc,
  secondarySrc,
  alt = "Rifa",
  className = "",
}) {
  const containerRef = useRef(null);
  const intervalRef = useRef(null);

  const [isVisible, setIsVisible] = useState(false);
  const [showSecondImage, setShowSecondImage] = useState(false);

  const principalFinal = String(principalSrc || "").trim() || "/logo.png";
  const secundariaFinal = String(secondarySrc || "").trim();
  const tieneSecundaria = Boolean(secundariaFinal) && secundariaFinal !== principalFinal;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const isMobile = window.innerWidth <= 768;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: isMobile ? 0.12 : 0.18,
        rootMargin: isMobile
          ? "-10% 0px -10% 0px"
          : "-8% 0px -8% 0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!tieneSecundaria) {
      setShowSecondImage(false);
      return;
    }

    if (!isVisible) {
      setShowSecondImage(false);
      return;
    }

    setShowSecondImage(false);

    intervalRef.current = setInterval(() => {
      setShowSecondImage((prev) => !prev);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, tieneSecundaria, secundariaFinal, principalFinal]);

  return (
    <div ref={containerRef} className={`raffle-dual-image-wrap ${className}`}>
      <img
        src={principalFinal}
        alt={alt}
        className={`raffle-dual-image-layer ${
          showSecondImage && tieneSecundaria ? "hide" : "show"
        }`}
        loading="lazy"
        decoding="async"
        draggable={false}
      />

      {tieneSecundaria && (
        <img
          src={secundariaFinal}
          alt={`${alt} secundaria`}
          className={`raffle-dual-image-layer ${showSecondImage ? "show" : "hide"}`}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
    </div>
  );
}