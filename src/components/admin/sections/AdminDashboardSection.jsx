"use client";

import { useEffect, useMemo, useState } from "react";

import HeroRifa from "../HeroRifa";

import KpiGrid from "../KpiGrid";

import PurchaseCard from "../PurchaseCard";
import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";

function normalizarTexto(valor) {

  return String(valor ?? "").trim().toLowerCase();

}

function normalizarTicketsUnicos(lista = []) {

  const seen = new Set();

  return (lista || [])

    .map((ticket) => {

      const numero = Number(ticket?.numero_ticket);

      if (!Number.isFinite(numero)) {

        return null;

      }

      return {

        ...ticket,

        numero_ticket: numero,

      };

    })

    .filter(Boolean)

    .filter((ticket) => {

      const key = String(ticket.numero_ticket);

      if (seen.has(key)) {

        return false;

      }

      seen.add(key);

      return true;

    })

    .sort(

      (a, b) =>

        Number(a.numero_ticket) -

        Number(b.numero_ticket)

    );

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

function esTicketPagado(ticket = {}) {

  const tieneCompra =

    ticket?.compra_id !== null &&

    ticket?.compra_id !== undefined;

  return tieneCompra && !esTicketFree(ticket);

}

function esTicketOcupado(ticket = {}) {

  const estado = normalizarTexto(ticket?.estado);

  const tieneCompra =

    ticket?.compra_id !== null &&

    ticket?.compra_id !== undefined;

  return Boolean(

    ticket?.ocupado ||

      ticket?.vendido ||

      tieneCompra ||

      esTicketFree(ticket) ||

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

  const nombreCompleto =

    `${nombre} ${apellido}`.trim();

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

function obtenerParticipacionFree(ticket = {}) {

  return (

    ticket?.free_drop_participation ||

    ticket?.freeParticipation ||

    ticket?.participacion ||

    null

  );

}

function obtenerCompra(ticket = {}) {

  return ticket?.compra || null;

}

function obtenerNombreCompra(ticket = {}) {

  const compra = obtenerCompra(ticket);

  return (

    compra?.usuarios?.nombre ||

    compra?.usuario?.nombre ||

    ticket?.asignado_a_nombre ||

    "Sin nombre"

  );

}

function obtenerEmailCompra(ticket = {}) {

  const compra = obtenerCompra(ticket);

  return (

    compra?.usuarios?.email ||

    compra?.usuario?.email ||

    ticket?.asignado_a_email ||

    "Sin email"

  );

}

function obtenerTelefonoCompra(ticket = {}) {

  const compra = obtenerCompra(ticket);

  return (

    compra?.usuarios?.telefono ||

    compra?.usuario?.telefono ||

    ticket?.asignado_a_telefono ||

    "Sin teléfono"

  );

}

function obtenerMontoCompra(compra = {}) {

  const monto = Number(

    compra?.monto_total ??

      compra?.total ??

      0

  );

  return Number.isFinite(monto) ? monto : 0;

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

  const [busquedaNumero, setBusquedaNumero] =

    useState("");

  const [tipoTicket, setTipoTicket] =

    useState("todos");

  const [participacionesFreeDashboard, setParticipacionesFreeDashboard] =
    useState([]);

  useEffect(() => {
    const rifaId = rifaSeleccionada?.id;

    const necesitaDetallesFree =
  filtroDashboard === "free" ||
  (filtroDashboard === "tickets" && tipoTicket === "free");

if (!necesitaDetallesFree) {
  setParticipacionesFreeDashboard([]);
  return;
}

    if (!rifaId) {
      setParticipacionesFreeDashboard([]);
      return;
    }

    const controller = new AbortController();

    async function cargarParticipacionesFreeDashboard() {
      try {
        const headers = await getAdminAuthHeaders();

        const response = await fetch(
          `/api/admin-free-drop-participations?rifaId=${encodeURIComponent(rifaId)}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.error || `No se pudieron cargar los datos FREE (${response.status})`
          );
        }

        if (!controller.signal.aborted) {
          setParticipacionesFreeDashboard(
            Array.isArray(data?.participaciones) ? data.participaciones : []
          );
        }
      } catch (error) {
        if (error?.name === "AbortError") return;

        console.error(
          "Error cargando participaciones FREE para el dashboard:",
          error
        );

        if (!controller.signal.aborted) {
          setParticipacionesFreeDashboard([]);
        }
      }
    }

    cargarParticipacionesFreeDashboard();

    return () => controller.abort();
  }, [rifaSeleccionada?.id, filtroDashboard, tipoTicket]);

  const estadoNormalizado = (valor) =>

    String(valor || "").toLowerCase().trim();

  const comprasAprobadas =

    comprasFiltradasPorRifa.filter((compra) =>

      ["aprobado", "aprobada"].includes(

        estadoNormalizado(compra.estado_pago)

      )

    );

  const comprasPendientes =

    comprasFiltradasPorRifa.filter(

      (compra) =>

        estadoNormalizado(compra.estado_pago) ===

        "pendiente"

    );

  const comprasRechazadas =

    comprasFiltradasPorRifa.filter(

      (compra) =>

        estadoNormalizado(compra.estado_pago) ===

        "rechazado"

    );

  const comprasPorFiltro = {

    total: comprasFiltradasPorRifa,

    pendientes: comprasPendientes,

    aprobadas: comprasAprobadas,

    rechazadas: comprasRechazadas,

    monto: comprasAprobadas,

  };

  const comprasPorId = useMemo(() => {

  const mapa = new Map();

  (comprasFiltradasPorRifa || []).forEach((compra) => {

    if (

      compra?.id !== null &&

      compra?.id !== undefined

    ) {

      mapa.set(String(compra.id), compra);

    }

  });

  return mapa;

}, [comprasFiltradasPorRifa]);

  const participacionesFreePorId = useMemo(() => {
    const mapa = new Map();

    (participacionesFreeDashboard || []).forEach((participacion) => {
      if (participacion?.id !== null && participacion?.id !== undefined) {
        mapa.set(String(participacion.id), participacion);
      }
    });

    return mapa;
  }, [participacionesFreeDashboard]);

  const participacionesFreePorTicketId = useMemo(() => {
    const mapa = new Map();

    (participacionesFreeDashboard || []).forEach((participacion) => {
      const posiblesIds = [
        participacion?.ticket_id,
        participacion?.ticketId,
        participacion?.ticket?.id,
        participacion?.tickets?.id,
      ];

      posiblesIds.forEach((id) => {
        if (id !== null && id !== undefined && String(id).trim() !== "") {
          mapa.set(String(id), participacion);
        }
      });
    });

    return mapa;
  }, [participacionesFreeDashboard]);

  const participacionesFreePorNumero = useMemo(() => {
    const mapa = new Map();

    (participacionesFreeDashboard || []).forEach((participacion) => {
      const numero =
        participacion?.numeroTicket ??
        participacion?.numero_ticket ??
        participacion?.ticket?.numero_ticket ??
        participacion?.tickets?.numero_ticket;

      if (numero !== null && numero !== undefined && String(numero).trim() !== "") {
        mapa.set(String(Number(numero)), participacion);
      }
    });

    return mapa;
  }, [participacionesFreeDashboard]);

  const ticketsVendidosUnicos = useMemo(() => {

    return normalizarTicketsUnicos(

      ticketsFiltradosPorRifa

    ).filter(esTicketOcupado);

  }, [ticketsFiltradosPorRifa]);

  const ticketsPagados = useMemo(() => {

    return ticketsVendidosUnicos.filter(

      esTicketPagado

    );

  }, [ticketsVendidosUnicos]);

  const ticketsFree = useMemo(() => {

    return ticketsVendidosUnicos.filter(

      esTicketFree

    );

  }, [ticketsVendidosUnicos]);

  const resumenRifa =

    dashboardCompactSummary || {};
    

  const totalTickets = Number(

    resumenRifa.totalTickets ??

      rifaSeleccionada?.total_numeros ??

      rifaSeleccionada?.cantidad_numeros ??

      ticketsVendidosUnicos.length ??

      0

  );

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

  const montoAprobado = comprasAprobadas.reduce(

    (acc, compra) =>

      acc + obtenerMontoCompra(compra),

    0

  );

    /*

   * =========================================================

   * ESTADÍSTICAS FINANCIERAS

   * =========================================================

   */

  const totalComprasDashboard =

    comprasFiltradasPorRifa.length;

  const promedioPorCompra =

    comprasAprobadas.length > 0

      ? montoAprobado / comprasAprobadas.length

      : 0;

  const promedioIngresoPorTicket =

    ticketsPagados.length > 0

      ? montoAprobado / ticketsPagados.length

      : 0;

  const ticketsPagadosPorCompra =

    comprasAprobadas.length > 0

      ? ticketsPagados.length /

        comprasAprobadas.length

      : 0;

  const relacionFreePagados =

    ticketsPagados.length > 0

      ? ticketsFree.length /

        ticketsPagados.length

      : 0;

  const porcentajeTicketsPagados =

    ticketsVendidosUnicos.length > 0

      ? Math.min(

          100,

          (ticketsPagados.length /

            ticketsVendidosUnicos.length) *

            100

        )

      : 0;

  const porcentajeTicketsFree =

    ticketsVendidosUnicos.length > 0

      ? Math.min(

          100,

          (ticketsFree.length /

            ticketsVendidosUnicos.length) *

            100

        )

      : 0;

  const porcentajeComprasAprobadas =

    totalComprasDashboard > 0

      ? Math.min(

          100,

          (comprasAprobadas.length /

            totalComprasDashboard) *

            100

        )

      : 0;

  const porcentajeComprasPendientes =

    totalComprasDashboard > 0

      ? Math.min(

          100,

          (comprasPendientes.length /

            totalComprasDashboard) *

            100

        )

      : 0;

  const porcentajeComprasRechazadas =

    totalComprasDashboard > 0

      ? Math.min(

          100,

          (comprasRechazadas.length /

            totalComprasDashboard) *

            100

        )

      : 0;

  const porcentajeProgresoSeguro =

    Math.min(

      100,

      Math.max(

        0,

        Number(porcentajeVendido) || 0

      )

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

    pagados:

      "Tickets pagados de la rifa",

    free:

      "Tickets FREE de la rifa",

    monto:

      "Monto aprobado de la rifa",

  };

  const esFiltroTickets = [

    "tickets",

    "pagados",

    "free",

  ].includes(filtroDashboard);

  let ticketsBase = ticketsVendidosUnicos;

  if (filtroDashboard === "pagados") {

    ticketsBase = ticketsPagados;

  }

  if (filtroDashboard === "free") {

    ticketsBase = ticketsFree;

  }

  if (

    filtroDashboard === "tickets" &&

    tipoTicket === "pagados"

  ) {

    ticketsBase = ticketsPagados;

  }

  if (

    filtroDashboard === "tickets" &&

    tipoTicket === "free"

  ) {

    ticketsBase = ticketsFree;

  }

  const busquedaLimpia = String(

    busquedaNumero || ""

  )

    .replace(/\D/g, "")

    .replace(/^0+(?=\d)/, "");

  const numeroBuscado =

    busquedaLimpia !== ""

      ? Number(busquedaLimpia)

      : null;

  const busquedaValida =

    numeroBuscado !== null &&

    Number.isInteger(numeroBuscado) &&

    numeroBuscado >= 0 &&

    (totalTickets <= 0 ||

      numeroBuscado < totalTickets);

  const ticketEncontrado =

    busquedaValida

      ? ticketsVendidosUnicos.find(

          (ticket) =>

            Number(ticket.numero_ticket) ===

            numeroBuscado

        ) || null

      : null;

  const ticketsParaMostrar =

    numeroBuscado !== null

      ? ticketEncontrado

        ? [ticketEncontrado]

        : []

      : ticketsBase;

  function limpiarPanel() {

    setBusquedaNumero("");

    setTipoTicket("todos");

    setFiltroDashboard(null);

  }

  function cambiarTipoTicket(tipo) {

    setTipoTicket(tipo);

    setBusquedaNumero("");

  }

  function renderTicket(ticket) {

    const free = esTicketFree(ticket);

    const numeroFormateado = String(

      ticket.numero_ticket

    ).padStart(padLength, "0");

    const participacionFreeEmbebida = obtenerParticipacionFree(ticket);

    const participacionFree =
      participacionFreeEmbebida ||
      participacionesFreePorId.get(
        String(ticket?.free_drop_participation_id ?? "")
      ) ||
      participacionesFreePorTicketId.get(String(ticket?.id ?? "")) ||
      participacionesFreePorNumero.get(String(Number(ticket?.numero_ticket))) ||
      null;

    const ticketFreeCompleto = participacionFree
      ? {
          ...ticket,
          free_drop_participation: participacionFree,
          free_drop:
            participacionFree?.free_drop ||
            participacionFree?.freeDrop ||
            participacionFree?.free_drops ||
            ticket?.free_drop ||
            ticket?.freeDrop ||
            ticket?.free_drops ||
            null,
          freeNombre:
            participacionFree?.nombreCompleto ||
            [participacionFree?.nombre, participacionFree?.apellido]
              .filter(Boolean)
              .join(" ")
              .trim(),
          freeEmail: participacionFree?.email || ticket?.freeEmail,
          freeTelefono: participacionFree?.telefono || ticket?.freeTelefono,
          codigoFree: participacionFree?.codigo_unico || ticket?.codigoFree,
          freeDropNombre:
            participacionFree?.freeDropLabel ||
            participacionFree?.free_drop?.nombre ||
            participacionFree?.freeDrop?.nombre ||
            participacionFree?.free_drops?.nombre ||
            ticket?.freeDropNombre,
        }
      : ticket;

    const codigoFree = formatearCodigoFree(ticketFreeCompleto);

    const freeDropNombre = formatearFreeDrop(ticketFreeCompleto);

    const nombreFree = formatearNombreFree(ticketFreeCompleto);

const compraRelacionada =

  ticket?.compra ||

  comprasPorId.get(String(ticket?.compra_id)) ||

  null;

const nombreCompra =

  compraRelacionada?.usuarios?.nombre ||

  compraRelacionada?.usuario?.nombre ||

  compraRelacionada?.nombre ||

  compraRelacionada?.nombre_cliente ||

  compraRelacionada?.cliente_nombre ||

  ticket?.asignado_a_nombre ||

  "Sin nombre";

const emailCompra =

  compraRelacionada?.usuarios?.email ||

  compraRelacionada?.usuario?.email ||

  compraRelacionada?.email ||

  compraRelacionada?.email_cliente ||

  compraRelacionada?.cliente_email ||

  ticket?.asignado_a_email ||

  "Sin email";

const telefonoCompra =

  compraRelacionada?.usuarios?.telefono ||

  compraRelacionada?.usuario?.telefono ||

  compraRelacionada?.telefono ||

  compraRelacionada?.telefono_cliente ||

  compraRelacionada?.cliente_telefono ||

  ticket?.asignado_a_telefono ||

  "Sin teléfono";

    const fechaAsignacion =

      ticket.asignado_at ||

      ticket.fecha_asignacion ||

      participacionFree?.created_at ||

      null;

    return (

      <article

        key={

          ticket.id ||

          `${ticket.rifa_id}-${ticket.numero_ticket}`

        }

        className={`adminpro-ticket-detail-card ${

          free ? "is-free" : "is-paid"

        }`}

      >

        <div className="adminpro-ticket-detail-head">

          <div className="adminpro-ticket-number-wrap">

            <span className="adminpro-ticket-number-label">

              NÚMERO

            </span>

            <strong className="adminpro-ticket-number-big">

              {numeroFormateado}

            </strong>

          </div>

          <span

            className={`adminpro-ticket-type-badge ${

              free ? "free" : "paid"

            }`}

          >

            {free ? "🎁 FREE" : "💳 PAGADO"}

          </span>

        </div>

        <div className="adminpro-ticket-detail-body">

          <div className="adminpro-ticket-data-row">

            <span>Estado</span>

            <strong>

              {ticket.estado ||

                (free ? "FREE" : "Asignado")}

            </strong>

          </div>

          {free ? (

            <>

              <div className="adminpro-ticket-data-row">

                <span>Participante</span>

                <strong>{nombreFree}</strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Email</span>

                <strong>

                  {ticket.freeEmail ||

                    participacionFree?.email ||

                    ticket.asignado_a_email ||

                    "Sin email"}

                </strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Teléfono</span>

                <strong>

                  {ticket.freeTelefono ||

                    participacionFree?.telefono ||

                    ticket.asignado_a_telefono ||

                    "Sin teléfono"}

                </strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Free Drop</span>

                <strong>{freeDropNombre}</strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Código FREE</span>

                <strong>{codigoFree}</strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Participación FREE</span>

                <strong>

                  {participacionFree?.id ||

                    ticket.free_drop_participation_id ||

                    "Sin participación"}

                </strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Estado residencia</span>

                <strong>

                  {participacionFree?.estado_residencia ||

                    "Sin dato"}

                </strong>

              </div>

            </>

          ) : (

            <>

              <div className="adminpro-ticket-data-row">

                <span>Cliente</span>

                <strong>{nombreCompra}</strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Email</span>

                <strong>{emailCompra}</strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Teléfono</span>

                <strong>{telefonoCompra}</strong>

              </div>

              <div className="adminpro-ticket-data-row">

                <span>Compra ID</span>

                <strong>

                  {ticket.compra_id ||

                    "Sin compra"}

                </strong>

              </div>

            </>

          )}

          {fechaAsignacion && (

            <div className="adminpro-ticket-data-row">

              <span>Asignado</span>

              <strong>

                {formatearFecha(fechaAsignacion)}

              </strong>

            </div>

          )}

          <div className="adminpro-ticket-technical">

            <div>

              <span>ID del ticket</span>

              <strong>

                {ticket.id || "Sin ID"}

              </strong>

            </div>

            <div>

              <span>Rifa ID</span>

              <strong>

                {ticket.rifa_id || "Sin ID"}

              </strong>

            </div>

          </div>

        </div>

      </article>

    );

  }

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

            onCardClick={(key) => {

              setBusquedaNumero("");

              setTipoTicket("todos");

              abrirFiltroDashboard(key);

            }}

          />

        </>

      )}

      <div

        className="adminpro-page-stack"

        ref={dashboardRef}

      >

        <div ref={dashboardFilterRef}>

          {filtroDashboard && (

            <section className="adminpro-card adminpro-dashboard-detail">

              <div className="adminpro-dashboard-detail-header">

                <div className="adminpro-dashboard-detail-title">

                  <span className="adminpro-dashboard-detail-eyebrow">

                    DETALLE ACTUALIZADO

                  </span>

                  <h2>

                    {titulosFiltro[

                      filtroDashboard

                    ] ||

                      "Detalle de la rifa"}

                  </h2>

                  <p>

                    Información correspondiente

                    únicamente a la rifa

                    seleccionada.

                  </p>

                </div>

                <button

                  className="adminpro-soft-btn dark adminpro-dashboard-close"

                  onClick={limpiarPanel}

                  type="button"

                >

                  Cerrar

                </button>

              </div>

              {esFiltroTickets && (

                <>

                  <div className="adminpro-ticket-summary">

                    <div>

                      <span>Ocupados</span>

                      <strong>

                        {ticketsVendidosUnicos.length}

                      </strong>

                    </div>

                    <div>

                      <span>Pagados</span>

                      <strong>

                        {ticketsPagados.length}

                      </strong>

                    </div>

                    <div>

                      <span>FREE</span>

                      <strong>

                        {ticketsFree.length}

                      </strong>

                    </div>

                    <div>

                      <span>Disponibles</span>

                      <strong>

                        {ticketsDisponibles}

                      </strong>

                    </div>

                  </div>

                  <div className="adminpro-ticket-tools">

                    <div className="adminpro-number-search">

                      <span

                        className="adminpro-number-search-icon"

                        aria-hidden="true"

                      >

                        🔎

                      </span>

                      <input

                        type="text"

                        inputMode="numeric"

                        pattern="[0-9]*"

                        value={busquedaNumero}

                        onChange={(e) => {

                          const valor =

                            e.target.value.replace(

                              /\D/g,

                              ""

                            );

                          setBusquedaNumero(valor);

                        }}

                        placeholder={`Buscar Nº ${String(

                          0

                        ).padStart(

                          padLength,

                          "0"

                        )}`}

                        aria-label="Buscar número de ticket"

                      />

                      {busquedaNumero && (

                        <button

                          type="button"

                          onClick={() =>

                            setBusquedaNumero("")

                          }

                          aria-label="Limpiar búsqueda"

                        >

                          ×

                        </button>

                      )}

                    </div>

                    {filtroDashboard ===

                      "tickets" && (

                      <div className="adminpro-ticket-filter-tabs">

                        <button

                          type="button"

                          className={

                            tipoTicket ===

                            "todos"

                              ? "active"

                              : ""

                          }

                          onClick={() =>

                            cambiarTipoTicket(

                              "todos"

                            )

                          }

                        >

                          Todos

                          <span>

                            {

                              ticketsVendidosUnicos.length

                            }

                          </span>

                        </button>

                        <button

                          type="button"

                          className={

                            tipoTicket ===

                            "pagados"

                              ? "active"

                              : ""

                          }

                          onClick={() =>

                            cambiarTipoTicket(

                              "pagados"

                            )

                          }

                        >

                          Pagados

                          <span>

                            {ticketsPagados.length}

                          </span>

                        </button>

                        <button

                          type="button"

                          className={

                            tipoTicket ===

                            "free"

                              ? "active"

                              : ""

                          }

                          onClick={() =>

                            cambiarTipoTicket(

                              "free"

                            )

                          }

                        >

                          FREE

                          <span>

                            {ticketsFree.length}

                          </span>

                        </button>

                      </div>

                    )}

                  </div>

                  {numeroBuscado !== null &&

                    !busquedaValida && (

                      <div className="adminpro-ticket-search-result invalid">

                        <div className="adminpro-ticket-search-result-icon">

                          ⚠️

                        </div>

                        <div>

                          <strong>

                            Número fuera de rango

                          </strong>

                          <p>

                            Escribe un número

                            válido de esta rifa.

                          </p>

                        </div>

                      </div>

                    )}

                  {numeroBuscado !== null &&

                    busquedaValida &&

                    !ticketEncontrado && (

                      <div className="adminpro-ticket-search-result available">

                        <div className="adminpro-ticket-search-result-icon">

                          ✓

                        </div>

                        <div>

                          <strong>

                            Nº{" "}

                            {String(

                              numeroBuscado

                            ).padStart(

                              padLength,

                              "0"

                            )}{" "}

                            — DISPONIBLE

                          </strong>

                          <p>

                            Este número no aparece

                            ocupado actualmente en

                            la rifa seleccionada.

                          </p>

                        </div>

                      </div>

                    )}

                  {numeroBuscado !== null &&

                    ticketEncontrado && (

                      <div className="adminpro-ticket-search-result occupied">

                        <div className="adminpro-ticket-search-result-icon">

                          🎟️

                        </div>

                        <div>

                          <strong>

                            Nº{" "}

                            {String(

                              numeroBuscado

                            ).padStart(

                              padLength,

                              "0"

                            )}{" "}

                            — OCUPADO

                          </strong>

                          <p>

                            Se encontró la

                            información de este

                            número.

                          </p>

                        </div>

                      </div>

                    )}

                  {ticketsParaMostrar.length >

                  0 ? (

                    <div className="adminpro-ticket-detail-grid">

                      {ticketsParaMostrar.map(

                        (ticket) =>

                          renderTicket(ticket)

                      )}

                    </div>

                  ) : numeroBuscado ===

                    null ? (

                    <div className="adminpro-dashboard-empty">

                      <span>🎟️</span>

                      <strong>

                        No hay tickets para

                        mostrar

                      </strong>

                      <p>

                        Este filtro todavía no

                        tiene registros.

                      </p>

                    </div>

                  ) : null}

                </>

              )}

              {!esFiltroTickets &&

                filtroDashboard === "monto" && (

                  <div className="adminpro-finance-dashboard">

                    <section className="adminpro-finance-hero">

                      <div className="adminpro-finance-hero-main">

                        <div className="adminpro-finance-hero-icon">💵</div>

                        <div>

                          <span className="adminpro-finance-label">INGRESOS APROBADOS</span>

                          <strong className="adminpro-finance-total">

                            ${Number(montoAprobado || 0).toFixed(2)}

                          </strong>

                          <p>Dinero correspondiente únicamente a compras aprobadas.</p>

                        </div>

                      </div>

                      <div className="adminpro-finance-status">

                        <span className="adminpro-finance-status-dot" />

                        Datos actuales

                      </div>

                    </section>

                    <section className="adminpro-finance-kpis">

                      <div className="adminpro-finance-kpi">

                        <div className="adminpro-finance-kpi-icon green">✓</div>

                        <div><span>Compras aprobadas</span><strong>{comprasAprobadas.length}</strong><small>de {totalComprasDashboard} compras</small></div>

                      </div>

                      <div className="adminpro-finance-kpi">

                        <div className="adminpro-finance-kpi-icon purple">$</div>

                        <div><span>Promedio por compra</span><strong>${promedioPorCompra.toFixed(2)}</strong><small>ticket promedio</small></div>

                      </div>

                      <div className="adminpro-finance-kpi">

                        <div className="adminpro-finance-kpi-icon blue">🎟</div>

                        <div><span>Tickets pagados</span><strong>{ticketsPagados.length}</strong><small>con ingreso</small></div>

                      </div>

                      <div className="adminpro-finance-kpi">

                        <div className="adminpro-finance-kpi-icon yellow">$</div>

                        <div><span>Ingreso por ticket</span><strong>${promedioIngresoPorTicket.toFixed(2)}</strong><small>promedio pagado</small></div>

                      </div>

                    </section>

                    <section className="adminpro-finance-panel">

                      <div className="adminpro-finance-panel-head">

                        <div><span className="adminpro-finance-section-label">RENDIMIENTO</span><h3>Progreso comercial</h3><p>Ocupación actual de la rifa seleccionada.</p></div>

                        <div className="adminpro-finance-percentage">{porcentajeProgresoSeguro.toFixed(2)}%</div>

                      </div>

                      <div className="adminpro-finance-main-progress">

                        <div className="adminpro-finance-main-progress-fill" style={{ width: `${porcentajeProgresoSeguro}%` }} />

                      </div>

                      <div className="adminpro-finance-progress-footer">

                        <span><strong>{ticketsVendidos}</strong> ocupados</span>

                        <span><strong>{ticketsDisponibles}</strong> disponibles</span>

                        <span><strong>{totalTickets}</strong> total</span>

                      </div>

                    </section>

                    <section className="adminpro-finance-panel">

                      <div className="adminpro-finance-panel-title"><span className="adminpro-finance-section-label">DISTRIBUCIÓN</span><h3>Composición de tickets ocupados</h3><p>Cómo se distribuyen los números que ya están ocupados.</p></div>

                      <div className="adminpro-finance-bars">

                        <div className="adminpro-finance-bar-item">

                          <div className="adminpro-finance-bar-head"><div><span className="adminpro-finance-bar-icon">💳</span><strong>Tickets pagados</strong></div><div className="adminpro-finance-bar-value"><strong>{ticketsPagados.length}</strong><span>{porcentajeTicketsPagados.toFixed(1)}%</span></div></div>

                          <div className="adminpro-finance-track"><div className="adminpro-finance-fill paid" style={{ width: `${porcentajeTicketsPagados}%` }} /></div>

                          <div className="adminpro-finance-bar-caption">{ticketsPagados.length} de {ticketsVendidosUnicos.length} tickets ocupados</div>

                        </div>

                        <div className="adminpro-finance-bar-item">

                          <div className="adminpro-finance-bar-head"><div><span className="adminpro-finance-bar-icon">🎁</span><strong>Tickets FREE</strong></div><div className="adminpro-finance-bar-value"><strong>{ticketsFree.length}</strong><span>{porcentajeTicketsFree.toFixed(1)}%</span></div></div>

                          <div className="adminpro-finance-track"><div className="adminpro-finance-fill free" style={{ width: `${porcentajeTicketsFree}%` }} /></div>

                          <div className="adminpro-finance-bar-caption">{ticketsFree.length} de {ticketsVendidosUnicos.length} tickets ocupados</div>

                        </div>

                      </div>

                    </section>

                    <section className="adminpro-finance-panel">

                      <div className="adminpro-finance-panel-title"><span className="adminpro-finance-section-label">OPERACIONES</span><h3>Estado de las compras</h3><p>Distribución de las operaciones registradas.</p></div>

                      <div className="adminpro-finance-bars">

                        {[

                          ["✅", "Aprobadas", comprasAprobadas.length, porcentajeComprasAprobadas, "approved"],

                          ["⏳", "Pendientes", comprasPendientes.length, porcentajeComprasPendientes, "pending"],

                          ["❌", "Rechazadas", comprasRechazadas.length, porcentajeComprasRechazadas, "rejected"],

                        ].map(([icono, label, cantidad, porcentaje, clase]) => (

                          <div className="adminpro-finance-bar-item" key={label}>

                            <div className="adminpro-finance-bar-head"><div><span className="adminpro-finance-bar-icon">{icono}</span><strong>{label}</strong></div><div className="adminpro-finance-bar-value"><strong>{cantidad}</strong><span>{Number(porcentaje).toFixed(1)}%</span></div></div>

                            <div className="adminpro-finance-track"><div className={`adminpro-finance-fill ${clase}`} style={{ width: `${porcentaje}%` }} /></div>

                          </div>

                        ))}

                      </div>

                    </section>

                    <section className="adminpro-finance-panel">

                      <div className="adminpro-finance-panel-title"><span className="adminpro-finance-section-label">MÉTRICAS</span><h3>Indicadores comerciales</h3><p>Métricas calculadas automáticamente con los datos actuales.</p></div>

                      <div className="adminpro-finance-metrics">

                        <div><span>Ingreso actual</span><strong>${montoAprobado.toFixed(2)}</strong></div>

                        <div><span>Promedio por compra</span><strong>${promedioPorCompra.toFixed(2)}</strong></div>

                        <div><span>Ingreso por ticket</span><strong>${promedioIngresoPorTicket.toFixed(2)}</strong></div>

                        <div><span>Tickets / compra</span><strong>{ticketsPagadosPorCompra.toFixed(2)}</strong></div>

                        <div><span>FREE / pagados</span><strong>{relacionFreePagados.toFixed(2)}</strong></div>

                        <div><span>Números disponibles</span><strong>{ticketsDisponibles}</strong></div>

                      </div>

                    </section>

                    <section className="adminpro-finance-insight">

                      <div className="adminpro-finance-insight-icon">✦</div>

                      <div>

                        <span>RESUMEN DEL RENDIMIENTO</span>

                        <h3>Estado actual de la rifa</h3>

                        <p>Las <strong>{comprasAprobadas.length} compras aprobadas</strong> han generado <strong>${montoAprobado.toFixed(2)}</strong>, con un promedio de <strong>${promedioPorCompra.toFixed(2)}</strong> por compra. Actualmente hay <strong>{ticketsPagados.length} tickets pagados</strong> y <strong>{ticketsFree.length} tickets FREE</strong>. La ocupación total de la rifa se encuentra en <strong>{porcentajeProgresoSeguro.toFixed(2)}%</strong>.</p>

                      </div>

                    </section>

                  </div>

                )}

              {!esFiltroTickets &&

                filtroDashboard !== "monto" &&

                (comprasPorFiltro[

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

                            String(compra.id)

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

                          ) === "rechazado"

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

                  <div className="adminpro-dashboard-empty">

                    <span>📭</span>

                    <strong>

                      No hay registros

                    </strong>

                    <p>

                      No existen datos para este

                      filtro en la rifa

                      seleccionada.

                    </p>

                  </div>

                ))}

            </section>

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
