"use client";

import { useMemo, useState } from "react";

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin fecha";

  try {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return String(fecha);

    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const anio = date.getFullYear();

    let horas = date.getHours();
    const minutos = String(date.getMinutes()).padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";
    horas = horas % 12 || 12;

    return `${dia}/${mes}/${anio} - ${String(horas).padStart(2, "0")}:${minutos} ${ampm}`;
  } catch {
    return String(fecha);
  }
};

const normalizarTexto = (valor) =>
  String(valor ?? "").trim().toLowerCase();

const safeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const compactarNombre = (nombre, apellido) =>
  [nombre, apellido]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

const getFullName = (persona = {}) => {
  const nombre = safeText(persona?.nombre);
  const apellido = safeText(persona?.apellido);
  return compactarNombre(nombre, apellido);
};

const esCompraAsignada = (ticket = {}) =>
  ticket?.compra_id !== null && ticket?.compra_id !== undefined;

const esFreeAsignado = (ticket = {}) =>
  Boolean(
    ticket?.es_free ||
      normalizarTexto(ticket?.tipo) === "free" ||
      ticket?.free_drop_id ||
      ticket?.free_drop_participation_id
  );

const getEstadoVisual = (ticket = {}) => {
  if (safeText(ticket?.estado_visual)) {
    return ticket.estado_visual;
  }

  if (ticket?.es_free || normalizarTexto(ticket?.tipo) === "free") {
    return "FREE";
  }

  if (
    ticket?.ocupado ||
    ticket?.vendido ||
    esCompraAsignada(ticket) ||
    esFreeAsignado(ticket)
  ) {
    return "OCUPADO";
  }

  const estado = safeText(ticket?.estado);
  if (!estado) return "DISPONIBLE";

  const estadoNormalizado = normalizarTexto(estado);

  if (["disponible", "libre"].includes(estadoNormalizado)) return "DISPONIBLE";
  if (["asignado"].includes(estadoNormalizado)) return "OCUPADO";

  return estado.charAt(0).toUpperCase() + estado.slice(1);
};

const getDropLabel = (item = {}) => {
  if (item?.freeDropNombre) return item.freeDropNombre;

  const drop = item?.freeDrop || item?.free_drop || item?.free_drops || null;
  if (!drop) return "Sin free drop";

  if (drop?.nombre) return drop.nombre;

  if (drop?.numero_drop !== undefined && drop?.numero_drop !== null) {
    return `FREE DROP #${drop.numero_drop}`;
  }

  if (drop?.numero !== undefined && drop?.numero !== null) {
    return `FREE DROP #${drop.numero}`;
  }

  return "FREE DROP";
};

export default function RaffleProgressPanel({
  tickets = [],
  compras = [],
  rifaSeleccionada,
  tieneComprasPendientes,
  onOpenManualFromGrid,
  onOpenCompra,
  numeroGanadorOficial = null,
}) {
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [ticketDetalle, setTicketDetalle] = useState(null);
  const [busquedaNumero, setBusquedaNumero] = useState("");
  const [filtroVista, setFiltroVista] = useState("todos");

  const padLength = rifaSeleccionada?.formato === "3digitos" ? 3 : 4;

  const numeroInicio =
    rifaSeleccionada?.numero_inicio !== undefined &&
    rifaSeleccionada?.numero_inicio !== null
      ? Number(rifaSeleccionada.numero_inicio)
      : 0;

  const numeroFin =
    rifaSeleccionada?.numero_fin !== undefined &&
    rifaSeleccionada?.numero_fin !== null
      ? Number(rifaSeleccionada.numero_fin)
      : rifaSeleccionada?.formato === "3digitos"
      ? 999
      : 9999;

  const comprasMap = useMemo(() => {
    const map = new Map();
    (compras || []).forEach((compra) => {
      map.set(String(compra.id), compra);
    });
    return map;
  }, [compras]);

  const numeroGanadorFormateado = useMemo(() => {
    const ganador =
      numeroGanadorOficial ??
      rifaSeleccionada?.numero_ganador ??
      rifaSeleccionada?.numero_oficial ??
      rifaSeleccionada?.sorteo?.numero_ganador ??
      rifaSeleccionada?.sorteo?.numero_oficial ??
      null;

    if (ganador === null || ganador === undefined || ganador === "") return null;

    const soloNumeros = String(ganador).replace(/\D/g, "");
    if (!soloNumeros) return null;

    return String(Number(soloNumeros)).padStart(padLength, "0");
  }, [
    numeroGanadorOficial,
    rifaSeleccionada?.numero_ganador,
    rifaSeleccionada?.numero_oficial,
    rifaSeleccionada?.sorteo?.numero_ganador,
    rifaSeleccionada?.sorteo?.numero_oficial,
    padLength,
  ]);

  const esNumeroGanador = (numero) => {
    const numeroFormateado = String(numero).padStart(padLength, "0");
    return (
      numeroGanadorFormateado !== null &&
      numeroFormateado === numeroGanadorFormateado
    );
  };

  const totalNumeros = useMemo(() => {
    const fromStats = toNumber(rifaSeleccionada?.stats?.total);
    if (fromStats > 0) return fromStats;

    const fromTotalNumeros = toNumber(rifaSeleccionada?.total_numeros);
    if (fromTotalNumeros > 0) return fromTotalNumeros;

    const fromCantidad = toNumber(rifaSeleccionada?.cantidad_numeros);
    if (fromCantidad > 0) return fromCantidad;

    return numeroFin >= numeroInicio ? numeroFin - numeroInicio + 1 : 0;
  }, [rifaSeleccionada, numeroInicio, numeroFin]);

  const ticketsUnicos = useMemo(() => {
    const seen = new Set();

    return (tickets || [])
      .map((ticket) => {
        const numero = Number(ticket?.numero_ticket);
        if (!Number.isFinite(numero)) return null;

        if (numero < numeroInicio || numero > numeroFin) return null;

        return {
          ...ticket,
          numero_ticket: numero,
        };
      })
      .filter(Boolean)
      .filter((ticket) => {
        const key = String(ticket.numero_ticket);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => Number(a.numero_ticket) - Number(b.numero_ticket));
  }, [tickets, numeroInicio, numeroFin]);

  const ticketsProcesados = useMemo(() => {
    return ticketsUnicos
      .map((ticket) => {
        const compra =
          comprasMap.get(String(ticket.compra_id)) || ticket.compra || null;

        const usuarioCompra = compra?.usuarios || compra?.usuario || {};

        const freeParticipation =
          ticket.free_drop_participation ||
          ticket.freeParticipation ||
          ticket.participacion ||
          null;

        const freeDrop =
          ticket.free_drop || ticket.freeDrop || ticket.free_drops || null;

        const esFree = Boolean(ticket.es_free || esFreeAsignado(ticket));
        const vendido = Boolean(ticket.vendido) || (esCompraAsignada(ticket) && !esFree);
        const ocupado = Boolean(ticket.ocupado) || vendido || esFree;

        const estadoVisual = getEstadoVisual({
          ...ticket,
          ocupado,
          vendido,
          es_free: esFree,
        });

        const nombreCliente = safeText(
          ticket.nombreCliente,
          getFullName(usuarioCompra) ||
            safeText(compra?.nombre) ||
            safeText(ticket.asignado_a_nombre) ||
            "Sin nombre"
        );

        const emailCliente = safeText(
          ticket.emailCliente,
          safeText(usuarioCompra?.email) ||
            safeText(compra?.email) ||
            safeText(ticket.asignado_a_email) ||
            "Sin email"
        );

        const telefonoCliente = safeText(
          ticket.telefonoCliente,
          safeText(usuarioCompra?.telefono) ||
            safeText(compra?.telefono) ||
            safeText(ticket.asignado_a_telefono) ||
            "Sin teléfono"
        );

        const freeNombre = safeText(
          ticket.freeNombre,
          getFullName(freeParticipation) ||
            safeText(ticket.asignado_a_nombre) ||
            "Sin nombre"
        );

        const freeEmail = safeText(
          ticket.freeEmail,
          safeText(freeParticipation?.email) ||
            safeText(ticket.asignado_a_email) ||
            "Sin email"
        );

        const freeTelefono = safeText(
          ticket.freeTelefono,
          safeText(freeParticipation?.telefono) ||
            safeText(ticket.asignado_a_telefono) ||
            "Sin teléfono"
        );

        const codigoFree = safeText(
          ticket.codigoFree,
          safeText(freeParticipation?.codigo_unico) ||
            safeText(freeParticipation?.codigo_free) ||
            safeText(ticket?.codigo_unico) ||
            safeText(ticket?.codigo_free) ||
            "Sin código"
        );

        const freeDropNombre = safeText(
          ticket.freeDropNombre,
          getDropLabel({ freeDrop, free_drop: freeDrop })
        );

        return {
          ...ticket,
          compra,
          usuario: usuarioCompra,
          freeParticipation,
          freeDrop,
          ocupado,
          vendido,
          es_free: esFree,
          disponible: !ocupado,
          estadoVisual,
          nombreCliente,
          emailCliente,
          telefonoCliente,
          freeNombre,
          freeEmail,
          freeTelefono,
          codigoFree,
          freeDropNombre,
        };
      })
      .sort((a, b) => Number(a.numero_ticket) - Number(b.numero_ticket));
  }, [ticketsUnicos, comprasMap]);

  const ticketsMap = useMemo(() => {
    const map = new Map();
    ticketsProcesados.forEach((ticket) => {
      map.set(Number(ticket.numero_ticket), ticket);
    });
    return map;
  }, [ticketsProcesados]);

  const ticketsOcupados = useMemo(() => {
    return ticketsProcesados.filter((ticket) => ticket.ocupado);
  }, [ticketsProcesados]);

  const ocupados = ticketsOcupados.length;
  const disponibles = Math.max(totalNumeros - ocupados, 0);

  const porcentajeOcupado =
    totalNumeros > 0 ? Number(((ocupados / totalNumeros) * 100).toFixed(2)) : 0;

  const porcentajeDisponible =
    totalNumeros > 0 ? Number((100 - porcentajeOcupado).toFixed(2)) : 0;

  const numeros = useMemo(() => {
    const lista = [];
    for (let i = numeroInicio; i <= numeroFin; i++) {
      lista.push(i);
    }
    return lista;
  }, [numeroInicio, numeroFin]);

  const busquedaNumerica = busquedaNumero.replace(/\D/g, "").slice(0, padLength);

  const numeroExactoEncontrado = useMemo(() => {
    if (busquedaNumerica.length !== padLength) return null;

    const numero = Number(busquedaNumerica);
    if (Number.isNaN(numero)) return null;

    if (numero < numeroInicio || numero > numeroFin) return null;

    return numero;
  }, [busquedaNumerica, padLength, numeroInicio, numeroFin]);

  const abrirDetalleNumero = (numero) => {
    const ticket = ticketsMap.get(Number(numero));
    const ganador = esNumeroGanador(numero);
    const ocupado = Boolean(ticket) && Boolean(ticket.ocupado);

    if (!ticket || !ocupado) {
      setTicketDetalle({
        tipo: "disponible",
        numero,
        esGanador: ganador,
      });
      setDetalleOpen(true);
      return;
    }

    if (ticket.es_free) {
      setTicketDetalle({
        tipo: "free",
        numero,
        ticket,
        esGanador: ganador,
      });
      setDetalleOpen(true);
      return;
    }

    setTicketDetalle({
      tipo: "ticket",
      numero,
      ticket,
      compra: ticket.compra || null,
      esGanador: ganador,
    });
    setDetalleOpen(true);
  };

  const numerosFiltrados = useMemo(() => {
    return numeros.filter((numero) => {
      const ticket = ticketsMap.get(Number(numero));
      const ocupado = Boolean(ticket) && ticket.ocupado;
      const numeroFormateado = String(numero).padStart(padLength, "0");
      const ganador = esNumeroGanador(numero);

      const coincideBusqueda =
        !busquedaNumerica || numeroFormateado.includes(busquedaNumerica);

      let coincideFiltro = true;

      if (filtroVista === "vendidos") coincideFiltro = ocupado;
      else if (filtroVista === "disponibles") coincideFiltro = !ocupado && !ganador;
      else if (filtroVista === "ganador") coincideFiltro = ganador;

      return coincideBusqueda && coincideFiltro;
    });
  }, [numeros, ticketsMap, busquedaNumerica, filtroVista, padLength]);

  if (!rifaSeleccionada) return null;

  return (
    <>
      <div className="adminpro-card adminpro-raffle-panel-pro">
        <div className="adminpro-section-head">
          <div>
            <h2>Estado visual de la rifa</h2>
            <p>
              Consulta qué números ya están ocupados, cuáles siguen disponibles y cuál fue el ganador
            </p>
          </div>

          <div className="adminpro-badge-box">🎯 Avance: {porcentajeOcupado}%</div>
        </div>

        <div className="adminpro-raffle-stats-grid">
          <button
            type="button"
            className="adminpro-raffle-stat-item blue clickable"
            onClick={() => {
              setTicketDetalle({
                tipo: "resumen",
                titulo: "Total de números",
                valor: totalNumeros,
                descripcion: "Cantidad total de números de la rifa.",
              });
              setDetalleOpen(true);
            }}
          >
            <span>Total números</span>
            <strong>{totalNumeros}</strong>
          </button>

          <button
            type="button"
            className="adminpro-raffle-stat-item green clickable"
            onClick={() => {
              setTicketDetalle({
                tipo: "lista-ocupados",
                titulo: "Tickets ocupados",
                valor: ocupados,
                tickets: ticketsOcupados,
              });
              setDetalleOpen(true);
            }}
          >
            <span>Ocupados</span>
            <strong>{ocupados}</strong>
          </button>

          <button
            type="button"
            className="adminpro-raffle-stat-item gray clickable"
            onClick={() => {
              setTicketDetalle({
                tipo: "resumen",
                titulo: "Números disponibles",
                valor: disponibles,
                descripcion:
                  "Estos números todavía no han sido asignados y pueden usarse para aprobación manual.",
              });
              setDetalleOpen(true);
            }}
          >
            <span>Disponibles</span>
            <strong>{disponibles}</strong>
          </button>

          <button
            type="button"
            className="adminpro-raffle-stat-item orange clickable"
            onClick={() => {
              setTicketDetalle({
                tipo: "resumen",
                titulo: "Falta por ocupar",
                valor: `${porcentajeDisponible}%`,
                descripcion:
                  "Porcentaje restante de números que todavía no han sido ocupados.",
              });
              setDetalleOpen(true);
            }}
          >
            <span>Falta por vender</span>
            <strong>{porcentajeDisponible}%</strong>
          </button>
        </div>

        <div className="adminpro-progress">
          <div
            className="adminpro-progress-fill"
            style={{ width: `${Math.min(Number(porcentajeOcupado), 100)}%` }}
          />
        </div>

        <div className="adminpro-progress-meta">
          <span>Ocupado: {porcentajeOcupado}%</span>
          <span>Disponible: {porcentajeDisponible}%</span>
        </div>

        {tieneComprasPendientes && (
          <div className="adminpro-grid-tip">
            Haz clic en un número disponible para iniciar la aprobación manual.
          </div>
        )}

        <div className="adminpro-raffle-toolbar">
          <div className="adminpro-raffle-search">
            <input
              type="text"
              className="adminpro-input"
              placeholder={
                padLength === 3 ? "Buscar número: 000" : "Buscar número: 0000"
              }
              value={busquedaNumero}
              onChange={(e) =>
                setBusquedaNumero(
                  e.target.value.replace(/\D/g, "").slice(0, padLength)
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && numeroExactoEncontrado !== null) {
                  abrirDetalleNumero(numeroExactoEncontrado);
                }
              }}
            />
          </div>

          <div className="adminpro-raffle-filters">
            <button
              type="button"
              className={`adminpro-raffle-filter-btn ${
                filtroVista === "todos" ? "active" : ""
              }`}
              onClick={() => setFiltroVista("todos")}
            >
              Todos
            </button>

            <button
              type="button"
              className={`adminpro-raffle-filter-btn ${
                filtroVista === "vendidos" ? "active" : ""
              }`}
              onClick={() => setFiltroVista("vendidos")}
            >
              Ocupados
            </button>

            <button
              type="button"
              className={`adminpro-raffle-filter-btn ${
                filtroVista === "disponibles" ? "active" : ""
              }`}
              onClick={() => setFiltroVista("disponibles")}
            >
              Disponibles
            </button>

            <button
              type="button"
              className={`adminpro-raffle-filter-btn ${
                filtroVista === "ganador" ? "active" : ""
              }`}
              onClick={() => setFiltroVista("ganador")}
            >
              Ganador
            </button>
          </div>
        </div>

        {numeroExactoEncontrado !== null && (
          <div className="adminpro-raffle-open-match">
            <button
              type="button"
              className="adminpro-primary-btn"
              onClick={() => abrirDetalleNumero(numeroExactoEncontrado)}
            >
              Abrir número {String(numeroExactoEncontrado).padStart(padLength, "0")}
            </button>
          </div>
        )}

        <div className="adminpro-legend">
          <div>
            <span className="legend-box sold" /> Ocupado / FREE asignado
          </div>
          <div>
            <span className="legend-box free" /> Disponible
          </div>
          <div>
            <span className="legend-box winner" /> Ganador oficial
          </div>
        </div>

        <div className="adminpro-raffle-results-meta">
          <span>
            Mostrando {numerosFiltrados.length} número
            {numerosFiltrados.length !== 1 ? "s" : ""}
          </span>

          {busquedaNumero && (
            <button
              type="button"
              className="adminpro-soft-btn dark"
              onClick={() => setBusquedaNumero("")}
            >
              Limpiar búsqueda
            </button>
          )}
        </div>

        <div className="adminpro-ticket-grid-wrap">
          <div className="adminpro-ticket-grid">
            {numerosFiltrados.map((numero) => {
              const ticket = ticketsMap.get(Number(numero));
              const ocupado = Boolean(ticket) && ticket.ocupado;
              const numeroFormateado = String(numero).padStart(padLength, "0");
              const ganador = esNumeroGanador(numero);
              const esBusquedaExacta =
                busquedaNumerica.length === padLength &&
                numeroFormateado === busquedaNumerica;

              let className = "free";
              if (ganador) className = "winner";
              else if (ocupado) className = "sold";

              const winnerStyle = ganador
                ? {
                    background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
                    color: "#111827",
                    border: "1px solid #fde047",
                    boxShadow: "0 0 12px rgba(250, 204, 21, 0.45)",
                    fontWeight: 700,
                  }
                : undefined;

              return (
                <button
                  key={numero}
                  type="button"
                  className={`adminpro-ticket-cell ${className} clickable ${
                    esBusquedaExacta ? "highlighted" : ""
                  }`}
                  onClick={() => abrirDetalleNumero(numero)}
                  title={
                    ganador
                      ? `Número ganador ${numeroFormateado}`
                      : ticket?.es_free
                      ? `Número FREE ${numeroFormateado}`
                      : ocupado
                      ? `Número ocupado ${numeroFormateado}`
                      : `Número disponible ${numeroFormateado}`
                  }
                  style={winnerStyle}
                >
                  {numeroFormateado}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {detalleOpen && ticketDetalle && (
        <div
          className="adminpro-modal-backdrop"
          onClick={() => setDetalleOpen(false)}
        >
          <div
            className="adminpro-modal adminpro-raffle-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adminpro-section-head">
              <div>
                <h2>Detalle</h2>
                <p>Información del número o resumen seleccionado</p>
              </div>

              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={() => setDetalleOpen(false)}
              >
                Cerrar
              </button>
            </div>

            {ticketDetalle.tipo === "resumen" && (
              <div className="adminpro-raffle-detail-summary">
                <div className="adminpro-raffle-detail-big">
                  <span>{ticketDetalle.titulo}</span>
                  <strong>{ticketDetalle.valor}</strong>
                </div>
                <p>{ticketDetalle.descripcion}</p>
              </div>
            )}

            {ticketDetalle.tipo === "lista-ocupados" && (
              <div className="adminpro-raffle-detail-summary">
                <div className="adminpro-raffle-detail-big">
                  <span>{ticketDetalle.titulo}</span>
                  <strong>{ticketDetalle.valor}</strong>
                </div>

                <div className="adminpro-raffle-sold-list">
                  {ticketDetalle.tickets?.length ? (
                    ticketDetalle.tickets.map((item) => {
                      const esFree = Boolean(item.es_free || item.tipo === "free");
                      const compra = item.compra || null;
                      const freeParticipation =
                        item.freeParticipation || item.free_drop_participation || null;

                      return (
                        <div key={item.id} className="adminpro-raffle-sold-item">
                          <div>
                            <strong>
                              Nº {String(item.numero_ticket).padStart(padLength, "0")}
                            </strong>
                            <p>
                              {esFree
                                ? `FREE • ${item.freeDropNombre || "Participación gratis"}`
                                : `Compra #${item.compra_id}`}
                            </p>
                          </div>

                          <div>
                            <strong>
                              {esFree
                                ? item.freeNombre ||
                                  getFullName(freeParticipation) ||
                                  "Sin nombre"
                                : item.nombreCliente ||
                                  getFullName(compra?.usuarios) ||
                                  compra?.usuarios?.email ||
                                  "Sin nombre"}
                            </strong>
                            <p>
                              {esFree
                                ? item.freeEmail ||
                                  freeParticipation?.email ||
                                  "Sin email"
                                : item.emailCliente ||
                                  compra?.usuarios?.email ||
                                  "Sin email"}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p>No hay tickets ocupados.</p>
                  )}
                </div>
              </div>
            )}

            {ticketDetalle.tipo === "disponible" && (
              <div className="adminpro-raffle-detail-summary">
                <div className="adminpro-raffle-detail-big">
                  <span>Número disponible</span>
                  <strong>
                    {String(ticketDetalle.numero).padStart(padLength, "0")}
                  </strong>
                </div>

                <p>
                  Este número todavía no ha sido ocupado. Si hay compras pendientes,
                  puedes usarlo para aprobación manual.
                </p>

                {tieneComprasPendientes && (
                  <button
                    type="button"
                    className="adminpro-primary-btn"
                    onClick={() => {
                      setDetalleOpen(false);
                      onOpenManualFromGrid?.(ticketDetalle.numero);
                    }}
                  >
                    Usar este número
                  </button>
                )}
              </div>
            )}

            {ticketDetalle.tipo === "free" && (
              <div className="adminpro-raffle-detail-card">
                <div className="adminpro-raffle-detail-hero">
                  <div className="adminpro-raffle-detail-number">
                    {String(ticketDetalle.numero).padStart(padLength, "0")}
                  </div>

                  <div className="adminpro-raffle-detail-state">
                    <span className="sold">FREE</span>
                  </div>
                </div>

                <div className="adminpro-raffle-detail-grid">
                  <div>
                    <span>Tipo</span>
                    <strong>Participación gratis</strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong>
                      {ticketDetalle.ticket.estadoVisual ||
                        ticketDetalle.ticket.estado ||
                        "FREE"}
                    </strong>
                  </div>

                  <div>
                    <span>Nombre</span>
                    <strong>
                      {ticketDetalle.ticket.freeNombre ||
                        ticketDetalle.ticket.free_drop_participation?.nombre ||
                        ticketDetalle.ticket.asignado_a_nombre ||
                        "Sin nombre"}
                    </strong>
                  </div>

                  <div>
                    <span>Apellido</span>
                    <strong>
                      {ticketDetalle.ticket.free_drop_participation?.apellido ||
                        "Sin apellido"}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>
                      {ticketDetalle.ticket.freeEmail ||
                        ticketDetalle.ticket.free_drop_participation?.email ||
                        ticketDetalle.ticket.asignado_a_email ||
                        "Sin email"}
                    </strong>
                  </div>

                  <div>
                    <span>Teléfono</span>
                    <strong>
                      {ticketDetalle.ticket.freeTelefono ||
                        ticketDetalle.ticket.free_drop_participation?.telefono ||
                        ticketDetalle.ticket.asignado_a_telefono ||
                        "Sin teléfono"}
                    </strong>
                  </div>

                  <div>
                    <span>Free Drop</span>
                    <strong>
                      {ticketDetalle.ticket.freeDropNombre ||
                        ticketDetalle.ticket.freeDrop?.nombre ||
                        ticketDetalle.ticket.free_drop?.nombre ||
                        `FREE DROP #${
                          ticketDetalle.ticket.freeDrop?.numero_drop ||
                          ticketDetalle.ticket.free_drop?.numero_drop ||
                          ""
                        }`}
                    </strong>
                  </div>

                  <div>
                    <span>Participación FREE</span>
                    <strong>
                      {ticketDetalle.ticket.freeParticipation?.id ||
                        ticketDetalle.ticket.free_drop_participation?.id ||
                        ticketDetalle.ticket.free_drop_participation_id ||
                        "Sin participación"}
                    </strong>
                  </div>

                  <div>
                    <span>Código FREE</span>
                    <strong>
                      {ticketDetalle.ticket.codigoFree ||
                        ticketDetalle.ticket.free_drop_participation?.codigo_unico ||
                        ticketDetalle.ticket.free_drop_participation?.codigo_free ||
                        "Sin código"}
                    </strong>
                  </div>

                  <div>
                    <span>Asignado</span>
                    <strong>
                      {formatearFecha(
                        ticketDetalle.ticket.asignado_at ||
                          ticketDetalle.ticket.fecha_asignacion ||
                          ticketDetalle.ticket.free_drop_participation?.created_at
                      )}
                    </strong>
                  </div>
                </div>

                <p style={{ marginTop: "14px" }}>
                  Este número fue asignado por FREE DROP y cuenta como ocupado.
                </p>
              </div>
            )}

            {ticketDetalle.tipo === "ticket" && (
              <div className="adminpro-raffle-detail-card">
                <div className="adminpro-raffle-detail-hero">
                  <div className="adminpro-raffle-detail-number">
                    {String(ticketDetalle.numero).padStart(padLength, "0")}
                  </div>

                  <div className="adminpro-raffle-detail-state">
                    {ticketDetalle.esGanador ? (
                      <span className="winner">Ganador oficial</span>
                    ) : (
                      <span className="sold">
                        {ticketDetalle.ticket.estadoVisual || "Ocupado"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="adminpro-raffle-detail-grid">
                  <div>
                    <span>Compra ID</span>
                    <strong>{ticketDetalle.ticket.compra_id}</strong>
                  </div>

                  <div>
                    <span>Ticket ID</span>
                    <strong>{ticketDetalle.ticket.id}</strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong>{ticketDetalle.ticket.estadoVisual || "OCUPADO"}</strong>
                  </div>

                  <div>
                    <span>Cliente</span>
                    <strong>
                      {ticketDetalle.ticket.nombreCliente ||
                        ticketDetalle.compra?.usuarios?.nombre ||
                        ticketDetalle.compra?.usuario?.nombre ||
                        ticketDetalle.compra?.nombre ||
                        ticketDetalle.compra?.cliente_nombre ||
                        "Sin nombre"}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>
                      {ticketDetalle.ticket.emailCliente ||
                        ticketDetalle.compra?.usuarios?.email ||
                        ticketDetalle.compra?.usuario?.email ||
                        ticketDetalle.compra?.email ||
                        "Sin email"}
                    </strong>
                  </div>

                  <div>
                    <span>Teléfono</span>
                    <strong>
                      {ticketDetalle.ticket.telefonoCliente ||
                        ticketDetalle.compra?.usuarios?.telefono ||
                        ticketDetalle.compra?.usuario?.telefono ||
                        ticketDetalle.compra?.telefono ||
                        "Sin teléfono"}
                    </strong>
                  </div>

                  <div>
                    <span>Monto</span>
                    <strong>
                      $
                      {Number(
                        ticketDetalle.compra?.monto_total ??
                          ticketDetalle.compra?.total ??
                          0
                      ).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>Referencia</span>
                    <strong>{ticketDetalle.compra?.referencia || "Sin referencia"}</strong>
                  </div>

                  <div>
                    <span>Fecha</span>
                    <strong>
                      {formatearFecha(
                        ticketDetalle.compra?.fecha_compra ||
                          ticketDetalle.compra?.created_at
                      )}
                    </strong>
                  </div>
                </div>

                {ticketDetalle.compra?.id && (
                  <div className="adminpro-actions-wrap">
                    <button
                      type="button"
                      className="adminpro-primary-btn"
                      onClick={() => {
                        setDetalleOpen(false);
                        onOpenCompra?.(ticketDetalle.compra.id);
                      }}
                    >
                      Ver compra en sección compras
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}