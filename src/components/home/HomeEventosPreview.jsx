"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RaffleDualImage from "@/components/shared/RaffleDualImage";

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

  const obtenerPorcentajeSeguro = (evento) => {
    const totalNumerosRaw = Number(
      evento?.cantidad_numeros ?? evento?.total_tickets ?? evento?.numeros_totales ?? 0
    );

    const ticketsVendidosRaw = Number(
      evento?.tickets_vendidos ?? evento?.vendidos ?? evento?.ticketsVendidos ?? 0
    );

    const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;
    const ticketsVendidos = Number.isFinite(ticketsVendidosRaw) ? ticketsVendidosRaw : 0;

    const porcentajeRaw = Number(
      evento?.porcentaje_vendido ??
        (totalNumeros > 0 ? (ticketsVendidos / totalNumeros) * 100 : 0)
    );

    return Number.isFinite(porcentajeRaw) ? porcentajeRaw : 0;
  };

  const eventosDisponibles = useMemo(
    () => rifas.filter((r) => esEventoDisponible(r.estado)),
    [rifas]
  );

  const eventosAgotados = useMemo(
    () => rifas.filter((r) => esEventoAgotado(r.estado)),
    [rifas]
  );

  const eventosFinalizados = useMemo(
    () => rifas.filter((r) => esEventoFinalizado(r.estado)),
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

              const porcentaje = obtenerPorcentajeSeguro(evento);

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

                    {evento.precio_ticket !== null && evento.precio_ticket !== undefined ? (
                      <p className="home-event-card-price">
                        💰 ${formatearPrecioSeguro(evento.precio_ticket)}
                      </p>
                    ) : null}

                    <p className="home-event-card-progress">
                      📊 {porcentaje.toFixed(1)}% vendido
                    </p>

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

                const porcentaje = obtenerPorcentajeSeguro(evento);

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
                      <h3>{evento.nombre}</h3>

                      {fecha && <p className="home-event-card-date">📅 {fecha}</p>}

                      <p className="home-event-card-progress">
                        📊 {porcentaje.toFixed(1)}% vendido
                      </p>

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

                      {evento.precio_ticket !== null && evento.precio_ticket !== undefined ? (
                        <p className="home-event-card-price">
                          💰 ${formatearPrecioSeguro(evento.precio_ticket)}
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
                aria-label="Ir a la página anterior de eventos finalizados"
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