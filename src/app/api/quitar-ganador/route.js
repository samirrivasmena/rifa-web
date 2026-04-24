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
    const rifaIdLimpio = String(body?.rifaId ?? "").trim();

    if (!rifaIdLimpio) {
      return NextResponse.json(
        { error: "Falta la rifa seleccionada" },
        { status: 400 }
      );
    }

    // 1) Verificar que la rifa exista
    const { data: rifaExistente, error: rifaExistenteError } = await supabaseAdmin
      .from("rifas")
      .select("id, estado")
      .eq("id", rifaIdLimpio)
      .maybeSingle();

    if (rifaExistenteError) {
      console.error("Error buscando rifa:", rifaExistenteError);
      return NextResponse.json(
        {
          error: "No se pudo validar la rifa",
          debug: {
            message: rifaExistenteError.message,
            code: rifaExistenteError.code,
            details: rifaExistenteError.details,
            hint: rifaExistenteError.hint,
          },
        },
        { status: 500 }
      );
    }

    if (!rifaExistente) {
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 404 }
      );
    }

    // 2) Buscar otras rifas activas para dejarlas en publicada
    const { data: otrasActivas, error: activasError } = await supabaseAdmin
      .from("rifas")
      .select("id")
      .eq("estado", "activa")
      .neq("id", rifaIdLimpio);

    if (activasError) {
      console.error("Error buscando otras rifas activas:", activasError);
      return NextResponse.json(
        {
          error: "No se pudieron validar las rifas activas",
          debug: {
            message: activasError.message,
            code: activasError.code,
            details: activasError.details,
            hint: activasError.hint,
          },
        },
        { status: 500 }
      );
    }

    // 3) Bajar otras activas a publicada
    if (Array.isArray(otrasActivas) && otrasActivas.length > 0) {
      const idsOtrasActivas = otrasActivas.map((r) => r.id);

      const { error: demoteError } = await supabaseAdmin
        .from("rifas")
        .update({
          estado: "publicada",
        })
        .in("id", idsOtrasActivas);

      if (demoteError) {
        console.error("Error bajando otras activas:", demoteError);
        return NextResponse.json(
          {
            error: "No se pudieron actualizar las otras rifas activas",
            debug: {
              message: demoteError.message,
              code: demoteError.code,
              details: demoteError.details,
              hint: demoteError.hint,
            },
          },
          { status: 500 }
        );
      }
    }

    // 4) Limpiar el sorteo relacionado
    const { error: sorteoError } = await supabaseAdmin
      .from("sorteos")
      .update({
        numero_ganador: null,
        numero_oficial: null,
      })
      .eq("rifa_id", rifaIdLimpio);

    if (sorteoError) {
      console.error("Error limpiando sorteo:", sorteoError);
      return NextResponse.json(
        {
          error: "No se pudo limpiar el sorteo",
          debug: {
            message: sorteoError.message,
            code: sorteoError.code,
            details: sorteoError.details,
            hint: sorteoError.hint,
          },
        },
        { status: 500 }
      );
    }

    // 5) Reactivar la rifa seleccionada
    const { data: rifaActualizada, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "activa",
        numero_ganador: null,
      })
      .eq("id", rifaIdLimpio)
      .select("id, estado, numero_ganador")
      .maybeSingle();

    if (rifaError) {
      console.error("Error actualizando rifa:", rifaError);
      return NextResponse.json(
        {
          error: "No se pudo actualizar la rifa",
          debug: {
            message: rifaError.message,
            code: rifaError.code,
            details: rifaError.details,
            hint: rifaError.hint,
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
      mensaje: "Ganador oficial eliminado correctamente",
      rifa: rifaActualizada,
    });
  } catch (error) {
    console.error("Error en quitar-ganador:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}