import { NextResponse } from "next/server";
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

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function esCompraAsignada(ticket = {}) {
  return ticket?.compra_id !== null && ticket?.compra_id !== undefined;
}

function esFreeAsignado(ticket = {}) {
  return Boolean(
    ticket?.free_drop_id ||
      ticket?.free_drop_participation_id ||
      normalizarTexto(ticket?.tipo) === "free"
  );
}

function esTicketOcupado(ticket = {}) {
  return esCompraAsignada(ticket) || esFreeAsignado(ticket);
}

function getNombreCompleto(persona = {}) {
  const nombre = limpiarTexto(persona?.nombre);
  const apellido = limpiarTexto(persona?.apellido);
  return [nombre, apellido].filter(Boolean).join(" ").trim();
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

    const { data: ticketsBase, error: errorTickets } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        rifa_id,
        compra_id,
        numero_ticket,
        tipo,
        estado,
        free_drop_id,
        free_drop_participation_id,
        asignado_a_nombre,
        asignado_a_email,
        asignado_a_telefono,
        asignado_at,
        fecha_asignacion,
        created_at
      `)
.eq("rifa_id", rifaId)
.neq("estado", "disponible")
.order("numero_ticket", { ascending: true });

    if (errorTickets) {
      return errorResponse(
        errorTickets.message || "No se pudieron cargar los tickets",
        500
      );
    }

    const tickets = Array.isArray(ticketsBase) ? ticketsBase : [];

    const compraIds = [
      ...new Set(
        tickets
          .map((ticket) => ticket.compra_id)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    const freeParticipationIds = [
      ...new Set(
        tickets
          .map((ticket) => ticket.free_drop_participation_id)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    const freeDropIds = [
      ...new Set(
        tickets
          .map((ticket) => ticket.free_drop_id)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    const [comprasRes, participacionesRes, dropsRes] = await Promise.all([
      compraIds.length
        ? supabaseAdmin
            .from("compras")
            .select(`
              id,
              rifa_id,
              usuario_id,
              referencia,
              metodo_pago,
              monto_total,
              estado_pago,
              created_at,
              usuarios (
                nombre,
                email,
                telefono
              )
            `)
            .in("id", compraIds)
        : Promise.resolve({ data: [], error: null }),

      freeParticipationIds.length
        ? supabaseAdmin
            .from("free_drop_participations")
            .select(`
              id,
              rifa_id,
              free_drop_id,
              ticket_id,
              nombre,
              apellido,
              email,
              telefono,
              codigo_unico,
              estado,
              estado_residencia,
              acepta_reglas,
              cumple_requisitos,
              social_username,
              evidence_url,
              created_at
            `)
            .in("id", freeParticipationIds)
        : Promise.resolve({ data: [], error: null }),

      freeDropIds.length
        ? supabaseAdmin
            .from("free_drops")
            .select(`
              id,
              rifa_id,
              nombre,
              numero_drop,
              estado,
              cupos_total,
              cupos_usados
            `)
            .in("id", freeDropIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (comprasRes.error) {
      return errorResponse(
        comprasRes.error.message || "No se pudieron cargar las compras",
        500
      );
    }

    if (participacionesRes.error) {
      return errorResponse(
        participacionesRes.error.message ||
          "No se pudieron cargar las participaciones FREE",
        500
      );
    }

    if (dropsRes.error) {
      return errorResponse(
        dropsRes.error.message || "No se pudieron cargar los free drops",
        500
      );
    }

    const comprasMap = new Map(
      (comprasRes.data || []).map((item) => [
        String(item.id),
        {
          ...item,
          total: item.monto_total ?? 0,
        },
      ])
    );

    const participacionesMap = new Map(
      (participacionesRes.data || []).map((item) => [String(item.id), item])
    );

    const dropsMap = new Map(
      (dropsRes.data || []).map((item) => [String(item.id), item])
    );

    const ticketsEnriquecidos = tickets
      .map((ticket) => {
        const numero = Number(ticket.numero_ticket);
        if (!Number.isFinite(numero)) return null;

        const compra = ticket.compra_id
          ? comprasMap.get(String(ticket.compra_id)) || null
          : null;

        const usuarioCompra = compra?.usuarios || compra?.usuario || {};
        const freeParticipation = ticket.free_drop_participation_id
          ? participacionesMap.get(String(ticket.free_drop_participation_id)) || null
          : null;

        const freeDrop = ticket.free_drop_id
          ? dropsMap.get(String(ticket.free_drop_id)) || null
          : null;

        const esFree = esFreeAsignado(ticket);
        const esCompra = esCompraAsignada(ticket) && !esFree;
        const ocupado = esCompra || esFree;

        const nombreCliente =
          getNombreCompleto(usuarioCompra) ||
          limpiarTexto(compra?.nombre) ||
          limpiarTexto(ticket.asignado_a_nombre) ||
          "Sin nombre";

        const emailCliente =
          limpiarTexto(usuarioCompra?.email) ||
          limpiarTexto(compra?.email) ||
          limpiarTexto(ticket.asignado_a_email) ||
          "Sin email";

        const telefonoCliente =
          limpiarTexto(usuarioCompra?.telefono) ||
          limpiarTexto(compra?.telefono) ||
          limpiarTexto(ticket.asignado_a_telefono) ||
          "Sin teléfono";

        const freeNombre =
          getNombreCompleto(freeParticipation) ||
          limpiarTexto(ticket.asignado_a_nombre) ||
          "Sin nombre";

        const freeEmail =
          limpiarTexto(freeParticipation?.email) ||
          limpiarTexto(ticket.asignado_a_email) ||
          "Sin email";

        const freeTelefono =
          limpiarTexto(freeParticipation?.telefono) ||
          limpiarTexto(ticket.asignado_a_telefono) ||
          "Sin teléfono";

        const codigoFree =
          limpiarTexto(freeParticipation?.codigo_unico) ||
          limpiarTexto(freeParticipation?.codigo_free) ||
          limpiarTexto(ticket?.codigo_unico) ||
          limpiarTexto(ticket?.codigo_free) ||
          "Sin código";

        const freeDropNombre =
          freeDrop?.nombre ||
          `FREE DROP #${freeDrop?.numero_drop || ""}`.trim();

        return {
          ...ticket,
          numero_ticket: numero,
          ocupado,
          vendido: esCompra,
          es_free: esFree,
          disponible: !ocupado,
          estado_visual: esFree
            ? "FREE"
            : esCompra
            ? "OCUPADO"
            : "DISPONIBLE",
          tipo_normalizado: esFree ? "free" : ticket.tipo || null,
          compra: null,
          nombreCliente,
          emailCliente,
          telefonoCliente,
          free_drop_participation: freeParticipation,
          free_drop: freeDrop,
          freeNombre,
          freeEmail,
          freeTelefono,
          codigoFree,
          freeDropNombre,
        };
      })
      .filter(Boolean);

    return NextResponse.json(
      {
        ok: true,
        tickets: ticketsEnriquecidos,
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
    console.error("admin-tickets-rifa error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}