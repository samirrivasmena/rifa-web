
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const TAMANO_PAGINA = 100;
const HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pendientes = new Map();

function responder(body, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

async function compartir(clave, tarea) {
  if (pendientes.has(clave)) return pendientes.get(clave);
  if (pendientes.size >= 200) return tarea();
  const promesa = Promise.resolve().then(tarea);
  pendientes.set(clave, promesa);
  try {
    return await promesa;
  } finally {
    if (pendientes.get(clave) === promesa) pendientes.delete(clave);
  }
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const rifaId = (params.get("rifaId") || "").trim().toLowerCase();
    const desdeTexto = params.get("desde");

    if (!UUID.test(rifaId)) {
      return responder({ ok: false, error: "Rifa inválida" }, 400);
    }

    if (desdeTexto !== null && !/^\d{1,10}$/.test(desdeTexto)) {
      return responder({ ok: false, error: "Página inválida" }, 400);
    }

    const [consultaRifa, consultaSettings] = await compartir(
      `config:${rifaId}`,
      () => Promise.all([
        supabaseAdmin
          .from("rifas")
          .select("numero_inicio,numero_fin,publicada,estado")
          .eq("id", rifaId)
          .maybeSingle(),
        supabaseAdmin
          .from("seleccion_manual_settings")
          .select("enabled,modo_compra,bendecidos_activos")
          .eq("rifa_id", rifaId)
          .maybeSingle()
      ])
    );

    if (consultaRifa.error || consultaSettings.error) {
      return responder({ ok: false, error: "No se pudo consultar la rifa" }, 503);
    }

    const rifa = consultaRifa.data;
    const settings = consultaSettings.data;

    if (
      !rifa ||
      rifa.publicada !== true ||
      !["activa", "disponible", "publicada"].includes(
        String(rifa.estado || "").trim().toLowerCase()
      )
    ) {
      return responder({ ok: false, error: "Rifa no disponible" }, 404);
    }

    if (
      settings?.enabled !== true ||
      !["ambos", "manual"].includes(settings.modo_compra)
    ) {
      return responder({ ok: false, error: "Selección manual no disponible" }, 403);
    }

    const bendecidosActivos = settings.bendecidos_activos === true;
    const inicio = Number(rifa.numero_inicio);
    const fin = Number(rifa.numero_fin);

    if (
      rifa.numero_inicio == null ||
      rifa.numero_fin == null ||
      !Number.isSafeInteger(inicio) ||
      !Number.isSafeInteger(fin) ||
      inicio < 0 ||
      fin < inicio
    ) {
      return responder({ ok: false, error: "Rango de rifa inválido" }, 409);
    }

    const solicitado = desdeTexto === null ? inicio : Number(desdeTexto);

    if (
      !Number.isSafeInteger(solicitado) ||
      solicitado < inicio ||
      solicitado > fin
    ) {
      return responder({ ok: false, error: "Página fuera del rango de la rifa" }, 400);
    }

    const pagina = inicio + Math.floor(
      (solicitado - inicio) / TAMANO_PAGINA
    ) * TAMANO_PAGINA;

    const hasta = Math.min(fin, pagina + TAMANO_PAGINA - 1);

    const { data: tickets, error: errorTickets } = await compartir(
      `tickets:${rifaId}:${pagina}:${hasta}`,
      () => supabaseAdmin
        .from("tickets")
        .select("numero_ticket,estado,compra_id,free_drop_id,free_drop_participation_id,tipo,reserva_expira_at,premio_bendecido")
        .eq("rifa_id", rifaId)
        .gte("numero_ticket", pagina)
        .lte("numero_ticket", hasta)
    );

    if (errorTickets || !Array.isArray(tickets)) {
      return responder({ ok: false, error: "No se pudo consultar disponibilidad" }, 503);
    }

    const estados = new Map();

    for (const ticket of tickets) {
      const numero = Number(ticket.numero_ticket);
      const estado = String(ticket.estado || "").trim().toLowerCase();
      const tipo = String(ticket.tipo || "").trim().toLowerCase();
      const premio = Number(ticket.premio_bendecido || 0);

      const esFree =
        ticket.free_drop_id != null ||
        ticket.free_drop_participation_id != null ||
        tipo.includes("free");

      const reservado =
        estado === "reservado" &&
        ticket.compra_id != null &&
        ticket.reserva_expira_at != null &&
        !esFree;

      const ocupado =
        estado !== "disponible" ||
        ticket.compra_id != null ||
        esFree ||
        ticket.reserva_expira_at != null;

      if (reservado) {
        estados.set(numero, "reservado");
      } else if (ocupado) {
        estados.set(numero, "ocupado");
      } else if (bendecidosActivos && premio > 0) {
        estados.set(numero, "solo_azar");
      } else {
        estados.set(numero, "disponible");
      }
    }

    const numeros = Array.from(
      { length: hasta - pagina + 1 },
      (_, i) => {
        const numero = pagina + i;
        const estado = estados.get(numero) || "disponible";

        return {
          numero,
          disponible: estado === "disponible",
          estado
        };
      }
    );

    return responder({
      ok: true,
      inicio,
      fin,
      desde: pagina,
      hasta,
      bendecidos_activos: bendecidosActivos,
      numeros
    });

  } catch (error) {
    console.error("numeros-disponibles:", error?.message);
    return responder({ ok: false, error: "Error consultando números" }, 500);
  }
}
