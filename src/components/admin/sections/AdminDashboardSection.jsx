"use client";

import { useMemo } from "react";

import HeroRifa from "../HeroRifa";
import KpiGrid from "../KpiGrid";
import PurchaseCard from "../PurchaseCard";

function normalizarTicketsUnicos(lista = []) {
  const seen = new Set();

  return (lista || [])
    .map((ticket) => {
      const numero = Number(ticket?.numero_ticket);
      if (!Number.isFinite(numero)) return null;

      return {
        ...ticket,
        numero_ticket: numero,
      };
    })
    .filter(Boolean)
    .filter((ticket) => {
      const key = String(ticket.numero_ticket);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        Number(a.numero_ticket) - Number(b.numero_ticket)
    );
}

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function esTicketFree(ticket = {}) {
  const tipo = normalizarTexto(ticket?.tipo);

  return Boolean(
    ticket?.es_free ||
      tipo === "free" ||
      ticket?.free_drop_id ||
      ticket?.free_drop_participation_id
  );
}

function esTicketOcupado(ticket = {}) {
  const estado = normalizarTexto(ticket?.estado);

  const tieneCompra =
    ticket?.compra_id !== null &&
    ticket?.compra_id !== undefined;

  const esFree = esTicketFree(ticket);

  return Boolean(
    ticket?.ocupado ||
      ticket?.vendido ||
      tieneCompra ||
      esFree ||
      estado === "asignado" ||
      estado === "vendido" ||
      estado === "ocupado" ||
      estado === "reservado"
  );
}

function formatearNombreFree(ticket = {}) {
  const participacion =
    ticket?.free_drop_participation ||
    ticket?.freeParticipation ||
    ticket?.participacion ||
    null;

  const nombre = String(
    ticket?.freeNombre ||
      participacion?.nombre ||
      ""
  ).trim();

  const apellido = String(
    participacion?.apellido || ""
  ).trim();

  const nombreCompleto = `${nombre} ${apellido}`.trim();

  return nombreCompleto || "Sin nombre";
}

function formatearFreeDrop(ticket = {}) {
  if (ticket?.freeDropNombre) {
    return ticket.freeDropNombre;
  }

  const drop =
    ticket?.free_drop ||
    ticket?.freeDrop ||
    ticket?.free_drops ||
    null;

  if (drop?.nombre) {
    return drop.nombre;
  }

  const numero = drop?.numero_drop;

  if (numero !== undefined && numero !== null) {
    return `FREE DROP #${numero}`;
  }

  return "FREE DROP";
}

function formatearCodigoFree(ticket = {}) {
  const participacion =
    ticket?.free_drop_participation ||
    ticket?.freeParticipation ||
    ticket?.participacion ||
    null;

  return (
    ticket?.codigoFree ||
    participacion?.codigo_unico ||
    participacion?.codigo_free ||
    ticket?.codigo_free ||
    ticket?.codigo_unico ||
    ticket?.codigo ||
    "Sin código"
  );
}

export default function AdminDashboardSection({
  dashboardRef,
  dashboardFilterRef,
  comprasSectionRef,
  ganadorRef,
  rankingRef,
  premioRef,
  rifaSeleccionada,
  padLength,
  formatearFecha,
  comprasFiltradasPorRifa,
  ticketsFiltradosPorRifa,
  showSecondImage,
  setSeccionActiva,
  scrollToRef,
  abrirFiltroDashboard,
  filtroDashboard,
  setFiltroDashboard,
  ticketsPorCompra,
  aprobarCompra,
  abrirAprobacionManual,
  rechazarCompra,
  eliminarCompra,
  loadingAprobacion,
  loadingRechazo,
  loadingEliminacion,
  numeroGanadorOficial,
  dashboardCompactSummary,
}) {
  const estadoNormalizado = (valor) =>
    String(valor || "").toLowerCase().trim();

  const comprasAprobadas =
    comprasFiltradasPorRifa.filter((compra) =>
      ["aprobado", "aprobada"].includes(
        estadoNormalizado(compra.estado_pago)
      )
    );

  const comprasPorFiltro = {
    total: comprasFiltradasPorRifa,

    pendientes: comprasFiltradasPorRifa.filter(
      (compra) =>
        estadoNormalizado(compra.estado_pago) ===
        "pendiente"
    ),

    aprobadas: comprasAprobadas,

    rechazadas: comprasFiltradasPorRifa.filter(
      (compra) =>
        estadoNormalizado(compra.estado_pago) ===
        "rechazado"
    ),
  };

  /*
   * Números realmente ocupados.
   *
   * Incluye:
   * - tickets de compras;
   * - tickets FREE;
   * - tickets reservados/asignados/ocupados.
   *
   * Un FREE nunca debe aparecer como disponible.
   */
  const ticketsVendidosUnicos = useMemo(() => {
    return normalizarTicketsUnicos(
      ticketsFiltradosPorRifa
    ).filter(esTicketOcupado);
  }, [ticketsFiltradosPorRifa]);

  const resumenRifa =
    dashboardCompactSummary || {};

  const totalTickets = Number(
    resumenRifa.totalTickets ??
      rifaSeleccionada?.total_numeros ??
      rifaSeleccionada?.cantidad_numeros ??
      ticketsVendidosUnicos.length ??
      0
  );

  /*
   * Conservamos el nombre ticketsVendidos por
   * compatibilidad con los componentes existentes.
   *
   * En el progreso representa números OCUPADOS:
   * pagados + FREE.
   */
  const ticketsVendidos = Number(
    resumenRifa.ticketsVendidos ??
      rifaSeleccionada?.tickets_ocupados ??
      rifaSeleccionada?.tickets_vendidos ??
      rifaSeleccionada?.stats?.ocupados ??
      rifaSeleccionada?.stats?.vendidos ??
      ticketsVendidosUnicos.length ??
      0
  );

  const ticketsDisponibles = Number(
    resumenRifa.disponibles ??
      rifaSeleccionada?.tickets_disponibles ??
      Math.max(
        totalTickets - ticketsVendidos,
        0
      )
  );

  const porcentajeVendido = Number(
    resumenRifa.porcentajeVendido ??
      rifaSeleccionada?.porcentaje_vendido ??
      rifaSeleccionada?.stats?.porcentaje ??
      (totalTickets > 0
        ? Number(
            (
              (ticketsVendidos / totalTickets) *
              100
            ).toFixed(2)
          )
        : 0)
  );

  const titulosFiltro = {
    total: "Todas las compras de la rifa",
    pendientes:
      "Compras pendientes de la rifa",
    aprobadas:
      "Compras aprobadas de la rifa",
    rechazadas:
      "Compras rechazadas de la rifa",
    tickets:
      "Tickets ocupados de la rifa",
  };

  return (
    <>
      {rifaSeleccionada && (
        <>
          <div ref={premioRef}>
            <HeroRifa
              rifaSeleccionada={
                rifaSeleccionada
              }
              padLength={padLength}
              formatearFecha={
                formatearFecha
              }
              totalCompras={
                comprasFiltradasPorRifa.length
              }
              totalTicketsVendidos={
                ticketsVendidos
              }
              totalComprasAprobadas={
                comprasAprobadas.length
              }
              showSecondImage={
                showSecondImage
              }
              onIrCompras={() => {
                setSeccionActiva("compras");

                scrollToRef(
                  comprasSectionRef,
                  180
                );
              }}
              onIrGanador={() => {
                setSeccionActiva("ganador");

                scrollToRef(
                  ganadorRef,
                  180
                );
              }}
              onIrRanking={() => {
                setSeccionActiva("ranking");

                scrollToRef(
                  rankingRef,
                  180
                );
              }}
            />
          </div>

          <KpiGrid
            compras={
              comprasFiltradasPorRifa
            }
            tickets={
              ticketsVendidosUnicos
            }
            ticketsVendidos={
              ticketsVendidos
            }
            onCardClick={
              abrirFiltroDashboard
            }
          />
        </>
      )}

      <div
        className="adminpro-page-stack"
        ref={dashboardRef}
      >
        <div ref={dashboardFilterRef}>
          {filtroDashboard && (
            <div className="adminpro-card">
              <div className="adminpro-section-head">
                <div>
                  <h2>
                    {titulosFiltro[
                      filtroDashboard
                    ] ||
                      "Detalle de la rifa"}
                  </h2>

                  <p>
                    Detalle filtrado de la
                    rifa seleccionada
                  </p>
                </div>

                <button
                  className="adminpro-soft-btn dark"
                  onClick={() =>
                    setFiltroDashboard(null)
                  }
                  type="button"
                >
                  Cerrar
                </button>
              </div>

              {filtroDashboard !==
              "tickets" ? (
                comprasPorFiltro[
                  filtroDashboard
                ]?.length > 0 ? (
                  <div className="adminpro-compras-grid">
                    {comprasPorFiltro[
                      filtroDashboard
                    ].map((compra) => (
                      <PurchaseCard
                        key={compra.id}
                        compra={compra}
                        ticketsAsignados={
                          ticketsPorCompra[
                            String(
                              compra.id
                            )
                          ] || []
                        }
                        onAprobar={
                          aprobarCompra
                        }
                        onAprobarManual={
                          abrirAprobacionManual
                        }
                        onRechazar={
                          rechazarCompra
                        }
                        onEliminar={
                          eliminarCompra
                        }
                        loadingAprobacion={
                          loadingAprobacion
                        }
                        loadingRechazo={
                          loadingRechazo
                        }
                        loadingEliminacion={
                          loadingEliminacion
                        }
                        mostrarEliminar={
                          estadoNormalizado(
                            compra.estado_pago
                          ) ===
                          "rechazado"
                        }
                        formatearFecha={
                          formatearFecha
                        }
                        numeroGanadorOficial={
                          numeroGanadorOficial
                        }
                        padLength={
                          padLength
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <p>
                    No hay registros para
                    mostrar.
                  </p>
                )
              ) : ticketsVendidosUnicos.length >
                0 ? (
                <div className="adminpro-compras-grid">
                  {ticketsVendidosUnicos.map(
                    (ticket) => {
                      const esFree =
                        esTicketFree(ticket);

                      const numeroFormateado =
                        String(
                          ticket.numero_ticket
                        ).padStart(
                          padLength,
                          "0"
                        );

                      const codigoFree =
                        formatearCodigoFree(
                          ticket
                        );

                      const freeDropNombre =
                        formatearFreeDrop(
                          ticket
                        );

                      const nombreFree =
                        formatearNombreFree(
                          ticket
                        );

                      const compra =
                        ticket.compra || null;

                      const nombreCompra =
                        compra?.usuarios
                          ?.nombre ||
                        compra?.usuarios
                          ?.email ||
                        ticket?.asignado_a_nombre ||
                        "Sin nombre";

                      const emailCompra =
                        compra?.usuarios
                          ?.email ||
                        ticket?.asignado_a_email ||
                        "Sin email";

                      const telefonoCompra =
                        compra?.usuarios
                          ?.telefono ||
                        ticket?.asignado_a_telefono ||
                        "Sin teléfono";

                      const participacionFree =
                        ticket?.free_drop_participation ||
                        ticket?.freeParticipation ||
                        ticket?.participacion ||
                        null;

                      return (
                        <div
                          key={
                            ticket.id ||
                            `${ticket.rifa_id}-${ticket.numero_ticket}`
                          }
                          className={`adminpro-purchase-card ${
                            esFree
                              ? "free-ticket"
                              : ""
                          }`}
                          style={{
                            border: esFree
                              ? "1px solid rgba(34,197,94,.35)"
                              : undefined,

                            background:
                              esFree
                                ? "linear-gradient(180deg, rgba(22,163,74,.12), rgba(15,23,42,.92))"
                                : undefined,
                          }}
                        >
                          <div className="adminpro-purchase-head">
                            <div>
                              <h3>
                                {esFree
                                  ? `FREE • Nº ${numeroFormateado}`
                                  : `Ticket #${ticket.id}`}
                              </h3>

                              <p>
                                {esFree
                                  ? "Participación gratis registrada en la rifa actual"
                                  : "Registrado en la rifa actual"}
                              </p>
                            </div>

                            <div
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                padding:
                                  "6px 10px",
                                borderRadius:
                                  "999px",
                                fontSize:
                                  "12px",
                                fontWeight: 800,

                                background:
                                  esFree
                                    ? "rgba(34,197,94,.18)"
                                    : "rgba(59,130,246,.18)",

                                color:
                                  esFree
                                    ? "#bbf7d0"
                                    : "#bfdbfe",

                                border:
                                  esFree
                                    ? "1px solid rgba(34,197,94,.35)"
                                    : "1px solid rgba(59,130,246,.25)",
                              }}
                            >
                              {esFree
                                ? "FREE"
                                : "OCUPADO"}
                            </div>
                          </div>

                          <div className="adminpro-purchase-body">
                            <p>
                              <strong>
                                Número:
                              </strong>{" "}
                              {
                                numeroFormateado
                              }
                            </p>

                            <p>
                              <strong>
                                Estado:
                              </strong>{" "}
                              {esFree
                                ? ticket.estado ||
                                  "FREE"
                                : ticket.estado ||
                                  "asignado"}
                            </p>

                            {!esFree ? (
                              <>
                                <p>
                                  <strong>
                                    Compra ID:
                                  </strong>{" "}
                                  {
                                    ticket.compra_id
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Rifa ID:
                                  </strong>{" "}
                                  {
                                    ticket.rifa_id
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Cliente:
                                  </strong>{" "}
                                  {
                                    nombreCompra
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Email:
                                  </strong>{" "}
                                  {
                                    emailCompra
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Teléfono:
                                  </strong>{" "}
                                  {
                                    telefonoCompra
                                  }
                                </p>
                              </>
                            ) : (
                              <>
                                <p>
                                  <strong>
                                    Free Drop:
                                  </strong>{" "}
                                  {
                                    freeDropNombre
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Participante:
                                  </strong>{" "}
                                  {
                                    nombreFree
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Email:
                                  </strong>{" "}
                                  {ticket
                                    .freeEmail ||
                                    participacionFree
                                      ?.email ||
                                    ticket.asignado_a_email ||
                                    "Sin email"}
                                </p>

                                <p>
                                  <strong>
                                    Teléfono:
                                  </strong>{" "}
                                  {ticket
                                    .freeTelefono ||
                                    participacionFree
                                      ?.telefono ||
                                    ticket.asignado_a_telefono ||
                                    "Sin teléfono"}
                                </p>

                                <p
                                  style={{
                                    wordBreak:
                                      "break-word",
                                  }}
                                >
                                  <strong>
                                    Código FREE:
                                  </strong>{" "}
                                  {codigoFree}
                                </p>

                                <p>
                                  <strong>
                                    Participación
                                    FREE:
                                  </strong>{" "}
                                  {participacionFree
                                    ?.id ||
                                    ticket.free_drop_participation_id ||
                                    "Sin participación"}
                                </p>

                                <p>
                                  <strong>
                                    Estado
                                    residencia:
                                  </strong>{" "}
                                  {participacionFree
                                    ?.estado_residencia ||
                                    "Sin dato"}
                                </p>

                                <p>
                                  <strong>
                                    Asignado:
                                  </strong>{" "}
                                  {formatearFecha(
                                    ticket.asignado_at ||
                                      ticket.fecha_asignacion ||
                                      participacionFree
                                        ?.created_at
                                  )}
                                </p>
                              </>
                            )}

                            <p>
                              <strong>
                                Rifa ID:
                              </strong>{" "}
                              {ticket.rifa_id}
                            </p>

                            {esFree && (
                              <p>
                                <strong>
                                  Tipo:
                                </strong>{" "}
                                Participación
                                gratis
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <p>
                  No hay tickets ocupados
                  todavía.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="adminpro-top-info"
        style={{ display: "none" }}
      >
        {ticketsDisponibles}{" "}
        {porcentajeVendido}
      </div>
    </>
  );
}