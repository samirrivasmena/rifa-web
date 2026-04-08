"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VerifyTicketsModal from "@/components/shared/VerifyTicketsModal";
import PublicTopbar from "@/components/shared/PublicTopbar";
import RaffleDualImage from "@/components/shared/RaffleDualImage";
import FloatingShareButton from "@/components/shared/ShareButtons/FloatingShareButton";

export default function EventoDetallePageClient() {
  const params = useParams();
  const router = useRouter();

  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificarEmail, setVerificarEmail] = useState("");

  // NUEVO: URL para compartir
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
  if (!evento?.id) return setShareUrl("");

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  setShareUrl(origin ? `${origin}/evento/${evento.id}` : "");
}, [evento?.id]);

  const esPublicada = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

  const esEstadoFinalizado = (estado) =>
    ["finalizada", "finalizado", "cerrada"].includes(
      String(estado || "").toLowerCase()
    );

  const esEstadoAgotado = (estado) =>
    ["agotada", "agotado"].includes(String(estado || "").toLowerCase());

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
    } else {
      setEvento(null);
      setLoading(false);
    }
  }, [params?.id]);

  // NUEVO: construir link final para compartir (no afecta nada del resto)
  useEffect(() => {
    if (!evento?.id) {
      setShareUrl("");
      return;
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    if (!origin) {
      setShareUrl("");
      return;
    }

    setShareUrl(`${origin}/evento/${evento.id}`);
  }, [evento?.id]);

  const estaFinalizado = useMemo(() => {
    return esEstadoFinalizado(evento?.estado);
  }, [evento]);

  const estaAgotado = useMemo(() => {
    return esEstadoAgotado(evento?.estado);
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

  const precioRaw = Number(evento?.precio_ticket);
  const precio = Number.isFinite(precioRaw) ? precioRaw : 0;

  const descripcion = evento?.descripcion || "Sin descripción disponible.";

  const totalNumerosRaw = Number(
    evento?.cantidad_numeros ?? evento?.total_tickets ?? evento?.numeros_totales ?? 0
  );
  const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;

  const ticketsVendidosRaw = Number(
    evento?.tickets_vendidos ?? evento?.vendidos ?? evento?.ticketsVendidos ?? 0
  );
  const ticketsVendidos = Number.isFinite(ticketsVendidosRaw) ? ticketsVendidosRaw : 0;

  const porcentajeVendidoRaw = Number(
    evento?.porcentaje_vendido ??
      (totalNumeros > 0 ? (ticketsVendidos / totalNumeros) * 100 : 0)
  );
  const porcentajeVendido = Number.isFinite(porcentajeVendidoRaw)
    ? Math.min(porcentajeVendidoRaw, 100)
    : 0;

  return (
    <>
      <main className="evento-page">
        <PublicTopbar
          active="eventos"
          onOpenVerifier={() => setShowVerifyModal(true)}
          logoHref="/principal"
          inicioHref="/principal#inicio"
          eventosHref="/principal#eventos-disponibles"
          resultadosHref="/principal#resultados-oficiales"
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
          <section className="evento-wrap reveal-fade-up">
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
                  className={`evento-image-dual-wrap ${
                    estaFinalizado || estaAgotado ? "finalizada" : ""
                  }`}
                />

                <div className="evento-overlay" />

                {estaFinalizado && <div className="evento-ribbon">FINALIZADO</div>}
                {!estaFinalizado && estaAgotado && <div className="evento-ribbon">AGOTADO</div>}

                <div className="evento-image-content">
                  <div
                    className={`evento-status ${
                      estaFinalizado || estaAgotado ? "off" : "on"
                    }`}
                  >
                    {estaFinalizado
                      ? "● Finalizada"
                      : estaAgotado
                      ? "● Agotada"
                      : "● Disponible"}
                  </div>

                  <h1>{evento.nombre || "Evento"}</h1>
                </div>
              </div>

              <div className="evento-side">
                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">DETALLE DEL EVENTO</p>
                  <h2>Información general</h2>
                  <p className="evento-description">{descripcion}</p>
                </div>

                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">RESUMEN</p>
                  <h2>Datos principales</h2>

                  <div className="evento-mini-grid">
                    <div className="evento-mini-box">
                      <span>ESTADO</span>
                      <strong
                        className={
                          estaFinalizado || estaAgotado ? "text-red" : "text-green"
                        }
                      >
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

                    <div className="evento-mini-box">
                      <span>PROGRESO</span>
                      <strong>{porcentajeVendido.toFixed(1)}%</strong>
                    </div>

                    <div className="evento-mini-box">
                      <span>VENDIDOS</span>
                      <strong>
                        {ticketsVendidos}
                        {totalNumeros > 0 ? ` / ${totalNumeros}` : ""}
                      </strong>
                    </div>
                  </div>
                </div>

                {estaAgotado && !estaFinalizado && (
                  <div className="evento-card premium-card-hover">
                    <p className="evento-kicker">ESTADO DEL EVENTO</p>
                    <h2>Rifa completa</h2>
                    <p className="evento-description">
                      Todos los boletos fueron vendidos. Este evento está agotado y pendiente
                      del sorteo oficial.
                    </p>
                  </div>
                )}

                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">PREMIACIÓN</p>
                  <h2>Premios del evento</h2>

                  {premios.length > 0 ? (
                    <div className="evento-premios">
                      {premios.map((premio, index) => (
                        <div key={`${premio}-${index}`} className="evento-premio-item">
                          🎁 {premio}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="evento-premio-empty">No hay premios definidos todavía.</div>
                  )}
                </div>

                <div className="evento-card premium-card-hover">
                  <p className="evento-kicker">ACCIONES</p>
                  <h2>Participar</h2>

                  <div className="evento-actions">
                    {!estaFinalizado && !estaAgotado ? (
                      <Link href={`/?rifa=${evento.id}#boletos`} className="principal-red-btn">
                        COMPRAR TICKETS
                      </Link>
                    ) : estaAgotado ? (
                      <button type="button" className="evento-disabled-btn" disabled>
                        BOLETOS AGOTADOS
                      </button>
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

        {/* NUEVO: Botón flotante de compartir (solo si hay evento cargado) */}
        {evento?.id && (
          <FloatingShareButton
            url={shareUrl}
            title={evento?.nombre || "Evento"}
            text={`Participa en este evento: ${evento?.nombre || "Evento"}\n🎟️ Compra aquí:`}
          />
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