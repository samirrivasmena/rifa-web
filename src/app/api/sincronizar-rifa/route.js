import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", Expires: "0" };
function respuesta(data, status = 200) {
  return NextResponse.json(data, { status, headers });
}
export async function GET(req) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return respuesta({ error: auth.error }, auth.status);
    const rifaId = String(new URL(req.url).searchParams.get("rifaId") || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rifaId)) {
      return respuesta({ error: "ID de rifa inválido" }, 400);
    }
    const { data: rifa, error: rifaError } = await supabaseAdmin.from("rifas").select("id,nombre,estado").eq("id", rifaId).maybeSingle();
    if (rifaError) throw rifaError;
    if (!rifa) return respuesta({ error: "La rifa no existe" }, 404);
    const { data, error } = await supabaseAdmin.rpc("get_rifa_stats_seleccion_manual", { p_rifa_id: rifaId });
    if (error) throw error;
    const s = Array.isArray(data) ? data[0] : data;
    if (!s) throw new Error("Sin estadísticas");
    const total = Number(s.total_numeros);
    const ocupados = Number(s.tickets_ocupados);
    const disponibles = Number(s.tickets_disponibles);
    const porcentaje = Number(s.porcentaje_ocupado);
    const soldOut = s.sold_out === true;
    return respuesta({
      ok: true, soloLectura: true, ticketsCreados: 0, ticketsAsignadosExtra: 0,
      rifa: {
        id: rifa.id, nombre: rifa.nombre, estado: rifa.estado,
        total_numeros: total, tickets_vendidos: ocupados, tickets_ocupados: ocupados,
        tickets_disponibles: disponibles, tickets_reservados: Number(s.tickets_reservados),
        tickets_pagados: Number(s.tickets_pagados), tickets_free: Number(s.tickets_free),
        tickets_reservas_vencidas: Number(s.tickets_reservas_vencidas),
        tickets_otros_ocupados: Number(s.tickets_otros_ocupados),
        porcentaje_vendido: porcentaje, porcentaje_ocupado: porcentaje,
        porcentaje_pagado: Number(s.porcentaje_vendido), sold_out: soldOut,
        stats: { total, vendidos: ocupados, disponibles, porcentaje, soldOut, ticketsVendidos: ocupados, porcentajeVendido: porcentaje }
      }
    });
  } catch (error) {
    console.error("sincronizar-rifa error:", error);
    return respuesta({ error: "No se pudieron consultar las estadísticas de la rifa" }, 500);
  }
}
