"use client";

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function estadoNormalizado(valor) {
  return normalizarTexto(valor);
}

function esCompraAprobada(estado) {
  const e = estadoNormalizado(estado);
  return e === "aprobado" || e === "aprobada";
}

function esTicketFree(ticket = {}) {
  return Boolean(
    ticket?.es_free ||
      normalizarTexto(ticket?.tipo) === "free" ||
      ticket?.free_drop_id ||
      ticket?.free_drop_participation_id
  );
}

function esTicketPagado(ticket = {}) {
  const tieneCompra =
    ticket?.compra_id !== null &&
    ticket?.compra_id !== undefined;

  return tieneCompra && !esTicketFree(ticket);
}

function normalizarTicketsUnicos(lista = []) {
  const vistos = new Set();

  return (lista || [])
    .map((ticket) => {
      const numero = Number(ticket?.numero_ticket);

      if (!Number.isFinite(numero)) {
        return null;
      }

      return {
        ...ticket,
        numero_ticket: numero,
      };
    })
    .filter(Boolean)
    .filter((ticket) => {
      const key = String(ticket.numero_ticket);

      if (vistos.has(key)) {
        return false;
      }

      vistos.add(key);
      return true;
    });
}

export default function KpiGrid({
  compras = [],
  tickets = [],
  ticketsVendidos: ticketsOcupadosProp = null,
  onCardClick,
}) {
  const totalCompras = compras.length;

  const pendientes = compras.filter(
    (compra) =>
      estadoNormalizado(compra.estado_pago) === "pendiente"
  ).length;

  const aprobadas = compras.filter((compra) =>
    esCompraAprobada(compra.estado_pago)
  ).length;

  const rechazadas = compras.filter(
    (compra) =>
      estadoNormalizado(compra.estado_pago) === "rechazado"
  ).length;

  /*
   * AdminDashboardSection ya nos entrega en `tickets`
   * únicamente los números considerados ocupados.
   *
   * Aun así normalizamos por numero_ticket para evitar
   * contar accidentalmente el mismo número más de una vez.
   */
  const ticketsUnicos = normalizarTicketsUnicos(tickets);

  const ticketsFree = ticketsUnicos.filter(
    esTicketFree
  ).length;

  const ticketsPagados = ticketsUnicos.filter(
    esTicketPagado
  ).length;

  /*
   * Conservamos la prop `ticketsVendidos` para no romper
   * la integración existente.
   *
   * Actualmente esa prop representa el TOTAL OCUPADO
   * de la rifa: pagados + FREE.
   */
  const valorOcupadosProp = Number(
    ticketsOcupadosProp
  );

  const ticketsOcupados =
    ticketsOcupadosProp !== null &&
    ticketsOcupadosProp !== undefined &&
    Number.isFinite(valorOcupadosProp)
      ? Math.max(valorOcupadosProp, 0)
      : ticketsUnicos.length;

  const montoAprobado = compras
    .filter((compra) =>
      esCompraAprobada(compra.estado_pago)
    )
    .reduce((acc, compra) => {
      const monto = Number(
        compra.monto_total ??
          compra.total ??
          0
      );

      return (
        acc +
        (Number.isFinite(monto) ? monto : 0)
      );
    }, 0);

  const cards = [
    {
      key: "total",
      label: "Total Compras",
      value: totalCompras,
      icon: "🛒",
      className: "purple",
    },
    {
      key: "pendientes",
      label: "Pendientes",
      value: pendientes,
      icon: "⏳",
      className: "yellow",
    },
    {
      key: "aprobadas",
      label: "Aprobadas",
      value: aprobadas,
      icon: "✅",
      className: "green",
    },
    {
      key: "rechazadas",
      label: "Rechazadas",
      value: rechazadas,
      icon: "❌",
      className: "red",
    },
    {
      key: "tickets",
      label: "Tickets Ocupados",
      value: ticketsOcupados,
      icon: "🎟️",
      className: "blue",
    },
    {
      key: "pagados",
      label: "Tickets Pagados",
      value: ticketsPagados,
      icon: "💳",
      className: "yellow",
      disabled: true,
    },
    {
      key: "free",
      label: "Tickets FREE",
      value: ticketsFree,
      icon: "🎁",
      className: "blue",
      disabled: true,
    },
    {
      key: "monto",
      label: "Monto Aprobado",
      value: `$${Number(
        montoAprobado || 0
      ).toFixed(2)}`,
      icon: "💵",
      className: "dark",
      disabled: true,
    },
  ];

  return (
    <div className="adminpro-kpi-grid">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          className={`adminpro-kpi-card ${
            card.className
          } ${
            card.disabled
              ? "disabled"
              : "clickable"
          }`}
          onClick={() => {
            if (!card.disabled) {
              onCardClick?.(card.key);
            }
          }}
        >
          <div className="adminpro-kpi-icon">
            {card.icon}
          </div>

          <div>
            <p>{card.label}</p>
            <h3>{card.value}</h3>
          </div>

          {!card.disabled && (
            <span className="adminpro-kpi-click-hint">
              ↘
            </span>
          )}
        </button>
      ))}
    </div>
  );
}