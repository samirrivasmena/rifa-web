import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// ============================================================
// CAMPOS PÚBLICOS DE UNA RIFA
//
// IMPORTANTE:
// Esta API es pública.
//
// No usamos select("*") para evitar que una columna interna
// agregada en el futuro quede expuesta automáticamente.
// ============================================================

const CAMPOS_PUBLICOS_RIFA = `
  id,
  nombre,
  descripcion,
  numero_inicio,
  numero_fin,
  cantidad_numeros,
  formato,
  estado,
  portada_url,
  portada_scroll_url,
  premio,
  precio_ticket,
  fecha_sorteo,
  hora_sorteo,
  publicada,
  destacada
`;

// ============================================================
// TOTAL DE NÚMEROS
// ============================================================

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (
    Number.isFinite(inicio) &&
    Number.isFinite(fin) &&
    fin >= inicio
  ) {
    return fin - inicio + 1;
  }

  const cantidad = Number(
    rifa?.cantidad_numeros
  );

  if (
    Number.isFinite(cantidad) &&
    cantidad > 0
  ) {
    return cantidad;
  }

  return String(rifa?.formato) === "3digitos"
    ? 1000
    : 10000;
}

// ============================================================
// NORMALIZAR TEXTO
// ============================================================

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

// ============================================================
// IDENTIFICAR TICKET FREE
// ============================================================

function esTicketFree(ticket = {}) {
  return (
    ticket?.free_drop_id != null ||
    ticket?.free_drop_participation_id != null ||
    normalizarTexto(ticket?.tipo) === "free"
  );
}

// ============================================================
// IDENTIFICAR TICKET PAGADO
// ============================================================

function esTicketPagado(ticket = {}) {
  return (
    ticket?.compra_id != null &&
    !esTicketFree(ticket)
  );
}

// ============================================================
// IDENTIFICAR TICKET DISPONIBLE
// ============================================================

function esTicketDisponible(ticket = {}) {
  return (
    ticket?.compra_id == null &&
    ticket?.free_drop_id == null &&
    ticket?.free_drop_participation_id == null &&
    normalizarTexto(ticket?.tipo) !== "free" &&
    normalizarTexto(ticket?.estado) ===
      "disponible"
  );
}

// ============================================================
// AGREGAR NÚMERO A SET
// ============================================================

function agregarNumero(
  set,
  numeroTicket
) {
  if (
    numeroTicket == null ||
    numeroTicket === ""
  ) {
    return;
  }

  set.add(String(numeroTicket));
}

// ============================================================
// GET
// ============================================================

export async function GET(req) {
  try {
    const { searchParams } =
      new URL(req.url);

    const rifaId =
      searchParams.get("rifaId");

    let rifa = null;

    // ========================================================
    // 1. CARGAR RIFA
    // ========================================================

    /*
     * Si recibimos rifaId cargamos exactamente esa rifa.
     *
     * EventoDetallePageClient depende de poder consultar
     * un evento específico.
     *
     * SEGURIDAD:
     * Esta es una API pública, por lo tanto solamente
     * permitimos consultar rifas publicadas.
     */

    if (rifaId) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("rifas")
        .select(
          CAMPOS_PUBLICOS_RIFA
        )
        .eq("id", rifaId)
        .eq("publicada", true)
        .maybeSingle();

      if (error) {
        console.error(
          "Error cargando rifa:",
          error
        );

        return NextResponse.json(
          {
            error:
              "No se pudo cargar la rifa",
          },
          {
            status: 500,
            headers: {
              "Cache-Control":
                "no-store, no-cache, must-revalidate, proxy-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );
      }

      rifa = data || null;
    } else {
      /*
       * Cuando no llega rifaId:
       *
       * Conservamos el comportamiento existente:
       * usar la rifa publicada más reciente.
       */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("rifas")
        .select(
          CAMPOS_PUBLICOS_RIFA
        )
        .eq("publicada", true)
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(
          "Error cargando rifa activa:",
          error
        );

        return NextResponse.json(
          {
            error:
              "No se pudo cargar la rifa activa",
          },
          {
            status: 500,
            headers: {
              "Cache-Control":
                "no-store, no-cache, must-revalidate, proxy-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );
      }

      rifa = data || null;
    }

    // ========================================================
    // 2. SI NO EXISTE RIFA PÚBLICA
    // ========================================================

    if (!rifa) {
      return NextResponse.json(
        {
          ok: true,
          rifa: null,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // ========================================================
    // 3. TOTAL DE NÚMEROS
    // ========================================================

    const totalNumeros =
      obtenerTotalNumeros(rifa);

    // ========================================================
    // 4. INVENTARIO DE TICKETS
    // ========================================================

    /*
     * Cargamos únicamente los campos necesarios.
     *
     * Necesitamos distinguir correctamente:
     *
     * - tickets pagados
     * - tickets FREE
     * - tickets disponibles
     * - tickets bloqueados/reservados
     *
     * Estos tickets NO se devuelven individualmente
     * al navegador.
     */

    const {
      data: ticketsData,
      error: ticketsError,
    } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        numero_ticket,
        compra_id,
        estado,
        tipo,
        free_drop_id,
        free_drop_participation_id,
        rifa_id,
        asignado_at
      `)
      .eq(
        "rifa_id",
        rifa.id
      );

    if (ticketsError) {
      console.error(
        "Error cargando tickets:",
        ticketsError
      );

      return NextResponse.json(
        {
          error:
            "No se pudieron obtener los tickets de la rifa",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const tickets =
      Array.isArray(ticketsData)
        ? ticketsData
        : [];

    // ========================================================
    // 5. SETS DE NÚMEROS
    // ========================================================

    /*
     * Usamos Sets para contar números únicos
     * y no simplemente cantidad de filas.
     */

    const numerosPagados =
      new Set();

    const numerosFree =
      new Set();

    const numerosOcupados =
      new Set();

    const numerosDisponiblesInventario =
      new Set();

    // ========================================================
    // 6. CLASIFICAR TICKETS
    // ========================================================

    for (const ticket of tickets) {
      if (
        ticket?.numero_ticket == null ||
        ticket?.numero_ticket === ""
      ) {
        continue;
      }

      /*
       * FREE tiene prioridad.
       *
       * No dependemos solamente de:
       *
       * estado = "asignado"
       *
       * Si existe:
       *
       * - tipo = "free"
       * - free_drop_id
       * - free_drop_participation_id
       *
       * el número pertenece al flujo FREE
       * y no debe aparecer disponible para compra.
       *
       * Esto también cubre FREE reservados.
       */

      if (esTicketFree(ticket)) {
        agregarNumero(
          numerosFree,
          ticket.numero_ticket
        );

        agregarNumero(
          numerosOcupados,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Ticket perteneciente
       * a una compra normal.
       */

      if (
        esTicketPagado(ticket)
      ) {
        agregarNumero(
          numerosPagados,
          ticket.numero_ticket
        );

        agregarNumero(
          numerosOcupados,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Un ticket solamente es realmente
       * disponible cuando:
       *
       * - no tiene compra
       * - no tiene referencias FREE
       * - no es tipo FREE
       * - estado = disponible
       */

      if (
        esTicketDisponible(ticket)
      ) {
        agregarNumero(
          numerosDisponiblesInventario,
          ticket.numero_ticket
        );

        continue;
      }

      /*
       * Cualquier fila restante no cumple
       * las condiciones estrictas para
       * considerarse disponible.
       *
       * Por seguridad del inventario,
       * se considera ocupada/bloqueada.
       */

      agregarNumero(
        numerosOcupados,
        ticket.numero_ticket
      );
    }

    // ========================================================
    // 7. ESTADÍSTICAS
    // ========================================================

    const ticketsPagados =
      numerosPagados.size;

    const ticketsFree =
      numerosFree.size;

    const ticketsOcupados =
      numerosOcupados.size;

    /*
     * Disponibilidad matemática pública:
     *
     * TOTAL - todos los números
     * realmente ocupados.
     */

    const ticketsDisponibles =
      Math.max(
        totalNumeros -
          ticketsOcupados,
        0
      );

    /*
     * Conservamos tickets_vendidos como
     * alias de ocupación total porque el
     * frontend existente utiliza este campo
     * para mostrar el progreso general.
     *
     * El desglose real queda disponible en:
     *
     * - tickets_pagados
     * - tickets_free
     * - tickets_ocupados
     */

    const ticketsVendidos =
      ticketsOcupados;

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(
            (
              (ticketsOcupados /
                totalNumeros) *
              100
            ).toFixed(2)
          )
        : 0;

    const soldOut =
      totalNumeros > 0 &&
      ticketsOcupados >=
        totalNumeros;

    // ========================================================
    // 8. RESPUESTA PÚBLICA
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        rifa: {
          /*
           * Aquí solamente existen los campos
           * incluidos en CAMPOS_PUBLICOS_RIFA.
           *
           * Ya no puede filtrarse automáticamente
           * una futura columna interna de la tabla.
           */

          ...rifa,

          total_numeros:
            totalNumeros,

          /*
           * CAMPOS EXISTENTES.
           *
           * Se conservan para no romper
           * EventoDetallePageClient ni otros
           * componentes existentes.
           */

          tickets_vendidos:
            ticketsVendidos,

          tickets_disponibles:
            ticketsDisponibles,

          porcentaje_vendido:
            porcentajeVendido,

          sold_out:
            soldOut,

          /*
           * DESGLOSE.
           */

          tickets_pagados:
            ticketsPagados,

          tickets_free:
            ticketsFree,

          tickets_ocupados:
            ticketsOcupados,

          // ==================================================
          // STATS
          // ==================================================

          stats: {
            total:
              totalNumeros,

            /*
             * Compatibilidad anterior.
             */

            vendidos:
              ticketsVendidos,

            ocupados:
              ticketsOcupados,

            disponibles:
              ticketsDisponibles,

            porcentaje:
              porcentajeVendido,

            soldOut,

            ticketsVendidos,

            ticketsOcupados,

            porcentajeVendido,

            /*
             * Desglose explícito.
             */

            pagados:
              ticketsPagados,

            free:
              ticketsFree,

            ticketsPagados,

            ticketsFree,

            /*
             * Diagnóstico del inventario físico.
             */

            disponiblesInventario:
              numerosDisponiblesInventario.size,
          },
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "rifa-resumen error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno del servidor",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}