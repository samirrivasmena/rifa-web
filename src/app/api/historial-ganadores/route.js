
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   CONFIGURACIÓN DE CACHÉ
========================================================= */

const CACHE_HISTORIAL_PUBLICO =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=30";

const CACHE_PRIVADA =
  "private, no-store, max-age=0";

/* =========================================================
   HELPERS
========================================================= */

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarTexto(valor) {
  return limpiarTexto(valor).toLowerCase();
}

function normalizarNumero(valor) {
  const limpio = limpiarTexto(valor);

  if (!limpio) return null;

  const soloNumeros = limpio.replace(/\D/g, "");

  if (!soloNumeros) return null;

  const numero = Number(soloNumeros);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero;
}

function obtenerNumeroGanador(sorteo) {
  return (
    sorteo?.numero_oficial ??
    sorteo?.numero_ganador ??
    null
  );
}

function construirNombre(nombre, apellido) {
  return [
    limpiarTexto(nombre),
    limpiarTexto(apellido),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/* =========================================================
   SELECTS REUTILIZABLES
========================================================= */

const TICKET_SELECT = `
  id,
  rifa_id,
  numero_ticket,
  compra_id,
  tipo,
  estado,
  free_drop_id,
  free_drop_participation_id,
  asignado_a_nombre,
  asignado_a_email,
  asignado_a_telefono,
  asignado_at
`;

const FREE_PARTICIPATION_SELECT = `
  id,
  rifa_id,
  free_drop_id,
  ticket_id,
  nombre,
  apellido,
  email,
  telefono,
  codigo_unico,
  estado,
  estado_residencia,
  acepta_reglas,
  cumple_requisitos,
  social_username,
  evidence_url,
  created_at,
  updated_at
`;

/* =========================================================
   RESPUESTA PÚBLICA SEGURA

   Se construye con una lista explícita de campos.
   No incluye datos administrativos privados.
========================================================= */

function convertirGanadorAPublico(ganador) {
  const rifa = ganador?.rifas || {};

  return {
    id: ganador.id,
    rifa_id: ganador.rifa_id,

    numero_ganador: ganador.numero_ganador,
    numero_oficial: ganador.numero_oficial,

    nombre_ganador: ganador.nombre_ganador,

    foto_ganador_url:
      ganador.foto_ganador_url,

    foto_ganador_secundaria_url:
      ganador.foto_ganador_secundaria_url,

    descripcion_resultado:
      ganador.descripcion_resultado,

    ciudad_ganador:
      ganador.ciudad_ganador,

    instagram_ganador:
      ganador.instagram_ganador,

    estado_entrega:
      ganador.estado_entrega,

    fecha_entrega:
      ganador.fecha_entrega,

    fecha_sorteo:
      ganador.fecha_sorteo,

    fuente: ganador.fuente,

    rifas: {
      id: rifa.id,
      nombre: rifa.nombre,
      premio: rifa.premio,
      descripcion: rifa.descripcion,
      portada_url: rifa.portada_url,
      portada_scroll_url: rifa.portada_scroll_url,
      fecha_sorteo: rifa.fecha_sorteo,
      hora_sorteo: rifa.hora_sorteo,
      estado: rifa.estado,
      formato: rifa.formato,
    },
  };
}

/* =========================================================
   RESPUESTA JSON

   Público:
   Caché compartida de 60 segundos.

   Administrador:
   Sin caché.

   Errores:
   Sin caché.
========================================================= */

function responderJSON(
  datos,
  status = 200,
  cachePublica = false
) {
  return NextResponse.json(datos, {
    status,
    headers: {
      "Cache-Control":
        cachePublica && status === 200
          ? CACHE_HISTORIAL_PUBLICO
          : CACHE_PRIVADA,

      "X-Content-Type-Options": "nosniff",
    },
  });
}

/* =========================================================
   GET - HISTORIAL DE GANADORES
========================================================= */

export async function GET(req) {
  const inicioHistorial = performance.now();

  const diagnosticoId = Math.random()
    .toString(36)
    .slice(2, 8);

  const medir = async (nombre, consulta) => {
    const inicio = performance.now();

    try {
      return await consulta();
    } finally {
      const duracion =
        performance.now() - inicio;

      console.log(
        `[${diagnosticoId}] HISTORIAL - ${nombre}: ${duracion.toFixed(2)}ms`
      );
    }
  };

  try {
    /* =====================================================
       1. VERIFICAR ADMINISTRADOR
    ===================================================== */

    const authHeader =
      req.headers.get("authorization") || "";

    let esAdministrador = false;

    if (authHeader) {
      const admin = await requireAdmin(req);

      if (!admin.ok) {
        return responderJSON(
          {
            ok: false,
            error:
              admin.error || "No autorizado",

            ...(admin.requiresMfa
              ? { requiresMfa: true }
              : {}),
          },
          admin.status || 401
        );
      }

      esAdministrador = true;
    }

    /* =====================================================
       2. CARGAR SORTEOS
    ===================================================== */

    const {
      data: sorteos,
      error: sorteosError,
    } = await medir("sorteos", () =>
      supabaseAdmin
        .from("sorteos")
        .select(`
          id,
          rifa_id,
          numero_ganador,
          numero_oficial,
          nombre_ganador,
          foto_ganador_url,
          foto_ganador_secundaria_url,
          descripcion_resultado,
          ciudad_ganador,
          instagram_ganador,
          estado_entrega,
          fecha_entrega,
          nota_interna,
          fecha_sorteo,
          fuente,
          rifas (
            id,
            nombre,
            premio,
            descripcion,
            portada_url,
            portada_scroll_url,
            fecha_sorteo,
            hora_sorteo,
            estado,
            formato
          )
        `)
        .order("fecha_sorteo", {
          ascending: false,
        })
    );

    if (sorteosError) {
      console.error(
        "Error cargando sorteos:",
        sorteosError
      );

      return responderJSON(
        {
          ok: false,
          error:
            "No se pudo cargar el historial",
        },
        500
      );
    }

    const sorteosBase =
      Array.isArray(sorteos)
        ? sorteos
        : [];

    /* =====================================================
       SIN GANADORES
    ===================================================== */

    if (!sorteosBase.length) {
      console.log(
        `[${diagnosticoId}] HISTORIAL - TOTAL: ${Math.round(
          performance.now() - inicioHistorial
        )}ms`
      );

      return responderJSON(
        {
          ok: true,
          ganadores: [],
        },
        200,
        !esAdministrador
      );
    }

    /* =====================================================
       3. BUSCAR TICKETS GANADORES
    ===================================================== */

    const sorteosConTicket = await medir(
      "tickets ganadores",
      () =>
        Promise.all(
          sorteosBase.map(async (sorteo) => {
            const rifaId = limpiarTexto(
              sorteo?.rifa_id
            );

            const numeroGanador =
              normalizarNumero(
                obtenerNumeroGanador(sorteo)
              );

            if (
              !rifaId ||
              numeroGanador === null
            ) {
              return {
                sorteo,
                ticketGanador: null,
              };
            }

            const {
              data: ticketData,
              error: ticketError,
            } = await supabaseAdmin
              .from("tickets")
              .select(TICKET_SELECT)
              .eq("rifa_id", rifaId)
              .eq(
                "numero_ticket",
                numeroGanador
              )
              .limit(1);

            if (ticketError) {
              console.error(
                `Error buscando ticket ganador ${rifaId} #${numeroGanador}:`,
                ticketError
              );

              return {
                sorteo,
                ticketGanador: null,
              };
            }

            const ticketGanador =
              Array.isArray(ticketData) &&
              ticketData.length
                ? ticketData[0]
                : null;

            return {
              sorteo,
              ticketGanador,
            };
          })
        )
    );

    /* =====================================================
       4. IDS DE COMPRAS GANADORAS
    ===================================================== */

    const compraIds = [
      ...new Set(
        sorteosConTicket
          .map(({ ticketGanador }) =>
            limpiarTexto(
              ticketGanador?.compra_id
            )
          )
          .filter(Boolean)
      ),
    ];

    const inicioConsultasPosteriores =
      performance.now();

    /* =====================================================
       5. CARGAR COMPRAS
    ===================================================== */

    let compras = [];

    if (compraIds.length) {
      const {
        data: comprasData,
        error: comprasError,
      } = await medir("compras", () =>
        supabaseAdmin
          .from("compras")
          .select(`
            id,
            rifa_id,
            usuario_id,
            nombre_cliente,
            email_cliente,
            telefono_cliente,
            cantidad_tickets,
            monto_total,
            referencia,
            metodo_pago,
            estado_pago,
            fecha_compra,
            created_at
          `)
          .in("id", compraIds)
      );

      if (comprasError) {
        console.error(
          "Error cargando compras ganadoras:",
          comprasError
        );

        return responderJSON(
          {
            ok: false,
            error:
              "No se pudieron cargar las compras ganadoras",
          },
          500
        );
      }

      compras = Array.isArray(comprasData)
        ? comprasData
        : [];
    }

    const comprasPorId = new Map(
      compras.map((compra) => [
        String(compra.id),
        compra,
      ])
    );

    /* =====================================================
       6. CARGAR USUARIOS
    ===================================================== */

    const usuarioIds = [
      ...new Set(
        compras
          .map((compra) =>
            limpiarTexto(
              compra?.usuario_id
            )
          )
          .filter(Boolean)
      ),
    ];

    let usuarios = [];

    if (usuarioIds.length) {
      const {
        data: usuariosData,
        error: usuariosError,
      } = await medir("usuarios", () =>
        supabaseAdmin
          .from("usuarios")
          .select(`
            id,
            nombre,
            email,
            telefono
          `)
          .in("id", usuarioIds)
      );

      if (usuariosError) {
        console.error(
          "Error cargando usuarios ganadores:",
          usuariosError
        );

        return responderJSON(
          {
            ok: false,
            error:
              "No se pudieron cargar los usuarios ganadores",
          },
          500
        );
      }

      usuarios = Array.isArray(usuariosData)
        ? usuariosData
        : [];
    }

    const usuariosPorId = new Map(
      usuarios.map((usuario) => [
        String(usuario.id),
        usuario,
      ])
    );

    /* =====================================================
       7. IDS DE PARTICIPACIONES FREE
    ===================================================== */

    const participacionFreeIds = [
      ...new Set(
        sorteosConTicket
          .map(({ ticketGanador }) =>
            limpiarTexto(
              ticketGanador
                ?.free_drop_participation_id
            )
          )
          .filter(Boolean)
      ),
    ];

    /* =====================================================
       8. IDS DE TICKETS GANADORES
    ===================================================== */

    const ticketGanadorIds = [
      ...new Set(
        sorteosConTicket
          .map(({ ticketGanador }) =>
            limpiarTexto(
              ticketGanador?.id
            )
          )
          .filter(Boolean)
      ),
    ];

    /* =====================================================
       9. PARTICIPACIONES FREE POR ID
    ===================================================== */

    let participacionesFree = [];

    if (participacionFreeIds.length) {
      const {
        data: freeData,
        error: freeError,
      } = await medir("free por ID", () =>
        supabaseAdmin
          .from(
            "free_drop_participations"
          )
          .select(
            FREE_PARTICIPATION_SELECT
          )
          .in(
            "id",
            participacionFreeIds
          )
      );

      if (freeError) {
        console.error(
          "Error cargando participaciones Free por ID:",
          freeError
        );

        return responderJSON(
          {
            ok: false,
            error:
              "No se pudieron cargar las participaciones FREE ganadoras",
          },
          500
        );
      }

      participacionesFree =
        Array.isArray(freeData)
          ? freeData
          : [];
    }

    /* =====================================================
       10. PARTICIPACIONES FREE POR TICKET

       Respaldo para participaciones antiguas.
    ===================================================== */

    if (ticketGanadorIds.length) {
      const {
        data: freeTicketData,
        error: freeTicketError,
      } = await medir(
        "free por ticket",
        () =>
          supabaseAdmin
            .from(
              "free_drop_participations"
            )
            .select(
              FREE_PARTICIPATION_SELECT
            )
            .in(
              "ticket_id",
              ticketGanadorIds
            )
      );

      if (freeTicketError) {
        console.error(
          "Error cargando Free por ticket:",
          freeTicketError
        );

        return responderJSON(
          {
            ok: false,
            error:
              "No se pudieron cargar las participaciones FREE por ticket",
          },
          500
        );
      }

      const existentes = new Set(
        participacionesFree.map(
          (participacion) =>
            String(participacion.id)
        )
      );

      for (
        const participacion of
          freeTicketData || []
      ) {
        const id = String(
          participacion.id
        );

        if (!existentes.has(id)) {
          participacionesFree.push(
            participacion
          );

          existentes.add(id);
        }
      }
    }

    /* =====================================================
       11. MAPAS DE PARTICIPACIONES FREE
    ===================================================== */

    const participacionesPorId =
      new Map();

    const participacionesPorTicket =
      new Map();

    for (
      const participacion of
        participacionesFree
    ) {
      if (participacion?.id) {
        participacionesPorId.set(
          String(participacion.id),
          participacion
        );
      }

      if (participacion?.ticket_id) {
        participacionesPorTicket.set(
          String(
            participacion.ticket_id
          ),
          participacion
        );
      }
    }

    /* =====================================================
       12. IDS DE FREE DROPS
    ===================================================== */

    const freeDropIds = [
      ...new Set(
        [
          ...sorteosConTicket.map(
            ({ ticketGanador }) =>
              limpiarTexto(
                ticketGanador
                  ?.free_drop_id
              )
          ),

          ...participacionesFree.map(
            (participacion) =>
              limpiarTexto(
                participacion
                  ?.free_drop_id
              )
          ),
        ].filter(Boolean)
      ),
    ];

    /* =====================================================
       13. CARGAR FREE DROPS
    ===================================================== */

    let freeDrops = [];

    if (freeDropIds.length) {
      const {
        data: freeDropsData,
        error: freeDropsError,
      } = await medir(
        "free drops",
        () =>
          supabaseAdmin
            .from("free_drops")
            .select(`
              id,
              nombre,
              numero_drop,
              estado,
              rifa_id
            `)
            .in(
              "id",
              freeDropIds
            )
      );

      if (freeDropsError) {
        console.error(
          "Error cargando Free Drops:",
          freeDropsError
        );

        return responderJSON(
          {
            ok: false,
            error:
              "No se pudieron cargar los Free Drops",
          },
          500
        );
      }

      freeDrops =
        Array.isArray(freeDropsData)
          ? freeDropsData
          : [];
    }

    const freeDropsPorId = new Map(
      freeDrops.map((drop) => [
        String(drop.id),
        drop,
      ])
    );

    /* =====================================================
       14. CONSTRUIR HISTORIAL COMPLETO

       Se conserva la información administrativa.
    ===================================================== */

    const ganadores =
      sorteosConTicket.map(
        ({
          sorteo,
          ticketGanador,
        }) => {
          /* ===============================================
             CASO 1: NO SE ENCONTRÓ TICKET
          =============================================== */

          if (!ticketGanador) {
            return {
              ...sorteo,

              ticket_ganador: null,

              tipo_ticket:
                "desconocido",

              es_free: false,

              propietario: {
                nombre:
                  limpiarTexto(
                    sorteo
                      ?.nombre_ganador
                  ) || null,

                email: null,
                telefono: null,
              },

              compra_ganadora: null,
              participacion_free: null,
              free_drop_ganador: null,
            };
          }

          /* ===============================================
             DETECTAR FREE O PAGADO
          =============================================== */

          const tipoTicket =
            normalizarTexto(
              ticketGanador?.tipo
            );

          const esFree =
            tipoTicket === "free" ||
            Boolean(
              ticketGanador
                ?.free_drop_participation_id
            ) ||
            (
              Boolean(
                ticketGanador
                  ?.free_drop_id
              ) &&
              !ticketGanador?.compra_id
            );

          /* ===============================================
             CASO 2: TICKET FREE
          =============================================== */

          if (esFree) {
            const participacion =
              (
                ticketGanador
                  ?.free_drop_participation_id
                  ? participacionesPorId.get(
                      String(
                        ticketGanador
                          .free_drop_participation_id
                      )
                    )
                  : null
              ) ||
              participacionesPorTicket.get(
                String(
                  ticketGanador.id
                )
              ) ||
              null;

            const freeDropId =
              participacion
                ?.free_drop_id ||
              ticketGanador
                ?.free_drop_id ||
              null;

            const freeDrop =
              freeDropId
                ? freeDropsPorId.get(
                    String(
                      freeDropId
                    )
                  ) || null
                : null;

            const nombreFree =
              construirNombre(
                participacion?.nombre,
                participacion?.apellido
              ) ||
              limpiarTexto(
                ticketGanador
                  ?.asignado_a_nombre
              ) ||
              limpiarTexto(
                sorteo
                  ?.nombre_ganador
              ) ||
              null;

            const emailFree =
              limpiarTexto(
                participacion?.email
              ) ||
              limpiarTexto(
                ticketGanador
                  ?.asignado_a_email
              ) ||
              null;

            const telefonoFree =
              limpiarTexto(
                participacion?.telefono
              ) ||
              limpiarTexto(
                ticketGanador
                  ?.asignado_a_telefono
              ) ||
              null;

            return {
              ...sorteo,

              ticket_ganador: {
                id:
                  ticketGanador.id,

                numero_ticket:
                  ticketGanador
                    .numero_ticket,

                tipo: "free",
                es_free: true,

                estado:
                  ticketGanador.estado,

                compra_id: null,

                free_drop_id:
                  ticketGanador
                    .free_drop_id ||
                  null,

                free_drop_participation_id:
                  ticketGanador
                    .free_drop_participation_id ||
                  null,
              },

              tipo_ticket: "free",
              es_free: true,

              propietario: {
                nombre: nombreFree,
                email: emailFree,
                telefono: telefonoFree,
              },

              compra_ganadora: null,

              participacion_free:
                participacion
                  ? {
                      id:
                        participacion.id,

                      nombre:
                        participacion.nombre ||
                        null,

                      apellido:
                        participacion.apellido ||
                        null,

                      email:
                        participacion.email ||
                        null,

                      telefono:
                        participacion.telefono ||
                        null,

                      codigo:
                        participacion
                          .codigo_unico ||
                        null,

                      codigo_unico:
                        participacion
                          .codigo_unico ||
                        null,

                      estado:
                        participacion.estado ||
                        null,

                      estado_residencia:
                        participacion
                          .estado_residencia ||
                        null,

                      acepta_reglas:
                        Boolean(
                          participacion
                            .acepta_reglas
                        ),

                      cumple_requisitos:
                        Boolean(
                          participacion
                            .cumple_requisitos
                        ),

                      social_username:
                        participacion
                          .social_username ||
                        null,

                      evidence_url:
                        participacion
                          .evidence_url ||
                        null,

                      created_at:
                        participacion
                          .created_at ||
                        null,

                      updated_at:
                        participacion
                          .updated_at ||
                        null,
                    }
                  : null,

              free_drop_ganador:
                freeDrop
                  ? {
                      id:
                        freeDrop.id,

                      nombre:
                        freeDrop.nombre,

                      numero_drop:
                        freeDrop
                          .numero_drop,

                      estado:
                        freeDrop.estado,
                    }
                  : null,
            };
          }

          /* ===============================================
             CASO 3: TICKET PAGADO
          =============================================== */

          const compra =
            ticketGanador
              ?.compra_id
              ? comprasPorId.get(
                  String(
                    ticketGanador
                      .compra_id
                  )
                ) || null
              : null;

          const usuario =
            compra?.usuario_id
              ? usuariosPorId.get(
                  String(
                    compra.usuario_id
                  )
                ) || null
              : null;

          /*
             PRIORIDAD DEL PROPIETARIO:

             1. Tabla usuarios
             2. Tabla compras
             3. Datos asignados al ticket
             4. Nombre manual del sorteo
          */

          const nombrePagado =
            limpiarTexto(
              usuario?.nombre
            ) ||
            limpiarTexto(
              compra
                ?.nombre_cliente
            ) ||
            limpiarTexto(
              ticketGanador
                ?.asignado_a_nombre
            ) ||
            limpiarTexto(
              sorteo
                ?.nombre_ganador
            ) ||
            null;

          const emailPagado =
            limpiarTexto(
              usuario?.email
            ) ||
            limpiarTexto(
              compra
                ?.email_cliente
            ) ||
            limpiarTexto(
              ticketGanador
                ?.asignado_a_email
            ) ||
            null;

          const telefonoPagado =
            limpiarTexto(
              usuario?.telefono
            ) ||
            limpiarTexto(
              compra
                ?.telefono_cliente
            ) ||
            limpiarTexto(
              ticketGanador
                ?.asignado_a_telefono
            ) ||
            null;

          return {
            ...sorteo,

            ticket_ganador: {
              id:
                ticketGanador.id,

              numero_ticket:
                ticketGanador
                  .numero_ticket,

              tipo: "compra",
              es_free: false,

              estado:
                ticketGanador.estado,

              compra_id:
                ticketGanador
                  .compra_id ||
                null,

              free_drop_id: null,

              free_drop_participation_id:
                null,
            },

            tipo_ticket: "compra",
            es_free: false,

            propietario: {
              nombre:
                nombrePagado,

              email:
                emailPagado,

              telefono:
                telefonoPagado,
            },

            compra_ganadora:
              compra
                ? {
                    id:
                      compra.id,

                    usuario_id:
                      compra
                        .usuario_id ||
                      null,

                    nombre_cliente:
                      compra
                        .nombre_cliente ||
                      null,

                    email_cliente:
                      compra
                        .email_cliente ||
                      null,

                    telefono_cliente:
                      compra
                        .telefono_cliente ||
                      null,

                    cantidad_tickets:
                      compra
                        .cantidad_tickets ??
                      null,

                    monto_total:
                      compra
                        .monto_total ??
                      null,

                    referencia:
                      compra
                        .referencia ||
                      null,

                    metodo_pago:
                      compra
                        .metodo_pago ||
                      null,

                    estado_pago:
                      compra
                        .estado_pago ||
                      null,

                    fecha_compra:
                      compra
                        .fecha_compra ||
                      compra
                        .created_at ||
                      null,
                  }
                : null,

            participacion_free:
              null,

            free_drop_ganador:
              null,
          };
        }
      );

    /* =====================================================
       15. RESULTADOS DE RENDIMIENTO
    ===================================================== */

    console.log(
      `[${diagnosticoId}] HISTORIAL - consultas posteriores: ${(
        performance.now() -
        inicioConsultasPosteriores
      ).toFixed(2)}ms`
    );

    console.log(
      `[${diagnosticoId}] HISTORIAL - TOTAL: ${Math.round(
        performance.now() -
        inicioHistorial
      )}ms`
    );

    /* =====================================================
       16. RESPUESTA ADMINISTRATIVA

       No almacenar datos privados en caché.
    ===================================================== */

    if (esAdministrador) {
      return responderJSON(
        {
          ok: true,
          ganadores,
        },
        200,
        false
      );
    }

    /* =====================================================
       17. RESPUESTA PÚBLICA

       No se envían:
       - Emails
       - Teléfonos
       - Referencias de pago
       - Compras
       - Códigos Free Drop
       - Evidencias privadas
       - Notas internas
       - IDs de usuarios y compras

       Caché compartida de 60 segundos.
    ===================================================== */

    const ganadoresPublicos =
      ganadores.map(
        convertirGanadorAPublico
      );

    return responderJSON(
      {
        ok: true,
        ganadores:
          ganadoresPublicos,
      },
      200,
      true
    );
  } catch (error) {
    /* =====================================================
       ERROR INESPERADO

       Nunca almacenar errores en caché.
    ===================================================== */

    console.error(
      `[${diagnosticoId}] historial-ganadores error:`,
      error
    );

    return responderJSON(
      {
        ok: false,
        error:
          "Error interno del historial",
      },
      500,
      false
    );
  }
}
