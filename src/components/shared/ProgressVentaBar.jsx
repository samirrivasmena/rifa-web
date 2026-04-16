"use client";

export default function ProgressVentaBar({
  value = 0,
  soldOut = false,
  className = "",
}) {
  const porcentaje = Math.min(Math.max(Number(value) || 0, 0), 100);

  const getTone = () => {
    if (soldOut || porcentaje >= 100) return "complete";
    if (porcentaje >= 80) return "high";
    if (porcentaje >= 50) return "mid";
    return "low";
  };

  const tone = getTone();

  return (
    <div className={["smart-progress", tone, className].filter(Boolean).join(" ")}>
      <div className="smart-progress-head">
        <strong className="smart-progress-value">{porcentaje.toFixed(1)}%</strong>
      </div>

      <div
        className="smart-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Porcentaje de boletos vendidos"
      >
        <span
          className="smart-progress-fill"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}