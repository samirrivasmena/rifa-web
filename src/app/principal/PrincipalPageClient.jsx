"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Swal from "sweetalert2";
import Link from "next/link";

import VerifyTicketsModal from "@/components/shared/VerifyTicketsModal";
import PublicTopbar from "@/components/shared/PublicTopbar";
import RaffleDualImage from "@/components/shared/RaffleDualImage";
import ProgressVentaBar from "@/components/shared/ProgressVentaBar";
import SiteLogo from "@/components/shared/SiteLogo";
import { enriquecerListaRifasConResumen } from "@/lib/rifas/enriquecerRifaConResumen";

import { paymentMethodsConfig } from "@/lib/paymentMethods";
import { getRifaProgress } from "@/lib/getRifaProgress";

import HistorialGanadores from "@/components/shared/HistorialGanadores";
import FloatingPurchaseNotifications from "@/components/shared/FloatingPurchaseNotifications";
import PublicFooter from "@/components/shared/PublicFooter";

import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function PrincipalPageClient() {
  const { config, loadingConfig } = useSiteConfig();

  const logoUrl = config?.logo_url || "/logo.png";
  const nombreMarca = config?.nombre_marca || "RIFAS LSD";
  const whatsappNumber = config?.whatsapp || "17738277463";
  const instagramUrl = config?.instagram || "";

  const descripcionHome = config?.descripcion_principal?.trim() ?? "";
  const descripcionFinal = config?.descripcion?.trim() ?? "";

  const slogan1 = config?.slogan_frase_1 || "Visión, crecimiento y constancia.";
  const slogan2 =
    config?.slogan_frase_2 || "Eventos creados con seriedad y compromiso.";
  const slogan3 =
    config?.slogan_frase_3 || "Una marca enfocada en avanzar cada día.";
  const slogan4 =
    config?.slogan_frase_4 || "Participación segura, clara y profesional.";

  const homeBotonComprar = config?.home_boton_comprar || "COMPRAR AHORA";
  const homeBotonVerificar = config?.home_boton_verificar || "VERIFICAR TICKETS";

  const tituloEventos =
    config?.principal_titulo_eventos || "EVENTOS DISPONIBLES";
  const textoEventos =
    config?.principal_texto_eventos || "Participa en nuestras rifas activas.";

  const tituloResultados =
    config?.principal_titulo_resultados || "RESULTADOS OFICIALES";
  const tituloGanadores =
    config?.principal_titulo_ganadores || "HISTORIAL DE GANADORES";

  const textoContacto =
    config?.principal_texto_contacto || "Conéctate con nosotros.";
  const footerTexto = config?.footer_texto || "Todos los derechos reservados.";

  const metodosPagoAdmin = Array.isArray(config?.metodos_pago)
    ? config.metodos_pago
    : [];

  const esActivo = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

  const metodosPagoPublicos = metodosPagoAdmin
    .filter((metodo) => esActivo(metodo?.activo))
    .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0))
    .map((metodo) => {
      const visual = paymentMethodsConfig[metodo?.nombre] || {};

      return {
        ...visual,
        ...metodo,
        titulo: metodo?.nombre || visual?.titulo || "Método de pago",
        logo: metodo?.logo || visual?.logo || "",
      };
    });

  const [rifas, setRifas] = useState([]);
  const [loadingRifas, setLoadingRifas] = useState(true);
  const [errorRed, setErrorRed] = useState(false);

  const [verificarEmail, setVerificarEmail] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [rifaActiva, setRifaActiva] = useState(null);

  const [paginaFinalizados, setPaginaFinalizados] = useState(1);
  const [isMobileFinalizados, setIsMobileFinalizados] = useState(false);
  const [activeFinalizadoIndex, setActiveFinalizadoIndex] = useState(0);
  const scrollFinalizadosRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileFinalizados(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const itemsPorPaginaFinalizados = isMobileFinalizados ? 1 : 3;

  const swalConfig = {
    background: "#1f1f1f",
    color: "#fff",
    confirmButtonColor: config?.color_boton || "#dc2626",
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

  useEffect(() => {
    if (!config) return;

    const root = document.documentElement;

    const variables = {
      "--site-primary": config.color_primario || "#dc2626",
      "--site-secondary": config.color_secundario || "#111827",
      "--site-background": config.color_fondo || "#ffffff",
      "--site-text": config.color_texto || "#111827",
      "--site-button": config.color_boton || "#dc2626",
      "--site-card": config.color_tarjeta || "#ffffff",
      "--site-border": config.color_borde || "#e5e7eb",
      "--site-alert": config.color_alerta || "#f97316",
      "--site-success": config.color_exito || "#16a34a",
      "--site-error": config.color_error || "#dc2626",
      "--site-hover": config.color_hover || "#b91c1c",
      "--site-progress":
        config.color_progreso ||
        config.color_boton ||
        config.color_primario ||
        "#dc2626",
      "--site-progress-bg": config.color_progreso_fondo || "#e5e7eb",
    };

    Object.entries(variables).forEach(([nombre, valor]) => {
      root.style.setProperty(nombre, valor);
    });

    const saturacion = Number(config.saturacion_global) || 100;
    const brillo = Number(config.brillo_global) || 100;
    const contraste = Number(config.contraste_global) || 100;
    const tono = Number(config.tono_global) || 0;
    const luminosidad = Number(config.luminosidad_global) || 100;

    root.style.setProperty("--site-saturation", `${saturacion}%`);
    root.style.setProperty("--site-brightness", `${brillo}%`);
    root.style.setProperty("--site-contrast", `${contraste}%`);
    root.style.setProperty("--site-hue", `${tono}deg`);
    root.style.setProperty("--site-luminosity", `${luminosidad}%`);

    document.body.style.backgroundColor = config.color_fondo || "#ffffff";
    document.body.style.color = config.color_texto || "#111827";
  }, [config]);

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

      setTimeout(() => intentarScroll(), 220);
    };

    handleHashScroll();

    window.addEventListener("hashchange", handleHashScroll);

    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowVerifyModal(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const cargarRifas = async () => {
      try {
        setLoadingRifas(true);
        setErrorRed(false);

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
          setErrorRed(true);
          return;
        }

        if (!res.ok) {
          console.error(data?.error || "No se pudieron cargar las rifas");
          setRifas([]);
          setErrorRed(true);
          return;
        }

        const lista = Array.isArray(data?.rifas) ? data.rifas : [];
        const listaEnriquecida = await enriquecerListaRifasConResumen(lista);

        setRifas(listaEnriquecida);

        const activa = listaEnriquecida.find(
          (r) => String(r?.estado || "").toLowerCase() === "activa"
        );

        setRifaActiva(activa || null);
      } catch (error) {
        console.error("Error cargando rifas:", error);
        setRifas([]);
        setErrorRed(true);
      } finally {
        setLoadingRifas(false);
      }
    };

    cargarRifas();
  }, []);

  const rifasPublicadas = useMemo(() => {
    return rifas.filter((r) => esPublicada(r?.publicada));
  }, [rifas]);

  const ordenarRifas = (lista) => {
    return [...lista].sort((a, b) => {
      const destacadaA = Boolean(a?.destacada);
      const destacadaB = Boolean(b?.destacada);

      if (destacadaA !== destacadaB) {
        return Number(destacadaB) - Number(destacadaA);
      }

      const fechaA = new Date(a?.created_at || a?.fecha_sorteo || 0).getTime();
      const fechaB = new Date(b?.created_at || b?.fecha_sorteo || 0).getTime();

      return fechaB - fechaA;
    });
  };

  const eventosDisponibles = useMemo(() => {
    return ordenarRifas(
      rifasPublicadas.filter((r) => esEventoDisponible(r?.estado))
    );
  }, [rifasPublicadas]);

  const eventosAgotados = useMemo(() => {
    return ordenarRifas(rifasPublicadas.filter((r) => esEventoAgotado(r?.estado)));
  }, [rifasPublicadas]);

  const eventosFinalizados = useMemo(() => {
    return ordenarRifas(
      rifasPublicadas.filter((r) => esEventoFinalizado(r?.estado))
    );
  }, [rifasPublicadas]);

  const totalPaginasFinalizados = useMemo(() => {
    return Math.max(
      Math.ceil(eventosFinalizados.length / itemsPorPaginaFinalizados),
      1
    );
  }, [eventosFinalizados.length, itemsPorPaginaFinalizados]);

  const eventosFinalizadosPaginados = useMemo(() => {
    const inicio = (paginaFinalizados - 1) * itemsPorPaginaFinalizados;
    const fin = inicio + itemsPorPaginaFinalizados;

    return eventosFinalizados.slice(inicio, fin);
  }, [eventosFinalizados, paginaFinalizados, itemsPorPaginaFinalizados]);

  const finalizadosParaVista = isMobileFinalizados
    ? eventosFinalizados
    : eventosFinalizadosPaginados;

  useEffect(() => {
    setPaginaFinalizados(1);
    setActiveFinalizadoIndex(0);

    if (scrollFinalizadosRef.current) {
      scrollFinalizadosRef.current.scrollTo({
        left: 0,
        behavior: "auto",
      });
    }
  }, [eventosFinalizados.length, isMobileFinalizados]);

  const handleScrollFinalizados = () => {
    if (!isMobileFinalizados || !scrollFinalizadosRef.current) return;

    const cards = scrollFinalizadosRef.current.querySelectorAll(
      ".principal-finalizada-card"
    );

    const center =
      scrollFinalizadosRef.current.scrollLeft +
      scrollFinalizadosRef.current.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(center - cardCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveFinalizadoIndex(closestIndex);
  };

  const irAFinalizado = (index) => {
    if (!isMobileFinalizados || !scrollFinalizadosRef.current) return;

    const cards = scrollFinalizadosRef.current.querySelectorAll(
      ".principal-finalizada-card"
    );

    const card = cards[index];
    if (!card) return;

    scrollFinalizadosRef.current.scrollTo({
      left: card.offsetLeft - 16,
      behavior: "smooth",
    });

    setActiveFinalizadoIndex(index);
  };

  const primerEventoDisponible =
    eventosDisponibles[0] || eventosAgotados[0] || null;

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(String(texto || ""));

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

  if (loadingConfig && !config) {
    return (
      <main className="principal-page">
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
          }}
        >
          Cargando sitio...
        </div>
      </main>
    );
  }

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

        <div className="principal-shell">
          {/* HERO */}
          <section className="principal-hero reveal-fade-up">
            <div className="principal-hero-inner">
              <div className="principal-hero-image-box">
                <SiteLogo
                  src={logoUrl}
                  alt={`Logo ${nombreMarca}`}
                  fallbackText={nombreMarca}
                  size="hero"
                  className="principal-hero-logo"
                />
              </div>

              <div className="principal-hero-content">
                {descripcionHome && (
                  <p className="principal-location">{descripcionHome}</p>
                )}

                <h1>{nombreMarca}</h1>

                <div className="principal-bio">
                  <p>{slogan1}</p>
                  <p>{slogan2}</p>
                  <p>{slogan3}</p>
                  <p>{slogan4}</p>
                </div>

                {descripcionFinal && (
                  <p className="principal-message">{descripcionFinal}</p>
                )}

                <div className="principal-actions hero-actions">
                  <Link href="/" className="principal-red-btn">
                    {homeBotonComprar}
                  </Link>

                  <Link
                    href={
                      primerEventoDisponible?.id
                        ? `/evento/${primerEventoDisponible.id}`
                        : "/principal#eventos-disponibles"
                    }
                    className="principal-white-btn"
                  >
                    ENTRAR AL EVENTO
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* EVENTOS */}
          <section
            className="principal-section reveal-fade-up reveal-delay-1"
            id="eventos-disponibles"
          >
            <div className="principal-section-head">
              <p>{textoEventos}</p>
              <h2>{tituloEventos}</h2>
            </div>

            {errorRed ? (
              <div className="principal-empty-box premium">
                <div className="principal-empty-icon">⚠️</div>

                <h3>Error al cargar eventos</h3>

                <p>
                  No se pudieron cargar los eventos en este momento. Verifica tu
                  conexión e intenta recargar la página.
                </p>

                <button
                  type="button"
                  className="principal-red-btn"
                  onClick={() => window.location.reload()}
                >
                  Recargar página
                </button>
              </div>
            ) : loadingRifas ? (
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
                  En este momento no hay rifas activas publicadas. Vuelve pronto
                  para ver nuevos eventos.
                </p>
              </div>
            ) : (
              <div className="principal-events-list">
                {eventosDisponibles.map((evento) => {
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

                  const progreso = getRifaProgress(evento);

                  return (
                    <article
                      key={evento.id}
                      className="principal-event-card-mobile premium-card-hover reveal-fade-up"
                    >
                      {evento?.destacada && (
                        <div className="principal-card-badge-left">
                          <div className="principal-destacada-badge">
                            ⭐ Destacada
                          </div>
                        </div>
                      )}

                      <RaffleDualImage
                        principalSrc={evento?.portada_url}
                        secondarySrc={evento?.portada_scroll_url}
                        alt={evento?.nombre || "Evento disponible"}
                        className="principal-event-image-mobile-wrap"
                      />

                      <div className="principal-event-content-mobile">
                        <h3>{evento?.nombre || "Evento disponible"}</h3>

                        {fecha && (
                          <p className="principal-event-meta-mobile">
                            📅 {fecha}
                          </p>
                        )}

                        {hora && (
                          <p className="principal-event-meta-mobile">⏰ {hora}</p>
                        )}

                        {evento?.precio_ticket !== null &&
                          evento?.precio_ticket !== undefined && (
                            <p className="principal-event-meta-mobile">
                              💰 ${formatearPrecioSeguro(evento.precio_ticket)}
                            </p>
                          )}

                        <div className="principal-progress-wrap">
                          <ProgressVentaBar
                            value={progreso.porcentaje}
                            soldOut={progreso.soldOut}
                          />
                        </div>

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

          {/* AGOTADOS */}
          {eventosAgotados.length > 0 && (
            <section
              className="principal-section reveal-fade-up reveal-delay-2"
              id="eventos-agotados"
            >
              <div className="principal-section-head">
                <h2>AGOTADOS</h2>
              </div>

              <div className="principal-events-list">
                {eventosAgotados.map((evento) => {
                  const progreso = getRifaProgress(evento);

                  return (
                    <article
                      key={evento.id}
                      className="principal-event-card-mobile principal-finalizada-card premium-card-hover reveal-fade-up"
                    >
                      <div className="principal-card-badges-row">
                        {evento?.destacada ? (
                          <div className="principal-destacada-badge">
                            ⭐ Destacada
                          </div>
                        ) : (
                          <div className="principal-badge-placeholder" />
                        )}

                        <div className="principal-agotado-badge">Agotada</div>
                      </div>

                      <RaffleDualImage
                        principalSrc={evento?.portada_url}
                        secondarySrc={evento?.portada_scroll_url}
                        alt={evento?.nombre || "Evento agotado"}
                        className="principal-event-image-mobile-wrap finalizada"
                      />

                      <div className="principal-event-content-mobile">
                        <h3>{evento?.nombre || "Evento agotado"}</h3>

                        <div className="principal-progress-wrap">
                          <ProgressVentaBar
                            value={progreso.porcentaje}
                            soldOut={progreso.soldOut}
                          />
                        </div>

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

          {/* FINALIZADOS */}
          <section
            className="principal-section reveal-fade-up reveal-delay-3"
            id="eventos-finalizados"
          >
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

                <p>Todavía no hay rifas finalizadas publicadas para mostrar.</p>
              </div>
            ) : (
              <>
                <div
                  ref={scrollFinalizadosRef}
                  onScroll={isMobileFinalizados ? handleScrollFinalizados : undefined}
                  className="principal-events-grid-finalizados"
                >
                  {finalizadosParaVista.map((evento) => {
                    const progreso = getRifaProgress(evento);

                    return (
                      <article
                        key={evento.id}
                        className="principal-event-card-mobile principal-finalizada-card premium-card-hover reveal-fade-up"
                      >
                        <div className="principal-card-badges-row">
                          {evento?.destacada ? (
                            <div className="principal-destacada-badge">
                              ⭐ Destacada
                            </div>
                          ) : (
                            <div className="principal-badge-placeholder" />
                          )}

                          <div className="principal-finalizado-badge">
                            Finalizado
                          </div>
                        </div>

                        <RaffleDualImage
                          principalSrc={evento?.portada_url}
                          secondarySrc={evento?.portada_scroll_url}
                          alt={evento?.nombre || "Evento finalizado"}
                          className="principal-event-image-mobile-wrap finalizada"
                        />

                        <div className="principal-event-content-mobile">
                          <h3>{evento?.nombre || "Evento finalizado"}</h3>

                          {evento?.fecha_sorteo && (
                            <p className="principal-event-meta-mobile">
                              📅 {evento.fecha_sorteo}
                            </p>
                          )}

                          {evento?.precio_ticket !== null &&
                            evento?.precio_ticket !== undefined && (
                              <p className="principal-event-meta-mobile">
                                💰 ${formatearPrecioSeguro(evento.precio_ticket)}
                              </p>
                            )}

                          <div className="principal-progress-wrap">
                            <ProgressVentaBar
                              value={progreso.porcentaje}
                              soldOut={progreso.soldOut}
                            />
                          </div>

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

                {isMobileFinalizados ? (
<div
  className="principal-pagination-dots carousel-dots"
  aria-label="Paginación finalizados"
>
  {Array.from({ length: totalPaginasFinalizados }).map((_, index) => (
    <button
      key={index}
      type="button"
      className={`principal-pagination-dot carousel-dot ${
        paginaFinalizados === index + 1 ? "active" : ""
      }`}
      onClick={() => setPaginaFinalizados(index + 1)}
      aria-label={`Ir a la página ${index + 1}`}
    />
  ))}
</div>
                ) : (
                  totalPaginasFinalizados > 1 && (
                    <div
                      className="principal-pagination-dots"
                      aria-label="Paginación finalizados"
                    >
                      {Array.from({ length: totalPaginasFinalizados }).map(
                        (_, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`principal-pagination-dot ${
                              paginaFinalizados === index + 1 ? "active" : ""
                            }`}
                            onClick={() => setPaginaFinalizados(index + 1)}
                            aria-label={`Ir a la página ${index + 1}`}
                          />
                        )
                      )}
                    </div>
                  )
                )}
              </>
            )}

            <div className="principal-historial-wrap">
              <HistorialGanadores />
            </div>
          </section>

          {/* PAGOS */}
          <section
            className="principal-section reveal-fade-up reveal-delay-4"
            id="pagos"
          >
            <div className="principal-section-head">
              <h2>CUENTAS DE PAGO</h2>
            </div>

            <div className="principal-payments-vertical">
              {metodosPagoPublicos.map((method) => {
                const mostrarCuenta = Boolean(method?.cuenta);
                const mostrarTitular = Boolean(method?.titular);

                const extras = Array.isArray(method?.extra) ? method.extra : [];

                const nombreMetodo =
                  method?.titulo || method?.nombre || "Método de pago";

                return (
                  <div
                    key={method?.id || method?.nombre}
                    className="principal-payment-block premium-card-hover"
                  >
                    {method?.logo && (
                      <img
                        src={method.logo}
                        alt={nombreMetodo}
                        className="principal-payment-icon"
                      />
                    )}

                    <h3>{nombreMetodo}</h3>

                    {method?.subtitulo && <p>{method.subtitulo}</p>}

                    {mostrarCuenta && (
                      <div className="copy-line">
                        <strong>{method.cuenta}</strong>

                        <button
                          type="button"
                          onClick={() => copiarTexto(method.cuenta)}
                        >
                          📋
                        </button>
                      </div>
                    )}

                    {extras.map((item) => (
                      <div
                        key={`${method?.id || method?.nombre}-${item?.label}-${item?.value}`}
                      >
                        <p>{item?.label}</p>

                        <div className="copy-line">
                          <strong>{item?.value}</strong>

                          <button
                            type="button"
                            onClick={() => copiarTexto(item?.value)}
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    ))}

                    {mostrarTitular && (
                      <div className="copy-line">
                        <span>
                          <strong>Titular:</strong> {method.titular}
                        </span>

                        <button
                          type="button"
                          onClick={() => copiarTexto(method.titular)}
                        >
                          📋
                        </button>
                      </div>
                    )}

                    {method?.descripcion && <p>{method.descripcion}</p>}
                  </div>
                );
              })}

              {metodosPagoPublicos.length === 0 && (
                <div className="principal-empty-box premium">
                  <div className="principal-empty-icon">💳</div>

                  <h3>No hay métodos de pago</h3>

                  <p>Configura los métodos de pago desde el panel administrativo.</p>
                </div>
              )}
            </div>
          </section>

          {/* RESULTADOS */}
          <section
            className="principal-section reveal-fade-up"
            id="resultados-oficiales"
          >
            <div className="principal-section-head">
              <h2>{tituloResultados}</h2>
            </div>

            <div className="principal-results-box premium-card-hover">
              <div className="principal-results-copy">
                <p className="principal-results-kicker">
                  TRANSPARENCIA Y CONFIANZA
                </p>

                <h3>Consulta aquí los resultados oficiales</h3>

                <p>
                  El resultado ganador de nuestras rifas se tomará con base en
                  los resultados oficiales publicados por las loterías
                  autorizadas.
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

          {/* CONTACTO */}
          <section className="principal-section reveal-fade-up" id="contacto">
            <div className="principal-section-head">
              <h2>CONTACTO</h2>

              <p>{textoContacto}</p>
            </div>

            <div className="principal-contact-box premium-card-hover">
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${String(whatsappNumber).replace(
                    /\D/g,
                    ""
                  )}?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa`}
                  target="_blank"
                  rel="noreferrer"
                  className="principal-red-btn contact-btn"
                >
                  💬 WHATSAPP
                </a>
              )}

              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="principal-white-btn contact-btn"
                >
                  📸 INSTAGRAM
                </a>
              )}

              {config?.telegram && (
                <a
                  href={config.telegram}
                  target="_blank"
                  rel="noreferrer"
                  className="principal-white-btn contact-btn"
                >
                  ✈️ TELEGRAM
                </a>
              )}
            </div>
          </section>

          {/* FOOTER */}
          <PublicFooter
            texto={footerTexto}
            mostrarRedes={config?.footer_mostrar_redes !== false}
          />
        </div>

        {config?.notificaciones_activas !== false && (
          <FloatingPurchaseNotifications />
        )}
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