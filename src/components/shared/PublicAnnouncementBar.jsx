"use client";

export default function PublicAnnouncementBar({ config }) {
  if (!config?.linea_anuncios_activa) {
    return null;
  }

  const mensajes = [
    config?.linea_anuncios_mensaje_1,
    config?.linea_anuncios_mensaje_2,
    config?.linea_anuncios_mensaje_3,
  ]
    .map((mensaje) => String(mensaje || "").trim())
    .filter(Boolean);

  if (mensajes.length === 0) {
    return null;
  }

  const velocidad = Math.max(
    5,
    Math.min(60, Number(config?.linea_anuncios_velocidad || 22))
  );

  const style = {
    "--announcement-bg":
      config?.linea_anuncios_color_fondo || "#111111",

    "--announcement-text":
      config?.linea_anuncios_color_texto || "#ffffff",

    "--announcement-dot":
      config?.linea_anuncios_color_separador || "#facc15",

    "--announcement-duration": `${velocidad}s`,
  };

  const contenido = (
    <>
      {mensajes.map((mensaje, index) => (
        <div
          className="public-announcement-item"
          key={`${mensaje}-${index}`}
        >
          <span className="public-announcement-text">
            {mensaje}
          </span>

          <span
            className="public-announcement-dot"
            aria-hidden="true"
          >
            ●
          </span>
        </div>
      ))}
    </>
  );

  const clases = [
    "public-announcement-bar",

    config?.linea_anuncios_negrita
      ? "is-bold"
      : "",

    config?.linea_anuncios_mostrar_movil === false
      ? "hide-mobile"
      : "",

    config?.linea_anuncios_mostrar_escritorio === false
      ? "hide-desktop"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={clases}
      style={style}
      role="region"
      aria-label="Anuncios"
    >
      <div className="public-announcement-viewport">
        <div className="public-announcement-track">

<div className="public-announcement-group">
  {contenido}
  {contenido}
  {contenido}
</div>

<div
  className="public-announcement-group"
  aria-hidden="true"
>
  {contenido}
  {contenido}
  {contenido}
</div>

        </div>
      </div>
    </div>
  );
}