"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";

export default function SwipeCarousel({ children, className = "" }) {
  const ref = useRef(null);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const dragging = useRef(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  const handleTouchStart = (e) => {
    if (!ref.current) return;
    dragging.current = true;
    startX.current = e.touches[0].pageX;
    startScrollLeft.current = ref.current.scrollLeft;
  };

  const handleTouchMove = (e) => {
    if (!dragging.current || !ref.current) return;

    const x = e.touches[0].pageX;
    const walk = (x - startX.current) * 1.2;
    ref.current.scrollLeft = startScrollLeft.current - walk;
  };

  const handleTouchEnd = () => {
    dragging.current = false;
  };

  const items = isMobile
    ? Children.map(children, (child) => {
        if (!isValidElement(child)) return child;

        return cloneElement(child, {
          style: {
            ...child.props.style,
            flex: "0 0 86%",
            minWidth: "86%",
            maxWidth: "86%",
            scrollSnapAlign: "center",
            scrollSnapStop: "always",
          },
        });
      })
    : children;

  return (
    <div
      ref={ref}
      className={`swipe-carousel ${className}`.trim()}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onTouchCancel={isMobile ? handleTouchEnd : undefined}
      style={
        isMobile
          ? {
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              overflowX: "auto",
              overflowY: "hidden",
              gap: "16px",
              padding: "8px 12px 16px",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorX: "contain",
              touchAction: "pan-x",
              scrollbarWidth: "none",
            }
          : undefined
      }
    >
      {items}
    </div>
  );
}