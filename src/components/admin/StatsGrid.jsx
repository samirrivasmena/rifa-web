"use client";

export default function StatsGrid({
  compras = [],
  tickets = [],
  onFilterClick,
  scrollTargetRef,
}) {
  const totalCompras = compras.length;
  const pendientes = compras.filter((c) => c.estado_pago === "pendiente").length;
  const aprobadas = compras.filter((c) => c.estado_pago === "aprobado").length;
  const rechazadas = compras.filter((c) => c.estado_pago === "rechazado").length;
  const ticketsVendidos = tickets.length;

  const stats = [
    {
      key: "total",
      title: "Total compras",
      value: totalCompras,
      subtitle: "Registros de esta rifa",
      emoji: "🛒",
      className: "purple",
    },
    {
      key: "pendientes",
      title: "Compras pendientes",
      value: pendientes,
      subtitle: "Esperando revisión",
      emoji: "⏳",
      className: "yellow",
    },
    {
      key: "aprobadas",
      title: "Compras aprobadas",
      value: aprobadas,
      subtitle: "Pagos validados",
      emoji: "✅",
      className: "green",
    },
    {
      key: "rechazadas",
      title: "Compras rechazadas",
      value: rechazadas,
      subtitle: "Pagos rechazados",
      emoji: "❌",
      className: "red",
    },
    {
      key: "tickets",
      title: "Tickets vendidos",
      value: ticketsVendidos,
      subtitle: "Números ya asignados",
      emoji: "🎟️",
      className: "blue",
    },
  ];

  return (
    <div className="adminpro-kpi-grid">
      {stats.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`adminpro-kpi-card clickable ${item.className}`}
          onClick={() => {
            onFilterClick?.(item.key);

            setTimeout(() => {
              scrollTargetRef?.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 120);
          }}
        >
          <div className="adminpro-kpi-icon">{item.emoji}</div>

          <div>
            <p>{item.title}</p>
            <h3>{item.value}</h3>
            <small style={{ opacity: 0.9 }}>{item.subtitle}</small>
          </div>

          <span className="adminpro-kpi-click-hint">↘</span>
        </button>
      ))}
    </div>
  );
}