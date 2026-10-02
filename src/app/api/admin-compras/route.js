import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function traerTodosLosTickets(rifaId = null) {
  const pageSize = 1000;
  let from = 0;
  let allTickets = [];

  while (true) {
let query = supabaseAdmin
  .from("tickets")
  .select(`
    id,
    rifa_id,
    numero_ticket,
    compra_id,
    estado,
    tipo,
    free_drop_id,
    free_drop_participation_id,
    asignado_at,
    fecha_asignacion,
    asignado_a_nombre,
    asignado_a_email,
    asignado_a_telefono
  `)
  .neq("estado", "disponible")
  .order("numero_ticket", { ascending: true })
  .range(from, from + pageSize - 1);

if (rifaId) {
  query = query.eq("rifa_id", rifaId);
}

const { data, error } = await query;

    if (error) throw error;

    allTickets = [...allTickets, ...(data || [])];

    if (!data || data.length < pageSize) break;

    from += pageSize;
  }

  return allTickets;
}

function normalizarCompra(compra = {}) {
  return {
    ...compra,
    total: compra.monto_total ?? compra.total ?? 0,
  };
}

export async function GET(req) {
  const auth = await requireAdmin(req);

if (!auth.ok) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

const { searchParams } = new URL(req.url);
const rifaId = searchParams.get("rifaId");

try {
const [comprasResult, tickets] = await Promise.all([
  supabaseAdmin
    .from("compras")
    .select(`
      id,
      rifa_id,
      usuario_id,
      cantidad_tickets,
      monto_total,
      referencia,
      metodo_pago,
      estado_pago,
      comprobante_url,
      fecha_compra,
      created_at,
      usuarios (
        id,
        nombre,
        email,
        telefono
      ),
      rifas (
        id,
        nombre,
        premio,
        descripcion,
        portada_url,
        portada_scroll_url,
        fecha_sorteo,
        hora_sorteo,
        formato,
        estado
      )
    `)
    .order("fecha_compra", { ascending: false }),

  traerTodosLosTickets(rifaId),
]);

const {
  data: comprasBase,
  error: comprasError,
} = comprasResult;

if (comprasError) {
  return NextResponse.json(
    {
      error:
        comprasError.message ||
        "Error al cargar compras",
    },
    {
      status: 500,
    }
  );
}

const compras = Array.isArray(comprasBase)
  ? comprasBase.map(normalizarCompra)
  : [];

    return NextResponse.json(
      {
        ok: true,
        compras,
        tickets: tickets || [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("admin-compras error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}