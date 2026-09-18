"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import RaffleDualImage from "@/components/shared/RaffleDualImage";
import ProgressVentaBar from "@/components/shared/ProgressVentaBar";
import { getRifaProgress } from "@/lib/getRifaProgress";

export default function HomeEventosPreview({ rifas = [] }) {
  const router = useRouter();

  const [paginaActual, setPaginaActual] = useState(1);
  const cardsPorPagina = 3;

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
      ? Number(Math.min(Math.max(porcentajeApi, 0), 100).toFixed(2))
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

  const eventosFinalizados = useMemo(() => {
    return ordenarRifas(rifas.filter((r) => esEventoFinalizado(r.estado)));
  }, [rifas]);

  const totalPaginas = Math.max(
    Math.ceil(eventosFinalizados.length / cardsPorPagina),
    1
  );

  const eventosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * cardsPorPagina;
    const fin = inicio + cardsPorPagina;

    return eventosFinalizados.slice(inicio, fin);
  }, [eventosFinalizados, paginaActual]);

  const abrirEvento = (id) => {
    if (!id) return;
    router.push(`/evento/${id}`);
  };

  useEffect(() => {
    setPaginaActual(1);
  }, [eventosFinalizados.length]);

  return (
    <section id="eventos" className="home-events-preview-section">
      <div className="home-events-preview-inner">
        <div className="home-events-title-wrap home-events-finalizados">
          <h2 className="home-events-title">FINALIZADOS</h2>
          <p className="home-events-subtitle">
            Eventos terminados organizados por páginas
          </p>
        </div>

        {eventosFinalizados.length === 0 ? (
          <div className="home-events-empty">
            No hay eventos finalizados por ahora.
          </div>
        ) : (
          <>
            <div className="home-events-grid-finalizados">
              {eventosPaginados.map((evento) => {
                const fecha =
                  evento.fecha_sorteo ||
                  evento.fecha ||
                  evento.fecha_rifa ||
                  "";

                const progreso = normalizarProgreso(evento);

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

                      {fecha && (
                        <p className="home-event-card-date">📅 {fecha}</p>
                      )}

                      <div className="home-progress-wrap">
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
                      </div>

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

            {totalPaginas > 1 && (
              <div
                className="home-events-dots"
                aria-label="Paginación eventos finalizados"
              >
                {Array.from({ length: totalPaginas }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`home-event-dot ${
                      paginaActual === index + 1 ? "active" : ""
                    }`}
                    onClick={() => setPaginaActual(index + 1)}
                    aria-label={`Ir a la página ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}