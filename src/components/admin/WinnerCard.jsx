"use client";

import Swal from "sweetalert2";

/* =========================================================
   HELPERS
========================================================= */

function normalizarNumero(valor, pad = 4) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");

  if (!soloNumeros) return null;

  return String(Number(soloNumeros)).padStart(
    pad,
    "0"
  );
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

async function copiarTextoSeguro(texto) {
  const valor = String(texto ?? "").trim();

  if (!valor) return false;

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // fallback abajo
  }

  try {
    const area =
      document.createElement("textarea");

    area.value = valor;
    area.setAttribute("readonly", "true");

    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.left = "-9999px";

    document.body.appendChild(area);

    area.focus();
    area.select();

    const ok =
      document.execCommand("copy");

    document.body.removeChild(area);

    return ok;
  } catch {
    return false;
  }
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function WinnerCard({
  resultado,
  estadoRifa,
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
  /* =======================================================
     ESTADO DEL GANADOR
  ======================================================= */

  const esReservado = resultado?.reservado === true || resultado?.tipo === "reservado";
  const esBloqueado = esReservado || resultado?.bloqueado === true;
  const elegible = !esBloqueado && resultado?.esGanador === true && (resultado?.vendido === true || resultado?.es_free === true);
  const oficial = normalizarNumero(numeroGanadorOficial, padLength);
  const consultado = normalizarNumero(resultado?.numero_ticket ?? resultado?.numero_ganador ?? resultado?.numero_oficial, padLength);
  const ganadorOficialActual = !esBloqueado && Boolean(resultado?.oficial === true || (oficial && (!resultado || oficial === consultado)));

  /* =======================================================
     DETECTAR FREE
  ======================================================= */

  const esFree = Boolean(
    resultado?.es_free ||
      resultado?.tipo === "free" ||
      resultado?.free_drop ||
      resultado?.codigo_free ||
      resultado?.participacion?.codigo ||
      resultado?.participacion?.codigo_unico
  );

  const esPagado = resultado?.vendido === true && Boolean(
    resultado?.existe &&
      !esFree &&
      (
        resultado?.compra_id ||
        resultado?.tipo === "compra"
      )
  );

  /* =======================================================
     NÚMERO
  ======================================================= */

  const numeroGanadorGuardado =
    normalizarNumero(
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
    numeroBase !== undefined &&
    numeroBase !== null &&
    numeroBase !== ""
      ? Number(
          String(numeroBase).replace(
            /\D/g,
            ""
          )
        )
      : null;

  const numeroFormateado =
    numeroSeguro !== null &&
    !Number.isNaN(numeroSeguro)
      ? String(numeroSeguro).padStart(
          padLength,
          "0"
        )
      : "Sin número";

  /* =======================================================
     DATOS DEL USUARIO
  ======================================================= */

  const nombreParticipante =
    limpiarTexto(resultado?.usuario?.nombre) ||
    [
      limpiarTexto(
        resultado?.participacion?.nombre
      ),
      limpiarTexto(
        resultado?.participacion?.apellido
      ),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    limpiarTexto(
      resultado?.compra?.nombre_cliente
    ) ||
    null;

  const emailParticipante =
    limpiarTexto(resultado?.usuario?.email) ||
    limpiarTexto(
      resultado?.participacion?.email
    ) ||
    limpiarTexto(
      resultado?.compra?.email_cliente
    ) ||
    null;

  const telefonoParticipante =
    limpiarTexto(
      resultado?.usuario?.telefono
    ) ||
    limpiarTexto(
      resultado?.participacion?.telefono
    ) ||
    limpiarTexto(
      resultado?.compra?.telefono_cliente
    ) ||
    null;

  /* =======================================================
     INSTAGRAM FREE
  ======================================================= */

  const instagramParticipante =
    limpiarTexto(
      resultado?.participacion
        ?.social_username
    ) || null;

  const instagramNormalizado =
    instagramParticipante
      ? instagramParticipante.startsWith("@")
        ? instagramParticipante
        : `@${instagramParticipante}`
      : null;

  const instagramSinArroba =
    instagramNormalizado
      ? instagramNormalizado.replace(
          /^@/,
          ""
        )
      : null;

  const instagramUrl =
    instagramSinArroba
      ? `https://www.instagram.com/${encodeURIComponent(
          instagramSinArroba
        )}/`
      : null;

  /* =======================================================
     FREE DROP
  ======================================================= */

  const codigoFree =
    resultado?.codigo_free ||
    resultado?.participacion?.codigo ||
    resultado?.participacion
      ?.codigo_unico ||
    null;

  const freeDropNombre =
    resultado?.free_drop?.nombre ||
    resultado?.participacion?.free_drop ||
    null;

  const freeDropNumero =
    resultado?.free_drop?.numero_drop ??
    resultado?.participacion
      ?.free_drop_numero ??
    null;

  const fechaParticipacion =
    resultado?.participacion?.created_at ||
    resultado?.participacion?.updated_at ||
    resultado?.sorteo?.fecha_sorteo ||
    null;

  /* =======================================================
     COMPRA
  ======================================================= */

  const compra =
    resultado?.compra || null;

  const montoCompra =
    compra?.monto_total ??
    null;

  const cantidadTicketsCompra =
    compra?.cantidad_tickets ??
    null;

  const referenciaCompra =
    compra?.referencia ||
    null;

  const metodoPago =
    compra?.metodo_pago ||
    null;

  const estadoPago =
    compra?.estado_pago ||
    null;

  const fechaCompra =
    compra?.fecha_compra ||
    null;

  /* =======================================================
     ¿TENEMOS DATOS DEL USUARIO?
  ======================================================= */

  const tieneUsuario = Boolean(
    nombreParticipante ||
      emailParticipante ||
      telefonoParticipante ||
      instagramNormalizado
  );

  /* =======================================================
     ESTILO / ESTADO
  ======================================================= */

  const estadoKey =
    ganadorOficialActual
      ? "official"
      : esFree
      ? "free"
      : resultado?.existe
      ? "sold"
      : "empty";

  const titulo =
    ganadorOficialActual
      ? elegible ? "🏆 Número ganador oficial" : "Resultado oficial sin ganador confirmado"
      : esFree
      ? "🎁 Número FREE"
      : resultado?.existe
      ? "✅ Número vendido"
      : "❌ Número no vendido";

  const descripcion =
    ganadorOficialActual
      ? esFree
        ? "Este número FREE quedó registrado como ganador oficial de la rifa."
        : esPagado ? "Este número pagado quedó registrado como ganador oficial de la rifa." : "Resultado oficial sin participante ganador confirmado."
      : esFree
      ? "El número pertenece a una participación FREE y puede convertirse en ganador."
      : resultado?.existe
      ? "El número fue vendido y puede convertirse en ganador."
      : "No existe una compra ni participación FREE asociada a ese número.";

  const mensajeClase =
    ganadorOficialActual
      ? "adminpro-message-warn"
      : resultado?.existe
      ? "adminpro-message-success"
      : "adminpro-message-error";

  /* =======================================================
     COPIAR
  ======================================================= */

  const copiarDato = async (
    valor,
    etiqueta
  ) => {
    const ok =
      await copiarTextoSeguro(valor);

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

  const renderValorUsuario = (
    value
  ) =>
    value
      ? value
      : "No disponible";

  /* =======================================================
     ACCIONES
  ======================================================= */

  const mostrarEmpty =
    !resultado &&
    !ganadorOficialActual;

  const puedeGuardarGanador =
    estadoRifa === "cerrada" && (elegible || (resultado?.tipo === "disponible" && resultado?.existe === false)) &&
    !ganadorOficialActual &&
    !numeroGanadorGuardado &&
    onGuardar;

  const puedeQuitarGanador =
    ganadorOficialActual && resultado?.sorteo?.estado_entrega !== "entregado" &&
    onQuitar;

  /* =======================================================
     RENDER
  ======================================================= */

  if (esBloqueado) {
    const vence = resultado?.reserva_expira_at;
    return (
      <div className="adminpro-result-stack">
        <div className="adminpro-card adminpro-winner-card" style={{border:"1px solid #52525b", background:"#18181b", color:"#f4f4f5"}}>
          <div className="adminpro-winner-card-head">
            <div className="adminpro-winner-title-block">
              <div className="adminpro-winner-icon" style={{background:"#27272a"}}>🔒</div>
              <div><strong>{esReservado ? "RESERVADO" : "BLOQUEADO"}</strong><h3>{esReservado ? "Pendiente de aprobación" : "Asignación no confirmada"}</h3><p>Este número no está disponible ni es elegible como ganador confirmado.</p></div>
            </div>
            <div className="adminpro-winner-number-box"><span>Número consultado</span><strong>{numeroFormateado}</strong></div>
          </div>
          <div className="adminpro-winner-info-box">
            <div className="adminpro-winner-info-item"><span>Estado</span><strong>{esReservado ? "Reservado 🔒" : "Bloqueado"}</strong></div>
            <div className="adminpro-winner-info-item"><span>Pago confirmado</span><strong>No</strong></div>
            <div className="adminpro-winner-info-item"><span>Elegible como ganador</span><strong>No</strong></div>
            {vence && <div className="adminpro-winner-info-item"><span>Reserva hasta</span><strong>{formatearFecha?.(vence) || vence}</strong></div>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="adminpro-result-stack">
      {mensaje ? (
        <p className={mensajeClase}>
          {mensaje}
        </p>
      ) : null}

      {mostrarEmpty ? (
        /* =================================================
           VACÍO
        ================================================= */

        <div className="adminpro-card adminpro-winner-card adminpro-winner-empty-card">
          <div className="adminpro-winner-empty-emoji">
            🔎
          </div>

          <h3>Resultado del número</h3>

          <p>
            Busca un número para ver aquí su
            estado, los datos del comprador o
            de la participación FREE y las
            acciones disponibles.
          </p>

          <div className="adminpro-winner-empty-tip">
            <strong>Tip:</strong> cuando el
            número esté confirmado podrás
            registrarlo como ganador oficial o
            quitarlo si hace falta.
          </div>
        </div>
      ) : (
        /* =================================================
           RESULTADO
        ================================================= */

        <div
          className={`adminpro-card adminpro-winner-card adminpro-winner-${estadoKey}`}
        >
          {/* ===============================================
              CABECERA
          =============================================== */}

          <div className="adminpro-winner-card-head">
            <div className="adminpro-winner-title-block">
              <div
                className={`adminpro-winner-icon ${estadoKey}`}
              >
                {ganadorOficialActual
                  ? "🏆"
                  : esFree
                  ? "🎁"
                  : resultado?.existe
                  ? "✅"
                  : "❌"}
              </div>

              <div>
                <span
                  className={`adminpro-winner-badge ${estadoKey}`}
                >
                  {ganadorOficialActual
                    ? elegible ? "Ganador oficial" : "Resultado oficial"
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
                {ganadorOficialActual
                  ? "Número ganador"
                  : "Número consultado"}
              </span>

              <strong>
                {numeroFormateado}
              </strong>
            </div>
          </div>

          {/* ===============================================
              GANADOR DESTACADO
          =============================================== */}

          {ganadorOficialActual && (
            <div
              style={{
                margin: "0 0 16px",
                padding: "15px 16px",
                borderRadius: "16px",
                background:
                  "linear-gradient(135deg, rgba(245,158,11,.18), rgba(234,179,8,.08))",
                border:
                  "1px solid rgba(251,191,36,.42)",
                boxShadow:
                  "0 0 22px rgba(245,158,11,.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <strong
                  style={{
                    color: "#fbbf24",
                    fontSize: "14px",
                  }}
                >
                  {elegible ? "🏆 GANADOR DE ESTA RIFA" : "RESULTADO OFICIAL"}
                </strong>

                <span
                  style={{
                    padding: "5px 9px",
                    borderRadius: "999px",
                    background:
                      "rgba(245,158,11,.16)",
                    border:
                      "1px solid rgba(251,191,36,.30)",
                    color: "#fde68a",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  {esFree
                    ? "🎁 TICKET FREE"
                    : esPagado ? "🎟️ TICKET PAGADO" : "SIN PARTICIPANTE"}
                </span>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  color: "#fef3c7",
                  fontSize: "13px",
                }}
              >
                Número ganador oficial:{" "}
                <strong>
                  #{numeroFormateado}
                </strong>
              </div>
            </div>
          )}

          {/* ===============================================
              TIPO DE TICKET
          =============================================== */}

          {esFree && (
            <div
              style={{
                margin: "0 0 14px",
                padding: "12px 14px",
                borderRadius: "14px",
                background:
                  ganadorOficialActual
                    ? "rgba(245,158,11,.10)"
                    : "rgba(34,197,94,.10)",
                border:
                  ganadorOficialActual
                    ? "1px solid rgba(251,191,36,.30)"
                    : "1px solid rgba(34,197,94,.25)",
                color:
                  ganadorOficialActual
                    ? "#fde68a"
                    : "#bbf7d0",
                fontWeight: 700,
              }}
            >
              {ganadorOficialActual
                ? "🏆 Este número ganador proviene de una participación FREE"
                : "🎁 Este número proviene de una participación FREE"}
            </div>
          )}

          {esPagado && (
            <div
              style={{
                margin: "0 0 14px",
                padding: "12px 14px",
                borderRadius: "14px",
                background:
                  ganadorOficialActual
                    ? "rgba(245,158,11,.10)"
                    : "rgba(59,130,246,.09)",
                border:
                  ganadorOficialActual
                    ? "1px solid rgba(251,191,36,.30)"
                    : "1px solid rgba(59,130,246,.22)",
                color:
                  ganadorOficialActual
                    ? "#fde68a"
                    : "#bfdbfe",
                fontWeight: 700,
              }}
            >
              {ganadorOficialActual
                ? "🏆 Este número ganador pertenece a un ticket pagado"
                : "🎟️ Este número pertenece a un ticket pagado"}
            </div>
          )}

          {/* ===============================================
              INFORMACIÓN
          =============================================== */}

          <div className="adminpro-winner-info-grid">
            {/* =============================================
                COLUMNA IZQUIERDA
            ============================================= */}

            <div className="adminpro-winner-info-box">
              <div className="adminpro-winner-info-item">
                <span>Estado</span>

                <strong>
                  {ganadorOficialActual
                    ? elegible ? "Ganador oficial" : "Resultado oficial"
                    : esFree
                    ? "FREE asignado"
                    : resultado?.existe
                    ? "Vendido"
                    : "No vendido"}
                </strong>
              </div>

              <div className="adminpro-winner-info-item">
                <span>Tipo de ticket</span>

                <strong>
                  {esFree
                    ? "🎁 FREE"
                    : esPagado
                    ? "🎟️ Pagado"
                    : "Disponible"}
                </strong>
              </div>

              {/* ===========================================
                  COMPRA
              =========================================== */}

              {resultado?.compra_id && (
                <div className="adminpro-winner-info-item">
                  <span>Compra ID</span>

                  <strong
                    style={{
                      wordBreak: "break-word",
                    }}
                  >
                    {resultado.compra_id}
                  </strong>
                </div>
              )}

              {esPagado &&
                cantidadTicketsCompra !==
                  null && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Tickets de la compra
                    </span>

                    <strong>
                      {cantidadTicketsCompra}
                    </strong>
                  </div>
                )}

              {esPagado &&
                montoCompra !== null && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Monto de compra
                    </span>

                    <strong>
                      $
                      {Number(
                        montoCompra || 0
                      ).toFixed(2)}
                    </strong>
                  </div>
                )}

              {esPagado &&
                estadoPago && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Estado de compra
                    </span>

                    <strong>
                      {estadoPago}
                    </strong>
                  </div>
                )}

              {esPagado &&
                metodoPago && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Método de pago
                    </span>

                    <strong>
                      {metodoPago}
                    </strong>
                  </div>
                )}

              {esPagado &&
                referenciaCompra && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Referencia
                    </span>

                    <strong
                      style={{
                        wordBreak:
                          "break-word",
                      }}
                    >
                      {referenciaCompra}
                    </strong>
                  </div>
                )}

              {esPagado &&
                fechaCompra && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Fecha compra
                    </span>

                    <strong>
                      {formatearFecha?.(
                        fechaCompra
                      ) || fechaCompra}
                    </strong>
                  </div>
                )}

              {/* ===========================================
                  FREE
              =========================================== */}

              {esFree && (
                <>
                  <div className="adminpro-winner-info-item">
                    <span>
                      Free Drop
                    </span>

                    <strong>
                      {freeDropNombre
                        ? `${freeDropNombre}${
                            freeDropNumero !==
                              null &&
                            freeDropNumero !==
                              undefined
                              ? ` (#${freeDropNumero})`
                              : ""
                          }`
                        : "Sin free drop"}
                    </strong>
                  </div>

                  <div className="adminpro-winner-info-item">
                    <span>
                      Código FREE
                    </span>

                    <strong
                      style={{
                        wordBreak:
                          "break-word",
                      }}
                    >
                      {codigoFree ||
                        "Sin código"}
                    </strong>
                  </div>

                  <div className="adminpro-winner-info-item">
                    <span>
                      Participación FREE
                    </span>

                    <strong
                      style={{
                        wordBreak:
                          "break-word",
                      }}
                    >
                      {resultado
                        ?.participacion?.id ||
                        "Sin participación"}
                    </strong>
                  </div>

                  {resultado
                    ?.participacion
                    ?.estado_residencia && (
                    <div className="adminpro-winner-info-item">
                      <span>
                        Estado residencia
                      </span>

                      <strong>
                        {
                          resultado
                            .participacion
                            .estado_residencia
                        }
                      </strong>
                    </div>
                  )}

                  <div className="adminpro-winner-info-item">
                    <span>
                      Aceptó reglas
                    </span>

                    <strong>
                      {resultado
                        ?.participacion
                        ?.acepta_reglas
                        ? "Sí"
                        : "No"}
                    </strong>
                  </div>

                  <div className="adminpro-winner-info-item">
                    <span>
                      Cumple requisitos
                    </span>

                    <strong>
                      {resultado
                        ?.participacion
                        ?.cumple_requisitos
                        ? "Sí"
                        : "No"}
                    </strong>
                  </div>

                  {fechaParticipacion && (
                    <div className="adminpro-winner-info-item">
                      <span>
                        Fecha participación
                      </span>

                      <strong>
                        {formatearFecha?.(
                          fechaParticipacion
                        ) ||
                          fechaParticipacion}
                      </strong>
                    </div>
                  )}
                </>
              )}

              {/* ===========================================
                  SORTEO
              =========================================== */}

              {resultado?.sorteo
                ?.fecha_sorteo && (
                <div className="adminpro-winner-info-item">
                  <span>
                    Fecha sorteo
                  </span>

                  <strong>
                    {formatearFecha?.(
                      resultado.sorteo
                        .fecha_sorteo
                    ) ||
                      resultado.sorteo
                        .fecha_sorteo}
                  </strong>
                </div>
              )}

              {resultado?.sorteo?.fuente && (
                <div className="adminpro-winner-info-item">
                  <span>Fuente</span>

                  <strong>
                    {
                      resultado.sorteo
                        .fuente
                    }
                  </strong>
                </div>
              )}

              {ganadorOficialActual && (
                <div className="adminpro-winner-info-item">
                  <span>Guardado</span>

                  <strong>
                    En base de datos
                  </strong>
                </div>
              )}

              {!ganadorOficialActual &&
                numeroGanadorGuardado && (
                  <div className="adminpro-winner-info-item">
                    <span>
                      Ganador oficial actual
                    </span>

                    <strong>
                      {
                        numeroGanadorGuardado
                      }
                    </strong>
                  </div>
                )}
            </div>

            {/* =============================================
                COLUMNA DERECHA - USUARIO
            ============================================= */}

            <div className="adminpro-winner-info-box">
              {tieneUsuario ? (
                <>
                  <div className="adminpro-winner-user-card">
                    <div className="adminpro-winner-avatar">
                      {ganadorOficialActual
                        ? "🏆"
                        : String(
                            nombreParticipante ||
                              emailParticipante ||
                              "?"
                          )
                            .charAt(0)
                            .toUpperCase()}
                    </div>

                    <div className="adminpro-winner-user-main">
                      <strong>
                        {renderValorUsuario(
                          nombreParticipante
                        )}
                      </strong>

                      <p>
                        {renderValorUsuario(
                          emailParticipante
                        )}
                      </p>

                      <p>
                        {renderValorUsuario(
                          telefonoParticipante
                        )}
                      </p>

                      {esFree &&
                        instagramNormalizado && (
                          <p
                            style={{
                              marginTop:
                                "5px",
                            }}
                          >
                            📸{" "}
                            <a
                              href={
                                instagramUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color:
                                  "#f9a8d4",
                                fontWeight:
                                  700,
                                textDecoration:
                                  "none",
                              }}
                            >
                              {
                                instagramNormalizado
                              }
                            </a>
                          </p>
                        )}
                    </div>
                  </div>

                  {/* =======================================
                      BOTONES COPIAR
                  ======================================= */}

                  <div className="adminpro-winner-copy-row">
                    {nombreParticipante && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() =>
                          copiarDato(
                            nombreParticipante,
                            "Nombre"
                          )
                        }
                      >
                        📋 Nombre
                      </button>
                    )}

                    {emailParticipante && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() =>
                          copiarDato(
                            emailParticipante,
                            "Email"
                          )
                        }
                      >
                        📧 Email
                      </button>
                    )}

                    {telefonoParticipante && (
                      <button
                        type="button"
                        className="adminpro-winner-copy-btn"
                        onClick={() =>
                          copiarDato(
                            telefonoParticipante,
                            "Teléfono"
                          )
                        }
                      >
                        📞 Teléfono
                      </button>
                    )}

                    {esFree &&
                      instagramNormalizado && (
                        <button
                          type="button"
                          className="adminpro-winner-copy-btn"
                          onClick={() =>
                            copiarDato(
                              instagramNormalizado,
                              "Instagram"
                            )
                          }
                        >
                          📸 Instagram
                        </button>
                      )}

                    {esFree &&
                      codigoFree && (
                        <button
                          type="button"
                          className="adminpro-winner-copy-btn"
                          onClick={() =>
                            copiarDato(
                              codigoFree,
                              "Código FREE"
                            )
                          }
                        >
                          🏷️ Código FREE
                        </button>
                      )}
                  </div>

                  {/* =======================================
                      ABRIR INSTAGRAM
                  ======================================= */}

                  {esFree &&
                    instagramUrl && (
                      <div
                        style={{
                          marginTop:
                            "12px",
                        }}
                      >
                        <a
                          href={instagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="adminpro-soft-btn blue"
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            gap: "7px",
                            textDecoration:
                              "none",
                          }}
                        >
                          📸 Ver Instagram
                        </a>
                      </div>
                    )}
                </>
              ) : (
                <div className="adminpro-winner-empty-user">
                  <strong>
                    Usuario no disponible
                  </strong>

                  <p>
                    {ganadorOficialActual
                      ? "Resultado registrado; no hay datos de participante disponibles."
                      : esFree
                      ? "La participación FREE existe, pero no se pudieron cargar todos los datos del participante."
                      : resultado?.existe ? "No se pudieron cargar los datos del cliente." : "Este número no tiene un participante confirmado."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ===============================================
              ACCIONES
          =============================================== */}

          <div className="adminpro-winner-actions">
            {esFree && codigoFree && (
              <button
                type="button"
                className="adminpro-soft-btn blue adminpro-winner-main-btn"
                onClick={() =>
                  copiarDato(
                    codigoFree,
                    "Código FREE"
                  )
                }
              >
                <span className="btn-icon">
                  🏷️
                </span>

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
                <span className="btn-icon">
                  🏆
                </span>

                {guardando
                  ? "Registrando..."
                  : esFree
                  ? "Registrar FREE como ganador"
                  : elegible ? "Registrar ganador oficial" : "Registrar resultado sin ganador"}
              </button>
            )}

            {puedeQuitarGanador && (
              <button
                className="adminpro-soft-btn danger adminpro-winner-main-btn"
                onClick={onQuitar}
                disabled={
                  quitando ||
                  guardando
                }
                type="button"
              >
                <span className="btn-icon">
                  🗑️
                </span>

                {quitando
                  ? "Quitando..."
                  : "Quitar ganador oficial"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}