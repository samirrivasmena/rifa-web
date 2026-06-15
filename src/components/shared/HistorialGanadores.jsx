"use client";

import { useEffect, useMemo, useState } from "react";
import RaffleDualImage from "@/components/shared/RaffleDualImage";

export default function HistorialGanadores() {
  const [ganadores, setGanadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);

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

  const totalPaginas = Math.max(ganadores.length, 1);

  const ganadorActual = useMemo(() => {
    return ganadores[pagina - 1] || null;
  }, [ganadores, pagina]);

  if (loading) {
    return (
      <section className="principal-section" id="historial-ganadores">
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

  if (!ganadorActual) {
    return (
      <section className="principal-section" id="historial-ganadores">
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

  const rifa = ganadorActual.rifas || {};
  const padLength = rifa.formato === "3digitos" ? 3 : 4;

  const numero =
    ganadorActual.numero_oficial ||
    String(ganadorActual.numero_ganador || "").padStart(padLength, "0");

  const fotoPrincipal =
    ganadorActual.foto_ganador_url ||
    rifa.portada_url ||
    rifa.portada_scroll_url ||
    "";

  const fotoSecundaria =
    ganadorActual.foto_ganador_secundaria_url ||
    rifa.portada_scroll_url ||
    rifa.portada_url ||
    "";

  const nombreGanador =
    ganadorActual.nombre_ganador || rifa.nombre || "Ganador oficial";

  const estadoEntrega =
    ganadorActual.estado_entrega === "entregado" ? "entregado" : "pendiente";

  return (
    <section className="principal-section" id="historial-ganadores">
      <div className="principal-section-head">
        <p>Resultados oficiales</p>
        <h2>HISTORIAL DE GANADORES</h2>
      </div>

      <div className="principal-events-list">
        <article className="principal-event-card-mobile principal-finalizada-card premium-card-hover winner-result-card">
          <div className="winner-result-badges">
            <span className="winner-badge-green">🟢 GANADOR OFICIAL</span>
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

              {ganadorActual.ciudad_ganador ? (
                <p className="principal-event-meta-mobile">
                  📍 Ciudad: <strong>{ganadorActual.ciudad_ganador}</strong>
                </p>
              ) : null}

              {ganadorActual.instagram_ganador ? (
                <p className="principal-event-meta-mobile">
                  📸 Instagram: <strong>{ganadorActual.instagram_ganador}</strong>
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

              {ganadorActual.descripcion_resultado ? (
                <p className="principal-event-meta-mobile">
                  📝 {ganadorActual.descripcion_resultado}
                </p>
              ) : null}

              {ganadorActual.fecha_sorteo ? (
                <p className="principal-event-meta-mobile">
                  📅 Resultado:{" "}
                  {new Date(ganadorActual.fecha_sorteo).toLocaleDateString()}
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
        </article>
      </div>

      <div className="principal-pagination-wrap principal-pagination-premium">
        <button
          type="button"
          className="principal-pagination-btn premium"
          onClick={() => setPagina((prev) => Math.max(prev - 1, 1))}
          disabled={pagina === 1}
        >
          ← Anterior
        </button>

        <div className="principal-pagination-current premium">
          <span className="principal-pagination-label">GANADOR</span>
          <strong>
            {pagina} / {totalPaginas}
          </strong>
        </div>

        <button
          type="button"
          className="principal-pagination-btn premium"
          onClick={() => setPagina((prev) => Math.min(prev + 1, totalPaginas))}
          disabled={pagina === totalPaginas}
        >
          Siguiente →
        </button>
      </div>
    </section>
  );
}