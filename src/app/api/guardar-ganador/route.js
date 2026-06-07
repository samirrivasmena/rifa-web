import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const limpio = limpiarTexto(valor);
  return Boolean(limpio) && limpio.length <= 100;
}

function normalizarNumeroTicket(valor, padLength = 4) {
  if (valor === undefined || valor === null || valor === "") return null;

  const texto = String(valor).trim();
  const soloDigitos = texto.replace(/\D/g, "");

  if (!soloDigitos) return null;

  const numero = Number(soloDigitos);
  if (!Number.isInteger(numero)) return null;

  return {
    numero,
    numeroOficial: String(numero).padStart(padLength, "0"),
  };
}

function obtenerNumeroGuardado(origen) {
  const candidatos = [origen?.numero_ganador, origen?.numero_oficial];

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

async function restaurarSorteoAnterior(sorteoAnterior) {
  if (!sorteoAnterior?.id) return { ok: true };

  const { error: restaurarSorteoError } = await supabaseAdmin
    .from("sorteos")
    .update({
      numero_ganador: sorteoAnterior.numero_ganador ?? null,
      numero_oficial: sorteoAnterior.numero_oficial ?? null,
      fecha_sorteo: sorteoAnterior.fecha_sorteo ?? null,
      fuente: sorteoAnterior.fuente ?? null,
    })
    .eq("id", sorteoAnterior.id);

  if (restaurarSorteoError) {
    return {
      ok: false,
      error:
        restaurarSorteoError.message || "No se pudo restaurar el sorteo anterior",
    };
  }

  return { ok: true };
}

async function restaurarRifaAnterior(rifaId, rifaAnterior) {
  if (!rifaId || !rifaAnterior) return { ok: true };

  const { error: restaurarRifaError } = await supabaseAdmin
    .from("rifas")
    .update({
      estado: rifaAnterior.estado ?? "activa",
    })
    .eq("id", rifaId);

  if (restaurarRifaError) {
    return {
      ok: false,
      error:
        restaurarRifaError.message || "No se pudo restaurar la rifa anterior",
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

    const rifaIdLimpio = limpiarTexto(body?.rifaId ?? body?.rifa_id);

    if (!validarId(rifaIdLimpio)) {
      return errorResponse("Falta la rifa seleccionada", 400);
    }

    const padLength = Number.isInteger(Number(body?.padLength))
      ? Number(body.padLength)
      : 4;

    const numeroNormalizado = normalizarNumeroTicket(
      body?.numero_ticket ?? body?.numero,
      padLength
    );

    if (!numeroNormalizado) {
      return errorResponse("Falta el número de ticket", 400);
    }

    const numero = numeroNormalizado.numero;
    const numeroOficial = numeroNormalizado.numeroOficial;

    // 1) Verificar ticket vendido
    const { data: ticketRows, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("rifa_id", rifaIdLimpio)
      .eq("numero_ticket", numero)
      .limit(1);

    if (ticketError) {
      console.error("Error buscando ticket:", {
        message: ticketError.message,
        details: ticketError.details,
        hint: ticketError.hint,
        code: ticketError.code,
        rifaIdLimpio,
        numero,
      });

      return errorResponse(
        `Error al verificar el ticket: ${ticketError.message}`,
        500
      );
    }

    const ticketData = Array.isArray(ticketRows) ? ticketRows[0] || null : null;

    if (!ticketData) {
      return errorResponse("Ese número no fue vendido en esta rifa", 400);
    }

    // 2) Buscar rifa
    const { data: rifaRows, error: rifaBuscarError } = await supabaseAdmin
      .from("rifas")
      .select("id, nombre, estado")
      .eq("id", rifaIdLimpio)
      .limit(1);

    if (rifaBuscarError) {
      console.error("Error buscando rifa:", {
        message: rifaBuscarError.message,
        details: rifaBuscarError.details,
        hint: rifaBuscarError.hint,
        code: rifaBuscarError.code,
        rifaIdLimpio,
        ticketData,
      });

      return errorResponse(
        `Error al buscar la rifa: ${rifaBuscarError.message}`,
        500
      );
    }

    const rifaData = Array.isArray(rifaRows) ? rifaRows[0] || null : null;

    if (!rifaData) {
      return errorResponse("La rifa asociada al ticket no existe", 404);
    }

    // 3) Buscar sorteo existente
    const { data: sorteoRows, error: sorteoExistenteError } = await supabaseAdmin
      .from("sorteos")
      .select(
        "id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente"
      )
      .eq("rifa_id", rifaIdLimpio)
      .order("fecha_sorteo", { ascending: false })
      .limit(1);

    if (sorteoExistenteError) {
      console.error("Error verificando sorteo existente:", {
        message: sorteoExistenteError.message,
        details: sorteoExistenteError.details,
        hint: sorteoExistenteError.hint,
        code: sorteoExistenteError.code,
        rifaIdLimpio,
      });

      return errorResponse("Error al verificar sorteo existente", 500);
    }

    const sorteoExistente = Array.isArray(sorteoRows)
      ? sorteoRows[0] || null
      : null;

    const ganadorGuardado = obtenerNumeroGuardado(sorteoExistente);

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
    };

    let sorteoFinal = null;

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
            rifa_id: rifaIdLimpio,
          },
        ])
        .select(
          "id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente"
        )
        .single();

      if (insertError) {
        console.error("Error guardando ganador:", insertError);
        return errorResponse("No se pudo registrar el ganador oficial", 500);
      }

      sorteoFinal = sorteoCreadoData;
    } else {
      const { data: sorteoActualizado, error: updateSorteoError } =
        await supabaseAdmin
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
          .select(
            "id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente"
          )
          .single();

      if (updateSorteoError) {
        console.error("Error actualizando sorteo:", updateSorteoError);
        return errorResponse("No se pudo actualizar el ganador oficial", 500);
      }

      sorteoFinal = sorteoActualizado;
    }

    // 5) Actualizar SOLO el estado de la rifa
    const { data: rifaActualizada, error: updateRifaError } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "finalizada",
      })
      .eq("id", rifaIdLimpio)
      .select("id, nombre, estado")
      .maybeSingle();

    if (updateRifaError) {
      console.error("Error actualizando rifa:", updateRifaError);

      await restaurarSorteoAnterior(sorteoAnterior);
      await restaurarRifaAnterior(rifaIdLimpio, rifaAnterior);

      return errorResponse(
        `Se registró el sorteo pero no se pudo actualizar la rifa: ${updateRifaError.message}`,
        500
      );
    }

    if (!rifaActualizada) {
      await restaurarSorteoAnterior(sorteoAnterior);
      await restaurarRifaAnterior(rifaIdLimpio, rifaAnterior);

      return errorResponse("La rifa no se pudo actualizar", 404);
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Ganador oficial registrado correctamente",
      sorteo: {
        id: sorteoFinal?.id || null,
        rifa_id: sorteoFinal?.rifa_id || rifaIdLimpio,
        numero_ganador: sorteoFinal?.numero_ganador ?? numero,
        numero_oficial: sorteoFinal?.numero_oficial ?? numeroOficial,
        fecha_sorteo: sorteoFinal?.fecha_sorteo || null,
        fuente: sorteoFinal?.fuente || rifaData.nombre || "Rifa",
      },
      rifa: {
        id: rifaActualizada.id,
        nombre: rifaActualizada.nombre,
        estado: rifaActualizada.estado,
      },
      numero_ganador: numero,
      numero_oficial: numeroOficial,
    });
  } catch (error) {
    console.error("Error en guardar-ganador:", error);
    return errorResponse(
      error?.message || "No se pudo registrar el ganador oficial",
      500
    );
  }
}