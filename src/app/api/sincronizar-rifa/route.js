import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const id = limpiarTexto(valor);
  return Boolean(id) && /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);
  if (Number.isFinite(cantidad) && cantidad > 0) return cantidad;

  return String(rifa?.formato) === "3digitos" ? 1000 : 10000;
}

function obtenerRangoNumeros(rifa = {}, totalNumeros = 0) {
  const inicioRaw = Number(rifa?.numero_inicio);
  const finRaw = Number(rifa?.numero_fin);

  const inicio = Number.isFinite(inicioRaw) ? inicioRaw : 0;

  const fin = Number.isFinite(finRaw)
    ? finRaw
    : inicio + Math.max(totalNumeros - 1, 0);

  return { inicio, fin };
}

function construirListaNumeros(inicio, fin) {
  const lista = [];
  for (let n = inicio; n <= fin; n++) {
    lista.push(n);
  }
  return lista;
}

function tomarAleatorios(pool, cantidad) {
  const copia = [...pool];
  const seleccionados = [];

  for (let i = 0; i < cantidad; i++) {
    const idx = randomInt(0, copia.length);
    seleccionados.push(copia.splice(idx, 1)[0]);
  }

  return seleccionados;
}

async function asegurarTicketsBase(rifa, totalNumeros) {
  const { inicio, fin } = obtenerRangoNumeros(rifa, totalNumeros);
  const esperados = construirListaNumeros(inicio, fin);

  const { data: existentes, error: errorExistentes } = await supabaseAdmin
    .from("tickets")
    .select("id, numero_ticket, compra_id")
    .eq("rifa_id", rifa.id);

  if (errorExistentes) {
    return {
      ok: false,
      error: errorExistentes.message || "No se pudieron leer los tickets existentes",
    };
  }

  const ticketsExistentes = Array.isArray(existentes) ? existentes : [];
  const setExistentes = new Set(
    ticketsExistentes
      .map((t) => Number(t.numero_ticket))
      .filter((n) => Number.isFinite(n))
  );

  const faltantes = esperados.filter((n) => !setExistentes.has(n));

  let ticketsCreados = 0;

  if (faltantes.length > 0) {
    const batchSize = 500;

    for (let i = 0; i < faltantes.length; i += batchSize) {
      const batch = faltantes.slice(i, i + batchSize).map((numero) => ({
        rifa_id: rifa.id,
        numero_ticket: numero,
        compra_id: null,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("tickets")
        .insert(batch);

      if (insertError) {
        return {
          ok: false,
          error: insertError.message || "No se pudieron crear los tickets faltantes",
        };
      }

      ticketsCreados += batch.length;
    }
  }

  const { data: ticketsActualizados, error: errorReload } = await supabaseAdmin
    .from("tickets")
    .select("id, numero_ticket, compra_id, rifa_id")
    .eq("rifa_id", rifa.id)
    .order("numero_ticket", { ascending: true });

  if (errorReload) {
    return {
      ok: false,
      error: errorReload.message || "No se pudieron recargar los tickets",
    };
  }

  return {
    ok: true,
    tickets: Array.isArray(ticketsActualizados) ? ticketsActualizados : [],
    ticketsCreados,
    inicio,
    fin,
    totalNumeros,
  };
}

async function sincronizarComprasAprobadas(rifa, tickets) {
  const { data: comprasData, error: comprasError } = await supabaseAdmin
    .from("compras")
    .select("id, cantidad_tickets, fecha_compra, estado_pago")
    .eq("rifa_id", rifa.id)
    .in("estado_pago", ["aprobado", "aprobada"])
    .order("fecha_compra", { ascending: true });

  if (comprasError) {
    return {
      ok: false,
      error: comprasError.message || "No se pudieron cargar las compras aprobadas",
    };
  }

  const comprasAprobadas = Array.isArray(comprasData) ? comprasData : [];
  const ticketsLocal = [...tickets];
  const libres = ticketsLocal.filter(
    (t) => t.compra_id === null || t.compra_id === undefined
  );

  let ticketsAsignadosExtra = 0;

  for (const compra of comprasAprobadas) {
    const cantidad = Number(compra.cantidad_tickets) || 0;
    if (cantidad <= 0) continue;

    const asignados = ticketsLocal.filter(
      (t) => String(t.compra_id) === String(compra.id)
    );

    const faltantes = cantidad - asignados.length;
    if (faltantes <= 0) continue;

    if (libres.length < faltantes) {
      return {
        ok: false,
        error:
          "No hay suficientes números libres para sincronizar la rifa. Hay compras aprobadas que superan la disponibilidad real.",
      };
    }

    const seleccionados = tomarAleatorios(libres, faltantes);
    const idsSeleccionados = seleccionados.map((t) => t.id);

    const { error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({ compra_id: compra.id })
      .in("id", idsSeleccionados);

    if (updateError) {
      return {
        ok: false,
        error: updateError.message || "No se pudieron sincronizar los tickets",
      };
    }

    ticketsAsignadosExtra += idsSeleccionados.length;

    for (const ticket of ticketsLocal) {
      if (idsSeleccionados.includes(ticket.id)) {
        ticket.compra_id = compra.id;
      }
    }

    for (const id of idsSeleccionados) {
      const idx = libres.findIndex((t) => t.id === id);
      if (idx !== -1) libres.splice(idx, 1);
    }
  }

  return {
    ok: true,
    tickets: ticketsLocal,
    ticketsAsignadosExtra,
  };
}

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rifaId = limpiarTexto(searchParams.get("rifaId"));

    if (!validarId(rifaId)) {
      return errorResponse("Falta rifaId", 400);
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select(
        "id, nombre, estado, numero_inicio, numero_fin, cantidad_numeros, formato"
      )
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return errorResponse(
        rifaError.message || "No se pudo consultar la rifa",
        500
      );
    }

    if (!rifa) {
      return errorResponse("La rifa no existe", 404);
    }

    const totalNumeros = obtenerTotalNumeros(rifa);

    const base = await asegurarTicketsBase(rifa, totalNumeros);
    if (!base.ok) {
      return errorResponse(base.error, 500);
    }

    const sincronizacion = await sincronizarComprasAprobadas(rifa, base.tickets);
    if (!sincronizacion.ok) {
      return errorResponse(sincronizacion.error, 409);
    }

    const ticketsFinales = sincronizacion.tickets || base.tickets;

    const ticketsVendidos = ticketsFinales.filter(
      (t) => t.compra_id !== null && t.compra_id !== undefined
    ).length;

    const ticketsDisponibles = Math.max(totalNumeros - ticketsVendidos, 0);
    const porcentajeVendido =
      totalNumeros > 0
        ? Number(((ticketsVendidos / totalNumeros) * 100).toFixed(2))
        : 0;

    const soldOut = totalNumeros > 0 && ticketsVendidos >= totalNumeros;

    return NextResponse.json(
      {
        ok: true,
        ticketsCreados: base.ticketsCreados,
        ticketsAsignadosExtra: sincronizacion.ticketsAsignadosExtra,
        rifa: {
          id: rifa.id,
          nombre: rifa.nombre,
          estado: soldOut ? "agotada" : rifa.estado,
          total_numeros: totalNumeros,
          tickets_vendidos: ticketsVendidos,
          tickets_disponibles: ticketsDisponibles,
          porcentaje_vendido: porcentajeVendido,
          sold_out: soldOut,
          stats: {
            total: totalNumeros,
            vendidos: ticketsVendidos,
            disponibles: ticketsDisponibles,
            porcentaje: porcentajeVendido,
            soldOut,
            ticketsVendidos,
            porcentajeVendido,
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
    console.error("sincronizar-rifa error:", error);
    return errorResponse(error.message || "Error interno del servidor", 500);
  }
}