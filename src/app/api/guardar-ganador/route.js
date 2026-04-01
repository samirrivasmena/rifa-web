import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { numero_ticket, rifaId } = body;

    if (numero_ticket === undefined || numero_ticket === null) {
      return NextResponse.json(
        { error: "Falta el número de ticket" },
        { status: 400 }
      );
    }

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta la rifa seleccionada" },
        { status: 400 }
      );
    }

    const numero = Number(numero_ticket);

    if (Number.isNaN(numero)) {
      return NextResponse.json(
        { error: "Número de ticket inválido" },
        { status: 400 }
      );
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("numero_ticket", numero)
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (ticketError) {
      console.error("Error buscando ticket:", ticketError);
      return NextResponse.json(
        { error: "Error al verificar el ticket" },
        { status: 500 }
      );
    }

    if (!ticketData) {
      return NextResponse.json(
        { error: "Ese número no fue vendido en esta rifa" },
        { status: 400 }
      );
    }

    const { data: rifaData, error: rifaError } = await supabase
      .from("rifas")
      .select("id, nombre, estado")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError || !rifaData) {
      console.error("Error buscando rifa:", rifaError);
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 400 }
      );
    }

    const { data: sorteoExistente, error: sorteoExistenteError } = await supabase
      .from("sorteos")
      .select("id, numero_ganador, numero_oficial, rifa_id")
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (sorteoExistenteError) {
      console.error("Error verificando sorteo existente:", sorteoExistenteError);
      return NextResponse.json(
        { error: "Error al verificar sorteo existente" },
        { status: 500 }
      );
    }

    let sorteoFinal = sorteoExistente || null;

    if (!sorteoExistente) {
      const { data: sorteoCreado, error: insertError } = await supabase
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
        console.error("Error guardando ganador:", insertError);
        return NextResponse.json(
          { error: "No se pudo registrar el ganador oficial" },
          { status: 500 }
        );
      }

      sorteoFinal = sorteoCreado;
    } else {
      const ganadorExistente = Number(
        sorteoExistente.numero_ganador ?? sorteoExistente.numero_oficial
      );

      if (ganadorExistente !== numero) {
        return NextResponse.json(
          { error: "Esta rifa ya tiene otro ganador oficial registrado" },
          { status: 400 }
        );
      }
    }

    const { data: rifaActualizada, error: updateRifaError } = await supabase
      .from("rifas")
      .update({ estado: "finalizada" })
      .eq("id", rifaId)
      .select()
      .single();

    if (updateRifaError) {
      console.error("Error actualizando rifa:", updateRifaError);
      return NextResponse.json(
        { error: "Se registró el sorteo pero no se pudo actualizar la rifa" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Ganador oficial registrado correctamente",
      sorteo: sorteoFinal,
      rifa: rifaActualizada,
    });
  } catch (error) {
    console.error("Error en guardar-ganador:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}