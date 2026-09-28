"use client";

import Swal from "sweetalert2";

function normalizarNumero(valor, pad = 4) {
  if (valor === undefined || valor === null || valor === "") return null;

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");
  if (!soloNumeros) return null;

  return String(Number(soloNumeros)).padStart(pad, "0");
}

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
  const ganadorOficialActual = Boolean(
    resultado?.oficial === true || numeroGanadorOficial
  );

  const esFree = Boolean(
    resultado?.es_free ||
      resultado?.tipo === "free" ||
      resultado?.free_drop ||
      resultado?.codigo_free ||
      resultado?.participacion?.codigo ||
      resultado?.participacion?.codigo_unico
  );

  const numeroGanadorGuardado = normalizarNumero(
    numeroGanadorOficial,
    padLength
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
      : "Sin número";

  const nombreParticipante =
    resultado?.usuario?.nombre ||
    [
      resultado?.participacion?.nombre,
      resultado?.participacion?.apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    null;

  const emailParticipante =
    resultado?.usuario?.email || resultado?.participacion?.email || null;

  const telefonoParticipante =
    resultado?.usuario?.telefono || resultado?.participacion?.telefono || null;

  const tieneUsuario = Boolean(
    nombreParticipante || emailParticipante || telefonoParticipante
  );

  const codigoFree =
    resultado?.codigo_free ||
    resultado?.participacion?.codigo ||
    resultado?.participacion?.codigo_unico ||
    null;

  const freeDropNombre =
    resultado?.free_drop?.nombre ||
    resultado?.participacion?.free_drop ||
    null;

  const freeDropNumero =
    resultado?.free_drop?.numero_drop ||
    resultado?.participacion?.free_drop_numero ||
    null;

  const fechaParticipacion =
    resultado?.participacion?.created_at ||
    resultado?.participacion?.updated_at ||
    resultado?.sorteo?.fecha_sorteo ||
    null;

  const estadoKey = ganadorOficialActual
    ? "official"
    : esFree
    ? "free"
    : resultado?.existe
    ? "sold"
    : "empty";

  const titulo = ganadorOficialActual
    ? "🏆 Número ganador oficial"
    : esFree
    ? "🎁 Número FREE"
    : resultado?.existe
    ? "✅ Número vendido"
    : "❌ Número no vendido";

  const descripcion = ganadorOficialActual
    ? "Este número ya quedó registrado como ganador oficial."
    : esFree
    ? "El número pertenece a una participación FREE y también puede convertirse en ganador."
    : resultado?.existe
    ? "El número fue vendido y puede convertirse en ganador."
    : "No existe una compra asociada a ese número.";

  const mensajeClase = ganadorOficialActual
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

  const mostrarEmpty = !resultado && !ganadorOficialActual;

  const puedeGuardarGanador =
    resultado?.existe &&
    !ganadorOficialActual &&
    !numeroGanadorGuardado &&
    onGuardar;

  const puedeQuitarGanador = ganadorOficialActual && onQuitar;

  return (
    <div className="adminpro-result-stack">
      {mensaje ? <p className={mensajeClase}>{mensaje}</p> : null}

      {mostrarEmpty ? (
        <div className="adminpro-card adminpro-winner-card adminpro-winner-empty-card">
          <div className="adminpro-winner-empty-emoji">🔎</div>
          <h3>Resultado del número</h3>
          <p>
            Busca un número para ver aquí su estado, los datos del comprador o
            de la participación FREE y las acciones disponibles.
          </p>

          <div className="adminpro-winner-empty-tip">
            <strong>Tip:</strong> cuando el número sea ocupado podrás
            registrarlo como ganador oficial o quitarlo si hace falta.
          </div>
        </div>
      ) : (
        <div className={`adminpro-card adminpro-winner-card adminpro-winner-${estadoKey}`}>
          <div className="adminpro-winner-card-head">
            <div className="adminpro-winner-title-block">
              <div className={`adminpro-winner-icon ${estadoKey}`}>
                {ganadorOficialActual ? "🏆" : esFree ? "🎁" : resultado?.existe ? "✅" : "❌"}
              </div>

              <div>
                <span className={`adminpro-winner-badge ${estadoKey}`}>
                  {ganadorOficialActual
                    ? "Ganador oficial"
                    : esFree
                    ? "FREE"
                    : resultado?.existe
                    ? "Vendido"
                    : "No vendido"}
                </span>

                <h3>{titulo}</h3>
                <p>{descripcion}</p>
              </div>
            </div>

            <div className="adminpro-winner-number-box">
              <span>
                {ganadorOficialActual ? "Número ganador" : "Número consultado"}
              </span>
              <strong>{numeroFormateado}</strong>
            </div>
          </div>

          {esFree && (
            <div
              style={{
                margin: "0 0 14px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(34,197,94,.10)",
                border: "1px solid rgba(34,197,94,.25)",
                color: "#bbf7d0",
                fontWeight: 700,
              }}
            >
              🎁 Este número proviene de una participación FREE
            </div>
          )}

          <div className="adminpro-winner-info-grid">
            <div className="adminpro-winner-info-box">
              <div className="adminpro-winner-info-item">
                <span>Estado</span>
                <strong>
                  {ganadorOficialActual
                    ? "Ganador oficial"
                    : esFree
                    ? "FREE asignado"
                    : resultado?.existe
                    ? "Vendido"
                    : "No vendido"}
                </strong>
              </div>

              {resultado?.compra_id && (
                <div className="adminpro-winner-info-item">
                  <span>Compra ID</span>
                  <strong>{resultado.compra_id}</strong>
                </div>
              )}

              {esFree && (
                <>
                  <div className="adminpro-winner-info-item">
                    <span>Free Drop</span>
                    <strong>
                      {freeDropNombre
                        ? `${freeDropNombre}${freeDropNumero ? ` (#${freeDropNumero})` : ""}`
                        : "Sin free drop"}
                    </strong>
                  </div>

                  <div className="adminpro-winner-info-item">
                    <span>Código FREE</span>
                    <strong style={{ wordBreak: "break-word" }}>
                      {codigoFree || "Sin código"}
                    </strong>
                  </div>

                  <div className="adminpro-winner-info-item">
                    <span>Participación FREE</span>
                    <strong>
                      {resultado?.participacion?.id || "Sin participación"}
                    </strong>
                  </div>

                  {resultado?.participacion?.estado_residencia && (
                    <div className="adminpro-winner-info-item">
                      <span>Estado residencia</span>
                      <strong>{resultado.participacion.estado_residencia}</strong>
                    </div>
                  )}

                  <div className="adminpro-winner-info-item">
                    <span>Aceptó reglas</span>
                    <strong>
                      {resultado?.participacion?.acepta_reglas ? "Sí" : "No"}
                    </strong>
                  </div>

                  <div className="adminpro-winner-info-item">
                    <span>Cumple requisitos</span>
                    <strong>
                      {resultado?.participacion?.cumple_requisitos ? "Sí" : "No"}
                    </strong>
                  </div>
                </>
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

              {ganadorOficialActual && (
                <div className="adminpro-winner-info-item">
                  <span>Guardado</span>
                  <strong>En base de datos</strong>
                </div>
              )}

              {!ganadorOficialActual && numeroGanadorGuardado && (
                <div className="adminpro-winner-info-item">
                  <span>Ganador oficial actual</span>
                  <strong>{numeroGanadorGuardado}</strong>
                </div>
              )}
            </div>

            <div className="adminpro-winner-info-box">
              {tieneUsuario ? (
                <>
                  <div className="adminpro-winner-user-card">
                    <div className="adminpro-winner-avatar">
                      {String(
                        nombreParticipante || emailParticipante || "?"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="adminpro-winner-user-main">
                      <strong>{renderValorUsuario(nombreParticipante)}</strong>
                      <p>{renderValorUsuario(emailParticipante)}</p>
                      <p>{renderValorUsuario(telefonoParticipante)}</p>
                    </div>
                  </div>

                  <div className="adminpro-winner-copy-row">
                    {nombreParticipante && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() => copiarDato(nombreParticipante, "Nombre")}
                      >
                        📋 Nombre
                      </button>
                    )}

                    {emailParticipante && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() => copiarDato(emailParticipante, "Email")}
                      >
                        📧 Email
                      </button>
                    )}

                    {telefonoParticipante && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() =>
                          copiarDato(telefonoParticipante, "Teléfono")
                        }
                      >
                        📞 Teléfono
                      </button>
                    )}

                    {esFree && codigoFree && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() => copiarDato(codigoFree, "Código FREE")}
                      >
                        🏷️ Código FREE
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="adminpro-winner-empty-user">
                  <strong>Usuario no disponible</strong>
                  <p>
                    {ganadorOficialActual
                      ? "El ganador ya fue guardado, pero no se cargaron los datos del cliente en esta vista."
                      : esFree
                      ? "La participación FREE existe, pero no se pudieron cargar todos los datos del participante."
                      : "La compra existe, pero no se pudieron cargar los datos del cliente."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="adminpro-winner-actions">
            {esFree && codigoFree && (
              <button
                type="button"
                className="adminpro-soft-btn blue adminpro-winner-main-btn"
                onClick={() => copiarDato(codigoFree, "Código FREE")}
              >
                <span className="btn-icon">🏷️</span>
                Copiar Código FREE
              </button>
            )}

            {puedeGuardarGanador && (
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

            {puedeQuitarGanador && (
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
      )}
    </div>
  );
}