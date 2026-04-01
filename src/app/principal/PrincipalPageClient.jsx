"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import VerifyTicketsModal from "@/components/shared/VerifyTicketsModal";
import { paymentMethodsConfig } from "@/lib/paymentMethods";
import PublicTopbar from "@/components/shared/PublicTopbar";
import RaffleDualImage from "@/components/shared/RaffleDualImage";
import Link from "next/link";

export default function PrincipalPageClient() {
  const [rifas, setRifas] = useState([]);
  const [loadingRifas, setLoadingRifas] = useState(true);
  const [verificarEmail, setVerificarEmail] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [rifaActiva, setRifaActiva] = useState(null);

  const [paginaFinalizados, setPaginaFinalizados] = useState(1);
  const itemsPorPaginaFinalizados = 1;

  const swalConfig = {
    background: "#1f1f1f",
    color: "#fff",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
  };

  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash;
      if (!hash) return;

      const id = hash.replace("#", "");
      if (!id) return;

      const intentarScroll = (intentos = 0) => {
        const section = document.getElementById(id);

        if (!section) {
          if (intentos < 20) {
            setTimeout(() => intentarScroll(intentos + 1), 180);
          }
          return;
        }

        section.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        section.classList.remove("principal-highlight");

        setTimeout(() => {
          section.classList.add("principal-highlight");
          setTimeout(() => {
            section.classList.remove("principal-highlight");
          }, 1800);
        }, 120);
      };

      setTimeout(() => {
        intentarScroll();
      }, 180);
    };

    handleHashScroll();
    window.addEventListener("hashchange", handleHashScroll);

    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setShowVerifyModal(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const cargarRifas = async () => {
      try {
        setLoadingRifas(true);

        const res = await fetch("/api/rifas-publicas", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "No se pudieron cargar las rifas");
          setRifas([]);
          return;
        }

        setRifas(Array.isArray(data.rifas) ? data.rifas : []);
      } catch (error) {
        console.error("Error cargando rifas:", error);
        setRifas([]);
      } finally {
        setLoadingRifas(false);
      }
    };

    cargarRifas();
  }, []);

  useEffect(() => {
    const cargarRifaActiva = async () => {
      try {
        const res = await fetch("/api/rifa-activa", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          setRifaActiva(null);
          return;
        }

        setRifaActiva(data.rifa || null);
      } catch (error) {
        console.error("Error cargando rifa activa:", error);
        setRifaActiva(null);
      }
    };

    cargarRifaActiva();
  }, []);

  const rifasPublicadas = useMemo(() => {
    return rifas.filter((r) => Boolean(r.publicada));
  }, [rifas]);

  const ordenarRifas = (lista) => {
    return [...lista].sort((a, b) => {
      const destacadaA = Boolean(a.destacada);
      const destacadaB = Boolean(b.destacada);

      if (destacadaA !== destacadaB) {
        return destacadaB - destacadaA;
      }

      const fechaA = new Date(a.created_at || a.fecha_sorteo || 0).getTime();
      const fechaB = new Date(b.created_at || b.fecha_sorteo || 0).getTime();

      return fechaB - fechaA;
    });
  };

  const eventosDisponibles = useMemo(() => {
    const disponibles = rifasPublicadas.filter((r) =>
      ["activa", "disponible"].includes(String(r.estado || "").toLowerCase())
    );

    return ordenarRifas(disponibles);
  }, [rifasPublicadas]);

  const eventosFinalizados = useMemo(() => {
    const finalizados = rifasPublicadas.filter((r) =>
      ["finalizada", "finalizado", "cerrada"].includes(
        String(r.estado || "").toLowerCase()
      )
    );

    return ordenarRifas(finalizados);
  }, [rifasPublicadas]);

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

  const primerEventoDisponible = eventosDisponibles[0] || null;

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);

      await Swal.fire({
        ...swalConfig,
        icon: "success",
        title: "Copiado",
        text: "Dato copiado correctamente",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "No se pudo copiar",
        text: "Copia manualmente el dato",
      });
    }
  };

  return (
    <>
      <main className="principal-page" id="inicio">
        <PublicTopbar
          active="eventos"
          onOpenVerifier={() => setShowVerifyModal(true)}
          logoHref="/principal"
          inicioHref="/principal#inicio"
          eventosHref="/principal#eventos-disponibles"
          pagosHref="/principal#pagos"
          contactoHref="/principal#contacto"
        />

        <section className="principal-hero">
          <div className="principal-hero-inner">
            <div className="principal-hero-image-box">
              <img src="/logo.png" alt="Logo Rifas LSD" className="principal-hero-image" />
            </div>

            <div className="principal-hero-content">
              <p className="principal-location">ESTADOS UNIDOS</p>
              <h1>RIFAS LSD</h1>

              <div className="principal-bio">
                <p>Visión, crecimiento y constancia.</p>
                <p>Eventos creados con seriedad y compromiso.</p>
                <p>Una marca enfocada en avanzar cada día.</p>
                <p>Participación segura, clara y profesional.</p>
              </div>

              <p className="principal-message">
                Las metas grandes no se alcanzan por suerte. Se construyen con enfoque,
                disciplina, esfuerzo y la decisión firme de nunca RENDIRSE🛑.
              </p>

              <div className="principal-actions hero-actions">
                <Link
                  href={
                    primerEventoDisponible?.id
                      ? `/evento/${primerEventoDisponible.id}`
                      : "/"
                  }
                  className="principal-red-btn"
                >
                  ENTRAR AL EVENTO
                </Link>

                <button
                  type="button"
                  className="principal-white-btn"
                  onClick={() => setShowVerifyModal(true)}
                >
                  VERIFICADOR
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="principal-section" id="eventos-disponibles">
          <div className="principal-section-head">
            <p>¡Participa!</p>
            <h2>DISPONIBLES</h2>
          </div>

          {loadingRifas ? (
            <div className="principal-loading-state-grid">
              {[1, 2].map((item) => (
                <div key={item} className="principal-skeleton-card">
                  <div className="principal-skeleton-image" />
                  <div className="principal-skeleton-line large" />
                  <div className="principal-skeleton-line medium" />
                  <div className="principal-skeleton-btn" />
                </div>
              ))}
            </div>
          ) : eventosDisponibles.length === 0 ? (
            <div className="principal-empty-box premium">
              <div className="principal-empty-icon">🎯</div>
              <h3>No hay eventos disponibles</h3>
              <p>
                En este momento no hay rifas activas publicadas. Vuelve pronto para ver
                nuevos eventos.
              </p>
            </div>
          ) : (
            <div className="principal-events-list">
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
                  <article key={evento.id} className="principal-event-card-mobile">
{evento.destacada && (
  <div className="principal-card-badge-left">
    <div className="principal-destacada-badge">⭐ Destacada</div>
  </div>
)}

                    <RaffleDualImage
                      principalSrc={evento.portada_url}
                      secondarySrc={evento.portada_scroll_url}
                      alt={evento.nombre || "Evento disponible"}
                      className="principal-event-image-mobile-wrap"
                    />

                    <div className="principal-event-content-mobile">
                      <h3>{evento.nombre || "Evento disponible"}</h3>

                      {fecha ? (
                        <p className="principal-event-meta-mobile">
                          📅 {fecha}
                        </p>
                      ) : null}

                      {hora ? (
                        <p className="principal-event-meta-mobile">
                          ⏰ {hora}
                        </p>
                      ) : null}

                      {evento.precio_ticket ? (
                        <p className="principal-event-meta-mobile">
                          💰 ${Number(evento.precio_ticket).toFixed(2)}
                        </p>
                      ) : null}

                      <div className="principal-event-actions-mobile">
                        <Link
                          href={`/evento/${evento.id}`}
                          className="principal-red-btn small-btn"
                        >
                          VER EVENTO
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="principal-section" id="eventos-finalizados">
          <div className="principal-section-head">
            <h2>FINALIZADOS</h2>
          </div>

          {loadingRifas ? (
            <div className="principal-loading-state-grid">
              {[1, 2].map((item) => (
                <div key={item} className="principal-skeleton-card">
                  <div className="principal-skeleton-image" />
                  <div className="principal-skeleton-line large" />
                  <div className="principal-skeleton-line medium" />
                  <div className="principal-skeleton-btn" />
                </div>
              ))}
            </div>
          ) : eventosFinalizados.length === 0 ? (
            <div className="principal-empty-box premium">
              <div className="principal-empty-icon">🏁</div>
              <h3>No hay eventos finalizados</h3>
              <p>
                Todavía no hay rifas finalizadas publicadas para mostrar en esta sección.
              </p>
            </div>
          ) : (
            <>
              <div className="principal-events-list">
                {eventosFinalizadosPaginados.map((evento) => (
                  <article key={evento.id} className="principal-event-card-mobile principal-finalizada-card">
                    <div className="principal-card-badges-row">
                      {evento.destacada ? (
                        <div className="principal-destacada-badge">⭐ Destacada</div>
                      ) : (
                        <div className="principal-badge-placeholder" />
                      )}

                      <div className="principal-finalizado-badge">Finalizado</div>
                    </div>

                    <RaffleDualImage
                      principalSrc={evento.portada_url}
                      secondarySrc={evento.portada_scroll_url}
                      alt={evento.nombre || "Evento finalizado"}
                      className="principal-event-image-mobile-wrap finalizada"
                    />

                    <div className="principal-event-content-mobile">
                      <h3>{evento.nombre || "Evento finalizado"}</h3>

                      {evento.fecha_sorteo ? (
                        <p className="principal-event-meta-mobile">
                          📅 {evento.fecha_sorteo}
                        </p>
                      ) : null}

                      {evento.precio_ticket ? (
                        <p className="principal-event-meta-mobile">
                          💰 ${Number(evento.precio_ticket).toFixed(2)}
                        </p>
                      ) : null}

                      <div className="principal-event-actions-mobile">
                        <Link
                          href={`/evento/${evento.id}`}
                          className="principal-white-btn small-btn"
                        >
                          VER EVENTO
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="principal-pagination-wrap principal-pagination-premium">
                <button
                  type="button"
                  className="principal-pagination-btn premium"
                  onClick={() => setPaginaFinalizados((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaFinalizados === 1}
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
                >
                  Siguiente →
                </button>
              </div>
            </>
          )}
        </section>

        <section className="principal-section" id="pagos">
          <div className="principal-section-head">
            <h2>CUENTAS DE PAGO</h2>
          </div>

          <div className="principal-payments-vertical">
            {Object.entries(paymentMethodsConfig).map(([methodName, method]) => (
              <div key={methodName} className="principal-payment-block">
                <img
                  src={method.logo}
                  alt={method.titulo}
                  className="principal-payment-icon"
                />

                <h3>{method.titulo}</h3>
                <p>{method.subtitulo}</p>

                <div className="copy-line">
                  <strong>{method.cuenta}</strong>
                  <button onClick={() => copiarTexto(method.cuenta)} type="button">
                    📋
                  </button>
                </div>

                {Array.isArray(method.extra) &&
                  method.extra.map((item) => (
                    <div key={`${methodName}-${item.label}-${item.value}`}>
                      <p>{item.label}</p>
                      <div className="copy-line">
                        <strong>{item.value}</strong>
                        <button onClick={() => copiarTexto(item.value)} type="button">
                          📋
                        </button>
                      </div>
                    </div>
                  ))}

                <div className="copy-line">
                  <span>
                    <strong>Titular:</strong> {method.nombre}
                  </span>
                  <button onClick={() => copiarTexto(method.nombre)} type="button">
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="principal-section" id="contacto">
          <div className="principal-section-head">
            <h2>CONTACTO</h2>
          </div>

          <div className="principal-contact-box">
            <a
              href="https://wa.me/17738277463?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa"
              target="_blank"
              rel="noreferrer"
              className="principal-red-btn contact-btn"
            >
              💬 WHATSAPP
            </a>

            <a
              href="https://www.instagram.com/samir__rivas/"
              target="_blank"
              rel="noreferrer"
              className="principal-white-btn contact-btn"
            >
              📸 INSTAGRAM
            </a>
          </div>
        </section>

        <footer className="principal-footer">
          <div className="principal-footer-grid">
            <div className="principal-footer-col">
              <h3>RIFAS LSD</h3>
              <img src="/logo.png" alt="Logo" className="principal-footer-logo" />
            </div>

            <div className="principal-footer-col">
              <h3>NOSOTROS</h3>
              <p>Marca enfocada en crecimiento y constancia</p>
              <p>Eventos con visión y compromiso</p>
              <p>Trabajo serio y profesional</p>
              <p>Participación segura para todos</p>
            </div>

            <div className="principal-footer-col">
              <h3>UBICACIÓN</h3>
              <p>Estados Unidos</p>
              <p>Atención digital y soporte</p>
              <p>Disponibilidad para consultas</p>
            </div>

            <div className="principal-footer-col">
              <h3>ACCESOS</h3>

              <div className="principal-footer-links">
                <a href="#inicio" className="principal-footer-link">
                  Inicio
                </a>
                <a href="#eventos-disponibles" className="principal-footer-link">
                  Eventos
                </a>
                <a href="#pagos" className="principal-footer-link">
                  Pagos
                </a>
                <a href="#contacto" className="principal-footer-link">
                  Contacto
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <VerifyTicketsModal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        email={verificarEmail}
        setEmail={setVerificarEmail}
        rifaId={rifaActiva?.id || null}
      />
    </>
  );
}