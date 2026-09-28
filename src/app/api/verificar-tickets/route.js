import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function estadoAprobado(estado) {
  return [
    "aprobado",
    "aprobada",
    "approved",
    "pagado",
    "pagada",
    "valida",
    "válida",
    "activo",
    "activa",
  ].includes(limpiarTexto(estado));
}

export async function POST(req) {
  try {
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const rifaId = body.rifaId ? String(body.rifaId).trim() : "";

    if (!email || !validarEmail(email)) {
      return NextResponse.json(
        { error: "Correo electrónico inválido" },
        { status: 400 }
      );
    }

    if (!rifaId) {
      return NextResponse.json(
        { error: "La rifa es requerida para verificar los tickets" },
        { status: 400 }
      );
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, formato")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return NextResponse.json(
        { error: rifaError.message || "Error buscando la rifa" },
        { status: 500 }
      );
    }

    if (!rifa) {
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 404 }
      );
    }

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id, nombre, email")
      .ilike("email", email)
      .maybeSingle();

    if (usuarioError) {
      return NextResponse.json(
        { error: usuarioError.message || "Error buscando usuario" },
        { status: 500 }
      );
    }

    if (!usuario) {
      return NextResponse.json({
        ok: true,
        encontrado: false,
        mensaje: "No se encontraron compras con ese correo en esta rifa",
        usuario: null,
        rifa,
        compras: [],
        tickets: [],
      });
    }

    const { data: comprasData, error: comprasError } = await supabaseAdmin
      .from("compras")
      .select(`
        id,
        usuario_id,
        rifa_id,
        estado_pago,
        fecha_compra,
        cantidad_tickets,
        monto_total,
        referencia,
        metodo_pago,
        created_at,
        rifas (
          id,
          nombre,
          formato
        )
      `)
      .eq("usuario_id", usuario.id)
      .eq("rifa_id", rifaId)
      .order("fecha_compra", { ascending: false });

    if (comprasError) {
      return NextResponse.json(
        { error: comprasError.message || "Error buscando compras" },
        { status: 500 }
      );
    }

    const compras = Array.isArray(comprasData) ? comprasData : [];

    if (compras.length === 0) {
      return NextResponse.json({
        ok: true,
        encontrado: false,
        mensaje: "No se encontraron compras con ese correo en esta rifa",
        usuario,
        rifa,
        compras: [],
        tickets: [],
      });
    }

    const comprasAprobadas = compras.filter((compra) =>
      estadoAprobado(compra.estado_pago)
    );

    const compraIdsAprobadas = comprasAprobadas.map((compra) => compra.id);

    let tickets = [];

    if (compraIdsAprobadas.length > 0) {
      const { data: ticketsData, error: ticketsError } = await supabaseAdmin
        .from("tickets")
        .select(`
          id,
          numero_ticket,
          estado,
          compra_id,
          rifa_id,
          tipo,
          created_at
        `)
        .in("compra_id", compraIdsAprobadas)
        .eq("rifa_id", rifaId)
        .order("numero_ticket", { ascending: true });

      if (ticketsError) {
        return NextResponse.json(
          { error: ticketsError.message || "Error buscando tickets" },
          { status: 500 }
        );
      }

      tickets = Array.isArray(ticketsData) ? ticketsData : [];
    }

    const mensaje =
      comprasAprobadas.length > 0
        ? "Se encontraron tickets aprobados para este correo en esta rifa"
        : "Se encontraron compras en esta rifa, pero aún no han sido aprobadas";

    return NextResponse.json({
      ok: true,
      encontrado: true,
      mensaje,
      usuario,
      rifa,
      compras,
      tickets,
    });
  } catch (error) {
    console.error("verificar-tickets error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}