"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VerifyTicketsModal from "@/components/shared/VerifyTicketsModal";
import PublicTopbar from "@/components/shared/PublicTopbar";
import RaffleDualImage from "@/components/shared/RaffleDualImage";

export default function EventoDetallePageClient() {
  const params = useParams();
  const router = useRouter();

  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificarEmail, setVerificarEmail] = useState("");

  const esPublicada = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setShowVerifyModal(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const cargarEvento = async () => {
      try {
        setLoading(true);

        const res = await fetch("/api/rifas-publicas", {
          method: "GET",
          cache: "no-store",
        });

        const raw = await res.text();
        let data;

        try {
          data = JSON.parse(raw);
        } catch {
          console.error("Respuesta inválida en /api/rifas-publicas");
          setEvento(null);
          return;
        }

        if (!res.ok) {
          console.error(data.error || "No se pudo cargar el evento");
          setEvento(null);
          return;
        }

        const rifas = Array.isArray(data.rifas) ? data.rifas : [];

        const encontrada = rifas.find(
          (r) => String(r.id) === String(params?.id) && esPublicada(r.publicada)
        );

        setEvento(encontrada || null);
      } catch (error) {
        console.error("Error cargando evento:", error);
        setEvento(null);
      } finally {
        setLoading(false);
      }
    };

    if (params?.id) {
      cargarEvento();
    }
  }, [params?.id]);

  const estaFinalizado = useMemo(() => {
    return ["finalizada", "finalizado", "cerrada"].includes(
      String(evento?.estado || "").toLowerCase()
    );
  }, [evento]);

  const premios = useMemo(() => {
    if (!evento) return [];
    if (Array.isArray(evento.premios) && evento.premios.length > 0) return evento.premios;
    if (evento.premio) return [evento.premio];
    return [];
  }, [evento]);

  const fecha =
    evento?.fecha_sorteo ||
    evento?.fecha ||
    evento?.fecha_rifa ||
    "";

  const hora =
    evento?.hora_sorteo ||
    evento?.hora ||
    evento?.hora_rifa ||
    "";

  const precio = Number(evento?.precio_ticket || 0);
  const descripcion = evento?.descripcion || "Sin descripción disponible.";

  return (
    <>
      <main className="evento-page">
        <PublicTopbar
          active="eventos"
          onOpenVerifier={() => setShowVerifyModal(true)}
          logoHref="/principal"
          inicioHref="/principal#inicio"
          eventosHref="/principal#eventos-disponibles"
          pagosHref="/principal#pagos"
          contactoHref="/principal#contacto"
        />

        {loading ? (
          <section className="evento-loading-wrap">
            <div className="evento-loading-grid">
              <div className="evento-loading-image" />
              <div className="evento-loading-side">
                <div className="evento-loading-card">
                  <div className="evento-loading-line large" />
                  <div className="evento-loading-line medium" />
                  <div className="evento-loading-line small" />
                </div>

                <div className="evento-loading-card">
                  <div className="evento-loading-line large" />
                  <div className="evento-loading-line medium" />
                  <div className="evento-loading-line small" />
                </div>

                <div className="evento-loading-card">
                  <div className="evento-loading-line large" />
                  <div className="evento-loading-line medium" />
                  <div className="evento-loading-line small" />
                </div>
              </div>
            </div>
          </section>
        ) : !evento ? (
          <div className="evento-empty-state premium">
            <img src="/logo.png" alt="Logo" className="evento-empty-logo" />
            <h2>Evento no encontrado</h2>
            <p>Este evento no existe, no está publicado o ya no está disponible.</p>

            <Link href="/principal" className="principal-red-btn">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <section className="evento-wrap">
            <div className="evento-title-row">
              <div className="evento-title-center">
                {evento.destacada && (
                  <div className="evento-destacada-badge">⭐ Evento destacado</div>
                )}

                <h2>{evento.nombre || "Evento"}</h2>
                <p>{descripcion}</p>
              </div>
            </div>

            <div className="evento-grid">
              <div className="evento-image-panel">
                <RaffleDualImage
                  principalSrc={evento.portada_url}
                  secondarySrc={evento.portada_scroll_url}
                  alt={evento.nombre || "Evento"}
                  className={`evento-image-dual-wrap ${estaFinalizado ? "finalizada" : ""}`}
                />

                <div className="evento-overlay" />

                {estaFinalizado && <div className="evento-ribbon">FINALIZADO</div>}

                <div className="evento-image-content">
                  <div className={`evento-status ${estaFinalizado ? "off" : "on"}`}>
                    {estaFinalizado ? "● Finalizada" : "● Disponible"}
                  </div>

                  <h1>{evento.nombre || "Evento"}</h1>
                </div>
              </div>

              <div className="evento-side">
                <div className="evento-card">
                  <p className="evento-kicker">DETALLE DEL EVENTO</p>
                  <h2>Información general</h2>
                  <p className="evento-description">{descripcion}</p>
                </div>

                <div className="evento-card">
                  <p className="evento-kicker">RESUMEN</p>
                  <h2>Datos principales</h2>

                  <div className="evento-mini-grid">
                    <div className="evento-mini-box">
                      <span>ESTADO</span>
                      <strong className={estaFinalizado ? "text-red" : "text-green"}>
                        {evento.estado || "Disponible"}
                      </strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>VALOR TICKET</span>
                      <strong className="text-red">${precio.toFixed(2)}</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>FECHA</span>
                      <strong>{fecha || "Por confirmar"}</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>HORA</span>
                      <strong>{hora || "Por confirmar"}</strong>
                    </div>
                  </div>
                </div>

                <div className="evento-card">
                  <p className="evento-kicker">PREMIACIÓN</p>
                  <h2>Premios del evento</h2>

                  {premios.length > 0 ? (
                    <div className="evento-premios">
                      {premios.map((premio, index) => (
                        <div key={index} className="evento-premio-item">
                          🎁 {premio}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="evento-premio-empty">
                      No hay premios definidos todavía.
                    </div>
                  )}
                </div>

                <div className="evento-card">
                  <p className="evento-kicker">ACCIONES</p>
                  <h2>Participar</h2>

                  <div className="evento-actions">
                    {!estaFinalizado ? (
                      <Link href={`/?rifa=${evento.id}#boletos`} className="principal-red-btn">
                        COMPRAR TICKETS
                      </Link>
                    ) : (
                      <button type="button" className="evento-disabled-btn" disabled>
                        EVENTO FINALIZADO
                      </button>
                    )}

                    <button
                      type="button"
                      className="principal-white-btn"
                      onClick={() => router.push("/principal#eventos-disponibles")}
                    >
                      VER MÁS EVENTOS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <VerifyTicketsModal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        email={verificarEmail}
        setEmail={setVerificarEmail}
        rifaId={evento?.id || null}
      />
    </>
  );
}