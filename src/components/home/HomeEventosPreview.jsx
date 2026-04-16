"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import RaffleDualImage from "@/components/shared/RaffleDualImage";
import ProgressVentaBar from "@/components/shared/ProgressVentaBar";
import { getRifaProgress } from "@/lib/getRifaProgress";

export default function HomeEventosPreview({ rifas = [] }) {
  const router = useRouter();

  const [paginaFinalizados, setPaginaFinalizados] = useState(1);
  const itemsPorPaginaFinalizados = 1;

  const esEventoDisponible = (estado) =>
    ["activa", "disponible", "publicada"].includes(
      String(estado || "").toLowerCase()
    );

  const esEventoAgotado = (estado) =>
    ["agotada", "agotado"].includes(String(estado || "").toLowerCase());

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

      const fechaA = new Date(a.created_at || a.fecha_sorteo || 0).getTime();
      const fechaB = new Date(b.created_at || b.fecha_sorteo || 0).getTime();

      return fechaB - fechaA;
    });
  };

  const eventosDisponibles = useMemo(() => {
    return ordenarRifas(rifas.filter((r) => esEventoDisponible(r.estado)));
  }, [rifas]);

  const eventosAgotados = useMemo(() => {
    return ordenarRifas(rifas.filter((r) => esEventoAgotado(r.estado)));
  }, [rifas]);

  const eventosFinalizados = useMemo(() => {
    return ordenarRifas(rifas.filter((r) => esEventoFinalizado(r.estado)));
  }, [rifas]);

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

    if (!section) {
      router.push("/#boletos");
      return;
    }

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

              const progreso = getRifaProgress(evento);

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
                    <h3>{evento.nombre || "Evento"}</h3>

                    {fecha && <p className="home-event-card-date">📅 {fecha}</p>}
                    {hora && <p className="home-event-card-time">⏰ {hora}</p>}

                    {evento.precio_ticket !== null &&
                    evento.precio_ticket !== undefined ? (
                      <p className="home-event-card-price">
                        💰 ${formatearPrecioSeguro(evento.precio_ticket)}
                      </p>
                    ) : null}

                    <ProgressVentaBar
                      value={progreso.porcentaje}
                      soldOut={progreso.soldOut}
                      text={
                        progreso.total > 0
                          ? `${progreso.vendidos} de ${progreso.total} boletos vendidos`
                          : "Progreso de venta"
                      }
                      compact
                    />

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

        {eventosAgotados.length > 0 && (
          <>
            <div className="home-events-title-wrap home-events-finalizados">
              <h2 className="home-events-title">AGOTADAS</h2>
              <p className="home-events-subtitle">
                Rifas completas y pendientes de sorteo
              </p>
            </div>

            <div className="home-events-grid">
              {eventosAgotados.map((evento) => {
                const fecha =
                  evento.fecha_sorteo ||
                  evento.fecha ||
                  evento.fecha_rifa ||
                  "";

                const progreso = getRifaProgress(evento);

                return (
                  <article key={evento.id} className="home-event-card finalizada">
                    <div className="home-card-badges-row">
                      {evento.destacada ? (
                        <div className="home-destacada-badge">⭐ Destacada</div>
                      ) : (
                        <div className="home-badge-placeholder" />
                      )}

                      <div className="home-agotado-badge">Agotada</div>
                    </div>

                    {evento.portada_url || evento.portada_scroll_url ? (
                      <RaffleDualImage
                        principalSrc={evento.portada_url}
                        secondarySrc={evento.portada_scroll_url}
                        alt={evento.nombre || "Evento agotado"}
                        className="home-event-card-image-wrap finalizada"
                      />
                    ) : (
                      <div className="home-event-card-placeholder">Sin imagen</div>
                    )}

                    <div className="home-event-card-body">
                      <h3>{evento.nombre || "Evento agotado"}</h3>

                      {fecha && <p className="home-event-card-date">📅 {fecha}</p>}

                      <ProgressVentaBar
                        value={progreso.porcentaje}
                        soldOut={progreso.soldOut}
                        text={
                          progreso.total > 0
                            ? `${progreso.vendidos} de ${progreso.total} boletos vendidos`
                            : "Progreso de venta"
                        }
                        compact
                      />

                      <p className="home-event-card-date">⏳ Pendiente de sorteo</p>

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
          </>
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

                const progreso = getRifaProgress(evento);

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
                      <h3>{evento.nombre || "Evento finalizado"}</h3>

                      {fecha && <p className="home-event-card-date">📅 {fecha}</p>}

                      {evento.precio_ticket !== null &&
                      evento.precio_ticket !== undefined ? (
                        <p className="home-event-card-price">
                          💰 ${formatearPrecioSeguro(evento.precio_ticket)}
                        </p>
                      ) : null}

                      <ProgressVentaBar
                        value={progreso.porcentaje}
                        soldOut={progreso.soldOut}
                        text={
                          progreso.total > 0
                            ? `${progreso.vendidos} de ${progreso.total} boletos vendidos`
                            : "Progreso de venta"
                        }
                        compact
                      />

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

            <div className="principal-pagination-wrap principal-pagination-premium">
              <button
                type="button"
                className="principal-pagination-btn premium"
                onClick={() => setPaginaFinalizados((prev) => Math.max(prev - 1, 1))}
                disabled={paginaFinalizados === 1}
                aria-label="Ir a la página anterior de eventos finalizados"
              >
                ← Anterior
              </button>

              <div className="principal-pagination-current premium">
                <span className="principal-pagination-label">PÁGINA ACTUAL</span>
                <strong>
                  {paginaFinalizados} / {totalPaginasFinalizados}
                </strong>
              </div>

              <button
                type="button"
                className="principal-pagination-btn premium"
                onClick={() =>
                  setPaginaFinalizados((prev) =>
                    Math.min(prev + 1, totalPaginasFinalizados)
                  )
                }
                disabled={paginaFinalizados === totalPaginasFinalizados}
                aria-label="Ir a la página siguiente de eventos finalizados"
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