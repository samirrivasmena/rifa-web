import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

function obtenerNumeroGuardado(sorteo) {
  const candidato = sorteo?.numero_ganador ?? sorteo?.numero_oficial ?? null;

  if (candidato === null || candidato === undefined || candidato === "") {
    return null;
  }

  const numero = Number(candidato);
  return Number.isNaN(numero) ? null : numero;
}

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
    const { numero_ticket, rifaId } = body;

    const rifaIdLimpio = String(rifaId ?? "").trim();

    if (numero_ticket === undefined || numero_ticket === null) {
      return NextResponse.json(
        { error: "Falta el número de ticket" },
        { status: 400 }
      );
    }

    if (!rifaIdLimpio) {
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

    const numeroOficial = String(numero);

    // 1) Verificar que el número sí fue vendido en esa rifa
    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("numero_ticket", numero)
      .eq("rifa_id", rifaIdLimpio)
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

    const rifaIdReal = String(ticketData.rifa_id ?? rifaIdLimpio).trim();

    // 2) Buscar la rifa
    const { data: rifaData, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, estado, numero_ganador")
      .eq("id", rifaIdReal)
      .maybeSingle();

    if (rifaError) {
      console.error("Error buscando rifa:", {
        rifaIdLimpio,
        rifaIdReal,
        rifaError,
      });

      return NextResponse.json(
        { error: "Error al buscar la rifa" },
        { status: 500 }
      );
    }

    if (!rifaData) {
      console.error("No se encontró la rifa asociada al ticket:", {
        rifaIdLimpio,
        rifaIdReal,
        ticketData,
      });

      return NextResponse.json(
        { error: "La rifa asociada al ticket no existe" },
        { status: 404 }
      );
    }

    // 3) Verificar si ya existe sorteo guardado
    const { data: sorteoExistente, error: sorteoExistenteError } =
      await supabaseAdmin
        .from("sorteos")
        .select("id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente")
        .eq("rifa_id", rifaIdReal)
        .maybeSingle();

    if (sorteoExistenteError) {
      console.error("Error verificando sorteo existente:", sorteoExistenteError);
      return NextResponse.json(
        { error: "Error al verificar sorteo existente" },
        { status: 500 }
      );
    }

    const ganadorGuardado =
      obtenerNumeroGuardado(sorteoExistente) ??
      obtenerNumeroGuardado(rifaData);

    if (ganadorGuardado !== null && ganadorGuardado !== numero) {
      return NextResponse.json(
        { error: "Esta rifa ya tiene otro ganador oficial registrado" },
        { status: 400 }
      );
    }

    let sorteoFinal = null;

    // 4) Crear o actualizar sorteo
    if (!sorteoExistente) {
      const { data: sorteoCreado, error: insertError } = await supabaseAdmin
        .from("sorteos")
        .insert([
          {
            numero_ganador: numero,
            numero_oficial: numeroOficial,
            fecha_sorteo: new Date().toISOString(),
            fuente: rifaData.nombre || "Rifa",
            rifa_id: rifaIdReal,
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
      const { data: sorteoActualizado, error: updateSorteoError } = await supabaseAdmin
        .from("sorteos")
        .update({
          numero_ganador: numero,
          numero_oficial: numeroOficial,
          fecha_sorteo:
            ganadorGuardado === null
              ? new Date().toISOString()
              : sorteoExistente.fecha_sorteo || new Date().toISOString(),
          fuente: sorteoExistente.fuente || rifaData.nombre || "Rifa",
        })
        .eq("id", sorteoExistente.id)
        .select()
        .single();

      if (updateSorteoError) {
        console.error("Error actualizando sorteo:", updateSorteoError);
        return NextResponse.json(
          { error: "No se pudo actualizar el ganador oficial" },
          { status: 500 }
        );
      }

      sorteoFinal = sorteoActualizado;
    }

    // 5) Marcar la rifa como finalizada
    const { data: rifaActualizada, error: updateRifaError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "finalizada",
        numero_ganador: numero,
      })
      .eq("id", rifaIdReal)
      .select("id, nombre, estado, numero_ganador")
      .maybeSingle();

    if (updateRifaError) {
      console.error("Error actualizando rifa:", updateRifaError);
      return NextResponse.json(
        {
          error: "Se registró el sorteo pero no se pudo actualizar la rifa",
          debug: {
            message: updateRifaError.message,
            code: updateRifaError.code,
            details: updateRifaError.details,
            hint: updateRifaError.hint,
          },
        },
        { status: 500 }
      );
    }

    if (!rifaActualizada) {
      return NextResponse.json(
        { error: "La rifa no se pudo actualizar" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Ganador oficial registrado correctamente",
      sorteo: sorteoFinal,
      rifa: rifaActualizada,
      numero_ganador: numero,
      numero_oficial: numeroOficial,
    });
  } catch (error) {
    console.error("Error en guardar-ganador:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}