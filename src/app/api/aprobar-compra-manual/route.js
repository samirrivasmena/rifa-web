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
    const { compraId, rifaId, ticketsSeleccionados } = body;

    if (!compraId || !rifaId || !Array.isArray(ticketsSeleccionados)) {
      return NextResponse.json(
        { error: "Faltan datos requeridos." },
        { status: 400 }
      );
    }

    if (ticketsSeleccionados.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos un ticket." },
        { status: 400 }
      );
    }

    const ticketsNormalizados = ticketsSeleccionados.map((n) => Number(n));

    if (ticketsNormalizados.some((n) => Number.isNaN(n))) {
      return NextResponse.json(
        { error: "Hay tickets inválidos en la selección." },
        { status: 400 }
      );
    }

    const ticketsUnicos = [...new Set(ticketsNormalizados)];

    if (ticketsUnicos.length !== ticketsNormalizados.length) {
      return NextResponse.json(
        { error: "Hay números repetidos en la selección." },
        { status: 400 }
      );
    }

    const { data: compra, error: compraError } = await supabaseAdmin
      .from("compras")
      .select("id, usuario_id, rifa_id, estado_pago, cantidad_tickets")
      .eq("id", compraId)
      .single();

    if (compraError || !compra) {
      return NextResponse.json(
        { error: "No se encontró la compra." },
        { status: 404 }
      );
    }

    if (String(compra.rifa_id) !== String(rifaId)) {
      return NextResponse.json(
        { error: "La compra no pertenece a la rifa seleccionada." },
        { status: 400 }
      );
    }

    if (compra.estado_pago !== "pendiente") {
      return NextResponse.json(
        { error: "La compra ya no está pendiente." },
        { status: 400 }
      );
    }

    const cantidadEsperada = Number(compra.cantidad_tickets) || 0;

    if (ticketsUnicos.length !== cantidadEsperada) {
      return NextResponse.json(
        {
          error: `Debes seleccionar exactamente ${cantidadEsperada} ticket(s).`,
        },
        { status: 400 }
      );
    }

    const { data: rifa, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq("id", rifaId)
      .single();

    if (rifaError || !rifa) {
      return NextResponse.json(
        { error: "No se encontró la rifa." },
        { status: 404 }
      );
    }

    if (rifa.estado !== "activa" && rifa.estado !== "cerrada") {
      return NextResponse.json(
        { error: "La rifa no permite aprobación manual en su estado actual." },
        { status: 400 }
      );
    }

    const numeroInicio = Number(rifa.numero_inicio);
    const numeroFin = Number(rifa.numero_fin);

    for (const numero of ticketsUnicos) {
      if (numero < numeroInicio || numero > numeroFin) {
        return NextResponse.json(
          { error: `El número ${numero} está fuera del rango permitido.` },
          { status: 400 }
        );
      }
    }

    const { data: ticketsExistentes, error: ticketsExistentesError } =
      await supabaseAdmin
        .from("tickets")
        .select("numero_ticket")
        .eq("rifa_id", rifaId)
        .in("numero_ticket", ticketsUnicos);

    if (ticketsExistentesError) {
      return NextResponse.json(
        { error: "Error al validar tickets existentes." },
        { status: 500 }
      );
    }

    if (ticketsExistentes && ticketsExistentes.length > 0) {
      return NextResponse.json(
        {
          error: `Algunos tickets ya fueron vendidos: ${ticketsExistentes
            .map((t) => t.numero_ticket)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    const ticketsInsertar = ticketsUnicos.map((numero) => ({
      compra_id: compra.id,
      rifa_id: rifaId,
      numero_ticket: numero,
    }));

    const { data: ticketsInsertados, error: insertError } = await supabaseAdmin
      .from("tickets")
      .insert(ticketsInsertar)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "No se pudieron guardar los tickets manuales." },
        { status: 500 }
      );
    }

    const { error: updateCompraError } = await supabaseAdmin
      .from("compras")
      .update({ estado_pago: "aprobado" })
      .eq("id", compra.id);

    if (updateCompraError) {
      return NextResponse.json(
        { error: "Los tickets se guardaron, pero no se pudo actualizar la compra." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Compra aprobada manualmente",
      compraId: compra.id,
      tickets: ticketsInsertados || ticketsInsertar,
    });
  } catch (error) {
    console.error("aprobar-compra-manual error:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}