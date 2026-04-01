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

    const {
      rifaId,
      nombre,
      descripcion,
      premio,
      precio_ticket,
      formato,
      fecha_sorteo,
      hora_sorteo,
      fecha_cierre,
      publicada,
      destacada,
    } = body;

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre de la rifa es obligatorio" },
        { status: 400 }
      );
    }

    if (!formato) {
      return NextResponse.json(
        { error: "El formato de la rifa es obligatorio" },
        { status: 400 }
      );
    }

    if (
      precio_ticket === undefined ||
      precio_ticket === null ||
      String(precio_ticket).trim() === ""
    ) {
      return NextResponse.json(
        { error: "El precio del ticket es obligatorio" },
        { status: 400 }
      );
    }

    const precioNormalizado = Number(precio_ticket);

    if (Number.isNaN(precioNormalizado) || precioNormalizado <= 0) {
      return NextResponse.json(
        { error: "El precio del ticket debe ser mayor a 0" },
        { status: 400 }
      );
    }

    let numero_inicio = 1;
    let numero_fin = 9999;

    if (formato === "3digitos") {
      numero_inicio = 1;
      numero_fin = 999;
    } else if (formato === "4digitos") {
      numero_inicio = 1;
      numero_fin = 9999;
    } else {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      );
    }

    const updateData = {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      premio: premio?.trim() || null,
      precio_ticket: precioNormalizado,
      formato,
      numero_inicio,
      numero_fin,
      fecha_sorteo: fecha_sorteo || null,
      hora_sorteo: hora_sorteo || null,
      fecha_cierre: fecha_cierre || null,
      publicada: Boolean(publicada),
      destacada: Boolean(destacada),
    };

    const { data, error } = await supabaseAdmin
      .from("rifas")
      .update(updateData)
      .eq("id", rifaId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo actualizar la rifa" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rifa actualizada correctamente",
      rifa: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}