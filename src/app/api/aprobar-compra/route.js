import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();
    const { compraId } = body;

    if (!compraId) {
      return NextResponse.json(
        { error: "Falta el ID de la compra" },
        { status: 400 }
      );
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, estado_pago, cantidad_tickets, rifa_id")
      .eq("id", compraId)
      .maybeSingle();

    if (compraError) {
      return NextResponse.json(
        { error: compraError.message },
        { status: 500 }
      );
    }

    if (!compra) {
      return NextResponse.json(
        { error: "La compra no existe" },
        { status: 404 }
      );
    }

    if (compra.estado_pago === "aprobado") {
      return NextResponse.json(
        { error: "La compra ya fue aprobada" },
        { status: 400 }
      );
    }

    if (compra.estado_pago === "rechazado") {
      return NextResponse.json(
        { error: "La compra fue rechazada y no puede aprobarse" },
        { status: 400 }
      );
    }

    const cantidadTickets = Number(compra.cantidad_tickets) || 0;

    if (cantidadTickets <= 0) {
      return NextResponse.json(
        { error: "La compra no tiene una cantidad válida de tickets" },
        { status: 400 }
      );
    }

    let rifaId = compra.rifa_id;

    if (!rifaId) {
      const { data: rifaActiva, error: rifaActivaError } = await supabaseAdmin
        .from("rifas")
        .select("*")
        .eq("estado", "activa")
        .limit(1)
        .maybeSingle();

      if (rifaActivaError) {
        return NextResponse.json(
          { error: rifaActivaError.message },
          { status: 500 }
        );
      }

      if (!rifaActiva) {
        return NextResponse.json(
          { error: "No hay una rifa activa disponible" },
          { status: 400 }
        );
      }

      rifaId = rifaActiva.id;

      const { error: updateCompraRifaError } = await supabaseAdmin
        .from("compras")
        .update({ rifa_id: rifaId })
        .eq("id", compra.id);

      if (updateCompraRifaError) {
        return NextResponse.json(
          { error: updateCompraRifaError.message },
          { status: 500 }
        );
      }
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return NextResponse.json(
        { error: rifaError.message },
        { status: 500 }
      );
    }

    if (!rifa) {
      return NextResponse.json(
        { error: "La rifa asociada no existe" },
        { status: 404 }
      );
    }

    if (rifa.estado !== "activa") {
      return NextResponse.json(
        { error: "La rifa no está activa para aprobar compras automáticamente" },
        { status: 400 }
      );
    }

    const { data: ticketsExistentes, error: ticketsExistentesError } = await supabaseAdmin
      .from("tickets")
      .select("numero_ticket")
      .eq("rifa_id", rifa.id);

    if (ticketsExistentesError) {
      return NextResponse.json(
        { error: ticketsExistentesError.message },
        { status: 500 }
      );
    }

    const numerosOcupados = new Set(
      (ticketsExistentes || []).map((t) => Number(t.numero_ticket))
    );

    const disponibles = [];
    for (let i = Number(rifa.numero_inicio); i <= Number(rifa.numero_fin); i++) {
      if (!numerosOcupados.has(i)) {
        disponibles.push(i);
      }
    }

    if (disponibles.length < cantidadTickets) {
      return NextResponse.json(
        { error: "No hay suficientes números disponibles en esta rifa" },
        { status: 400 }
      );
    }

    const disponiblesMezclados = [...disponibles].sort(() => Math.random() - 0.5);
    const seleccionados = disponiblesMezclados.slice(0, cantidadTickets);

    const ticketsParaInsertar = seleccionados.map((numero) => ({
      compra_id: compra.id,
      rifa_id: rifa.id,
      numero_ticket: numero,
    }));

    const { data: nuevosTickets, error: insertTicketsError } = await supabaseAdmin
      .from("tickets")
      .insert(ticketsParaInsertar)
      .select();

    if (insertTicketsError) {
      return NextResponse.json(
        { error: insertTicketsError.message },
        { status: 500 }
      );
    }

    const { error: aprobarCompraError } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago: "aprobado",
        rifa_id: rifa.id,
      })
      .eq("id", compra.id);

    if (aprobarCompraError) {
      return NextResponse.json(
        { error: aprobarCompraError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tickets: nuevosTickets || [],
      rifa: {
        id: rifa.id,
        nombre: rifa.nombre,
        formato: rifa.formato,
      },
    });
  } catch (error) {
    console.error("aprobar-compra error:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}