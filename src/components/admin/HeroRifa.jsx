"use client";

import {
  Eye,
  ShoppingCart,
  Trophy,
  TrendingUp,
  Gift,
  Ticket,
  Layers3,
  CalendarDays,
  Globe,
  Star,
  ImageIcon,
} from "lucide-react";

function formatBool(value) {
  return value ? "Sí" : "No";
}

export default function HeroRifa({
  rifaSeleccionada,
  totalCompras = 0,
  totalTicketsVendidos = 0,
  totalComprasAprobadas = 0,
  onIrCompras,
  onIrGanador,
  onIrRanking,
  showSecondImage = false,
}) {
  if (!rifaSeleccionada) return null;

  const {
    nombre,
    descripcion,
    premio,
    precio_ticket,
    formato,
    numero_inicio,
    numero_fin,
    cantidad_numeros,
    fecha_sorteo,
    hora_sorteo,
    fecha_cierre,
    publicada,
    destacada,
    estado,
    portada_url,
    portada_scroll_url,
    stats,
  } = rifaSeleccionada;

  const totalNumeros =
    Number(cantidad_numeros) ||
    (Number(numero_fin || 0) - Number(numero_inicio || 0) + 1);

  const vendidos = Number(stats?.ticketsVendidos || totalTicketsVendidos || 0);
  const disponibles = Math.max(
    Number(stats?.disponibles ?? totalNumeros - vendidos),
    0
  );
  const porcentajeVendido =
    totalNumeros > 0
      ? Number((((vendidos || 0) / totalNumeros) * 100).toFixed(2))
      : 0;

  const urlPublica = typeof window !== "undefined" ? window.location.origin : "#";

  const ringRadius = 42;
  const circumference = 2 * Math.PI * ringRadius;
  const dash = `${(porcentajeVendido / 100) * circumference} ${circumference}`;

  const imagenPrincipal = portada_url || "";
  const imagenScroll = portada_scroll_url || imagenPrincipal;

  return (
    <section className="adminhero4 adminhero4--compact">
      <div className="adminhero4__bg" />
      <div className="adminhero4__glow adminhero4__glow--one" />
      <div className="adminhero4__glow adminhero4__glow--two" />

      <div className="adminhero4__topbar">
        <div className="adminhero4__badges">
          <span className={`adminhero4__badge ${estado || "inactiva"}`}>
            {estado === "activa"
              ? "Rifa activa"
              : estado === "cerrada"
              ? "Rifa cerrada"
              : estado === "finalizada"
              ? "Rifa finalizada"
              : estado || "Sin estado"}
          </span>

          <span className="adminhero4__badge adminhero4__badge--public">
            {publicada ? "Publicada" : "No publicada"}
          </span>

          <span className="adminhero4__badge adminhero4__badge--featured">
            {destacada ? "Destacada" : "No destacada"}
          </span>
        </div>

        <div className="adminhero4__actions">
          <a
            href={urlPublica}
            target="_blank"
            rel="noreferrer"
            className="adminhero4__action adminhero4__action--ghost"
          >
            <Eye className="adminhero4__icon" />
            Ver pública
          </a>

          <button
            type="button"
            className="adminhero4__action adminhero4__action--ghost"
            onClick={onIrCompras}
          >
            <ShoppingCart className="adminhero4__icon" />
            Ir a compras
          </button>

          <button
            type="button"
            className="adminhero4__action adminhero4__action--ghost"
            onClick={onIrGanador}
          >
            <Trophy className="adminhero4__icon" />
            Ir a ganador
          </button>

          <button
            type="button"
            className="adminhero4__action adminhero4__action--primary"
            onClick={onIrRanking}
          >
            <TrendingUp className="adminhero4__icon" />
            Ir a ranking
          </button>
        </div>
      </div>

      <div className="adminhero4__main">
        <div className="adminhero4__left">
          <div className="adminhero4__header">
            <h1 className="adminhero4__title">{nombre || "Rifa sin nombre"}</h1>
            <p className="adminhero4__subtitle">
              {descripcion || "Sin descripción registrada"}
            </p>
          </div>

          <div className="adminhero4__featured">
            <div className="adminhero4__featured-icon-wrap">
              <Gift className="adminhero4__icon" />
            </div>

            <div className="adminhero4__featured-copy">
              <span className="adminhero4__featured-label">Premio principal</span>
              <strong className="adminhero4__featured-value">
                {premio || "No definido"}
              </strong>
            </div>
          </div>

          <div className="adminhero4__quickgrid">
            <div className="adminhero4__quickcard">
              <div className="adminhero4__quickicon">
                <Ticket className="adminhero4__icon" />
              </div>
              <div>
                <span>Precio por ticket</span>
                <strong>${Number(precio_ticket || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div className="adminhero4__quickcard">
              <div className="adminhero4__quickicon">
                <Layers3 className="adminhero4__icon" />
              </div>
              <div>
                <span>Formato</span>
                <strong>
                  {formato === "3digitos" ? "3 dígitos (3)" : "4 dígitos (4)"}
                </strong>
              </div>
            </div>

            <div className="adminhero4__quickcard">
              <div className="adminhero4__quickicon">
                <Ticket className="adminhero4__icon" />
              </div>
              <div>
                <span>Total de números</span>
                <strong>{totalNumeros || 0}</strong>
              </div>
            </div>

            <div className="adminhero4__quickcard">
              <div className="adminhero4__quickicon">
                <TrendingUp className="adminhero4__icon" />
              </div>
              <div>
                <span>Compras registradas</span>
                <strong>{totalCompras || 0}</strong>
              </div>
            </div>
          </div>

          <div className="adminhero4__salespanel">
            <div className="adminhero4__saleshead">
              <div>
                <span className="adminhero4__kicker">Rendimiento comercial</span>
                <h3>Progreso de ventas</h3>
              </div>

              <strong>{porcentajeVendido.toFixed(2)}%</strong>
            </div>

            <div className="adminhero4__bar">
              <div
                className="adminhero4__barfill"
                style={{ width: `${Math.min(porcentajeVendido, 100)}%` }}
              />
            </div>

            <div className="adminhero4__salesmeta">
              <div className="adminhero4__salesmeta-card">
                <span>Vendidos</span>
                <strong>{vendidos}</strong>
              </div>

              <div className="adminhero4__salesmeta-card">
                <span>Disponibles</span>
                <strong>{disponibles}</strong>
              </div>

              <div className="adminhero4__salesmeta-card">
                <span>Total</span>
                <strong>{totalNumeros}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="adminhero4__right">
          <div className="adminhero4__media adminhero4__media-switch">
            {imagenPrincipal ? (
              <>
                <img
                  src={imagenPrincipal}
                  alt={nombre || "Rifa"}
                  className={`adminhero4__image-layer ${showSecondImage ? "hide" : "show"}`}
                />
                <img
                  src={imagenScroll}
                  alt={`${nombre || "Rifa"} scroll`}
                  className={`adminhero4__image-layer ${showSecondImage ? "show" : "hide"}`}
                />
              </>
            ) : (
              <div className="adminhero4__media-placeholder">
                <div className="adminhero4__media-placeholder-icon">
                  <ImageIcon className="adminhero4__icon" />
                </div>
                <strong>Sin portada</strong>
                <span>Esta rifa todavía no tiene imagen principal cargada.</span>
              </div>
            )}
          </div>

          <div className="adminhero4__insight">
            <div className="adminhero4__ring">
              <svg className="adminhero4__ring-svg" viewBox="0 0 110 110">
                <circle className="adminhero4__ring-bg" cx="55" cy="55" r={ringRadius} />
                <circle
                  className="adminhero4__ring-progress"
                  cx="55"
                  cy="55"
                  r={ringRadius}
                  strokeDasharray={dash}
                />
              </svg>

              <div className="adminhero4__ring-center">
                <strong>{Math.round(porcentajeVendido)}%</strong>
                <span>Vendido</span>
              </div>
            </div>

            <div className="adminhero4__insight-copy">
              <h4>Resumen de ocupación</h4>
              <p>
                Se han vendido {vendidos} de {totalNumeros} números disponibles
                en esta rifa.
              </p>
              <p>
                Compras aprobadas: <strong>{totalComprasAprobadas || 0}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="adminhero4__bottom">
        <div className="adminhero4__bottomcard">
          <div className="adminhero4__bottomicon">
            <CalendarDays className="adminhero4__icon" />
          </div>
          <div>
            <span>Fecha de cierre</span>
            <strong>{fecha_cierre || "Sin fecha"}</strong>
          </div>
        </div>

        <div className="adminhero4__bottomcard">
          <div className="adminhero4__bottomicon">
            <CalendarDays className="adminhero4__icon" />
          </div>
          <div>
            <span>Fecha del sorteo</span>
            <strong>
              {fecha_sorteo || "Sin fecha"}
              {hora_sorteo ? ` - ${hora_sorteo}` : ""}
            </strong>
          </div>
        </div>

        <div className="adminhero4__bottomcard">
          <div className="adminhero4__bottomicon">
            <Globe className="adminhero4__icon" />
          </div>
          <div>
            <span>Publicada</span>
            <strong>{formatBool(Boolean(publicada))}</strong>
          </div>
        </div>

        <div className="adminhero4__bottomcard">
          <div className="adminhero4__bottomicon">
            <Star className="adminhero4__icon" />
          </div>
          <div>
            <span>Destacada</span>
            <strong>{formatBool(Boolean(destacada))}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}