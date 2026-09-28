import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function esUuidValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor || "").trim()
  );
}

function normalizarNumero(valor, padLength = 4) {
  if (valor === undefined || valor === null || valor === "") return null;

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");
  if (!soloNumeros) return null;

  const numero = Number(soloNumeros);
  if (!Number.isInteger(numero)) return null;

  return {
    numero,
    numeroOficial: String(numero).padStart(padLength, "0"),
  };
}

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();

    const rifaId = String(body.rifaId ?? body.rifa_id ?? "").trim();

    const padLength = Number.isInteger(Number(body.padLength))
      ? Number(body.padLength)
      : 4;

    const numeroNormalizado = normalizarNumero(
      body.numero ?? body.numero_ticket,
      padLength
    );

    if (
      !rifaId ||
      rifaId === "null" ||
      rifaId === "undefined" ||
      !esUuidValido(rifaId)
    ) {
      return NextResponse.json(
        { error: "Selecciona una rifa válida antes de buscar el ganador" },
        { status: 400 }
      );
    }

    if (!numeroNormalizado) {
      return NextResponse.json({ error: "Número inválido" }, { status: 400 });
    }

    const { numero, numeroOficial } = numeroNormalizado;

    const { data: rifaData, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, estado")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return NextResponse.json(
        { error: `Error al buscar la rifa: ${rifaError.message}` },
        { status: 500 }
      );
    }

    if (!rifaData) {
      return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
    }

    // Buscar el ticket por número, sin filtrar por compra_id
    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        numero_ticket,
        compra_id,
        rifa_id,
        tipo,
        estado,
        free_drop_id,
        free_drop_participation_id,
        asignado_a_nombre,
        asignado_a_email,
        asignado_a_telefono,
        asignado_at
      `)
      .eq("rifa_id", rifaId)
      .eq("numero_ticket", numero)
      .maybeSingle();

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 });
    }

    if (!ticketData) {
      return NextResponse.json({
        existe: false,
        ocupado: false,
        vendido: false,
        es_free: false,
        tipo: "disponible",
        numero_ticket: numero,
        numero_oficial: numeroOficial,
        compra_id: null,
        usuario: null,
        free_drop: null,
        codigo_free: null,
        participacion: null,
        sorteo: null,
        esGanador: false,
        mensaje: `El número ${numeroOficial} no fue vendido ni asignado por FREE DROP`,
      });
    }

    const estadoTicket = normalizarTexto(ticketData.estado);
    const tipoTicket = normalizarTexto(ticketData.tipo);

    const esCompra = Boolean(ticketData.compra_id);

    const esFreeAsignado =
      tipoTicket === "free" &&
      (estadoTicket === "asignado" ||
        Boolean(ticketData.free_drop_participation_id) ||
        Boolean(ticketData.free_drop_id));

    const ocupado = esCompra || esFreeAsignado;

    if (!ocupado) {
      return NextResponse.json({
        existe: false,
        ocupado: false,
        vendido: false,
        es_free: false,
        tipo: "disponible",
        numero_ticket: numero,
        numero_oficial: numeroOficial,
        compra_id: null,
        usuario: null,
        free_drop: null,
        codigo_free: null,
        participacion: null,
        sorteo: null,
        esGanador: false,
        mensaje: `El número ${numeroOficial} no fue vendido ni asignado por FREE DROP`,
      });
    }

    let compraData = null;
    let usuario = null;
    let participacionFree = null;
    let freeDropData = null;

    if (esCompra) {
      const { data, error } = await supabaseAdmin
        .from("compras")
        .select("id, rifa_id, usuario_id")
        .eq("id", ticketData.compra_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      compraData = data || null;

      if (compraData?.usuario_id) {
        const { data: usuarioData, error: usuarioError } = await supabaseAdmin
          .from("usuarios")
          .select("id, nombre, email, telefono")
          .eq("id", compraData.usuario_id)
          .maybeSingle();

        if (usuarioError) {
          return NextResponse.json({ error: usuarioError.message }, { status: 500 });
        }

        usuario = usuarioData || null;
      }
    }

    if (esFreeAsignado) {
      let freeParticipationQuery = supabaseAdmin
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
          created_at,
          updated_at
        `);

      if (ticketData.free_drop_participation_id) {
        freeParticipationQuery = freeParticipationQuery.eq(
          "id",
          ticketData.free_drop_participation_id
        );
      } else {
        freeParticipationQuery = freeParticipationQuery.eq("ticket_id", ticketData.id);
      }

      const { data: freeData, error: freeError } = await freeParticipationQuery.maybeSingle();

      if (freeError) {
        return NextResponse.json({ error: freeError.message }, { status: 500 });
      }

      participacionFree = freeData || null;

      const freeDropId = participacionFree?.free_drop_id || ticketData.free_drop_id;

      if (freeDropId) {
        const { data: dropData, error: dropError } = await supabaseAdmin
          .from("free_drops")
          .select("id, nombre, numero_drop, estado, rifa_id")
          .eq("id", freeDropId)
          .maybeSingle();

        if (dropError) {
          return NextResponse.json({ error: dropError.message }, { status: 500 });
        }

        freeDropData = dropData || null;
      }

      usuario = {
        id: null,
        nombre: `${participacionFree?.nombre || ""} ${participacionFree?.apellido || ""}`.trim(),
        email: participacionFree?.email || null,
        telefono: participacionFree?.telefono || null,
      };
    }

    const { data: sorteoData } = await supabaseAdmin
      .from("sorteos")
      .select("id, numero_ganador, numero_oficial, fecha_sorteo, fuente, rifa_id")
      .eq("rifa_id", rifaId)
      .maybeSingle();

    const esFree = Boolean(esFreeAsignado);

    return NextResponse.json({
      existe: true,
      ocupado: true,
      vendido: esCompra,
      es_free: esFree,
      tipo: esFree ? "free" : "compra",
      numero_ticket: ticketData.numero_ticket,
      numero_oficial: numeroOficial,
      compra_id: ticketData.compra_id ?? null,
      usuario,
      free_drop: freeDropData
        ? {
            id: freeDropData.id,
            nombre: freeDropData.nombre,
            numero_drop: freeDropData.numero_drop,
            estado: freeDropData.estado,
          }
        : null,
      codigo_free: participacionFree?.codigo_unico || null,
      participacion: participacionFree
        ? {
            ...participacionFree,
            free_drop: freeDropData?.nombre || null,
            numero_participacion: ticketData.numero_ticket,
            codigo: participacionFree.codigo_unico,
          }
        : null,
      sorteo: sorteoData || null,
      esGanador: ocupado,
      mensaje: esFree
        ? `🟢 El número ${numeroOficial} pertenece a una participación FREE válida`
        : `✅ El número ${numeroOficial} sí fue vendido en esta rifa`,
    });
  } catch (error) {
    console.error("verificar-ganador error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}