"use client";

import Swal from "sweetalert2";

async function copiarTextoSeguro(texto) {
  const valor = String(texto ?? "").trim();
  if (!valor) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // fallback abajo
  }

  try {
    const area = document.createElement("textarea");
    area.value = valor;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.focus();
    area.select();

    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function WinnerCard({
  resultado,
  esGanador,
  mensaje,
  onGuardar,
  onQuitar,
  guardando,
  quitando,
  padLength,
  formatearFecha,
  numeroGanadorOficial,
}) {
  const ganadorOficial = Boolean(
    esGanador ||
      resultado?.oficial ||
      resultado?.persistido ||
      numeroGanadorOficial !== undefined &&
      numeroGanadorOficial !== null &&
      String(numeroGanadorOficial).trim() !== ""
  );

  const numeroBase =
    resultado?.numero_ticket ??
    resultado?.numero_ganador ??
    resultado?.numero_oficial ??
    numeroGanadorOficial ??
    null;

  const numeroSeguro =
    numeroBase !== undefined && numeroBase !== null && numeroBase !== ""
      ? Number(String(numeroBase).replace(/\D/g, ""))
      : null;

  const numeroFormateado =
    numeroSeguro !== null && !Number.isNaN(numeroSeguro)
      ? String(numeroSeguro).padStart(padLength, "0")
      : ganadorOficial && numeroGanadorOficial
      ? String(numeroGanadorOficial).padStart(padLength, "0")
      : "Sin número";

  const tieneUsuario = Boolean(
    resultado?.usuario &&
      (resultado.usuario.nombre || resultado.usuario.email || resultado.usuario.telefono)
  );

  const estadoKey = ganadorOficial ? "official" : resultado?.existe ? "sold" : "empty";

  const titulo = ganadorOficial
    ? "🏆 Número ganador oficial"
    : resultado?.existe
    ? "✅ Número vendido"
    : "❌ Número no vendido";

  const descripcion = ganadorOficial
    ? "Este número ya quedó registrado como ganador oficial."
    : resultado?.existe
    ? "El número fue vendido y puede convertirse en ganador."
    : "No existe una compra asociada a ese número.";

  const mensajeClase = ganadorOficial
    ? "adminpro-message-warn"
    : resultado?.existe
    ? "adminpro-message-success"
    : "adminpro-message-error";

  const copiarDato = async (valor, etiqueta) => {
    const ok = await copiarTextoSeguro(valor);

    if (ok) {
      await Swal.fire({
        icon: "success",
        title: "Copiado",
        text: `${etiqueta} copiado al portapapeles.`,
        timer: 1100,
        showConfirmButton: false,
      });
    } else {
      await Swal.fire({
        icon: "error",
        title: "No se pudo copiar",
        text: `No fue posible copiar ${etiqueta.toLowerCase()}.`,
      });
    }
  };

  const renderValorUsuario = (value) => (value ? value : "No disponible");

  const mostrarEmpty = !resultado && !ganadorOficial;

  if (mostrarEmpty) {
    return (
      <div className="adminpro-result-stack">
        {mensaje ? <p className={mensajeClase}>{mensaje}</p> : null}

        <div className="adminpro-card adminpro-winner-card adminpro-winner-empty-card">
          <div className="adminpro-winner-empty-emoji">🔎</div>
          <h3>Resultado del número</h3>
          <p>
            Busca un número para ver aquí su estado, los datos del comprador y las acciones
            disponibles.
          </p>

          <div className="adminpro-winner-empty-tip">
            <strong>Tip:</strong> cuando el número sea vendido podrás registrarlo como ganador
            oficial o quitarlo si hace falta.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adminpro-result-stack">
      {mensaje ? <p className={mensajeClase}>{mensaje}</p> : null}

      <div className={`adminpro-card adminpro-winner-card adminpro-winner-${estadoKey}`}>
        <div className="adminpro-winner-card-head">
          <div className="adminpro-winner-title-block">
            <div className={`adminpro-winner-icon ${estadoKey}`}>
              {ganadorOficial ? "🏆" : resultado?.existe ? "✅" : "❌"}
            </div>

            <div>
              <span className={`adminpro-winner-badge ${estadoKey}`}>
                {ganadorOficial
                  ? "Ganador oficial"
                  : resultado?.existe
                  ? "Vendido"
                  : "No vendido"}
              </span>

              <h3>{titulo}</h3>
              <p>{descripcion}</p>
            </div>
          </div>

          <div className="adminpro-winner-number-box">
            <span>{ganadorOficial ? "Número ganador" : "Número consultado"}</span>
            <strong>{numeroFormateado}</strong>
          </div>
        </div>

        <div className="adminpro-winner-info-grid">
          <div className="adminpro-winner-info-box">
            <div className="adminpro-winner-info-item">
              <span>Estado</span>
              <strong>
                {ganadorOficial ? "Ganador oficial" : resultado?.existe ? "Vendido" : "No vendido"}
              </strong>
            </div>

            {resultado?.compra_id && (
              <div className="adminpro-winner-info-item">
                <span>Compra ID</span>
                <strong>{resultado.compra_id}</strong>
              </div>
            )}

            {resultado?.sorteo?.fecha_sorteo && (
              <div className="adminpro-winner-info-item">
                <span>Fecha sorteo</span>
                <strong>
                  {formatearFecha?.(resultado.sorteo.fecha_sorteo) ||
                    resultado.sorteo.fecha_sorteo}
                </strong>
              </div>
            )}

            {resultado?.sorteo?.fuente && (
              <div className="adminpro-winner-info-item">
                <span>Fuente</span>
                <strong>{resultado.sorteo.fuente}</strong>
              </div>
            )}

            {ganadorOficial && (
              <div className="adminpro-winner-info-item">
                <span>Guardado</span>
                <strong>En base de datos</strong>
              </div>
            )}
          </div>

          <div className="adminpro-winner-info-box">
            {tieneUsuario ? (
              <>
                <div className="adminpro-winner-user-card">
                  <div className="adminpro-winner-avatar">
                    {String(resultado.usuario?.nombre || resultado.usuario?.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="adminpro-winner-user-main">
                    <strong>{renderValorUsuario(resultado.usuario?.nombre)}</strong>
                    <p>{renderValorUsuario(resultado.usuario?.email)}</p>
                    <p>{renderValorUsuario(resultado.usuario?.telefono)}</p>
                  </div>
                </div>

                <div className="adminpro-winner-copy-row">
                  {resultado.usuario?.nombre && (
                    <button
                      type="button"
                      className="adminpro-winner-copy-btn"
                      onClick={() => copiarDato(resultado.usuario.nombre, "Nombre")}
                    >
                      📋 Nombre
                    </button>
                  )}

                  {resultado.usuario?.email && (
                    <button
                      type="button"
                      className="adminpro-winner-copy-btn"
                      onClick={() => copiarDato(resultado.usuario.email, "Email")}
                    >
                      📧 Email
                    </button>
                  )}

                  {resultado.usuario?.telefono && (
                    <button
                      type="button"
                      className="adminpro-winner-copy-btn"
                      onClick={() => copiarDato(resultado.usuario.telefono, "Teléfono")}
                    >
                      📞 Teléfono
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="adminpro-winner-empty-user">
                <strong>Usuario no disponible</strong>
                <p>
                  {ganadorOficial
                    ? "El ganador ya fue guardado, pero no se cargaron los datos del cliente en esta vista."
                    : "La compra existe, pero no se pudieron cargar los datos del cliente."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="adminpro-winner-actions">
          {resultado?.existe && !ganadorOficial && onGuardar && (
            <button
              className="adminpro-primary-btn adminpro-winner-main-btn"
              onClick={onGuardar}
              disabled={guardando}
              type="button"
            >
              <span className="btn-icon">🏆</span>
              {guardando ? "Registrando..." : "Registrar ganador oficial"}
            </button>
          )}

          {ganadorOficial && onQuitar && (
            <button
              className="adminpro-soft-btn danger adminpro-winner-main-btn"
              onClick={onQuitar}
              disabled={quitando || guardando}
              type="button"
            >
              <span className="btn-icon">🗑️</span>
              {quitando ? "Quitando..." : "Quitar ganador oficial"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}