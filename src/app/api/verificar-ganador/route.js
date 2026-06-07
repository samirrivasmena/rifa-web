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

    // IMPORTANTE:
    // Solo cuenta como vendido si el ticket tiene compra_id.
    // Si el número existe en tickets pero compra_id es null, sigue disponible.
    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("rifa_id", rifaId)
      .eq("numero_ticket", numero)
      .not("compra_id", "is", null)
      .maybeSingle();

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 });
    }

    if (!ticketData) {
      return NextResponse.json({
        existe: false,
        vendido: false,
        numero_ticket: numero,
        numero_oficial: numeroOficial,
        compra_id: null,
        usuario: null,
        sorteo: null,
        esGanador: false,
      });
    }

    let compraData = null;

    if (ticketData.compra_id) {
      const { data, error } = await supabaseAdmin
        .from("compras")
        .select("id, rifa_id, usuario_id")
        .eq("id", ticketData.compra_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      compraData = data || null;
    }

    let usuario = null;

    if (compraData?.usuario_id) {
      const { data: usuarioData } = await supabaseAdmin
        .from("usuarios")
        .select("id, nombre, email, telefono")
        .eq("id", compraData.usuario_id)
        .maybeSingle();

      usuario = usuarioData || null;
    }

    const { data: sorteoData } = await supabaseAdmin
      .from("sorteos")
      .select("id, numero_ganador, numero_oficial, fecha_sorteo, fuente, rifa_id")
      .eq("rifa_id", rifaId)
      .maybeSingle();

    return NextResponse.json({
      existe: true,
      vendido: true,
      numero_ticket: ticketData.numero_ticket,
      numero_oficial: numeroOficial,
      compra_id: ticketData.compra_id,
      usuario,
      sorteo: sorteoData || null,
      esGanador: Boolean(sorteoData),
    });
  } catch (error) {
    console.error("verificar-ganador error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}