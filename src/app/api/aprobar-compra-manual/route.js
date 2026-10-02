import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { sendCompraAprobadaEmail } from "../../../lib/sendCompraAprobadaEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   URL BASE
========================================================= */

function getBaseUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) {
    return envUrl.startsWith("http")
      ? envUrl.replace(/\/$/, "")
      : `https://${envUrl.replace(/\/$/, "")}`;
  }

  const proto = (
    req.headers.get("x-forwarded-proto") || "https"
  )
    .split(",")[0]
    .trim();

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/$/, "");
}

/* =========================================================
   HELPERS GENERALES
========================================================= */

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (
    Number.isFinite(inicio) &&
    Number.isFinite(fin) &&
    fin >= inicio
  ) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);

  return Number.isFinite(cantidad)
    ? cantidad
    : 0;
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   PROTECCIÓN FREE
========================================================= */

function esTicketFree(ticket = {}) {
  const tipo = normalizarTexto(ticket?.tipo);

  return Boolean(
    (ticket?.free_drop_id !== null &&
      ticket?.free_drop_id !== undefined) ||
      (ticket?.free_drop_participation_id !== null &&
        ticket?.free_drop_participation_id !== undefined) ||
      tipo === "free"
  );
}

function esTicketDisponible(ticket = {}) {
  const sinCompra =
    ticket?.compra_id === null ||
    ticket?.compra_id === undefined;

  const sinFreeDrop =
    ticket?.free_drop_id === null ||
    ticket?.free_drop_id === undefined;

  const sinParticipacionFree =
    ticket?.free_drop_participation_id === null ||
    ticket?.free_drop_participation_id === undefined;

  const estado = normalizarTexto(
    ticket?.estado
  );

  return (
    sinCompra &&
    sinFreeDrop &&
    sinParticipacionFree &&
    !esTicketFree(ticket) &&
    estado === "disponible"
  );
}

function esTicketOcupado(ticket = {}) {
  return !esTicketDisponible(ticket);
}

function contarNumerosUnicosOcupados(lista = []) {
  return new Set(
    lista
      .filter(esTicketOcupado)
      .map((ticket) =>
        Number(ticket?.numero_ticket)
      )
      .filter(Number.isFinite)
  ).size;
}

/* =========================================================
   DATOS DEL CLIENTE
========================================================= */

async function obtenerDatosCliente(compra) {
  let nombreCliente = "cliente";
  let emailDestino = "";

  if (compra?.usuario_id) {
    const { data: usuario } =
      await supabaseAdmin
        .from("usuarios")
        .select("nombre, email")
        .eq("id", compra.usuario_id)
        .maybeSingle();

    if (usuario) {
      nombreCliente =
        usuario.nombre ||
        nombreCliente;

      emailDestino =
        usuario.email ||
        emailDestino;
    }
  }

  return {
    nombreCliente,
    emailDestino,
  };
}

/* =========================================================
   ROLLBACK
========================================================= */

async function rollbackAprobacionManual({
  compraId,
  ticketsActualizadosIds = [],
  ticketsInsertadosIds = [],
}) {
  const errores = [];

  /*
   * Los tickets que ya existían antes de esta operación
   * deben regresar al estado completamente disponible.
   *
   * Solo tocamos tickets que todavía pertenecen
   * a ESTA compra.
   */
  if (ticketsActualizadosIds.length > 0) {
    const {
      error: rollbackTicketsError,
    } = await supabaseAdmin
      .from("tickets")
      .update({
        compra_id: null,
        estado: "disponible",
      })
      .in(
        "id",
        ticketsActualizadosIds
      )
      .eq(
        "compra_id",
        compraId
      );

    if (rollbackTicketsError) {
      errores.push(
        rollbackTicketsError.message ||
          "No se pudieron liberar los tickets actualizados."
      );
    }
  }

  /*
   * Las filas que fueron creadas únicamente durante
   * esta aprobación pueden eliminarse.
   *
   * También comprobamos compra_id para evitar eliminar
   * accidentalmente una fila ajena.
   */
  if (ticketsInsertadosIds.length > 0) {
    const {
      error: rollbackInsertadosError,
    } = await supabaseAdmin
      .from("tickets")
      .delete()
      .in(
        "id",
        ticketsInsertadosIds
      )
      .eq(
        "compra_id",
        compraId
      );

    if (rollbackInsertadosError) {
      errores.push(
        rollbackInsertadosError.message ||
          "No se pudieron eliminar los tickets creados durante el rollback."
      );
    }
  }

  /*
   * La compra vuelve a pendiente solamente
   * si todavía pertenece a la operación actual.
   */
  const {
    error: rollbackCompraError,
  } = await supabaseAdmin
    .from("compras")
    .update({
      estado_pago: "pendiente",
    })
    .eq(
      "id",
      compraId
    );

  if (rollbackCompraError) {
    errores.push(
      rollbackCompraError.message ||
        "No se pudo devolver la compra a pendiente."
    );
  }

  return errores;
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  try {
    let body;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Cuerpo de la solicitud inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      compraId,
      rifaId,
      ticketsSeleccionados,
    } = body;

    if (
      !compraId ||
      !rifaId ||
      !Array.isArray(ticketsSeleccionados)
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan datos requeridos.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       NORMALIZAR TICKETS
    ===================================================== */

    const ticketsNormalizados =
      ticketsSeleccionados.map(
        (numero) => Number(numero)
      );

    if (
      ticketsNormalizados.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Debes seleccionar al menos un ticket.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      ticketsNormalizados.some(
        (numero) =>
          !Number.isFinite(numero) ||
          !Number.isInteger(numero)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Hay tickets inválidos en la selección.",
        },
        {
          status: 400,
        }
      );
    }

    const ticketsUnicos = [
      ...new Set(ticketsNormalizados),
    ];

    if (
      ticketsUnicos.length !==
      ticketsNormalizados.length
    ) {
      return NextResponse.json(
        {
          error:
            "Hay números repetidos en la selección.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       CARGAR COMPRA
    ===================================================== */

    const {
      data: compra,
      error: compraError,
    } = await supabaseAdmin
      .from("compras")
      .select(
        "id, usuario_id, rifa_id, estado_pago, cantidad_tickets, monto_total"
      )
      .eq(
        "id",
        compraId
      )
      .maybeSingle();

    if (
      compraError ||
      !compra
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró la compra.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      String(compra.rifa_id) !==
      String(rifaId)
    ) {
      return NextResponse.json(
        {
          error:
            "La compra no pertenece a la rifa seleccionada.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      normalizarTexto(
        compra.estado_pago
      ) !== "pendiente"
    ) {
      return NextResponse.json(
        {
          error:
            "La compra ya no está pendiente.",
        },
        {
          status: 400,
        }
      );
    }

    const cantidadEsperada =
      Number(
        compra.cantidad_tickets
      ) || 0;

    if (
      ticketsUnicos.length !==
      cantidadEsperada
    ) {
      return NextResponse.json(
        {
          error:
            `Debes seleccionar exactamente ${cantidadEsperada} ticket(s).`,
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       CARGAR RIFA
    ===================================================== */

    const {
      data: rifa,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .select("*")
      .eq(
        "id",
        rifaId
      )
      .maybeSingle();

    if (
      rifaError ||
      !rifa
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró la rifa.",
        },
        {
          status: 404,
        }
      );
    }

    const estadoRifa =
      normalizarTexto(
        rifa.estado
      );

    /*
     * Conservamos los estados que ya permitías
     * para aprobación manual.
     */
    if (
      ![
        "activa",
        "cerrada",
        "disponible",
        "publicada",
        "agotada",
      ].includes(estadoRifa)
    ) {
      return NextResponse.json(
        {
          error:
            "La rifa no permite aprobación manual en su estado actual.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       RANGO DE NÚMEROS
    ===================================================== */

    const numeroInicio =
      Number.isFinite(
        Number(rifa.numero_inicio)
      )
        ? Number(rifa.numero_inicio)
        : 0;

    const numeroFin =
      Number.isFinite(
        Number(rifa.numero_fin)
      )
        ? Number(rifa.numero_fin)
        : String(
            rifa.formato
          ) === "3digitos"
        ? 999
        : 9999;

    const padLength =
      String(
        rifa.formato
      ) === "3digitos"
        ? 3
        : 4;

    const totalNumeros =
      obtenerTotalNumeros(rifa);

    if (
      totalNumeros <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "La rifa no tiene una cantidad de números válida.",
        },
        {
          status: 400,
        }
      );
    }

    for (
      const numero of ticketsUnicos
    ) {
      if (
        numero < numeroInicio ||
        numero > numeroFin
      ) {
        return NextResponse.json(
          {
            error:
              `El número ${String(
                numero
              ).padStart(
                padLength,
                "0"
              )} está fuera del rango permitido.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /* =====================================================
       INVENTARIO GENERAL
    ===================================================== */

    const {
      data: ticketsActuales,
      error: ticketsActualesError,
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
        free_drop_participation_id
      `)
      .eq(
        "rifa_id",
        rifaId
      );

    if (
      ticketsActualesError
    ) {
      return NextResponse.json(
        {
          error:
            "Error al validar disponibilidad general de tickets.",
        },
        {
          status: 500,
        }
      );
    }

    const inventario =
      Array.isArray(
        ticketsActuales
      )
        ? ticketsActuales
        : [];

    const ticketsVendidosAntes =
      contarNumerosUnicosOcupados(
        inventario
      );

    const ticketsDisponiblesAntes =
      new Set(
        inventario
          .filter(
            esTicketDisponible
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      ).size;

    const ticketsPagadosAntes =
      new Set(
        inventario
          .filter(
            (ticket) =>
              ticket?.compra_id !==
                null &&
              ticket?.compra_id !==
                undefined
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      ).size;

    const ticketsFreeAntes =
      new Set(
        inventario
          .filter(
            esTicketFree
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      ).size;

    if (
      ticketsDisponiblesAntes <= 0 ||
      ticketsVendidosAntes >=
        totalNumeros
    ) {
      await supabaseAdmin
        .from("rifas")
        .update({
          estado: "agotada",
        })
        .eq(
          "id",
          rifaId
        );

      return NextResponse.json(
        {
          error:
            "La rifa ya alcanzó el 100% y no acepta más tickets.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      ticketsUnicos.length >
      ticketsDisponiblesAntes
    ) {
      return NextResponse.json(
        {
          error:
            `No hay suficientes tickets disponibles. Solo quedan ${ticketsDisponiblesAntes} ticket(s).`,
        },
        {
          status: 409,
        }
      );
    }

    /* =====================================================
       COMPROBAR NÚMEROS SELECCIONADOS
    ===================================================== */

    const {
      data: ticketsExistentes,
      error: ticketsExistentesError,
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
        free_drop_participation_id
      `)
      .eq(
        "rifa_id",
        rifaId
      )
      .in(
        "numero_ticket",
        ticketsUnicos
      );

    if (
      ticketsExistentesError
    ) {
      return NextResponse.json(
        {
          error:
            "Error al validar tickets existentes.",
        },
        {
          status: 500,
        }
      );
    }

    const existentes =
      Array.isArray(
        ticketsExistentes
      )
        ? ticketsExistentes
        : [];

    /*
     * Cualquier ticket que no sea realmente
     * disponible se considera ocupado.
     *
     * Esto incluye FREE.
     */
    const ocupadosYa =
      new Set(
        existentes
          .filter(
            esTicketOcupado
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      );

    if (
      ocupadosYa.size > 0
    ) {
      return NextResponse.json(
        {
          error:
            `Algunos tickets ya están ocupados o pertenecen a FREE DROP: ${[
              ...ocupadosYa,
            ]
              .sort(
                (a, b) =>
                  a - b
              )
              .map((numero) =>
                String(
                  numero
                ).padStart(
                  padLength,
                  "0"
                )
              )
              .join(", ")}`,
        },
        {
          status: 409,
        }
      );
    }

    const existentesPorNumero =
      new Map(
        existentes.map(
          (ticket) => [
            Number(
              ticket.numero_ticket
            ),
            ticket,
          ]
        )
      );

    const ticketsParaActualizar =
      [];

    const ticketsParaInsertar =
      [];

    for (
      const numero of ticketsUnicos
    ) {
      const existente =
        existentesPorNumero.get(
          numero
        );

      if (
        existente?.id
      ) {
        ticketsParaActualizar.push(
          existente.id
        );
      } else {
        /*
         * Conservamos tu compatibilidad con
         * inventarios incompletos.
         *
         * Una fila creada directamente para una
         * compra aprobada nace como ASIGNADA.
         */
        ticketsParaInsertar.push({
          compra_id:
            compra.id,

          rifa_id:
            rifaId,

          numero_ticket:
            numero,

          tipo:
            null,

          estado:
            "asignado",

          free_drop_id:
            null,

          free_drop_participation_id:
            null,
        });
      }
    }

    let ticketsActualizados =
      [];

    let ticketsInsertadosNuevos =
      [];

    /* =====================================================
       ASIGNAR TICKETS EXISTENTES
    ===================================================== */

    if (
      ticketsParaActualizar.length >
      0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("tickets")
        .update({
          compra_id:
            compra.id,

          /*
           * CORRECCIÓN:
           * un ticket de una compra aprobada
           * ya no puede seguir disponible.
           */
          estado:
            "asignado",
        })
        .in(
          "id",
          ticketsParaActualizar
        )
        .is(
          "compra_id",
          null
        )
        .is(
          "free_drop_id",
          null
        )
        .is(
          "free_drop_participation_id",
          null
        )
        .eq(
          "estado",
          "disponible"
        )
        .or(
          "tipo.is.null,tipo.neq.free"
        )
        .select(`
          id,
          numero_ticket,
          compra_id,
          rifa_id,
          tipo,
          estado,
          free_drop_id,
          free_drop_participation_id
        `);

      if (error) {
        return NextResponse.json(
          {
            error:
              error.message ||
              "No se pudieron actualizar los tickets.",
          },
          {
            status: 500,
          }
        );
      }

      const actualizados =
        Array.isArray(data)
          ? data
          : [];

      /*
       * Si otro proceso tomó algún ticket entre
       * SELECT y UPDATE, revertimos los que sí
       * alcanzamos a tomar.
       */
      if (
        actualizados.length !==
        ticketsParaActualizar.length
      ) {
        if (
          actualizados.length > 0
        ) {
          await supabaseAdmin
            .from("tickets")
            .update({
              compra_id:
                null,

              estado:
                "disponible",
            })
            .in(
              "id",
              actualizados.map(
                (ticket) =>
                  ticket.id
              )
            )
            .eq(
              "compra_id",
              compra.id
            );
        }

        return NextResponse.json(
          {
            error:
              "Uno o más tickets dejaron de estar disponibles o pertenecen a FREE DROP.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * Defensa adicional.
       * El resultado nunca debe contener FREE.
       */
      const contieneFree =
        actualizados.some(
          esTicketFree
        );

      if (contieneFree) {
        await supabaseAdmin
          .from("tickets")
          .update({
            compra_id:
              null,

            estado:
              "disponible",
          })
          .in(
            "id",
            actualizados.map(
              (ticket) =>
                ticket.id
            )
          )
          .eq(
            "compra_id",
            compra.id
          );

        return NextResponse.json(
          {
            error:
              "La asignación fue cancelada porque se detectó un ticket FREE.",
          },
          {
            status: 409,
          }
        );
      }

      ticketsActualizados =
        actualizados;
    }

    /* =====================================================
       CREAR FILAS FALTANTES
    ===================================================== */

    if (
      ticketsParaInsertar.length >
      0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("tickets")
        .insert(
          ticketsParaInsertar
        )
        .select(`
          id,
          numero_ticket,
          compra_id,
          rifa_id,
          tipo,
          estado,
          free_drop_id,
          free_drop_participation_id
        `);

      if (error) {
        await rollbackAprobacionManual({
          compraId:
            compra.id,

          ticketsActualizadosIds:
            ticketsActualizados.map(
              (ticket) =>
                ticket.id
            ),

          ticketsInsertadosIds:
            [],
        });

        return NextResponse.json(
          {
            error:
              error.message ||
              "No se pudieron crear tickets faltantes.",
          },
          {
            status: 500,
          }
        );
      }

      ticketsInsertadosNuevos =
        Array.isArray(data)
          ? data
          : [];
    }

    const ticketsAsignados = [
      ...ticketsActualizados,
      ...ticketsInsertadosNuevos,
    ];

    if (
      ticketsAsignados.length !==
      ticketsUnicos.length
    ) {
      await rollbackAprobacionManual({
        compraId:
          compra.id,

        ticketsActualizadosIds:
          ticketsActualizados.map(
            (ticket) =>
              ticket.id
          ),

        ticketsInsertadosIds:
          ticketsInsertadosNuevos.map(
            (ticket) =>
              ticket.id
          ),
      });

      return NextResponse.json(
        {
          error:
            "No se pudieron asignar todos los tickets seleccionados.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Verificación final antes de aprobar la compra.
     */
    const asignacionInvalida =
      ticketsAsignados.some(
        (ticket) =>
          esTicketFree(ticket) ||
          String(
            ticket?.compra_id
          ) !==
            String(compra.id) ||
          normalizarTexto(
            ticket?.estado
          ) !== "asignado"
      );

    if (
      asignacionInvalida
    ) {
      await rollbackAprobacionManual({
        compraId:
          compra.id,

        ticketsActualizadosIds:
          ticketsActualizados.map(
            (ticket) =>
              ticket.id
          ),

        ticketsInsertadosIds:
          ticketsInsertadosNuevos.map(
            (ticket) =>
              ticket.id
          ),
      });

      return NextResponse.json(
        {
          error:
            "La asignación de tickets no superó la validación final.",
        },
        {
          status: 409,
        }
      );
    }

    /* =====================================================
       APROBAR COMPRA
    ===================================================== */

    const {
      data: compraActualizada,
      error: updateCompraError,
    } = await supabaseAdmin
      .from("compras")
      .update({
        estado_pago:
          "aprobado",

        rifa_id:
          rifaId,
      })
      .eq(
        "id",
        compra.id
      )
      /*
       * Evitamos aprobarla si otro proceso
       * dejó de tenerla pendiente.
       */
      .eq(
        "estado_pago",
        "pendiente"
      )
      .select(
        "id, estado_pago, rifa_id"
      )
      .maybeSingle();

    if (
      updateCompraError ||
      !compraActualizada
    ) {
      const rollbackErrors =
        await rollbackAprobacionManual({
          compraId:
            compra.id,

          ticketsActualizadosIds:
            ticketsActualizados.map(
              (ticket) =>
                ticket.id
            ),

          ticketsInsertadosIds:
            ticketsInsertadosNuevos.map(
              (ticket) =>
                ticket.id
            ),
        });

      console.error(
        "No se pudo aprobar la compra manual:",
        updateCompraError,
        rollbackErrors
      );

      return NextResponse.json(
        {
          error:
            "Los tickets se asignaron, pero no se pudo actualizar la compra.",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       RECALCULAR INVENTARIO REAL
    ===================================================== */

    const {
      data: ticketsFinalesData,
      error: ticketsFinalesError,
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
        free_drop_participation_id
      `)
      .eq(
        "rifa_id",
        rifaId
      );

    let ticketsFinales =
      Array.isArray(
        ticketsFinalesData
      )
        ? ticketsFinalesData
        : [];

    /*
     * Si falla únicamente la consulta estadística
     * final, la compra ya fue aprobada.
     *
     * No la revertimos por un fallo de estadísticas.
     * Construimos un fallback con el inventario anterior.
     */
    if (
      ticketsFinalesError
    ) {
      console.warn(
        "No se pudieron recalcular las estadísticas finales:",
        ticketsFinalesError.message
      );

      const idsAsignados =
        new Set(
          ticketsAsignados.map(
            (ticket) =>
              String(ticket.id)
          )
        );

      ticketsFinales =
        inventario.map(
          (ticket) => {
            if (
              idsAsignados.has(
                String(ticket.id)
              )
            ) {
              return {
                ...ticket,

                compra_id:
                  compra.id,

                estado:
                  "asignado",
              };
            }

            return ticket;
          }
        );

      /*
       * Agregamos cualquier fila que no existiera
       * originalmente en el inventario.
       */
      for (
        const ticket of ticketsInsertadosNuevos
      ) {
        if (
          !ticketsFinales.some(
            (existente) =>
              String(
                existente.id
              ) ===
              String(ticket.id)
          )
        ) {
          ticketsFinales.push(
            ticket
          );
        }
      }
    }

    const ticketsVendidosDespues =
      contarNumerosUnicosOcupados(
        ticketsFinales
      );

    const ticketsPagadosDespues =
      new Set(
        ticketsFinales
          .filter(
            (ticket) =>
              ticket?.compra_id !==
                null &&
              ticket?.compra_id !==
                undefined
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      ).size;

    const ticketsFreeDespues =
      new Set(
        ticketsFinales
          .filter(
            esTicketFree
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      ).size;

    const ticketsDisponiblesDespues =
      new Set(
        ticketsFinales
          .filter(
            esTicketDisponible
          )
          .map((ticket) =>
            Number(
              ticket.numero_ticket
            )
          )
          .filter(
            Number.isFinite
          )
      ).size;

    const rifaCompleta =
      ticketsDisponiblesDespues <=
        0 ||
      ticketsVendidosDespues >=
        totalNumeros;

    const nuevoEstadoRifa =
      rifaCompleta
        ? "agotada"
        : rifa.estado;

    let advertenciaRifa =
      null;

    if (
      rifaCompleta
    ) {
      const {
        error: updateRifaError,
      } = await supabaseAdmin
        .from("rifas")
        .update({
          estado:
            "agotada",
        })
        .eq(
          "id",
          rifaId
        );

      if (
        updateRifaError
      ) {
        advertenciaRifa =
          "La compra se aprobó, pero no se pudo marcar la rifa como agotada: " +
          (
            updateRifaError.message ||
            "error desconocido"
          );
      }
    }

    /* =====================================================
       EMAIL
    ===================================================== */

    try {
      const baseUrl =
        getBaseUrl(req);

      const {
        nombreCliente,
        emailDestino,
      } =
        await obtenerDatosCliente(
          compra
        );

      if (
        emailDestino
      ) {
        await sendCompraAprobadaEmail({
          to:
            emailDestino,

          nombre:
            nombreCliente,

          rifaNombre:
            rifa.nombre ||
            "Rifa",

          rifaDescripcion:
            rifa.descripcion ||
            "",

          portadaUrl:
            rifa.portada_url ||
            rifa.portada_scroll_url ||
            "",

fechaEvento: new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date()),

          horaEvento:
            rifa.hora_sorteo ||
            rifa.hora ||
            rifa.hora_rifa ||
            "",

          tickets:
            compra.cantidad_tickets ||
            0,

          numerosTickets:
            ticketsAsignados
              .map(
                (ticket) =>
                  Number(
                    ticket.numero_ticket
                  )
              )
              .sort(
                (a, b) =>
                  a - b
              ),

          totalPagar:
            Number(
              compra.monto_total ??
                0
            ),

          eventoUrl:
            `${baseUrl}/evento/${rifa.id}`,

          verificarUrl:
            `${baseUrl}/principal`,

          padLength,
        });
      }
    } catch (
      emailError
    ) {
      /*
       * Un fallo de email NO revierte
       * una compra aprobada.
       */
      console.error(
        "No se pudo enviar el correo:",
        emailError
      );
    }

    /* =====================================================
       RESPUESTA
    ===================================================== */

    return NextResponse.json({
      ok: true,

      message:
        "Compra aprobada manualmente",

      compraId:
        compra.id,

      tickets:
        ticketsAsignados,

      advertenciaRifa,

      rifa: {
        id:
          rifa.id,

        nombre:
          rifa.nombre,

        formato:
          rifa.formato,

        estado:
          nuevoEstadoRifa,

        /*
         * Compatibilidad:
         * tickets_vendidos representa
         * ocupación total PAGADOS + FREE.
         */
        tickets_vendidos:
          ticketsVendidosDespues,

        tickets_ocupados:
          ticketsVendidosDespues,

        tickets_pagados:
          ticketsPagadosDespues,

        tickets_free:
          ticketsFreeDespues,

        tickets_disponibles:
          ticketsDisponiblesDespues,

        total_numeros:
          totalNumeros,

        porcentaje_vendido:
          totalNumeros > 0
            ? Number(
                (
                  (
                    ticketsVendidosDespues /
                    totalNumeros
                  ) *
                  100
                ).toFixed(2)
              )
            : 0,

        sold_out:
          rifaCompleta,
      },

      diagnostico: {
        antes: {
          ocupados:
            ticketsVendidosAntes,

          pagados:
            ticketsPagadosAntes,

          free:
            ticketsFreeAntes,

          disponibles:
            ticketsDisponiblesAntes,
        },

        despues: {
          ocupados:
            ticketsVendidosDespues,

          pagados:
            ticketsPagadosDespues,

          free:
            ticketsFreeDespues,

          disponibles:
            ticketsDisponiblesDespues,
        },
      },

      rifaCompleta,
    });
  } catch (error) {
    console.error(
      "aprobar-compra-manual error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Error interno del servidor.",
      },
      {
        status: 500,
      }
    );
  }
}