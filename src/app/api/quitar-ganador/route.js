import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const limpio = limpiarTexto(valor);
  return Boolean(limpio) && limpio.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(limpio);
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

async function restaurarRifaAnterior(rifaId, rifaAnterior) {
  if (!rifaId || !rifaAnterior) return { ok: true };

  const { error } = await supabaseAdmin
    .from("rifas")
    .update({
      estado: rifaAnterior.estado ?? "activa",
      numero_ganador: rifaAnterior.numero_ganador ?? null,
      numero_oficial: rifaAnterior.numero_oficial ?? null,
    })
    .eq("id", rifaId);

  if (error) {
    return { ok: false, error: error.message || "No se pudo restaurar la rifa" };
  }

  return { ok: true };
}

async function restaurarSorteoAnterior(sorteoAnterior) {
  if (!sorteoAnterior?.id) return { ok: true };

  const { error } = await supabaseAdmin
    .from("sorteos")
    .update({
      numero_ganador: sorteoAnterior.numero_ganador ?? null,
      numero_oficial: sorteoAnterior.numero_oficial ?? null,
      fecha_sorteo: sorteoAnterior.fecha_sorteo ?? null,
      fuente: sorteoAnterior.fuente ?? null,
    })
    .eq("id", sorteoAnterior.id);

  if (error) {
    return { ok: false, error: error.message || "No se pudo restaurar el sorteo" };
  }

  return { ok: true };
}

async function restaurarOtrasActivas(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true };
  }

  const { error } = await supabaseAdmin
    .from("rifas")
    .update({ estado: "activa" })
    .in("id", ids);

  if (error) {
    return {
      ok: false,
      error: error.message || "No se pudieron restaurar las rifas activas",
    };
  }

  return { ok: true };
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
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Cuerpo de la solicitud inválido", 400);
    }

    const rifaIdLimpio = limpiarTexto(body?.rifaId);

    if (!validarId(rifaIdLimpio)) {
      return errorResponse("Falta la rifa seleccionada", 400);
    }

    // 1) Verificar que la rifa exista y guardar su estado anterior
    const { data: rifaAnterior, error: rifaExistenteError } = await supabaseAdmin
      .from("rifas")
      .select("id, estado, numero_ganador, numero_oficial, nombre")
      .eq("id", rifaIdLimpio)
      .maybeSingle();

    if (rifaExistenteError) {
      console.error("Error buscando rifa:", rifaExistenteError);
      return errorResponse("No se pudo validar la rifa", 500);
    }

    if (!rifaAnterior) {
      return errorResponse("La rifa no existe", 404);
    }

    // 2) Guardar sorteo actual, si existe
    const { data: sorteoAnterior, error: sorteoBuscarError } = await supabaseAdmin
      .from("sorteos")
      .select("id, numero_ganador, numero_oficial, fecha_sorteo, fuente, rifa_id")
      .eq("rifa_id", rifaIdLimpio)
      .maybeSingle();

    if (sorteoBuscarError) {
      console.error("Error buscando sorteo:", sorteoBuscarError);
      return errorResponse("No se pudo validar el sorteo asociado", 500);
    }

    // 3) Buscar otras rifas activas para dejarlas en publicada
    const { data: otrasActivas, error: activasError } = await supabaseAdmin
      .from("rifas")
      .select("id")
      .eq("estado", "activa")
      .neq("id", rifaIdLimpio);

    if (activasError) {
      console.error("Error buscando otras rifas activas:", activasError);
      return errorResponse("No se pudieron validar las rifas activas", 500);
    }

    const idsOtrasActivas = Array.isArray(otrasActivas)
      ? otrasActivas.map((r) => r.id)
      : [];

    // 4) Bajar otras activas a publicada
    if (idsOtrasActivas.length > 0) {
      const { error: demoteError } = await supabaseAdmin
        .from("rifas")
        .update({
          estado: "publicada",
        })
        .in("id", idsOtrasActivas);

      if (demoteError) {
        console.error("Error bajando otras activas:", demoteError);
        return errorResponse("No se pudieron actualizar las otras rifas activas", 500);
      }
    }

    // 5) Limpiar el sorteo relacionado
    if (sorteoAnterior?.id) {
      const { error: sorteoError } = await supabaseAdmin
        .from("sorteos")
        .update({
          numero_ganador: null,
          numero_oficial: null,
        })
        .eq("id", sorteoAnterior.id);

      if (sorteoError) {
        console.error("Error limpiando sorteo:", sorteoError);

        // rollback de otras rifas activas
        await restaurarOtrasActivas(idsOtrasActivas);

        return errorResponse("No se pudo limpiar el sorteo", 500);
      }
    }

    // 6) Reactivar la rifa seleccionada
    const { data: rifaActualizada, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "activa",
        numero_ganador: null,
        numero_oficial: null,
      })
      .eq("id", rifaIdLimpio)
      .select("id, estado, numero_ganador, numero_oficial, nombre")
      .maybeSingle();

    if (rifaError) {
      console.error("Error actualizando rifa:", rifaError);

      // rollback básico
      await restaurarSorteoAnterior(sorteoAnterior);
      await restaurarOtrasActivas(idsOtrasActivas);
      await restaurarRifaAnterior(rifaIdLimpio, rifaAnterior);

      return errorResponse("No se pudo actualizar la rifa", 500);
    }

    if (!rifaActualizada) {
      await restaurarSorteoAnterior(sorteoAnterior);
      await restaurarOtrasActivas(idsOtrasActivas);
      await restaurarRifaAnterior(rifaIdLimpio, rifaAnterior);

      return errorResponse("La rifa no se pudo actualizar", 404);
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Ganador oficial eliminado correctamente",
      rifa: rifaActualizada,
    });
  } catch (error) {
    console.error("Error en quitar-ganador:", error);
    return errorResponse("No se pudo procesar la eliminación del ganador", 500);
  }
}