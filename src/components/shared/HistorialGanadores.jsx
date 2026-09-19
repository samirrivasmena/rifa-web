"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RaffleDualImage from "@/components/shared/RaffleDualImage";

export default function HistorialGanadores() {
  const [ganadores, setGanadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch("/api/historial-ganadores", {
          cache: "no-store",
        });

        const data = await res.json();

        if (res.ok) {
          setGanadores(Array.isArray(data.ganadores) ? data.ganadores : []);
        }
      } catch (error) {
        console.error("Error cargando historial:", error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  const tarjetasGanadores = useMemo(() => {
    return ganadores.map((ganador, index) => {
      const rifa = ganador.rifas || {};
      const padLength = rifa.formato === "3digitos" ? 3 : 4;

      const numero =
        ganador.numero_oficial ||
        (ganador.numero_ganador !== null &&
        ganador.numero_ganador !== undefined
          ? String(ganador.numero_ganador).padStart(padLength, "0")
          : "Sin número");

      const fotoPrincipal =
        ganador.foto_ganador_url ||
        rifa.portada_url ||
        rifa.portada_scroll_url ||
        "";

      const fotoSecundaria =
        ganador.foto_ganador_secundaria_url ||
        rifa.portada_scroll_url ||
        rifa.portada_url ||
        "";

      const nombreGanador =
        ganador.nombre_ganador || rifa.nombre || "Ganador oficial";

      const estadoEntrega =
        ganador.estado_entrega === "entregado" ? "entregado" : "pendiente";

      return {
        key: ganador.id || `${nombreGanador}-${numero}-${index}`,
        ganador,
        rifa,
        numero,
        fotoPrincipal,
        fotoSecundaria,
        nombreGanador,
        estadoEntrega,
      };
    });
  }, [ganadores]);

  useEffect(() => {
    setActiveIndex(0);

    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: 0,
        behavior: "auto",
      });
    }
  }, [tarjetasGanadores.length]);

  const moverAGanador = useCallback((index) => {
    const contenedor = scrollRef.current;
    if (!contenedor) return;

    const slide = contenedor.querySelector(`[data-winner-slide="${index}"]`);
    if (!slide) return;

    contenedor.scrollTo({
      left: slide.offsetLeft,
      behavior: "smooth",
    });

    setActiveIndex(index);
  }, []);

  const handleScroll = useCallback(() => {
    const contenedor = scrollRef.current;
    if (!contenedor) return;

    const slides = contenedor.querySelectorAll("[data-winner-slide]");
    if (!slides.length) return;

    const center = contenedor.scrollLeft + contenedor.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(center - slideCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }, []);

  if (loading) {
    return (
      <section
        className="principal-section winner-history-section"
        id="historial-ganadores"
      >
        <div className="principal-section-head">
          <p>Resultados oficiales</p>
          <h2>HISTORIAL DE GANADORES</h2>
        </div>

        <div className="principal-empty-box premium">
          <p>Cargando ganadores...</p>
        </div>
      </section>
    );
  }

  if (tarjetasGanadores.length === 0) {
    return (
      <section
        className="principal-section winner-history-section"
        id="historial-ganadores"
      >
        <div className="principal-section-head">
          <p>Resultados oficiales</p>
          <h2>HISTORIAL DE GANADORES</h2>
        </div>

        <div className="principal-empty-box premium">
          <div className="principal-empty-icon">🏆</div>
          <h3>No hay ganadores todavía</h3>
          <p>Cuando finalices una rifa, aparecerá aquí.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="principal-section winner-history-section"
      id="historial-ganadores"
    >
      <div className="principal-section-head">
        <p>Resultados oficiales</p>
        <h2>HISTORIAL DE GANADORES</h2>
      </div>

      <div className="principal-winners-carousel-viewport">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="principal-winners-carousel"
          aria-label="Historial de ganadores"
        >
          {tarjetasGanadores.map((item, index) => {
            const {
              ganador,
              rifa,
              numero,
              fotoPrincipal,
              fotoSecundaria,
              nombreGanador,
              estadoEntrega,
            } = item;

            return (
              <article
                key={item.key}
                data-winner-slide={index}
                className="principal-winner-slide"
              >
                <div className="principal-event-card-mobile principal-finalizada-card premium-card-hover winner-result-card">
                  <div className="winner-result-badges">
                    <span className="winner-badge-green">
                      🟢 GANADOR OFICIAL
                    </span>
                    <span className="winner-badge-gold">🥇 RESULTADO</span>
                  </div>

                  <div className="winner-image-wrapper">
                    <div className="winner-ribbon">🏆 GANADOR</div>

                    <RaffleDualImage
                      principalSrc={fotoPrincipal}
                      secondarySrc={fotoSecundaria}
                      alt={nombreGanador}
                      className="principal-event-image-mobile-wrap finalizada"
                    />
                  </div>

                  <div className="principal-event-content-mobile">
                    <h3>{nombreGanador}</h3>

                    <div className="winner-result-details">
                      <p className="principal-event-meta-mobile">
                        🏆 Número ganador: <strong>{numero}</strong>
                      </p>

                      {rifa.premio ? (
                        <p className="principal-event-meta-mobile">
                          🎁 Premio: <strong>{rifa.premio}</strong>
                        </p>
                      ) : null}

                      {ganador.ciudad_ganador ? (
                        <p className="principal-event-meta-mobile">
                          📍 Ciudad: <strong>{ganador.ciudad_ganador}</strong>
                        </p>
                      ) : null}

                      {ganador.instagram_ganador ? (
                        <p className="principal-event-meta-mobile">
                          📸 Instagram: <strong>{ganador.instagram_ganador}</strong>
                        </p>
                      ) : null}

                      {estadoEntrega === "entregado" ? (
                        <p className="principal-event-meta-mobile">
                          ✅ Premio entregado
                        </p>
                      ) : (
                        <p className="principal-event-meta-mobile">
                          ⏳ Premio pendiente de entrega
                        </p>
                      )}

                      {ganador.descripcion_resultado ? (
                        <p className="principal-event-meta-mobile">
                          📝 {ganador.descripcion_resultado}
                        </p>
                      ) : null}

                      {ganador.fecha_sorteo ? (
                        <p className="principal-event-meta-mobile">
                          📅 Resultado:{" "}
                          {new Date(ganador.fecha_sorteo).toLocaleDateString()}
                        </p>
                      ) : null}

                      {(rifa.fecha_sorteo || rifa.hora_sorteo) && (
                        <p className="principal-event-meta-mobile">
                          🎯 Sorteo: {rifa.fecha_sorteo || "Sin fecha"}{" "}
                          {rifa.hora_sorteo || ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {tarjetasGanadores.length > 1 && (
        <div
          className="principal-pagination-dots winner-pagination-dots carousel-dots"
          aria-label="Paginación historial de ganadores"
        >
          {tarjetasGanadores.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`principal-pagination-dot carousel-dot ${
                activeIndex === index ? "active" : ""
              }`}
              onClick={() => moverAGanador(index)}
              aria-label={`Ir al ganador ${index + 1}`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}