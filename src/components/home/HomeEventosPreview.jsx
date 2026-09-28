"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import RaffleDualImage from "@/components/shared/RaffleDualImage";
import ProgressVentaBar from "@/components/shared/ProgressVentaBar";
import { getRifaProgress } from "@/lib/getRifaProgress";

export default function HomeEventosPreview({ rifas = [] }) {
  const router = useRouter();

  /* =========================================================
     ESTADO
  ========================================================= */

  const [paginaActual, setPaginaActual] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [activeFinalizadoIndex, setActiveFinalizadoIndex] = useState(0);

  const scrollFinalizadosRef = useRef(null);

  const cardsPorPagina = 3;

  /* =========================================================
     HELPERS
  ========================================================= */

  const esEventoFinalizado = (estado) =>
    ["finalizada", "finalizado", "cerrada"].includes(
      String(estado || "").toLowerCase()
    );

  const formatearPrecioSeguro = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toFixed(2) : "0.00";
  };

  const ordenarRifas = (lista) => {
    return [...lista].sort((a, b) => {
      const destacadaA = Boolean(a.destacada);
      const destacadaB = Boolean(b.destacada);

      if (destacadaA !== destacadaB) {
        return Number(destacadaB) - Number(destacadaA);
      }

      const fechaA = new Date(
        a.created_at || a.fecha_sorteo || 0
      ).getTime();

      const fechaB = new Date(
        b.created_at || b.fecha_sorteo || 0
      ).getTime();

      return fechaB - fechaA;
    });
  };

  const normalizarProgreso = (evento) => {
    const progresoFallback = getRifaProgress(evento || {});

    const total = Number(
      evento?.total_numeros ??
        evento?.cantidad_numeros ??
        evento?.numeros_totales ??
        progresoFallback.total ??
        0
    );

    const vendidos = Number(
      evento?.tickets_vendidos ??
        evento?.numeros_vendidos ??
        progresoFallback.vendidos ??
        0
    );

    const porcentajeApi = Number(evento?.porcentaje_vendido);

    const porcentaje = Number.isFinite(porcentajeApi)
      ? Number(
          Math.min(
            Math.max(porcentajeApi, 0),
            100
          ).toFixed(2)
        )
      : progresoFallback.porcentaje;

    const soldOut =
      Boolean(evento?.sold_out) ||
      progresoFallback.soldOut ||
      (total > 0 && vendidos >= total);

    return {
      total,
      vendidos,
      porcentaje,
      soldOut,
    };
  };

  /* =========================================================
     DETECTAR TELÉFONO
  ========================================================= */

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const actualizarVista = () => {
      setIsMobile(mediaQuery.matches);
    };

    actualizarVista();

    mediaQuery.addEventListener("change", actualizarVista);

    return () => {
      mediaQuery.removeEventListener("change", actualizarVista);
    };
  }, []);

  /* =========================================================
     EVENTOS FINALIZADOS
  ========================================================= */

  const eventosFinalizados = useMemo(() => {
    return ordenarRifas(
      rifas.filter((r) => esEventoFinalizado(r.estado))
    );
  }, [rifas]);

  /* =========================================================
     PAGINACIÓN DE ESCRITORIO
  ========================================================= */

  const totalPaginas = Math.max(
    Math.ceil(eventosFinalizados.length / cardsPorPagina),
    1
  );

  const eventosPaginados = useMemo(() => {
    const inicio =
      (paginaActual - 1) * cardsPorPagina;

    const fin =
      inicio + cardsPorPagina;

    return eventosFinalizados.slice(inicio, fin);
  }, [eventosFinalizados, paginaActual]);

  /*
    En teléfono mostramos todos los eventos dentro del carrusel.

    En computadora seguimos usando la paginación de 3 cards.
  */
  const eventosParaVista = isMobile
    ? eventosFinalizados
    : eventosPaginados;

  /* =========================================================
     REINICIAR CARRUSEL / PAGINACIÓN
  ========================================================= */

  useEffect(() => {
    setPaginaActual(1);
    setActiveFinalizadoIndex(0);

    if (scrollFinalizadosRef.current) {
      scrollFinalizadosRef.current.scrollTo({
        left: 0,
        behavior: "auto",
      });
    }
  }, [eventosFinalizados.length, isMobile]);

  /* =========================================================
     SWIPE DEL CARRUSEL
     CARD -> PUNTO
  ========================================================= */

  const handleScrollFinalizados = () => {
    if (!isMobile || !scrollFinalizadosRef.current) {
      return;
    }

    const contenedor = scrollFinalizadosRef.current;

    const cards = contenedor.querySelectorAll(
      ".home-event-card.finalizada"
    );

    if (!cards.length) {
      return;
    }

    const containerRect =
      contenedor.getBoundingClientRect();

    const containerCenter =
      containerRect.left +
      containerRect.width / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    cards.forEach((card, index) => {
      const cardRect =
        card.getBoundingClientRect();

      const cardCenter =
        cardRect.left +
        cardRect.width / 2;

      const distance = Math.abs(
        containerCenter - cardCenter
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveFinalizadoIndex(closestIndex);
  };

  /* =========================================================
     CLICK EN PUNTO
     PUNTO -> CARD
  ========================================================= */

  const irAFinalizado = (index) => {
    if (!isMobile || !scrollFinalizadosRef.current) {
      return;
    }

    const contenedor = scrollFinalizadosRef.current;

    const cards = contenedor.querySelectorAll(
      ".home-event-card.finalizada"
    );

    const card = cards[index];

    if (!card) {
      return;
    }

    const destino =
      card.offsetLeft -
      (contenedor.clientWidth - card.offsetWidth) / 2;

    contenedor.scrollTo({
      left: destino,
      behavior: "smooth",
    });

    setActiveFinalizadoIndex(index);
  };

  /* =========================================================
     ABRIR EVENTO
  ========================================================= */

  const abrirEvento = (id) => {
    if (!id) return;

    router.push(`/evento/${id}`);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <section
      id="eventos"
      className="home-events-preview-section"
    >
      <div className="home-events-preview-inner">

        {/* TÍTULO */}
        <div className="home-events-title-wrap home-events-finalizados">
          <h2 className="home-events-title">
            EVENTOS FINALIZADOS
          </h2>

          <p className="home-events-subtitle">
            Eventos terminados
          </p>
        </div>

        {/* SIN EVENTOS */}
        {eventosFinalizados.length === 0 ? (
          <div className="home-events-empty">
            No hay eventos finalizados por ahora.
          </div>
        ) : (
          <>
            {/* CARRUSEL / GRID */}
            <div
              ref={scrollFinalizadosRef}
              className="home-events-grid-finalizados"
              onScroll={
                isMobile
                  ? handleScrollFinalizados
                  : undefined
              }
            >
              {eventosParaVista.map((evento) => {
                const fecha =
                  evento?.fecha_sorteo ||
                  evento?.fecha ||
                  evento?.fecha_rifa ||
                  "";

                const progreso =
                  normalizarProgreso(evento);

                return (
                  <article
                    key={evento.id}
                    className="home-event-card finalizada"
                  >
                    {/* BADGES */}
                    <div className="home-card-badges-row">
                      {evento?.destacada ? (
                        <div className="home-destacada-badge">
                          ⭐ Destacada
                        </div>
                      ) : (
                        <div className="home-badge-placeholder" />
                      )}

                      <div className="home-finalizado-badge">
                        Finalizado
                      </div>
                    </div>

                    {/* IMAGEN */}
                    {evento?.portada_url ||
                    evento?.portada_scroll_url ? (
                      <RaffleDualImage
                        principalSrc={
                          evento?.portada_url
                        }
                        secondarySrc={
                          evento?.portada_scroll_url
                        }
                        alt={
                          evento?.nombre ||
                          "Evento finalizado"
                        }
                        className="home-event-card-image-wrap finalizada"
                      />
                    ) : (
                      <div className="home-event-card-placeholder">
                        Sin imagen
                      </div>
                    )}

                    {/* INFORMACIÓN */}
                    <div className="home-event-card-body">

                      <h3>
                        {evento?.nombre ||
                          "Evento finalizado"}
                      </h3>

                      {/* FECHA */}
                      {fecha && (
                        <p className="home-event-card-date">
                          📅 {fecha}
                        </p>
                      )}

                      {/* PRECIO */}
                      {evento?.precio_ticket !== null &&
                        evento?.precio_ticket !==
                          undefined && (
                          <p className="home-event-card-price">
                            💰 $
                            {formatearPrecioSeguro(
                              evento.precio_ticket
                            )}
                          </p>
                        )}

                      {/* PROGRESO */}
                      <div className="home-progress-wrap">
                        <ProgressVentaBar
                          value={progreso.porcentaje}
                          soldOut={progreso.soldOut}
                          compact
                        />
                      </div>

                      {/* BOTÓN */}
                      <div className="home-event-card-actions">
                        <button
                          type="button"
                          className="home-event-card-btn secondary"
                          onClick={() =>
                            abrirEvento(evento.id)
                          }
                        >
                          VER EVENTO
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* ===============================================
                PUNTOS DEL TELÉFONO
            =============================================== */}

            {isMobile ? (
              eventosFinalizados.length > 1 && (
                <div
                  className="home-events-dots carousel-dots"
                  aria-label="Navegación de eventos finalizados"
                >
                  {eventosFinalizados.map(
                    (evento, index) => (
                      <button
                        key={
                          evento?.id || index
                        }
                        type="button"
                        className={`home-event-dot carousel-dot ${
                          activeFinalizadoIndex ===
                          index
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          irAFinalizado(index)
                        }
                        aria-label={`Ir al evento finalizado ${
                          index + 1
                        }`}
                        aria-current={
                          activeFinalizadoIndex ===
                          index
                            ? "true"
                            : undefined
                        }
                      />
                    )
                  )}
                </div>
              )
            ) : (
              /* =============================================
                 PAGINACIÓN DE COMPUTADORA
              ============================================= */

              totalPaginas > 1 && (
                <div
                  className="home-events-dots"
                  aria-label="Paginación eventos finalizados"
                >
                  {Array.from({
                    length: totalPaginas,
                  }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`home-event-dot ${
                        paginaActual === index + 1
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setPaginaActual(index + 1)
                      }
                      aria-label={`Ir a la página ${
                        index + 1
                      }`}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </section>
  );
}