import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   UTILIDADES
========================================================= */

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function esUuidValido(valor) {
  const limpio = limpiarTexto(valor);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    limpio
  );
}

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: mensaje,
    },
    { status }
  );
}

/* =========================================================
   ROLLBACK - RESTAURAR RIFA SELECCIONADA
========================================================= */

async function restaurarRifaAnterior(rifaId, rifaAnterior) {
  if (!rifaId || !rifaAnterior) {
    return { ok: true };
  }

  const { error } = await supabaseAdmin
    .from("rifas")
    .update({
      estado: rifaAnterior.estado ?? "activa",
    })
    .eq("id", rifaId);

  if (error) {
    console.error("Error restaurando rifa anterior:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      rifaId,
    });

    return {
      ok: false,
      error: error.message || "No se pudo restaurar la rifa anterior",
    };
  }

  return { ok: true };
}

/* =========================================================
   ROLLBACK - RESTAURAR SORTEO
========================================================= */

async function restaurarSorteoAnterior(sorteoAnterior) {
  if (!sorteoAnterior?.id) {
    return { ok: true };
  }

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
    console.error("Error restaurando sorteo anterior:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      sorteoId: sorteoAnterior.id,
    });

    return {
      ok: false,
      error: error.message || "No se pudo restaurar el sorteo",
    };
  }

  return { ok: true };
}

/* =========================================================
   ROLLBACK - RESTAURAR OTRAS RIFAS ACTIVAS
========================================================= */

async function restaurarOtrasActivas(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true };
  }

  const idsValidos = ids.filter((id) => esUuidValido(id));

  if (idsValidos.length === 0) {
    return { ok: true };
  }

  const { error } = await supabaseAdmin
    .from("rifas")
    .update({
      estado: "activa",
    })
    .in("id", idsValidos);

  if (error) {
    console.error("Error restaurando otras rifas activas:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      idsValidos,
    });

    return {
      ok: false,
      error: error.message || "No se pudieron restaurar las rifas activas",
    };
  }

  return { ok: true };
}

/* =========================================================
   POST
   QUITAR GANADOR OFICIAL
========================================================= */

export async function POST(req) {
  /* -------------------------------------------------------
     1) SEGURIDAD ADMIN
  ------------------------------------------------------- */

  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  try {
    /* -------------------------------------------------------
       2) LEER BODY
    ------------------------------------------------------- */

    let body;

    try {
      body = await req.json();
    } catch {
      return errorResponse("Cuerpo de la solicitud inválido", 400);
    }

    const rifaIdLimpio = limpiarTexto(
      body?.rifaId ?? body?.rifa_id
    );

    /* -------------------------------------------------------
       3) VALIDAR ID
    ------------------------------------------------------- */

    if (!rifaIdLimpio) {
      return errorResponse("Falta la rifa seleccionada", 400);
    }

    if (!esUuidValido(rifaIdLimpio)) {
      return errorResponse("El identificador de la rifa no es válido", 400);
    }

    /* -------------------------------------------------------
       4) VERIFICAR QUE LA RIFA EXISTA
    ------------------------------------------------------- */

    const {
      data: rifaAnterior,
      error: rifaExistenteError,
    } = await supabaseAdmin
      .from("rifas")
      .select("id, estado, nombre")
      .eq("id", rifaIdLimpio)
      .maybeSingle();

    if (rifaExistenteError) {
      console.error("Error buscando rifa:", {
        message: rifaExistenteError.message,
        details: rifaExistenteError.details,
        hint: rifaExistenteError.hint,
        code: rifaExistenteError.code,
        rifaIdLimpio,
      });

      return errorResponse("No se pudo validar la rifa", 500);
    }

    if (!rifaAnterior) {
      return errorResponse("La rifa no existe", 404);
    }

    /* -------------------------------------------------------
       5) OBTENER SORTEO ACTUAL
       Guardamos todos los valores para poder restaurarlos
       si ocurre algún error posteriormente.
    ------------------------------------------------------- */

    const {
      data: sorteoAnterior,
      error: sorteoBuscarError,
    } = await supabaseAdmin
      .from("sorteos")
      .select(
        "id, numero_ganador, numero_oficial, fecha_sorteo, fuente, rifa_id"
      )
      .eq("rifa_id", rifaIdLimpio)
      .maybeSingle();

    if (sorteoBuscarError) {
      console.error("Error buscando sorteo:", {
        message: sorteoBuscarError.message,
        details: sorteoBuscarError.details,
        hint: sorteoBuscarError.hint,
        code: sorteoBuscarError.code,
        rifaIdLimpio,
      });

      return errorResponse(
        "No se pudo validar el sorteo asociado",
        500
      );
    }

    /* -------------------------------------------------------
       6) BUSCAR OTRAS RIFAS ACTIVAS

       Tu sistema mantiene una sola rifa activa.
       Si reabrimos esta rifa, las demás activas pasan
       nuevamente a "publicada".
    ------------------------------------------------------- */

    const {
      data: otrasActivas,
      error: activasError,
    } = await supabaseAdmin
      .from("rifas")
      .select("id")
      .eq("estado", "activa")
      .neq("id", rifaIdLimpio);

    if (activasError) {
      console.error("Error buscando otras rifas activas:", {
        message: activasError.message,
        details: activasError.details,
        hint: activasError.hint,
        code: activasError.code,
      });

      return errorResponse(
        "No se pudieron validar las rifas activas",
        500
      );
    }

    const idsOtrasActivas = Array.isArray(otrasActivas)
      ? otrasActivas
          .map((rifa) => limpiarTexto(rifa?.id))
          .filter((id) => esUuidValido(id))
      : [];

    /* -------------------------------------------------------
       7) PASAR OTRAS ACTIVAS A PUBLICADA
    ------------------------------------------------------- */

    if (idsOtrasActivas.length > 0) {
      const { error: demoteError } = await supabaseAdmin
        .from("rifas")
        .update({
          estado: "publicada",
        })
        .in("id", idsOtrasActivas);

      if (demoteError) {
        console.error("Error bajando otras rifas activas:", {
          message: demoteError.message,
          details: demoteError.details,
          hint: demoteError.hint,
          code: demoteError.code,
          idsOtrasActivas,
        });

        return errorResponse(
          "No se pudieron actualizar las otras rifas activas",
          500
        );
      }
    }

    /* -------------------------------------------------------
       8) LIMPIAR GANADOR DEL SORTEO

       Importante:
       ahora también limpiamos fecha_sorteo y fuente para
       evitar dejar información vieja de un ganador eliminado.
    ------------------------------------------------------- */

    if (sorteoAnterior?.id) {
      const { error: sorteoError } = await supabaseAdmin
        .from("sorteos")
        .update({
          numero_ganador: null,
          numero_oficial: null,
          fecha_sorteo: null,
          fuente: null,
        })
        .eq("id", sorteoAnterior.id);

      if (sorteoError) {
        console.error("Error limpiando sorteo:", {
          message: sorteoError.message,
          details: sorteoError.details,
          hint: sorteoError.hint,
          code: sorteoError.code,
          sorteoId: sorteoAnterior.id,
        });

        await restaurarOtrasActivas(idsOtrasActivas);

        return errorResponse(
          "No se pudo limpiar el sorteo",
          500
        );
      }
    }

    /* -------------------------------------------------------
       9) REACTIVAR RIFA SELECCIONADA
    ------------------------------------------------------- */

    const {
      data: rifaActualizada,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "activa",
      })
      .eq("id", rifaIdLimpio)
      .select("id, estado, nombre")
      .maybeSingle();

    /* -------------------------------------------------------
       10) ERROR ACTUALIZANDO RIFA
       Restauramos todo lo que modificamos.
    ------------------------------------------------------- */

    if (rifaError) {
      console.error("Error actualizando rifa:", {
        message: rifaError.message,
        details: rifaError.details,
        hint: rifaError.hint,
        code: rifaError.code,
        rifaIdLimpio,
      });

      const restaurarSorteo =
        await restaurarSorteoAnterior(sorteoAnterior);

      const restaurarActivas =
        await restaurarOtrasActivas(idsOtrasActivas);

      const restaurarRifa =
        await restaurarRifaAnterior(
          rifaIdLimpio,
          rifaAnterior
        );

      if (
        !restaurarSorteo.ok ||
        !restaurarActivas.ok ||
        !restaurarRifa.ok
      ) {
        console.error(
          "Advertencia: rollback incompleto en quitar-ganador",
          {
            restaurarSorteo,
            restaurarActivas,
            restaurarRifa,
          }
        );
      }

      return errorResponse(
        "No se pudo actualizar la rifa",
        500
      );
    }

    /* -------------------------------------------------------
       11) COMPROBAR QUE REALMENTE SE ACTUALIZÓ
    ------------------------------------------------------- */

    if (!rifaActualizada) {
      const restaurarSorteo =
        await restaurarSorteoAnterior(sorteoAnterior);

      const restaurarActivas =
        await restaurarOtrasActivas(idsOtrasActivas);

      const restaurarRifa =
        await restaurarRifaAnterior(
          rifaIdLimpio,
          rifaAnterior
        );

      if (
        !restaurarSorteo.ok ||
        !restaurarActivas.ok ||
        !restaurarRifa.ok
      ) {
        console.error(
          "Advertencia: rollback incompleto después de actualización vacía",
          {
            restaurarSorteo,
            restaurarActivas,
            restaurarRifa,
          }
        );
      }

      return errorResponse(
        "La rifa no se pudo actualizar",
        404
      );
    }

    /* -------------------------------------------------------
       12) RESPUESTA FINAL
    ------------------------------------------------------- */

    return NextResponse.json(
      {
        ok: true,
        mensaje: "Ganador oficial eliminado correctamente",
        rifa: rifaActualizada,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error en quitar-ganador:", {
      message: error?.message,
      stack:
        process.env.NODE_ENV === "development"
          ? error?.stack
          : undefined,
    });

    return errorResponse(
      "No se pudo procesar la eliminación del ganador",
      500
    );
  }
}