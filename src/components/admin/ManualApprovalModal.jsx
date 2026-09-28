"use client";

import { useEffect, useMemo } from "react";
import { Trophy, CheckCircle2 } from "lucide-react";

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function esTicketFree(ticket = {}) {
  return Boolean(
    ticket?.free_drop_id ||
      ticket?.free_drop_participation_id ||
      normalizarTexto(ticket?.tipo) === "free"
  );
}

function esTicketDisponible(ticket = {}) {
  const sinCompra =
    ticket?.compra_id === null ||
    ticket?.compra_id === undefined;

  const sinFreeDrop =
    ticket?.free_drop_id === null ||
    ticket?.free_drop_id === undefined;

  const sinParticipacionFree =
    ticket?.free_drop_participation_id === null ||
    ticket?.free_drop_participation_id === undefined;

  const tipo = normalizarTexto(ticket?.tipo);
  const estado = normalizarTexto(ticket?.estado);

  return (
    sinCompra &&
    sinFreeDrop &&
    sinParticipacionFree &&
    tipo !== "free" &&
    estado === "disponible"
  );
}

function esTicketOcupado(ticket = {}) {
  /*
   * Para el selector manual tratamos como ocupado
   * cualquier ticket que no sea realmente disponible.
   *
   * Esto incluye:
   * - compras normales
   * - FREE DROP
   * - reservados
   * - asignados
   * - vendidos
   * - ocupados
   */
  return !esTicketDisponible(ticket);
}

export default function ManualApprovalModal({
  open,
  onClose,
  compra,
  rifaSeleccionada,
  ticketsVendidos = [],
  seleccionados,
  setSeleccionados,
  onConfirmar,
  loading,
  preselectedNumber,
  formatearFecha,
}) {
  const padLength =
    rifaSeleccionada?.formato === "3digitos" ? 3 : 4;

  /*
   * =====================================================
   * MAPA DE TICKETS
   * =====================================================
   *
   * Nos permite saber qué registro corresponde
   * a cada número.
   */
  const ticketsPorNumero = useMemo(() => {
    const map = new Map();

    const lista = Array.isArray(ticketsVendidos)
      ? ticketsVendidos
      : [];

    lista.forEach((ticket) => {
      const numero = Number(ticket?.numero_ticket);

      if (!Number.isNaN(numero)) {
        map.set(numero, ticket);
      }
    });

    return map;
  }, [ticketsVendidos]);

  /*
   * =====================================================
   * TICKETS OCUPADOS
   * =====================================================
   *
   * Antes solamente se comprobaba compra_id.
   *
   * Ahora también protegemos:
   *
   * free_drop_id
   * free_drop_participation_id
   * tipo = free
   * estado != disponible
   */
  const ocupadosSet = useMemo(() => {
    const set = new Set();

    const lista = Array.isArray(ticketsVendidos)
      ? ticketsVendidos
      : [];

    lista
      .filter(esTicketOcupado)
      .forEach((ticket) => {
        const numero = Number(ticket?.numero_ticket);

        if (!Number.isNaN(numero)) {
          set.add(numero);
        }
      });

    return set;
  }, [ticketsVendidos]);

  /*
   * FREE DROP separado.
   *
   * Esto nos permite distinguir visualmente
   * entre un ticket vendido y un FREE.
   */
  const freeSet = useMemo(() => {
    const set = new Set();

    const lista = Array.isArray(ticketsVendidos)
      ? ticketsVendidos
      : [];

    lista
      .filter(esTicketFree)
      .forEach((ticket) => {
        const numero = Number(ticket?.numero_ticket);

        if (!Number.isNaN(numero)) {
          set.add(numero);
        }
      });

    return set;
  }, [ticketsVendidos]);

  /*
   * Compras normales.
   */
  const vendidosSet = useMemo(() => {
    const set = new Set();

    const lista = Array.isArray(ticketsVendidos)
      ? ticketsVendidos
      : [];

    lista
      .filter(
        (ticket) =>
          ticket?.compra_id !== null &&
          ticket?.compra_id !== undefined
      )
      .forEach((ticket) => {
        const numero = Number(ticket?.numero_ticket);

        if (!Number.isNaN(numero)) {
          set.add(numero);
        }
      });

    return set;
  }, [ticketsVendidos]);

  /*
   * =====================================================
   * GANADOR OFICIAL
   * =====================================================
   */
  const numeroGanadorOficial = useMemo(() => {
    if (!rifaSeleccionada) return null;

    const valor =
      rifaSeleccionada?.numero_ganador ??
      rifaSeleccionada?.sorteo?.numero_ganador ??
      null;

    if (
      valor === null ||
      valor === undefined ||
      valor === ""
    ) {
      return null;
    }

    const numero = Number(valor);

    return Number.isNaN(numero)
      ? null
      : numero;
  }, [rifaSeleccionada]);

  /*
   * =====================================================
   * RANGO
   * =====================================================
   */
  const numeroInicio = useMemo(() => {
    if (!rifaSeleccionada) return 0;

    if (
      rifaSeleccionada.numero_inicio !== undefined &&
      rifaSeleccionada.numero_inicio !== null
    ) {
      return Number(rifaSeleccionada.numero_inicio);
    }

    return 0;
  }, [rifaSeleccionada]);

  const numeroFin = useMemo(() => {
    if (!rifaSeleccionada) return 0;

    if (
      rifaSeleccionada.numero_fin !== undefined &&
      rifaSeleccionada.numero_fin !== null
    ) {
      return Number(rifaSeleccionada.numero_fin);
    }

    return rifaSeleccionada.formato === "3digitos"
      ? 999
      : 9999;
  }, [rifaSeleccionada]);

  const numeros = useMemo(() => {
    if (!rifaSeleccionada) return [];

    const arr = [];

    for (
      let i = numeroInicio;
      i <= numeroFin;
      i++
    ) {
      arr.push(i);
    }

    return arr;
  }, [
    rifaSeleccionada,
    numeroInicio,
    numeroFin,
  ]);

  /*
   * =====================================================
   * PRESELECCIÓN
   * =====================================================
   *
   * Si el número viene desde otra parte del admin,
   * comprobamos primero que NO esté ocupado.
   */
  useEffect(() => {
    if (!open) return;

    if (
      preselectedNumber === null ||
      preselectedNumber === undefined
    ) {
      return;
    }

    const numero = Number(preselectedNumber);

    if (Number.isNaN(numero)) {
      return;
    }

    /*
     * Nunca preseleccionar:
     *
     * - vendido
     * - FREE
     * - reservado
     * - asignado
     * - cualquier otro ocupado
     */
    if (ocupadosSet.has(numero)) {
      return;
    }

    if (
      numeroGanadorOficial !== null &&
      numero === numeroGanadorOficial
    ) {
      return;
    }

    setSeleccionados((prev) => {
      if (prev.includes(numero)) {
        return prev;
      }

      const maxSeleccion =
        Number(compra?.cantidad_tickets) || 0;

      if (
        prev.length >= maxSeleccion
      ) {
        return prev;
      }

      return [...prev, numero].sort(
        (a, b) => a - b
      );
    });
  }, [
    open,
    preselectedNumber,
    ocupadosSet,
    setSeleccionados,
    compra,
    numeroGanadorOficial,
  ]);

  /*
   * Si el modal se abre y por cualquier motivo
   * había un número seleccionado que ahora está
   * ocupado, lo quitamos.
   */
  useEffect(() => {
    if (!open) return;

    setSeleccionados((prev) =>
      prev.filter(
        (numero) =>
          !ocupadosSet.has(Number(numero))
      )
    );
  }, [
    open,
    ocupadosSet,
    setSeleccionados,
  ]);

  if (
    !open ||
    !compra ||
    !rifaSeleccionada
  ) {
    return null;
  }

  const maxSeleccion =
    Number(compra.cantidad_tickets) || 0;

  const faltan =
    maxSeleccion -
    seleccionados.length;

  /*
   * =====================================================
   * SELECCIONAR NÚMERO
   * =====================================================
   */
  const toggleNumero = (numero) => {
    /*
     * Primera defensa visual.
     */
    if (ocupadosSet.has(numero)) {
      return;
    }

    /*
     * El ganador oficial tampoco se modifica.
     */
    if (
      numeroGanadorOficial !== null &&
      numero === numeroGanadorOficial
    ) {
      return;
    }

    setSeleccionados((prev) => {
      const existe =
        prev.includes(numero);

      if (existe) {
        return prev.filter(
          (n) => n !== numero
        );
      }

      if (
        prev.length >= maxSeleccion
      ) {
        return prev;
      }

      return [
        ...prev,
        numero,
      ].sort(
        (a, b) => a - b
      );
    });
  };

  return (
    <div
      className="adminpro-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="adminpro-modal premium-manual-modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="manual-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>
              Aprobación manual
            </h2>

            <p
              style={{
                marginTop: "8px",
                color: "#64748b",
              }}
            >
              Selecciona exactamente{" "}
              {maxSeleccion} ticket(s) para esta
              compra
            </p>
          </div>

          <button
            className="adminpro-soft-btn dark"
            onClick={onClose}
            type="button"
            disabled={loading}
          >
            Cerrar
          </button>
        </div>

        <div className="manual-modal-body">
          <div className="adminpro-manual-topbar">
            <div className="adminpro-manual-pill">
              <strong>
                Compra ID:
              </strong>{" "}
              {compra.id}
            </div>

            <div className="adminpro-manual-pill">
              <strong>
                Seleccionados:
              </strong>{" "}
              {seleccionados.length}/
              {maxSeleccion}
            </div>

            <div className="adminpro-manual-pill warn">
              <strong>
                Faltan:
              </strong>{" "}
              {faltan}
            </div>

            {numeroGanadorOficial !== null && (
              <div className="adminpro-manual-pill gold">
                <Trophy size={14} />

                Ganador:{" "}
                {String(
                  numeroGanadorOficial
                ).padStart(
                  padLength,
                  "0"
                )}
              </div>
            )}
          </div>

          <div className="adminpro-manual-info-grid">
            <div className="adminpro-manual-info-box">
              <p>
                <strong>
                  Usuario:
                </strong>{" "}
                {compra.usuarios?.nombre ||
                  "Sin nombre"}
              </p>

              <p>
                <strong>
                  Email:
                </strong>{" "}
                {compra.usuarios?.email ||
                  "Sin email"}
              </p>

              <p>
                <strong>
                  Teléfono:
                </strong>{" "}
                {compra.usuarios?.telefono ||
                  "Sin teléfono"}
              </p>
            </div>

            <div className="adminpro-manual-info-box">
              <p>
                <strong>
                  Referencia:
                </strong>{" "}
                {compra.referencia ||
                  "Sin referencia"}
              </p>

              <p>
                <strong>
                  Método:
                </strong>{" "}
                {compra.metodo_pago ||
                  "Sin método"}
              </p>

              <p>
                <strong>
                  Fecha:
                </strong>{" "}
                {formatearFecha?.(
                  compra.fecha_compra ||
                    compra.created_at
                ) ||
                  compra.fecha_compra ||
                  compra.created_at ||
                  "Sin fecha"}
              </p>
            </div>

            <div className="adminpro-manual-info-box highlight">
              <p>
                <strong>
                  Tickets a asignar:
                </strong>{" "}
                {compra.cantidad_tickets}
              </p>

              <p>
                <strong>
                  Rifa:
                </strong>{" "}
                {rifaSeleccionada.nombre}
              </p>

              <p>
                <strong>
                  Formato:
                </strong>{" "}
                {rifaSeleccionada.formato}
              </p>
            </div>
          </div>

          <div className="adminpro-legend">
            <div>
              <span className="legend-box sold" />{" "}
              Vendido
            </div>

            <div>
              <span className="legend-box free" />{" "}
              Disponible
            </div>

            <div>
              <span className="legend-box selected" />{" "}
              Seleccionado
            </div>

            <div>
              <span className="legend-box winner" />{" "}
              Ganador oficial
            </div>

            <div>
              <span
                className="legend-box sold"
                style={{
                  opacity: 0.7,
                }}
              />{" "}
              FREE DROP / Ocupado
            </div>
          </div>

          <div className="manual-grid-block">
            <div className="adminpro-manual-grid-wrap">
              <div className="adminpro-manual-grid">
                {numeros.map(
                  (numero) => {
                    const ticket =
                      ticketsPorNumero.get(
                        numero
                      );

                    const esFree =
                      freeSet.has(
                        numero
                      );

                    const vendido =
                      vendidosSet.has(
                        numero
                      );

                    const ocupado =
                      ocupadosSet.has(
                        numero
                      );

                    const seleccionado =
                      seleccionados.includes(
                        numero
                      );

                    const esGanador =
                      numeroGanadorOficial !==
                        null &&
                      numero ===
                        numeroGanadorOficial;

                    let className =
                      "free";

                    if (esGanador) {
                      className =
                        "winner";
                    } else if (
                      ocupado
                    ) {
                      className =
                        "sold";
                    } else if (
                      seleccionado
                    ) {
                      className =
                        "selected";
                    }

                    let titulo =
                      "Disponible";

                    if (esFree) {
                      titulo =
                        "FREE DROP - No disponible para compra";
                    } else if (
                      vendido
                    ) {
                      titulo =
                        "Vendido";
                    } else if (
                      ocupado
                    ) {
                      titulo =
                        `Ocupado${
                          ticket?.estado
                            ? ` - ${ticket.estado}`
                            : ""
                        }`;
                    } else if (
                      esGanador
                    ) {
                      titulo =
                        "Ganador oficial";
                    } else if (
                      seleccionado
                    ) {
                      titulo =
                        "Seleccionado";
                    }

                    return (
                      <button
                        key={
                          numero
                        }
                        type="button"
                        disabled={
                          ocupado ||
                          esGanador
                        }
                        onClick={() =>
                          toggleNumero(
                            numero
                          )
                        }
                        className={`adminpro-manual-ticket ${className}`}
                        title={
                          titulo
                        }
                        aria-label={`${String(
                          numero
                        ).padStart(
                          padLength,
                          "0"
                        )} - ${titulo}`}
                      >
                        {String(
                          numero
                        ).padStart(
                          padLength,
                          "0"
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <div className="manual-selected-box">
            <strong>
              Tickets seleccionados:
            </strong>

            {seleccionados.length >
            0 ? (
              <div className="adminpro-ticket-chips">
                {seleccionados.map(
                  (numero) => (
                    <span
                      key={
                        numero
                      }
                    >
                      {String(
                        numero
                      ).padStart(
                        padLength,
                        "0"
                      )}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p
                className="adminpro-muted"
                style={{
                  marginTop:
                    "8px",
                }}
              >
                No has seleccionado
                tickets todavía
              </p>
            )}
          </div>
        </div>

        <div className="manual-modal-footer">
          <button
            className="adminpro-primary-btn"
            onClick={onConfirmar}
            disabled={
              seleccionados.length !==
                maxSeleccion ||
              loading
            }
            type="button"
          >
            <CheckCircle2
              size={16}
            />

            {loading
              ? "Aprobando..."
              : "Confirmar asignación"}
          </button>

          <button
            className="adminpro-soft-btn dark"
            onClick={() =>
              setSeleccionados([])
            }
            type="button"
            disabled={loading}
          >
            Limpiar selección
          </button>
        </div>
      </div>
    </div>
  );
}