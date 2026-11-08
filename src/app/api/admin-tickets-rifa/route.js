
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const PAGE_SIZE = 500;
const IN_BATCH_SIZE = 200;

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const id = limpiarTexto(valor);

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  );
}

function normalizarTexto(valor) {
  return limpiarTexto(valor).toLowerCase();
}

function esCompraAsignada(ticket = {}) {
  return ticket?.compra_id != null;
}

function esFreeAsignado(ticket = {}) {
  return Boolean(
    ticket?.free_drop_id != null ||
      ticket?.free_drop_participation_id != null ||
      normalizarTexto(ticket?.tipo) === "free"
  );
}

function esTicketDisponible(ticket = {}) {
  return (
    normalizarTexto(ticket?.estado) === "disponible" &&
    !esCompraAsignada(ticket) &&
    !esFreeAsignado(ticket)
  );
}

function getNombreCompleto(persona = {}) {
  const nombre = limpiarTexto(persona?.nombre);
  const apellido = limpiarTexto(persona?.apellido);

  return [nombre, apellido].filter(Boolean).join(" ").trim();
}

function dividirEnLotes(lista, tamano = IN_BATCH_SIZE) {
  const lotes = [];

  for (let i = 0; i < lista.length; i += tamano) {
    lotes.push(lista.slice(i, i + tamano));
  }

  return lotes;
}

async function consultarTodosLosTickets(rifaId) {
  const todos = [];
  let desde = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
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
      .or(
        "estado.neq.disponible," +
        "compra_id.not.is.null," +
        "free_drop_id.not.is.null," +
        "free_drop_participation_id.not.is.null," +
        "tipo.eq.free"
      )
      .order("numero_ticket", { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        error.message || "No se pudieron cargar los tickets"
      );
    }

    const pagina = Array.isArray(data) ? data : [];
    todos.push(...pagina);

    if (pagina.length < PAGE_SIZE) {
      break;
    }

    desde += PAGE_SIZE;
  }

  return todos;
}

async function consultarPorIds(tabla, campos, ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];

  if (unicos.length === 0) {
    return [];
  }

  const resultados = [];

  for (const lote of dividirEnLotes(unicos)) {
    const { data, error } = await supabaseAdmin
      .from(tabla)
      .select(campos)
      .in("id", lote);

    if (error) {
      throw new Error(
        error.message || `No se pudo consultar ${tabla}`
      );
    }

    resultados.push(...(Array.isArray(data) ? data : []));
  }

  return resultados;
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
      return errorResponse("rifaId inválido", 400);
    }

    // Solo leemos tickets ocupados o reservados.
    // Los disponibles no necesitan descargarse para la cuadrícula.
    const tickets = await consultarTodosLosTickets(rifaId);

    const compraIds = tickets
      .map((ticket) => ticket.compra_id)
      .filter(Boolean);

    const freeParticipationIds = tickets
      .map((ticket) => ticket.free_drop_participation_id)
      .filter(Boolean);

    const freeDropIds = tickets
      .map((ticket) => ticket.free_drop_id)
      .filter(Boolean);

    const [comprasData, participacionesData, dropsData] =
      await Promise.all([
        consultarPorIds(
          "compras",
          `
            id,
            rifa_id,
            usuario_id,
            referencia,
            metodo_pago,
            monto_total,
            estado_pago,
            created_at,
            nombre_cliente,
            email_cliente,
            telefono_cliente,
            usuarios (
              nombre,
              email,
              telefono
            )
          `,
          compraIds
        ),

        consultarPorIds(
          "free_drop_participations",
          `
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
          `,
          freeParticipationIds
        ),

        consultarPorIds(
          "free_drops",
          `
            id,
            rifa_id,
            nombre,
            numero_drop,
            estado,
            cupos_total,
            cupos_usados
          `,
          freeDropIds
        ),
      ]);

    const comprasMap = new Map(
      comprasData.map((item) => [
        String(item.id),
        {
          ...item,
          total: item.monto_total ?? 0,
        },
      ])
    );

    const participacionesMap = new Map(
      participacionesData.map((item) => [
        String(item.id),
        item,
      ])
    );

    const dropsMap = new Map(
      dropsData.map((item) => [
        String(item.id),
        item,
      ])
    );

    const ticketsEnriquecidos = tickets
      .map((ticket) => {
        const numero = Number(ticket.numero_ticket);

        if (!Number.isFinite(numero)) {
          return null;
        }

        const compra = ticket.compra_id
          ? comprasMap.get(String(ticket.compra_id)) || null
          : null;

        const usuarioCompra =
          compra?.usuarios || compra?.usuario || {};

        const freeParticipation =
          ticket.free_drop_participation_id
            ? participacionesMap.get(
                String(ticket.free_drop_participation_id)
              ) || null
            : null;

        const freeDrop = ticket.free_drop_id
          ? dropsMap.get(String(ticket.free_drop_id)) || null
          : null;

        const esFree = esFreeAsignado(ticket);
        const esCompra = esCompraAsignada(ticket) && !esFree;
        const disponible = esTicketDisponible(ticket);
        const ocupado = !disponible;

        const nombreCliente =
          getNombreCompleto(usuarioCompra) ||
          limpiarTexto(compra?.nombre_cliente) ||
          limpiarTexto(ticket.asignado_a_nombre) ||
          "Sin nombre";

        const emailCliente =
          limpiarTexto(usuarioCompra?.email) ||
          limpiarTexto(compra?.email_cliente) ||
          limpiarTexto(ticket.asignado_a_email) ||
          "Sin email";

        const telefonoCliente =
          limpiarTexto(usuarioCompra?.telefono) ||
          limpiarTexto(compra?.telefono_cliente) ||
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
          disponible,
          estado_visual: esFree
            ? "FREE"
            : esCompra
            ? "OCUPADO"
            : ocupado
            ? "RESERVADO"
            : "DISPONIBLE",
          tipo_normalizado: esFree
            ? "free"
            : ticket.tipo || null,
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
      {
        error:
          error?.message ||
          "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
