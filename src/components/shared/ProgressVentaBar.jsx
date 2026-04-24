"use client";

export default function ProgressVentaBar({
  value = 0,
  soldOut = false,
  text = "",
  className = "",
}) {
  const porcentaje = Math.min(Math.max(Number(value) || 0, 0), 100);

  const estado =
    soldOut || porcentaje >= 100
      ? "complete"
      : porcentaje >= 80
      ? "high"
      : porcentaje >= 50
      ? "mid"
      : "low";

  return (
    <div className={["progress-white-red", estado, className].filter(Boolean).join(" ")}>
      <div className="progress-white-red__top">
        <strong className="progress-white-red__value">{porcentaje.toFixed(0)}%</strong>
        <span className="progress-white-red__text">
          {text || (soldOut || porcentaje >= 100 ? "agotado" : "vendido")}
        </span>
      </div>

      <div
        className="progress-white-red__track"
        role="progressbar"
        aria-valuenow={Math.round(porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Porcentaje de boletos vendidos"
      >
        <span
          className="progress-white-red__fill"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}