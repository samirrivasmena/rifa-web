"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RaffleDualImage from "@/components/shared/RaffleDualImage";

export default function HomeEventosPreview({ rifas = [] }) {
  const router = useRouter();

  const [paginaFinalizados, setPaginaFinalizados] = useState(1);
  const itemsPorPaginaFinalizados = 1;

  const eventosDisponibles = useMemo(
    () =>
      rifas.filter((r) =>
        ["activa", "disponible"].includes(String(r.estado || "").toLowerCase())
      ),
    [rifas]
  );

  const eventosFinalizados = useMemo(
    () =>
      rifas.filter((r) =>
        ["finalizada", "finalizado", "cerrada"].includes(
          String(r.estado || "").toLowerCase()
        )
      ),
    [rifas]
  );

  const totalPaginasFinalizados = useMemo(() => {
    return Math.max(
      Math.ceil(eventosFinalizados.length / itemsPorPaginaFinalizados),
      1
    );
  }, [eventosFinalizados.length]);

  const eventosFinalizadosPaginados = useMemo(() => {
    const inicio = (paginaFinalizados - 1) * itemsPorPaginaFinalizados;
    const fin = inicio + itemsPorPaginaFinalizados;
    return eventosFinalizados.slice(inicio, fin);
  }, [eventosFinalizados, paginaFinalizados]);

  useEffect(() => {
    setPaginaFinalizados(1);
  }, [eventosFinalizados.length]);

  const irABoletos = () => {
    const section = document.getElementById("boletos");
    if (!section) return;

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    section.classList.remove("boletos-highlight");

    setTimeout(() => {
      section.classList.add("boletos-highlight");
    }, 120);

    setTimeout(() => {
      section.classList.remove("boletos-highlight");
    }, 2200);
  };

  const abrirEvento = (id) => {
    if (!id) return;
    router.push(`/evento/${id}`);
  };

  return (
    <section id="eventos" className="home-events-preview-section">
      <div className="home-events-preview-inner">
        <div className="home-events-title-wrap">
          <p className="home-events-mini-title">¡ Participa !</p>
          <h2 className="home-events-title">DISPONIBLES</h2>
        </div>

        {eventosDisponibles.length === 0 ? (
          <div className="home-events-empty">No hay eventos disponibles por ahora.</div>
        ) : (
          <div className="home-events-grid">
            {eventosDisponibles.map((evento) => {
              const fecha =
                evento.fecha_sorteo ||
                evento.fecha ||
                evento.fecha_rifa ||
                "";

              const hora =
                evento.hora_sorteo ||
                evento.hora ||
                evento.hora_rifa ||
                "";

              return (
                <article key={evento.id} className="home-event-card">
{evento.destacada && (
  <div className="home-card-badge-left">
    <div className="home-destacada-badge">⭐ Destacada</div>
  </div>
)}

                  {evento.portada_url || evento.portada_scroll_url ? (
                    <RaffleDualImage
                      principalSrc={evento.portada_url}
                      secondarySrc={evento.portada_scroll_url}
                      alt={evento.nombre || "Evento"}
                      className="home-event-card-image-wrap"
                    />
                  ) : (
                    <div className="home-event-card-placeholder">Sin imagen</div>
                  )}

                  <div className="home-event-card-body">
                    <h3>{evento.nombre}</h3>

                    {fecha && <p className="home-event-card-date">📅 {fecha}</p>}
                    {hora && <p className="home-event-card-time">⏰ {hora}</p>}

                    {evento.precio_ticket ? (
                      <p className="home-event-card-price">
                        💰 ${Number(evento.precio_ticket).toFixed(2)}
                      </p>
                    ) : null}

                    <div className="home-event-card-actions">
                      <button
                        type="button"
                        className="home-event-card-btn primary"
                        onClick={irABoletos}
                      >
                        BOLETOS DISPONIBLES
                      </button>

                      <button
                        type="button"
                        className="home-event-card-btn secondary"
                        onClick={() => abrirEvento(evento.id)}
                      >
                        VER EVENTO
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="home-events-title-wrap home-events-finalizados">
          <h2 className="home-events-title">FINALIZADOS</h2>
          <p className="home-events-subtitle">
            Eventos terminados organizados por páginas
          </p>
        </div>

        {eventosFinalizados.length === 0 ? (
          <div className="home-events-empty">No hay eventos finalizados por ahora.</div>
        ) : (
          <>
            <div className="home-events-grid">
              {eventosFinalizadosPaginados.map((evento) => {
                const fecha =
                  evento.fecha_sorteo ||
                  evento.fecha ||
                  evento.fecha_rifa ||
                  "";

                return (
                  <article key={evento.id} className="home-event-card finalizada">
                    <div className="home-card-badges-row">
                      {evento.destacada ? (
                        <div className="home-destacada-badge">⭐ Destacada</div>
                      ) : (
                        <div className="home-badge-placeholder" />
                      )}

                      <div className="home-finalizado-badge">Finalizado</div>
                    </div>

                    {evento.portada_url || evento.portada_scroll_url ? (
                      <RaffleDualImage
                        principalSrc={evento.portada_url}
                        secondarySrc={evento.portada_scroll_url}
                        alt={evento.nombre || "Evento"}
                        className="home-event-card-image-wrap finalizada"
                      />
                    ) : (
                      <div className="home-event-card-placeholder">Sin imagen</div>
                    )}

                    <div className="home-event-card-body">
                      <h3>{evento.nombre}</h3>

                      {fecha && <p className="home-event-card-date">📅 {fecha}</p>}

                      {evento.precio_ticket ? (
                        <p className="home-event-card-price">
                          💰 ${Number(evento.precio_ticket).toFixed(2)}
                        </p>
                      ) : null}

                      <div className="home-event-card-actions">
                        <button
                          type="button"
                          className="home-event-card-btn secondary"
                          onClick={() => abrirEvento(evento.id)}
                        >
                          VER EVENTO
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="home-pagination-wrap premium">
              <button
                type="button"
                className="home-pagination-btn"
                onClick={() => setPaginaFinalizados((prev) => Math.max(prev - 1, 1))}
                disabled={paginaFinalizados === 1}
              >
                ← Anterior
              </button>

              <div className="home-pagination-current">
                <span className="home-pagination-label">PÁGINA ACTUAL</span>
                <strong>
                  {paginaFinalizados} / {totalPaginasFinalizados}
                </strong>
              </div>

              <button
                type="button"
                className="home-pagination-btn"
                onClick={() =>
                  setPaginaFinalizados((prev) =>
                    Math.min(prev + 1, totalPaginasFinalizados)
                  )
                }
                disabled={paginaFinalizados === totalPaginasFinalizados}
              >
                Siguiente →
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}