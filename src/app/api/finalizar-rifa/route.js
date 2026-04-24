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

    if (
      numeroGanador === undefined ||
      numeroGanador === null ||
      String(numeroGanador).trim() === ""
    ) {
      return NextResponse.json(
        { error: "Falta el número ganador" },
        { status: 400 }
      );
    }

    const numeroLimpio = String(numeroGanador).trim().replace(/\D/g, "");

    if (!numeroLimpio) {
      return NextResponse.json(
        { error: "Número ganador inválido" },
        { status: 400 }
      );
    }

    const numero = Number(numeroLimpio);

    if (!Number.isFinite(numero)) {
      return NextResponse.json(
        { error: "Número ganador inválido" },
        { status: 400 }
      );
    }

    const { data: rifaData, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, numero_inicio, numero_fin, estado, formato")
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError || !rifaData) {
      console.error("Error buscando rifa:", rifaError);
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 404 }
      );
    }

    const numeroInicio = Number(
      rifaData.numero_inicio ?? 0
    );

    const numeroFin = Number(
      rifaData.numero_fin ??
        (String(rifaData.formato) === "3digitos" ? 999 : 9999)
    );

    if (
      Number.isNaN(numeroInicio) ||
      Number.isNaN(numeroFin) ||
      numero < numeroInicio ||
      numero > numeroFin
    ) {
      return NextResponse.json(
        { error: "El número ganador está fuera del rango de la rifa" },
        { status: 400 }
      );
    }

    const padLength = String(rifaData.formato) === "3digitos" ? 3 : 4;
    const numeroFormateado = String(numero).padStart(padLength, "0");
    const fechaSorteo = new Date().toISOString();

    const { data: sorteoExistente, error: sorteoExistenteError } =
      await supabaseAdmin
        .from("sorteos")
        .select("id, numero_ganador, numero_oficial, rifa_id")
        .eq("rifa_id", rifaId)
        .maybeSingle();

    if (sorteoExistenteError) {
      console.error("Error verificando sorteo existente:", sorteoExistenteError);
      return NextResponse.json(
        { error: "Error al verificar si la rifa ya tiene sorteo" },
        { status: 500 }
      );
    }

    let sorteoFinal = null;

    if (sorteoExistente) {
      const { data: sorteoActualizado, error: updateSorteoError } =
        await supabaseAdmin
          .from("sorteos")
          .update({
            numero_ganador: numero,
            numero_oficial: numeroFormateado,
            fecha_sorteo: fechaSorteo,
            fuente: rifaData.nombre || "Rifa",
          })
          .eq("rifa_id", rifaId)
          .select()
          .single();

      if (updateSorteoError) {
        console.error("Error actualizando sorteo:", updateSorteoError);
        return NextResponse.json(
          { error: "No se pudo actualizar el sorteo" },
          { status: 500 }
        );
      }

      sorteoFinal = sorteoActualizado;
    } else {
      const { data: sorteoCreado, error: insertError } = await supabaseAdmin
        .from("sorteos")
        .insert([
          {
            numero_ganador: numero,
            numero_oficial: numeroFormateado,
            fecha_sorteo: fechaSorteo,
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
    }

    // IMPORTANTE:
    // solo cambiamos el estado para evitar errores por columnas inexistentes
    const { data: rifaActualizada, error: updateError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "finalizada",
      })
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
      numero_ganador: numero,
      numero_oficial: numeroFormateado,
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