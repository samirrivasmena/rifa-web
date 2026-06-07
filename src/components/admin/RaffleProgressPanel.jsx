"use client";

import { useMemo, useState } from "react";

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin fecha";
  try {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;

    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const anio = date.getFullYear();

    let horas = date.getHours();
    const minutos = String(date.getMinutes()).padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";
    horas = horas % 12 || 12;

    return `${dia}/${mes}/${anio} - ${String(horas).padStart(2, "0")}:${minutos} ${ampm}`;
  } catch {
    return fecha;
  }
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

  const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const estaAsignado = (ticket) =>
    ticket?.compra_id !== null && ticket?.compra_id !== undefined;

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

  const normalizarNumero = (valor) => {
    if (valor === undefined || valor === null || valor === "") return null;

    const texto = String(valor).trim();
    const soloNumeros = texto.replace(/\D/g, "");
    if (!soloNumeros) return null;

    return String(Number(soloNumeros)).padStart(padLength, "0");
  };

  const numeroGanadorFormateado = useMemo(() => {
    const ganador =
      numeroGanadorOficial ??
      rifaSeleccionada?.numero_ganador ??
      rifaSeleccionada?.numero_oficial ??
      rifaSeleccionada?.sorteo?.numero_ganador ??
      rifaSeleccionada?.sorteo?.numero_oficial ??
      null;

    return normalizarNumero(ganador);
  }, [
    numeroGanadorOficial,
    rifaSeleccionada?.numero_ganador,
    rifaSeleccionada?.numero_oficial,
    rifaSeleccionada?.sorteo?.numero_ganador,
    rifaSeleccionada?.sorteo?.numero_oficial,
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
    if (fromStats !== null && fromStats > 0) return fromStats;

    const fromTotalNumeros = toNumber(rifaSeleccionada?.total_numeros);
    if (fromTotalNumeros !== null && fromTotalNumeros > 0) return fromTotalNumeros;

    const fromCantidad = toNumber(rifaSeleccionada?.cantidad_numeros);
    if (fromCantidad !== null && fromCantidad > 0) return fromCantidad;

    return numeroFin >= numeroInicio ? numeroFin - numeroInicio + 1 : 0;
  }, [rifaSeleccionada, numeroInicio, numeroFin]);

  const ticketsUnicos = useMemo(() => {
    const seen = new Set();

    return (tickets || [])
      .map((ticket) => {
        const numero = Number(ticket?.numero_ticket);
        if (!Number.isFinite(numero)) return null;

        // Ignora números fuera del rango de la rifa
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

  // Solo tickets realmente asignados a una compra
  const ticketsAsignados = useMemo(() => {
    return ticketsUnicos.filter((ticket) => estaAsignado(ticket));
  }, [ticketsUnicos]);

  const ticketsMap = useMemo(() => {
    const map = new Map();
    ticketsUnicos.forEach((ticket) => {
      map.set(Number(ticket.numero_ticket), ticket);
    });
    return map;
  }, [ticketsUnicos]);

  const comprasMap = useMemo(() => {
    const map = new Map();
    compras.forEach((compra) => {
      map.set(String(compra.id), compra);
    });
    return map;
  }, [compras]);

  const ticketsOrdenados = useMemo(() => {
    return ticketsAsignados
      .map((ticket) => ({
        ...ticket,
        compra: comprasMap.get(String(ticket.compra_id)) || null,
      }))
      .sort((a, b) => Number(a.numero_ticket) - Number(b.numero_ticket));
  }, [ticketsAsignados, comprasMap]);

  const vendidos = ticketsAsignados.length;
  const disponibles = Math.max(totalNumeros - vendidos, 0);

  const porcentajeVendido =
    totalNumeros > 0 ? Number(((vendidos / totalNumeros) * 100).toFixed(2)) : 0;

  const porcentajeDisponible =
    totalNumeros > 0 ? Number((100 - porcentajeVendido).toFixed(2)) : 0;

  const numeros = useMemo(() => {
    const lista = [];
    for (let i = numeroInicio; i <= numeroFin; i++) {
      lista.push(i);
    }
    return lista;
  }, [numeroInicio, numeroFin]);

  const abrirDetalleNumero = (numero) => {
    const ticket = ticketsMap.get(Number(numero));
    const ganador = esNumeroGanador(numero);
    const asignado = estaAsignado(ticket);

    if (!ticket || !asignado) {
      setTicketDetalle({
        tipo: "disponible",
        numero,
        esGanador: ganador,
      });
      setDetalleOpen(true);
      return;
    }

    const compra = comprasMap.get(String(ticket.compra_id)) || null;

    setTicketDetalle({
      tipo: "ticket",
      numero,
      ticket,
      compra,
      esGanador: ganador,
    });
    setDetalleOpen(true);
  };

  const numeroBuscadoNormalizado = busquedaNumero.trim();

  const numerosFiltrados = useMemo(() => {
    return numeros.filter((numero) => {
      const ticket = ticketsMap.get(Number(numero));
      const vendido = Boolean(ticket) && estaAsignado(ticket);
      const numeroFormateado = String(numero).padStart(padLength, "0");
      const ganador = esNumeroGanador(numero);

      const coincideBusqueda =
        !numeroBuscadoNormalizado ||
        numeroFormateado.includes(numeroBuscadoNormalizado);

      let coincideFiltro = true;

      if (filtroVista === "vendidos") coincideFiltro = vendido;
      else if (filtroVista === "disponibles") coincideFiltro = !vendido && !ganador;
      else if (filtroVista === "ganador") coincideFiltro = ganador;

      return coincideBusqueda && coincideFiltro;
    });
  }, [
    numeros,
    ticketsMap,
    numeroBuscadoNormalizado,
    filtroVista,
    padLength,
    numeroGanadorFormateado,
  ]);

  const numeroExactoEncontrado = useMemo(() => {
    if (numeroBuscadoNormalizado.length !== padLength) return null;

    const numero = Number(numeroBuscadoNormalizado);
    if (Number.isNaN(numero)) return null;

    if (numero < numeroInicio || numero > numeroFin) return null;

    return numero;
  }, [numeroBuscadoNormalizado, padLength, numeroInicio, numeroFin]);

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

          <div className="adminpro-badge-box">🎯 Avance: {porcentajeVendido}%</div>
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
                tipo: "lista-vendidos",
                titulo: "Tickets vendidos",
                valor: vendidos,
                tickets: ticketsOrdenados,
              });
              setDetalleOpen(true);
            }}
          >
            <span>Vendidos</span>
            <strong>{vendidos}</strong>
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
                titulo: "Falta por vender",
                valor: `${porcentajeDisponible}%`,
                descripcion:
                  "Porcentaje restante de números que todavía no han sido vendidos.",
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
            style={{ width: `${Math.min(Number(porcentajeVendido), 100)}%` }}
          />
        </div>

        <div className="adminpro-progress-meta">
          <span>Vendido: {porcentajeVendido}%</span>
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
              placeholder={padLength === 3 ? "Buscar número: 000" : "Buscar número: 0000"}
              value={busquedaNumero}
              onChange={(e) =>
                setBusquedaNumero(e.target.value.replace(/\D/g, "").slice(0, padLength))
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
              className={`adminpro-raffle-filter-btn ${filtroVista === "todos" ? "active" : ""}`}
              onClick={() => setFiltroVista("todos")}
            >
              Todos
            </button>

            <button
              type="button"
              className={`adminpro-raffle-filter-btn ${filtroVista === "vendidos" ? "active" : ""}`}
              onClick={() => setFiltroVista("vendidos")}
            >
              Vendidos
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
              className={`adminpro-raffle-filter-btn ${filtroVista === "ganador" ? "active" : ""}`}
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
            <span className="legend-box sold" /> Vendido / aprobado
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
              const vendido = Boolean(ticket) && estaAsignado(ticket);
              const numeroFormateado = String(numero).padStart(padLength, "0");
              const ganador = esNumeroGanador(numero);
              const esBusquedaExacta =
                busquedaNumero.length === padLength &&
                numeroFormateado === numeroBuscadoNormalizado;

              let className = "free";
              if (ganador) className = "winner";
              else if (vendido) className = "sold";

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
                      : vendido
                      ? `Número vendido ${numeroFormateado}`
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
        <div className="adminpro-modal-backdrop" onClick={() => setDetalleOpen(false)}>
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

            {ticketDetalle.tipo === "lista-vendidos" && (
              <div className="adminpro-raffle-detail-summary">
                <div className="adminpro-raffle-detail-big">
                  <span>{ticketDetalle.titulo}</span>
                  <strong>{ticketDetalle.valor}</strong>
                </div>

                <div className="adminpro-raffle-sold-list">
                  {ticketDetalle.tickets?.length ? (
                    ticketDetalle.tickets.map((item) => (
                      <div key={item.id} className="adminpro-raffle-sold-item">
                        <div>
                          <strong>
                            Nº {String(item.numero_ticket).padStart(padLength, "0")}
                          </strong>
                          <p>Compra #{item.compra_id}</p>
                        </div>

                        <div>
                          <strong>
                            {item.compra?.usuarios?.nombre ||
                              item.compra?.usuarios?.email ||
                              "Sin nombre"}
                          </strong>
                          <p>{item.compra?.usuarios?.telefono || "Sin teléfono"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No hay tickets vendidos.</p>
                  )}
                </div>
              </div>
            )}

            {ticketDetalle.tipo === "disponible" && (
              <div className="adminpro-raffle-detail-summary">
                <div className="adminpro-raffle-detail-big">
                  <span>Número disponible</span>
                  <strong>{String(ticketDetalle.numero).padStart(padLength, "0")}</strong>
                </div>

                <p>
                  Este número todavía no ha sido vendido. Si hay compras pendientes,
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
                      <span className="sold">Vendido / aprobado</span>
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
                    <span>Cliente</span>
                    <strong>
                      {ticketDetalle.compra?.usuarios?.nombre ||
                        ticketDetalle.compra?.usuarios?.email ||
                        "Sin nombre"}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>{ticketDetalle.compra?.usuarios?.email || "Sin email"}</strong>
                  </div>

                  <div>
                    <span>Teléfono</span>
                    <strong>{ticketDetalle.compra?.usuarios?.telefono || "Sin teléfono"}</strong>
                  </div>

                  <div>
                    <span>Monto</span>
                    <strong>
                      $
                      {Number(
                        ticketDetalle.compra?.monto_total ?? ticketDetalle.compra?.total ?? 0
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
                        ticketDetalle.compra?.fecha_compra || ticketDetalle.compra?.created_at
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