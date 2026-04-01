"use client";

export default function KpiGrid({ compras = [], tickets = [], onCardClick }) {
  const totalCompras = compras.length;

  const pendientes = compras.filter(
    (c) => c.estado_pago === "pendiente"
  ).length;

  const aprobadas = compras.filter(
    (c) => c.estado_pago === "aprobado"
  ).length;

  const rechazadas = compras.filter(
    (c) => c.estado_pago === "rechazado"
  ).length;

  const ticketsVendidos = tickets.length;

  const montoAprobado = compras
    .filter((c) => c.estado_pago === "aprobado")
    .reduce((acc, compra) => {
      const monto = Number(compra.monto_total ?? compra.total ?? 0);
      return acc + monto;
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
      label: "Tickets Vendidos",
      value: ticketsVendidos,
      icon: "🎟️",
      className: "blue",
    },
    {
      key: "monto",
      label: "Monto Aprobado",
      value: `$${Number(montoAprobado || 0).toFixed(2)}`,
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
          className={`adminpro-kpi-card ${card.className} ${
            card.disabled ? "disabled" : "clickable"
          }`}
          onClick={() => {
            if (!card.disabled) onCardClick?.(card.key);
          }}
        >
          <div className="adminpro-kpi-icon">{card.icon}</div>

          <div>
            <p>{card.label}</p>
            <h3>{card.value}</h3>
          </div>

          {!card.disabled && (
            <span className="adminpro-kpi-click-hint">↘</span>
          )}
        </button>
      ))}
    </div>
  );
}