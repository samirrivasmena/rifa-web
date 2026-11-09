
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   CAMPOS PÚBLICOS DE LA RIFA

   Esta API es pública.

   Seleccionamos solamente campos permitidos para evitar
   exponer columnas internas de Supabase.
============================================================ */

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

/* ============================================================
   CAMPOS DE LA VISTA OPTIMIZADA

   Esta vista ya existe en Supabase.

   No necesitamos crear tablas ni modificar tickets.
============================================================ */

const CAMPOS_RESUMEN = `
  rifa_id,
  tickets_pagados,
  tickets_free,
  tickets_ocupados,
  disponibles_inventario
`;

/* ============================================================
   RESPUESTA JSON SIN CACHÉ

   Conservamos el comportamiento original para que las
   estadísticas puedan reflejar las compras recientes.
============================================================ */

function responderJSON(data, status = 200) {
  const respuestaExitosa =
    status === 200 && data?.ok === true;

  return NextResponse.json(data, {
    status,
    headers: respuestaExitosa
      ? {
          "Cache-Control":
            "public, s-maxage=10, stale-while-revalidate=20",
        }
      : {
          "Cache-Control": "no-store",
        },
  });
}

/* ============================================================
   CALCULAR TOTAL DE NÚMEROS

   Mantiene exactamente las prioridades anteriores:

   1. numero_inicio / numero_fin
   2. cantidad_numeros
   3. formato
============================================================ */

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

  const cantidad = Number(rifa?.cantidad_numeros);

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

/* ============================================================
   CONVERTIR ESTADÍSTICAS A NÚMEROS SEGUROS
============================================================ */

function numeroSeguro(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numero));
}

/* ============================================================
   GET - RESUMEN PÚBLICO DE RIFA
============================================================ */

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const rifaId = searchParams.get("rifaId");

    /* ========================================================
       1. CONSULTAR RIFA PUBLICADA

       Si recibimos rifaId:
       Consultamos exactamente esa rifa.

       Si no recibimos rifaId:
       Consultamos la rifa publicada más reciente.

       SEGURIDAD:
       Nunca devolvemos rifas no publicadas.
    ======================================================== */

    let consultaRifa = supabaseAdmin
      .from("rifas")
      .select(CAMPOS_PUBLICOS_RIFA)
      .eq("publicada", true);

    if (rifaId) {
      consultaRifa = consultaRifa.eq(
        "id",
        rifaId
      );
    } else {
      consultaRifa = consultaRifa.order(
        "created_at",
        {
          ascending: false,
        }
      );
    }

    const {
      data: rifa,
      error: rifaError,
    } = await consultaRifa
      .limit(1)
      .maybeSingle();

    if (rifaError) {
      console.error(
        "Error cargando rifa:",
        rifaError
      );

      return responderJSON(
        {
          error: rifaId
            ? "No se pudo cargar la rifa"
            : "No se pudo cargar la rifa activa",
        },
        500
      );
    }

    /* ========================================================
       2. SI NO EXISTE UNA RIFA PUBLICADA

       Conservamos la respuesta original.
    ======================================================== */

    if (!rifa) {
      return responderJSON({
        ok: true,
        rifa: null,
      });
    }

    /* ========================================================
       3. TOTAL DE NÚMEROS DE LA RIFA
    ======================================================== */

    const totalNumeros = obtenerTotalNumeros(rifa);

    /* ========================================================
       4. CONSULTAR ESTADÍSTICAS OPTIMIZADAS

       ANTES:
       Se descargaban registros individuales de tickets.

       AHORA:
       Supabase calcula los conteos y devuelve una fila.

       La vista distingue:

       - Tickets pagados
       - Tickets Free Drop
       - Tickets ocupados
       - Inventario disponible

       No modificamos datos ni asignaciones.
    ======================================================== */

    const {
      data: resumen,
      error: resumenError,
    } = await supabaseAdmin
      .from("resumen_publico_tickets_por_rifa")
      .select(CAMPOS_RESUMEN)
      .eq("rifa_id", rifa.id)
      .maybeSingle();

    if (resumenError) {
      console.error(
        "Error cargando resumen de tickets:",
        resumenError
      );

      return responderJSON(
        {
          error:
            "No se pudieron obtener los tickets de la rifa",
        },
        500
      );
    }

    /* ========================================================
       5. ESTADÍSTICAS DE TICKETS

       Conservamos los nombres que utiliza el frontend.
    ======================================================== */

    const ticketsPagados = numeroSeguro(
      resumen?.tickets_pagados
    );

    const ticketsFree = numeroSeguro(
      resumen?.tickets_free
    );

    const ticketsOcupados = numeroSeguro(
      resumen?.tickets_ocupados
    );

    const disponiblesInventario = numeroSeguro(
      resumen?.disponibles_inventario
    );

    /* ========================================================
       6. DISPONIBILIDAD MATEMÁTICA

       Mantenemos el cálculo original:

       TOTAL - NÚMEROS OCUPADOS

       No reemplazamos este cálculo por
       disponibles_inventario porque representa
       una métrica diferente.
    ======================================================== */

    const ticketsDisponibles = Math.max(
      totalNumeros - ticketsOcupados,
      0
    );

    /* ========================================================
       7. COMPATIBILIDAD CON EL FRONTEND

       El campo tickets_vendidos representa ocupación
       total, incluyendo Free Drop y bloqueados.

       Se mantiene para no romper componentes existentes.
    ======================================================== */

    const ticketsVendidos = ticketsOcupados;

    /* ========================================================
       8. PORCENTAJE VENDIDO
    ======================================================== */

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(
            (
              (ticketsOcupados / totalNumeros) *
              100
            ).toFixed(2)
          )
        : 0;

    /* ========================================================
       9. RIFA AGOTADA
    ======================================================== */

    const soldOut =
      totalNumeros > 0 &&
      ticketsOcupados >= totalNumeros;

    /* ========================================================
       10. RESPUESTA PÚBLICA COMPLETA

       Conservamos todos los campos originales para
       EventoDetallePageClient y demás componentes.
    ======================================================== */

    return responderJSON({
      ok: true,

      rifa: {
        ...rifa,

        // Total de números
        total_numeros: totalNumeros,

        // Campos originales
        tickets_vendidos: ticketsVendidos,
        tickets_disponibles: ticketsDisponibles,
        porcentaje_vendido: porcentajeVendido,
        sold_out: soldOut,

        // Desglose de tickets
        tickets_pagados: ticketsPagados,
        tickets_free: ticketsFree,
        tickets_ocupados: ticketsOcupados,

        /* ====================================================
           STATS - COMPATIBILIDAD COMPLETA
        ==================================================== */

        stats: {
          total: totalNumeros,

          // Compatibilidad anterior
          vendidos: ticketsVendidos,
          ocupados: ticketsOcupados,
          disponibles: ticketsDisponibles,
          porcentaje: porcentajeVendido,

          soldOut,

          ticketsVendidos,
          ticketsOcupados,
          porcentajeVendido,

          // Desglose explícito
          pagados: ticketsPagados,
          free: ticketsFree,

          ticketsPagados,
          ticketsFree,

          // Inventario físico disponible
          disponiblesInventario,
        },
      },
    });
  } catch (error) {
    console.error(
      "rifa-resumen error:",
      error
    );

    return responderJSON(
      {
        error: "Error interno del servidor",
      },
      500
    );
  }
}
