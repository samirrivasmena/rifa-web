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

  const tieneSecundaria =
    Boolean(secondarySrc) && String(secondarySrc).trim() !== "";

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

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tieneSecundaria) return;

    if (!isVisible) {
      setShowSecondImage(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setShowSecondImage((prev) => !prev);
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible, tieneSecundaria]);

  return (
    <div ref={containerRef} className={`raffle-dual-image-wrap ${className}`}>
      <img
        src={principalSrc || "/logo.png"}
        alt={alt}
        className={`raffle-dual-image-layer ${
          showSecondImage && tieneSecundaria ? "hide" : "show"
        }`}
      />

      {tieneSecundaria && (
        <img
          src={secondarySrc}
          alt={`${alt} secundaria`}
          className={`raffle-dual-image-layer ${
            showSecondImage ? "show" : "hide"
          }`}
        />
      )}
    </div>
  );
}