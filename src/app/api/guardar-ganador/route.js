import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   HELPERS
========================================================= */

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function esUuidValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor || "").trim()
  );
}

function normalizarNumeroTicket(
  valor,
  padLength = 4
) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const texto = String(valor).trim();

  /*
   * Solamente permitimos números.
   *
   * Evitamos convertir accidentalmente textos
   * extraños en un número válido.
   */
  if (!/^\d+$/.test(texto)) {
    return null;
  }

  const numero = Number(texto);

  if (
    !Number.isSafeInteger(numero) ||
    numero < 0
  ) {
    return null;
  }

  return {
    numero,
    numeroOficial: String(numero).padStart(
      padLength,
      "0"
    ),
  };
}

function obtenerNumeroGuardado(origen) {
  const candidatos = [
    origen?.numero_ganador,
    origen?.numero_oficial,
  ];

  for (const candidato of candidatos) {
    if (
      candidato === null ||
      candidato === undefined ||
      candidato === ""
    ) {
      continue;
    }

    const texto = String(candidato).trim();

    if (!/^\d+$/.test(texto)) {
      continue;
    }

    const numero = Number(texto);

    if (Number.isSafeInteger(numero)) {
      return numero;
    }
  }

  return null;
}

function errorResponse(
  mensaje,
  status = 400
) {
  return NextResponse.json(
    {
      ok: false,
      error: mensaje,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

/* =========================================================
   RESTAURAR SORTEO ANTERIOR
========================================================= */

async function restaurarSorteoAnterior(
  sorteoAnterior
) {
  /*
   * Si no existía un sorteo antes de la operación,
   * no hay nada que restaurar aquí.
   *
   * El caso de un sorteo NUEVO creado y una posterior
   * falla de la rifa se maneja por separado eliminando
   * ese sorteo recién creado.
   */
  if (!sorteoAnterior?.id) {
    return {
      ok: true,
    };
  }

  const {
    error: restaurarSorteoError,
  } = await supabaseAdmin
    .from("sorteos")
    .update({
      numero_ganador:
        sorteoAnterior.numero_ganador ?? null,

      numero_oficial:
        sorteoAnterior.numero_oficial ?? null,

      fecha_sorteo:
        sorteoAnterior.fecha_sorteo ?? null,

      fuente:
        sorteoAnterior.fuente ?? null,
    })
    .eq(
      "id",
      sorteoAnterior.id
    );

  if (restaurarSorteoError) {
    console.error(
      "No se pudo restaurar el sorteo anterior:",
      restaurarSorteoError
    );

    return {
      ok: false,
      error:
        restaurarSorteoError.message ||
        "No se pudo restaurar el sorteo anterior",
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   ELIMINAR SORTEO NUEVO SI FALLA LA RIFA
========================================================= */

async function eliminarSorteoNuevo(
  sorteoId
) {
  if (!sorteoId) {
    return {
      ok: true,
    };
  }

  const {
    error,
  } = await supabaseAdmin
    .from("sorteos")
    .delete()
    .eq(
      "id",
      sorteoId
    );

  if (error) {
    console.error(
      "No se pudo eliminar el sorteo creado durante rollback:",
      error
    );

    return {
      ok: false,
      error:
        error.message ||
        "No se pudo revertir el sorteo creado",
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   RESTAURAR RIFA ANTERIOR
========================================================= */

async function restaurarRifaAnterior(
  rifaId,
  rifaAnterior
) {
  if (
    !rifaId ||
    !rifaAnterior
  ) {
    return {
      ok: true,
    };
  }

  const {
    error: restaurarRifaError,
  } = await supabaseAdmin
    .from("rifas")
    .update({
      estado:
        rifaAnterior.estado ?? "activa",
    })
    .eq(
      "id",
      rifaId
    );

  if (restaurarRifaError) {
    console.error(
      "No se pudo restaurar la rifa anterior:",
      restaurarRifaError
    );

    return {
      ok: false,
      error:
        restaurarRifaError.message ||
        "No se pudo restaurar la rifa anterior",
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   POST /api/guardar-ganador
========================================================= */

export async function POST(req) {
  /* =====================================================
     1. SEGURIDAD ADMIN + MFA/AAL2

     requireAdmin controla la autenticación administrativa.
  ===================================================== */

  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
      },
      {
        status: auth.status,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }

  try {
    /* =====================================================
       2. BODY
    ===================================================== */

    let body;

    try {
      body = await req.json();
    } catch {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return errorResponse(
        "Cuerpo de la solicitud inválido",
        400
      );
    }

    /* =====================================================
       3. RIFA
    ===================================================== */

    const rifaIdLimpio =
      limpiarTexto(
        body?.rifaId ??
        body?.rifa_id
      );

    if (
      !rifaIdLimpio ||
      !esUuidValido(rifaIdLimpio)
    ) {
      return errorResponse(
        "Falta una rifa válida",
        400
      );
    }

    /* =====================================================
       4. FORMATO DEL NÚMERO
    ===================================================== */

    const padLengthRecibido =
      Number(body?.padLength);

    const padLength =
      Number.isInteger(
        padLengthRecibido
      ) &&
      padLengthRecibido >= 1 &&
      padLengthRecibido <= 12
        ? padLengthRecibido
        : 4;

    const numeroNormalizado =
      normalizarNumeroTicket(
        body?.numero_ticket ??
          body?.numero,
        padLength
      );

    if (!numeroNormalizado) {
      return errorResponse(
        "Falta un número de ticket válido",
        400
      );
    }

    const {
      numero,
      numeroOficial,
    } = numeroNormalizado;

    /* =====================================================
       5. BUSCAR RIFA
    ===================================================== */

    const {
      data: rifaData,
      error: rifaBuscarError,
    } = await supabaseAdmin
      .from("rifas")
      .select(`
        id,
        nombre,
        estado
      `)
      .eq(
        "id",
        rifaIdLimpio
      )
      .maybeSingle();

    if (rifaBuscarError) {
      console.error(
        "Error buscando rifa:",
        rifaBuscarError
      );

      return errorResponse(
        "No se pudo verificar la rifa",
        500
      );
    }

    if (!rifaData) {
      return errorResponse(
        "La rifa no existe",
        404
      );
    }

    /* =====================================================
       6. BUSCAR TICKET

       IMPORTANTE:

       Ya NO comprobamos únicamente que exista una fila
       en tickets.

       Necesitamos determinar si realmente está OCUPADO.

       Puede ser:

       A) Ticket PAGADO:
          - tiene compra_id

       B) Ticket FREE:
          - tipo = free
          - y está realmente asignado a una participación
    ===================================================== */

    const {
      data: ticketData,
      error: ticketError,
    } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        numero_ticket,
        compra_id,
        rifa_id,
        tipo,
        estado,
        free_drop_id,
        free_drop_participation_id,
        asignado_a_nombre,
        asignado_a_email,
        asignado_at
      `)
      .eq(
        "rifa_id",
        rifaIdLimpio
      )
      .eq(
        "numero_ticket",
        numero
      )
      .maybeSingle();

    if (ticketError) {
      console.error(
        "Error buscando ticket:",
        ticketError
      );

      return errorResponse(
        "No se pudo verificar el ticket",
        500
      );
    }

    /* =====================================================
       7. EL NÚMERO NI SIQUIERA EXISTE
    ===================================================== */

    if (!ticketData) {
      return errorResponse(
        `El número ${numeroOficial} no existe en esta rifa`,
        400
      );
    }

    /* =====================================================
       8. DETERMINAR TIPO
    ===================================================== */

    const estadoTicket =
      normalizarTexto(
        ticketData.estado
      );

    const tipoTicket =
      normalizarTexto(
        ticketData.tipo
      );

    /*
     * PAGADO
     *
     * Un ticket asociado a una compra tiene compra_id.
     */
    const esCompra =
      Boolean(
        ticketData.compra_id
      );

    /*
     * FREE
     *
     * Mantenemos la misma lógica fundamental utilizada
     * por verificar-ganador.
     */
    const esFreeAsignado =
      tipoTicket === "free" &&
      (
        estadoTicket === "asignado" ||
        Boolean(
          ticketData.free_drop_participation_id
        ) ||
        Boolean(
          ticketData.free_drop_id
        )
      );

    const ocupado =
      esCompra ||
      esFreeAsignado;

    /* =====================================================
       9. PROHIBIR TICKET DISPONIBLE
    ===================================================== */

    if (!ocupado) {
      return errorResponse(
        `El número ${numeroOficial} está disponible y no puede registrarse como ganador`,
        400
      );
    }

    /* =====================================================
       10. VALIDAR COMPRA PAGADA

       Tener compra_id indica que el ticket está asociado
       a una compra.

       Además verificamos la compra real y su estado.
    ===================================================== */

    if (esCompra) {
      const {
        data: compraData,
        error: compraError,
      } = await supabaseAdmin
        .from("compras")
        .select(`
          id,
          rifa_id,
          estado_pago
        `)
        .eq(
          "id",
          ticketData.compra_id
        )
        .maybeSingle();

      if (compraError) {
        console.error(
          "Error verificando compra del ganador:",
          compraError
        );

        return errorResponse(
          "No se pudo verificar la compra asociada al ticket",
          500
        );
      }

      if (!compraData) {
        return errorResponse(
          "El ticket tiene una compra asociada que ya no existe",
          409
        );
      }

      if (
        compraData.rifa_id !==
        rifaIdLimpio
      ) {
        return errorResponse(
          "La compra asociada no pertenece a esta rifa",
          409
        );
      }

      const estadoPago =
        normalizarTexto(
          compraData.estado_pago
        );

      /*
       * Estados que tu sistema ha utilizado como
       * equivalentes de una compra válida/aprobada.
       */
      const estadosPagoValidos = [
        "aprobado",
        "aprobada",
        "approved",
        "pagado",
        "pagada",
        "activo",
        "activa",
      ];

      if (
        !estadosPagoValidos.includes(
          estadoPago
        )
      ) {
        return errorResponse(
          `El número ${numeroOficial} pertenece a una compra que no está aprobada`,
          409
        );
      }
    }

    /* =====================================================
       11. VALIDAR PARTICIPACIÓN FREE

       Si es FREE, comprobamos que realmente exista
       una participación asociada.

       Esto evita aceptar como ganador un ticket FREE
       que haya quedado disponible o incompleto.
    ===================================================== */

    if (esFreeAsignado) {
      let participacionQuery =
        supabaseAdmin
          .from(
            "free_drop_participations"
          )
          .select(`
            id,
            rifa_id,
            free_drop_id,
            ticket_id,
            estado
          `);

      if (
        ticketData.free_drop_participation_id
      ) {
        participacionQuery =
          participacionQuery.eq(
            "id",
            ticketData.free_drop_participation_id
          );
      } else {
        participacionQuery =
          participacionQuery.eq(
            "ticket_id",
            ticketData.id
          );
      }

      const {
        data: participacionFree,
        error: participacionError,
      } =
        await participacionQuery.maybeSingle();

      if (participacionError) {
        console.error(
          "Error verificando participación FREE:",
          participacionError
        );

        return errorResponse(
          "No se pudo verificar la participación FREE",
          500
        );
      }

      if (!participacionFree) {
        return errorResponse(
          `El número ${numeroOficial} no tiene una participación FREE válida asociada`,
          409
        );
      }

      if (
        participacionFree.rifa_id !==
        rifaIdLimpio
      ) {
        return errorResponse(
          "La participación FREE no pertenece a esta rifa",
          409
        );
      }

      /*
       * No aceptamos participaciones que claramente
       * estén anuladas o rechazadas.
       */
      const estadoParticipacion =
        normalizarTexto(
          participacionFree.estado
        );

      const estadosFreeInvalidos = [
        "rechazado",
        "rechazada",
        "rejected",
        "anulado",
        "anulada",
        "cancelado",
        "cancelada",
        "cancelled",
      ];

      if (
        estadosFreeInvalidos.includes(
          estadoParticipacion
        )
      ) {
        return errorResponse(
          `El número ${numeroOficial} pertenece a una participación FREE que ya no es válida`,
          409
        );
      }
    }

    /* =====================================================
       12. BUSCAR SORTEO EXISTENTE
    ===================================================== */

    const {
      data: sorteoRows,
      error: sorteoExistenteError,
    } = await supabaseAdmin
      .from("sorteos")
      .select(`
        id,
        numero_ganador,
        numero_oficial,
        rifa_id,
        fecha_sorteo,
        fuente
      `)
      .eq(
        "rifa_id",
        rifaIdLimpio
      )
      .order(
        "fecha_sorteo",
        {
          ascending: false,
        }
      )
      .limit(1);

    if (sorteoExistenteError) {
      console.error(
        "Error verificando sorteo existente:",
        sorteoExistenteError
      );

      return errorResponse(
        "Error al verificar el sorteo existente",
        500
      );
    }

    const sorteoExistente =
      Array.isArray(sorteoRows)
        ? sorteoRows[0] || null
        : null;

    const ganadorGuardado =
      obtenerNumeroGuardado(
        sorteoExistente
      );

    /* =====================================================
       13. NO REEMPLAZAR OTRO GANADOR
    ===================================================== */

    if (
      ganadorGuardado !== null &&
      ganadorGuardado !== numero
    ) {
      return errorResponse(
        "Esta rifa ya tiene otro ganador oficial registrado",
        409
      );
    }

    /* =====================================================
       14. GUARDAR ESTADO ANTERIOR PARA ROLLBACK
    ===================================================== */

    const sorteoAnterior =
      sorteoExistente
        ? {
            id:
              sorteoExistente.id,

            numero_ganador:
              sorteoExistente.numero_ganador ??
              null,

            numero_oficial:
              sorteoExistente.numero_oficial ??
              null,

            fecha_sorteo:
              sorteoExistente.fecha_sorteo ??
              null,

            fuente:
              sorteoExistente.fuente ??
              null,
          }
        : null;

    const rifaAnterior = {
      id:
        rifaData.id,

      estado:
        rifaData.estado ?? null,
    };

    let sorteoFinal = null;

    /*
     * Nos permite saber si acabamos de INSERTAR
     * un sorteo nuevo.
     */
    let sorteoFueCreado = false;

    /* =====================================================
       15. CREAR O ACTUALIZAR SORTEO
    ===================================================== */

    if (!sorteoExistente) {
      const {
        data: sorteoCreadoData,
        error: insertError,
      } = await supabaseAdmin
        .from("sorteos")
        .insert([
          {
            numero_ganador:
              numero,

            numero_oficial:
              numeroOficial,

            fecha_sorteo:
              new Date().toISOString(),

            fuente:
              rifaData.nombre ||
              "Rifa",

            rifa_id:
              rifaIdLimpio,
          },
        ])
        .select(`
          id,
          numero_ganador,
          numero_oficial,
          rifa_id,
          fecha_sorteo,
          fuente
        `)
        .single();

      if (insertError) {
        console.error(
          "Error guardando ganador:",
          insertError
        );

        return errorResponse(
          "No se pudo registrar el ganador oficial",
          500
        );
      }

      sorteoFinal =
        sorteoCreadoData;

      sorteoFueCreado = true;
    } else {
      const {
        data: sorteoActualizado,
        error: updateSorteoError,
      } = await supabaseAdmin
        .from("sorteos")
        .update({
          numero_ganador:
            numero,

          numero_oficial:
            numeroOficial,

          fecha_sorteo:
            ganadorGuardado === null
              ? new Date().toISOString()
              : sorteoExistente.fecha_sorteo ||
                new Date().toISOString(),

          fuente:
            sorteoExistente.fuente ||
            rifaData.nombre ||
            "Rifa",
        })
        .eq(
          "id",
          sorteoExistente.id
        )
        .select(`
          id,
          numero_ganador,
          numero_oficial,
          rifa_id,
          fecha_sorteo,
          fuente
        `)
        .single();

      if (updateSorteoError) {
        console.error(
          "Error actualizando sorteo:",
          updateSorteoError
        );

        return errorResponse(
          "No se pudo actualizar el ganador oficial",
          500
        );
      }

      sorteoFinal =
        sorteoActualizado;
    }

    /* =====================================================
       16. FINALIZAR RIFA
    ===================================================== */

    const {
      data: rifaActualizada,
      error: updateRifaError,
    } = await supabaseAdmin
      .from("rifas")
      .update({
        estado: "finalizada",
      })
      .eq(
        "id",
        rifaIdLimpio
      )
      .select(`
        id,
        nombre,
        estado
      `)
      .maybeSingle();

    /* =====================================================
       17. ROLLBACK SI FALLA LA RIFA
    ===================================================== */

    if (
      updateRifaError ||
      !rifaActualizada
    ) {
      console.error(
        "Error actualizando rifa después de guardar ganador:",
        updateRifaError
      );

      /*
       * Si acabamos de CREAR un sorteo,
       * debemos eliminarlo completamente.
       *
       * En la versión anterior no se eliminaba
       * porque sorteoAnterior era null.
       */
      if (
        sorteoFueCreado &&
        sorteoFinal?.id
      ) {
        await eliminarSorteoNuevo(
          sorteoFinal.id
        );
      } else {
        /*
         * Si el sorteo ya existía,
         * restauramos exactamente sus datos anteriores.
         */
        await restaurarSorteoAnterior(
          sorteoAnterior
        );
      }

      /*
       * Restauramos también el estado anterior
       * de la rifa.
       */
      await restaurarRifaAnterior(
        rifaIdLimpio,
        rifaAnterior
      );

      if (updateRifaError) {
        return errorResponse(
          `Se registró el sorteo pero no se pudo actualizar la rifa: ${
            updateRifaError.message ||
            "Error desconocido"
          }`,
          500
        );
      }

      return errorResponse(
        "La rifa no se pudo actualizar",
        404
      );
    }

    /* =====================================================
       18. RESPUESTA
    ===================================================== */

    return NextResponse.json(
      {
        ok: true,

        mensaje:
          "Ganador oficial registrado correctamente",

        tipo_ticket:
          esFreeAsignado
            ? "free"
            : "compra",

        sorteo: {
          id:
            sorteoFinal?.id ||
            null,

          rifa_id:
            sorteoFinal?.rifa_id ||
            rifaIdLimpio,

          numero_ganador:
            sorteoFinal?.numero_ganador ??
            numero,

          numero_oficial:
            sorteoFinal?.numero_oficial ??
            numeroOficial,

          fecha_sorteo:
            sorteoFinal?.fecha_sorteo ||
            null,

          fuente:
            sorteoFinal?.fuente ||
            rifaData.nombre ||
            "Rifa",
        },

        rifa: {
          id:
            rifaActualizada.id,

          nombre:
            rifaActualizada.nombre,

          estado:
            rifaActualizada.estado,
        },

        numero_ganador:
          numero,

        numero_oficial:
          numeroOficial,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error en guardar-ganador:",
      error
    );

    return errorResponse(
      error?.message ||
        "No se pudo registrar el ganador oficial",
      500
    );
  }
}