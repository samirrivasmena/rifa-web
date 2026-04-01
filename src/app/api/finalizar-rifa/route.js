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
    const { rifaId, numeroGanador } = body;

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    if (numeroGanador === undefined || numeroGanador === null) {
      return NextResponse.json(
        { error: "Falta el número ganador" },
        { status: 400 }
      );
    }

    const numero = Number(numeroGanador);

    if (Number.isNaN(numero)) {
      return NextResponse.json(
        { error: "Número ganador inválido" },
        { status: 400 }
      );
    }

    const { data: rifaData, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, numero_inicio, numero_fin, estado")
      .eq("id", rifaId)
      .single();

    if (rifaError || !rifaData) {
      console.error("Error buscando rifa:", rifaError);
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 404 }
      );
    }

    if (
      numero < Number(rifaData.numero_inicio) ||
      numero > Number(rifaData.numero_fin)
    ) {
      return NextResponse.json(
        { error: "El número ganador está fuera del rango de la rifa" },
        { status: 400 }
      );
    }

    const { data: sorteoExistente, error: sorteoExistenteError } = await supabaseAdmin
      .from("sorteos")
      .select("id, numero_ganador, rifa_id")
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (sorteoExistenteError) {
      console.error("Error verificando sorteo existente:", sorteoExistenteError);
      return NextResponse.json(
        { error: "Error al verificar si la rifa ya tiene sorteo" },
        { status: 500 }
      );
    }

    let numeroFinal = numero;
    let sorteoFinal = sorteoExistente || null;

    if (!sorteoExistente) {
      const { data: sorteoCreado, error: insertError } = await supabaseAdmin
        .from("sorteos")
        .insert([
          {
            numero_ganador: numero,
            numero_oficial: String(numero),
            fecha_sorteo: new Date().toISOString(),
            fuente: rifaData.nombre || "Rifa",
            rifa_id: rifaId,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("Error insertando sorteo:", insertError);
        return NextResponse.json(
          { error: "No se pudo registrar el sorteo" },
          { status: 500 }
        );
      }

      sorteoFinal = sorteoCreado;
      numeroFinal = Number(sorteoCreado.numero_ganador);
    }

    const { data: rifaActualizada, error: updateError } = await supabaseAdmin
      .from("rifas")
      .update({ estado: "finalizada" })
      .eq("id", rifaId)
      .select()
      .single();

    if (updateError) {
      console.error("Error actualizando estado de la rifa:", updateError);
      return NextResponse.json(
        { error: "No se pudo actualizar la rifa a finalizada" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Rifa finalizada correctamente",
      numero_ganador: numeroFinal,
      sorteo: sorteoFinal,
      rifa: rifaActualizada,
    });
  } catch (error) {
    console.error("Error en finalizar-rifa:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}