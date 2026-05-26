import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const limpio = limpiarTexto(valor);
  return Boolean(limpio) && limpio.length <= 100;
}

function obtenerNumeroGuardado(origen) {
  const candidatos = [
    origen?.numero_ganador,
    origen?.numero_oficial,
  ];

  for (const candidato of candidatos) {
    if (candidato === null || candidato === undefined || candidato === "") {
      continue;
    }

    const numero = Number(String(candidato).trim());
    if (Number.isInteger(numero)) return numero;
  }

  return null;
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

async function revertirCambios({
  sorteoAnterior = null,
  sorteoCreado = false,
  sorteoId = null,
  rifaAnterior = null,
  rifaId = null,
}) {
  const errores = [];

  // Si se creó el sorteo nuevo y luego falló algo, se borra
  if (sorteoCreado && sorteoId) {
    const { error: deleteSorteoError } = await supabaseAdmin
      .from("sorteos")
      .delete()
      .eq("id", sorteoId);

    if (deleteSorteoError) {
      errores.push(deleteSorteoError.message || "No se pudo eliminar el sorteo creado");
    }
  }

  // Si ya existía sorteo, se revierte
  if (!sorteoCreado && sorteoAnterior?.id) {
    const { error: restoreSorteoError } = await supabaseAdmin
      .from("sorteos")
      .update({
        numero_ganador: sorteoAnterior.numero_ganador ?? null,
        numero_oficial: sorteoAnterior.numero_oficial ?? null,
        fecha_sorteo: sorteoAnterior.fecha_sorteo ?? null,
        fuente: sorteoAnterior.fuente ?? null,
      })
      .eq("id", sorteoAnterior.id);

    if (restoreSorteoError) {
      errores.push(
        restoreSorteoError.message || "No se pudo restaurar el sorteo anterior"
      );
    }
  }

  // Se revierte la rifa
  if (rifaAnterior?.id && rifaId) {
    const { error: restoreRifaError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: rifaAnterior.estado ?? "activa",
        numero_ganador: rifaAnterior.numero_ganador ?? null,
        numero_oficial: rifaAnterior.numero_oficial ?? null,
      })
      .eq("id", rifaId);

    if (restoreRifaError) {
      errores.push(
        restoreRifaError.message || "No se pudo restaurar la rifa anterior"
      );
    }
  }

  return errores;
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

    const { numero_ticket, rifaId } = body;

    const rifaIdLimpio = limpiarTexto(rifaId);

    if (!validarId(rifaIdLimpio)) {
      return errorResponse("Falta la rifa seleccionada", 400);
    }

    if (numero_ticket === undefined || numero_ticket === null || numero_ticket === "") {
      return errorResponse("Falta el número de ticket", 400);
    }

    const numero = Number(numero_ticket);

    if (!Number.isInteger(numero)) {
      return errorResponse("Número de ticket inválido", 400);
    }

    const numeroOficial = String(numero);

    // 1) Verificar que el ticket existe y pertenece a esa rifa
    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("numero_ticket", numero)
      .eq("rifa_id", rifaIdLimpio)
      .maybeSingle();

    if (ticketError) {
      console.error("Error buscando ticket:", ticketError);
      return errorResponse("Error al verificar el ticket", 500);
    }

    if (!ticketData) {
      return errorResponse("Ese número no fue vendido en esta rifa", 400);
    }

    const rifaIdReal = String(ticketData.rifa_id ?? rifaIdLimpio).trim();

    // 2) Buscar la rifa
    const { data: rifaData, error: rifaError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, estado, numero_ganador, numero_oficial")
      .eq("id", rifaIdReal)
      .maybeSingle();

    if (rifaError) {
      console.error("Error buscando rifa:", rifaError);
      return errorResponse("Error al buscar la rifa", 500);
    }

    if (!rifaData) {
      return errorResponse("La rifa asociada al ticket no existe", 404);
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
      return errorResponse("Error al verificar sorteo existente", 500);
    }

    const ganadorGuardado =
      obtenerNumeroGuardado(sorteoExistente) ??
      obtenerNumeroGuardado(rifaData);

    if (ganadorGuardado !== null && ganadorGuardado !== numero) {
      return errorResponse(
        "Esta rifa ya tiene otro ganador oficial registrado",
        409
      );
    }

    const sorteoAnterior = sorteoExistente
      ? {
          id: sorteoExistente.id,
          numero_ganador: sorteoExistente.numero_ganador ?? null,
          numero_oficial: sorteoExistente.numero_oficial ?? null,
          fecha_sorteo: sorteoExistente.fecha_sorteo ?? null,
          fuente: sorteoExistente.fuente ?? null,
        }
      : null;

    const rifaAnterior = {
      id: rifaData.id,
      estado: rifaData.estado ?? null,
      numero_ganador: rifaData.numero_ganador ?? null,
      numero_oficial: rifaData.numero_oficial ?? null,
    };

    let sorteoFinal = null;
    let sorteoCreado = false;

    // 4) Crear o actualizar sorteo
    if (!sorteoExistente) {
      const { data: sorteoCreadoData, error: insertError } = await supabaseAdmin
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
        .select("id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente")
        .single();

      if (insertError) {
        console.error("Error guardando ganador:", insertError);
        return errorResponse("No se pudo registrar el ganador oficial", 500);
      }

      sorteoFinal = sorteoCreadoData;
      sorteoCreado = true;
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
        .select("id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente")
        .single();

      if (updateSorteoError) {
        console.error("Error actualizando sorteo:", updateSorteoError);
        return errorResponse("No se pudo actualizar el ganador oficial", 500);
      }

      sorteoFinal = sorteoActualizado;
    }

    // 5) Marcar la rifa como finalizada
    const { data: rifaActualizada, error: updateRifaError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "finalizada",
        numero_ganador: numero,
        numero_oficial: numeroOficial,
      })
      .eq("id", rifaIdReal)
      .select("id, nombre, estado, numero_ganador, numero_oficial")
      .maybeSingle();

    if (updateRifaError) {
      console.error("Error actualizando rifa:", updateRifaError);

      const rollbackErrors = await revertirCambios({
        sorteoAnterior,
        sorteoCreado,
        sorteoId: sorteoFinal?.id || null,
        rifaAnterior,
        rifaId: rifaIdReal,
      });

      console.error("Rollback guardar-ganador:", rollbackErrors);

      return errorResponse(
        "Se registró el sorteo pero no se pudo actualizar la rifa",
        500
      );
    }

    if (!rifaActualizada) {
      const rollbackErrors = await revertirCambios({
        sorteoAnterior,
        sorteoCreado,
        sorteoId: sorteoFinal?.id || null,
        rifaAnterior,
        rifaId: rifaIdReal,
      });

      console.error("Rollback por rifa no actualizada:", rollbackErrors);

      return errorResponse("La rifa no se pudo actualizar", 404);
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Ganador oficial registrado correctamente",
      sorteo: {
        id: sorteoFinal?.id || null,
        rifa_id: sorteoFinal?.rifa_id || rifaIdReal,
        numero_ganador: sorteoFinal?.numero_ganador ?? numero,
        numero_oficial: sorteoFinal?.numero_oficial ?? numeroOficial,
        fecha_sorteo: sorteoFinal?.fecha_sorteo || null,
        fuente: sorteoFinal?.fuente || rifaData.nombre || "Rifa",
      },
      rifa: {
        id: rifaActualizada.id,
        nombre: rifaActualizada.nombre,
        estado: rifaActualizada.estado,
        numero_ganador: rifaActualizada.numero_ganador,
        numero_oficial: rifaActualizada.numero_oficial,
      },
      numero_ganador: numero,
      numero_oficial: numeroOficial,
    });
  } catch (error) {
    console.error("Error en guardar-ganador:", error);
    return errorResponse("No se pudo registrar el ganador oficial", 500);
  }
}