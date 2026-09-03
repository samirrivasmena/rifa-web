"use client";

function clampNumber(value, min = 0, max = 100) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) return min;

  return Math.min(Math.max(numero, min), max);
}

function getProgressState(porcentaje, soldOut) {
  if (soldOut || porcentaje >= 100) return "complete";
  if (porcentaje >= 80) return "high";
  if (porcentaje >= 50) return "mid";
  return "low";
}

export default function ProgressVentaBar({
  value = 0,
  soldOut = false,
  text = "",
  className = "",
}) {
  const porcentaje = clampNumber(value, 0, 100);
  const estado = getProgressState(porcentaje, soldOut);

  const labelText =
    text ||
    (soldOut || porcentaje >= 100 ? "agotado" : "vendido");

  return (
    <div
      className={[
        "progress-white-red",
        estado,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="progress-white-red__top">
<strong
  className="progress-white-red__value"
  style={{
    color: "var(--site-progress, #dc2626)",
  }}
>
  {porcentaje.toFixed(0)}%
</strong>

        <span className="progress-white-red__text">
          {labelText}
        </span>
      </div>

      <div
        className="progress-white-red__track"
        role="progressbar"
        aria-valuenow={Math.round(porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Porcentaje de boletos vendidos"
style={{
  background: "var(--site-progress-bg, #e5e7eb)",
}}
      >
        <span
          className="progress-white-red__fill"
style={{
  width: `${porcentaje}%`,
  background: "var(--site-progress, #dc2626)",
}}
        />
      </div>
    </div>
  );
}