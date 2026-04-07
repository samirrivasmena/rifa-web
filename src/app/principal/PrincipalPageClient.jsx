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

  const esPublicada = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

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

        const isMobile = window.innerWidth <= 768;

        let offset = 110;

        if (id === "resultados-oficiales") {
          offset = isMobile ? 84 : 118;
        } else if (id === "eventos-disponibles") {
          offset = isMobile ? 84 : 108;
        } else if (id === "pagos") {
          offset = isMobile ? 84 : 108;
        } else if (id === "contacto") {
          offset = isMobile ? 84 : 108;
        } else if (id === "inicio") {
          offset = isMobile ? 76 : 96;
        } else {
          offset = isMobile ? 80 : 105;
        }

        const top = section.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({
          top,
          behavior: "smooth",
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
      }, 220);
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

        const raw = await res.text();
        let data;

        try {
          data = JSON.parse(raw);
        } catch {
          console.error("Respuesta inválida en /api/rifas-publicas");
          setRifas([]);
          return;
        }

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

        const raw = await res.text();
        let data;

        try {
          data = JSON.parse(raw);
        } catch {
          console.error("Respuesta inválida en /api/rifa-activa");
          setRifaActiva(null);
          return;
        }

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
    return rifas.filter((r) => esPublicada(r.publicada));
  }, [rifas]);

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
    const disponibles = rifasPublicadas.filter((r) => esEventoDisponible(r.estado));
    return ordenarRifas(disponibles);
  }, [rifasPublicadas]);

  const eventosAgotados = useMemo(() => {
    const agotados = rifasPublicadas.filter((r) => esEventoAgotado(r.estado));
    return ordenarRifas(agotados);
  }, [rifasPublicadas]);

  const eventosFinalizados = useMemo(() => {
    const finalizados = rifasPublicadas.filter((r) => esEventoFinalizado(r.estado));
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

  const primerEventoDisponible = eventosDisponibles[0] || eventosAgotados[0] || null;

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
          resultadosHref="/principal#resultados-oficiales"
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
                      : "/principal#eventos-disponibles"
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

                const porcentaje = obtenerPorcentajeSeguro(evento);

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
                        <p className="principal-event-meta-mobile">📅 {fecha}</p>
                      ) : null}

                      {hora ? (
                        <p className="principal-event-meta-mobile">⏰ {hora}</p>
                      ) : null}

                      {evento.precio_ticket !== null && evento.precio_ticket !== undefined ? (
                        <p className="principal-event-meta-mobile">
                          💰 ${formatearPrecioSeguro(evento.precio_ticket)}
                        </p>
                      ) : null}

                      <p className="principal-event-meta-mobile">
                        📊 {porcentaje.toFixed(1)}% vendido
                      </p>

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

        {eventosAgotados.length > 0 && (
          <section className="principal-section" id="eventos-agotados">
            <div className="principal-section-head">
              <h2>AGOTADOS</h2>
            </div>

            <div className="principal-events-list">
              {eventosAgotados.map((evento) => {
                const porcentaje = obtenerPorcentajeSeguro(evento);

                return (
                  <article
                    key={evento.id}
                    className="principal-event-card-mobile principal-finalizada-card"
                  >
                    <div className="principal-card-badges-row">
                      {evento.destacada ? (
                        <div className="principal-destacada-badge">⭐ Destacada</div>
                      ) : (
                        <div className="principal-badge-placeholder" />
                      )}

                      <div className="principal-agotado-badge">Agotada</div>
                    </div>

                    <RaffleDualImage
                      principalSrc={evento.portada_url}
                      secondarySrc={evento.portada_scroll_url}
                      alt={evento.nombre || "Evento agotado"}
                      className="principal-event-image-mobile-wrap finalizada"
                    />

                    <div className="principal-event-content-mobile">
                      <h3>{evento.nombre || "Evento agotado"}</h3>

                      <p className="principal-event-meta-mobile">
                        📊 {porcentaje.toFixed(1)}% vendido
                      </p>

                      <p className="principal-event-meta-mobile">
                        ⏳ Pendiente de sorteo
                      </p>

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
                );
              })}
            </div>
          </section>
        )}

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
                  <article
                    key={evento.id}
                    className="principal-event-card-mobile principal-finalizada-card"
                  >
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

                      {evento.precio_ticket !== null && evento.precio_ticket !== undefined ? (
                        <p className="principal-event-meta-mobile">
                          💰 ${formatearPrecioSeguro(evento.precio_ticket)}
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
        </section>

        <section className="principal-section" id="pagos">
          <div className="principal-section-head">
            <h2>CUENTAS DE PAGO</h2>
          </div>

          <div className="principal-payments-vertical">
            {Object.entries(paymentMethodsConfig).map(([methodName, method]) => {
              const mostrarCuenta = Boolean(method?.cuenta);
              const mostrarTitular = Boolean(method?.nombre);
              const extras = Array.isArray(method?.extra) ? method.extra : [];

              return (
                <div key={methodName} className="principal-payment-block">
                  {method.logo && (
                    <img
                      src={method.logo}
                      alt={method.titulo || methodName}
                      className="principal-payment-icon"
                    />
                  )}

                  <h3>{method.titulo || methodName}</h3>
                  {method.subtitulo ? <p>{method.subtitulo}</p> : null}

                  {mostrarCuenta && (
                    <div className="copy-line">
                      <strong>{method.cuenta}</strong>
                      <button
                        onClick={() => copiarTexto(method.cuenta)}
                        type="button"
                        aria-label={`Copiar cuenta de ${methodName}`}
                      >
                        📋
                      </button>
                    </div>
                  )}

                  {extras.map((item) => (
                    <div key={`${methodName}-${item.label}-${item.value}`}>
                      <p>{item.label}</p>
                      <div className="copy-line">
                        <strong>{item.value}</strong>
                        <button
                          onClick={() => copiarTexto(item.value)}
                          type="button"
                          aria-label={`Copiar ${item.label} de ${methodName}`}
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  ))}

                  {mostrarTitular && (
                    <div className="copy-line">
                      <span>
                        <strong>Titular:</strong> {method.nombre}
                      </span>
                      <button
                        onClick={() => copiarTexto(method.nombre)}
                        type="button"
                        aria-label={`Copiar titular de ${methodName}`}
                      >
                        📋
                      </button>
                    </div>
                  )}

                  {method.descripcion ? <p>{method.descripcion}</p> : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="principal-section" id="resultados-oficiales">
          <div className="principal-section-head">
            <h2>RESULTADOS OFICIALES</h2>
          </div>

          <div className="principal-results-box">
            <div className="principal-results-copy">
              <p className="principal-results-kicker">TRANSPARENCIA Y CONFIANZA</p>

              <h3>Consulta aquí los resultados oficiales</h3>

              <p>
                El resultado ganador de nuestras rifas se tomará con base en los resultados
                oficiales publicados por las loterías autorizadas. Puedes consultar los
                números directamente en la plataforma oficial.
              </p>

              <a
                href="https://supergana.com.ve/resultados.php"
                target="_blank"
                rel="noreferrer"
                className="principal-red-btn"
              >
                VER RESULTADOS OFICIALES
              </a>
            </div>

            <div className="principal-results-logos">
              <div className="principal-results-logo-card">
                <img
                  src="/resultados/triple-tachira.png"
                  alt="Triple Táchira"
                  className="principal-results-logo"
                />
              </div>

              <div className="principal-results-logo-card">
                <img
                  src="/resultados/super-gana.png"
                  alt="Super Gana"
                  className="principal-results-logo"
                />
              </div>
            </div>
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
                <a href="/principal#inicio" className="principal-footer-link">
                  Inicio
                </a>
                <a href="/principal#eventos-disponibles" className="principal-footer-link">
                  Eventos
                </a>
                <a href="/principal#pagos" className="principal-footer-link">
                  Pagos
                </a>
                <a href="/principal#contacto" className="principal-footer-link">
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