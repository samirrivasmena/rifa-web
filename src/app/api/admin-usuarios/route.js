import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   HELPERS
========================================================= */

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarEmail(valor) {
  return limpiarTexto(valor).toLowerCase();
}

function normalizarTelefono(valor) {
  return limpiarTexto(valor).replace(/\D/g, "");
}

function normalizarEstado(valor) {
  return limpiarTexto(valor).toLowerCase();
}

function esRifaFinalizada(estado) {
  return ["finalizada", "finalizado", "cerrada", "cerrado"].includes(
    normalizarEstado(estado)
  );
}

function normalizarNumeroComparacion(valor) {
  const limpio = limpiarTexto(valor);
  if (!limpio) return null;

  const numerico = Number(limpio);
  if (Number.isFinite(numerico)) return String(numerico);

  return limpio.replace(/^0+/, "") || "0";
}

function obtenerTimestamp(...fechas) {
  for (const fecha of fechas) {
    if (!fecha) continue;

    const timestamp = new Date(fecha).getTime();

    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function esCompraAprobada(estado) {
  return [
    "aprobado",
    "aprobada",
    "approved",
    "pagado",
    "pagada",
    "activo",
    "activa",
  ].includes(normalizarEstado(estado));
}

function esCompraPendiente(estado) {
  return ["pendiente", "pending"].includes(
    normalizarEstado(estado)
  );
}

function esCompraRechazada(estado) {
  return [
    "rechazado",
    "rechazada",
    "rejected",
  ].includes(normalizarEstado(estado));
}

function esFreeValido(estado) {
  return [
    "activo",
    "activa",
    "valida",
    "válida",
    "approved",
    "aprobado",
    "aprobada",
  ].includes(normalizarEstado(estado));
}

function esFreePendiente(estado) {
  return ["pendiente", "pending"].includes(
    normalizarEstado(estado)
  );
}

function esFreeRechazado(estado) {
  return [
    "rechazado",
    "rechazada",
    "rejected",
  ].includes(normalizarEstado(estado));
}

function esFreeAnulado(estado) {
  return [
    "anulado",
    "anulada",
    "cancelado",
    "cancelada",
  ].includes(normalizarEstado(estado));
}

function responderError(mensaje, status = 400) {
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
   IDENTIDAD DEL USUARIO
========================================================= */

/*
  IMPORTANTE:

  No agrupamos automáticamente por nombre.

  Prioridad:
  1. email
  2. usuario_id
  3. teléfono
  4. identificador único del registro

  De esta forma evitamos unir por accidente a dos personas
  diferentes que tengan el mismo nombre.
*/

function obtenerClaveCompra(compra = {}) {
  const email = normalizarEmail(
    compra?.email_cliente ||
      compra?.usuarios?.email ||
      ""
  );

  if (email) {
    return `email:${email}`;
  }

  if (compra?.usuario_id) {
    return `usuario:${String(compra.usuario_id)}`;
  }

  const telefono = normalizarTelefono(
    compra?.telefono_cliente ||
      compra?.usuarios?.telefono ||
      ""
  );

  if (telefono) {
    return `telefono:${telefono}`;
  }

  return `compra:${String(compra?.id || "")}`;
}

function obtenerClaveFree(participacion = {}) {
  const email = normalizarEmail(
    participacion?.email_normalized ||
      participacion?.email ||
      ""
  );

  if (email) {
    return `email:${email}`;
  }

  const telefono = normalizarTelefono(
    participacion?.telefono_normalized ||
      participacion?.telefono ||
      ""
  );

  if (telefono) {
    return `telefono:${telefono}`;
  }

  return `free:${String(participacion?.id || "")}`;
}

/* =========================================================
   USUARIO VACÍO
========================================================= */

function crearUsuarioBase({
  clave,
  nombre = "",
  email = "",
  telefono = "",
  usuarioId = null,
  fechaTimestamp = 0,
}) {
  return {
    id: clave,
    clave,

    usuario_id: usuarioId || null,

    nombre: limpiarTexto(nombre) || "Sin nombre",
    email: normalizarEmail(email),
    telefono: limpiarTexto(telefono),

    ultimaFechaDatos: fechaTimestamp,

    tiene_compras: false,
    tiene_free: false,

    compras: [],
    participaciones_free: [],

    tickets_pagados: [],
    tickets_free: [],

    resumen: {
      compras_total: 0,
      compras_aprobadas: 0,
      compras_pendientes: 0,
      compras_rechazadas: 0,

      monto_aprobado: 0,

      tickets_pagados: 0,

      free_total: 0,
      free_validos: 0,
      free_pendientes: 0,
      free_rechazados: 0,
      free_anulados: 0,

      tickets_free: 0,

      tickets_total: 0,
    },

    ultima_actividad: null,
  };
}

/* =========================================================
   ACTUALIZAR DATOS PERSONALES
========================================================= */

function actualizarDatosUsuario(
  usuario,
  {
    nombre = "",
    email = "",
    telefono = "",
    usuarioId = null,
    fechaTimestamp = 0,
  }
) {
  if (!usuario) return;

  const nombreLimpio = limpiarTexto(nombre);
  const emailLimpio = normalizarEmail(email);
  const telefonoLimpio = limpiarTexto(telefono);

  if (
    fechaTimestamp >=
    Number(usuario.ultimaFechaDatos || 0)
  ) {
    if (nombreLimpio) {
      usuario.nombre = nombreLimpio;
    }

    if (emailLimpio) {
      usuario.email = emailLimpio;
    }

    if (telefonoLimpio) {
      usuario.telefono = telefonoLimpio;
    }

    if (usuarioId) {
      usuario.usuario_id = usuarioId;
    }

    usuario.ultimaFechaDatos = fechaTimestamp;
  } else {
    if (
      (!usuario.nombre ||
        usuario.nombre === "Sin nombre") &&
      nombreLimpio
    ) {
      usuario.nombre = nombreLimpio;
    }

    if (!usuario.email && emailLimpio) {
      usuario.email = emailLimpio;
    }

    if (!usuario.telefono && telefonoLimpio) {
      usuario.telefono = telefonoLimpio;
    }

    if (!usuario.usuario_id && usuarioId) {
      usuario.usuario_id = usuarioId;
    }
  }
}

/* =========================================================
   CARGAR TODOS LOS TICKETS DE LA RIFA
========================================================= */

async function traerTodosLosTickets(rifaId) {
  const pageSize = 1000;

  let from = 0;
  let allTickets = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        rifa_id,
        numero_ticket,
        compra_id,
        estado,
        tipo,
        free_drop_id,
        free_drop_participation_id,
        asignado_at,
        fecha_asignacion,
        asignado_a_nombre,
        asignado_a_email,
        asignado_a_telefono
      `)
      .eq("rifa_id", rifaId)
      .neq("estado", "disponible")
      .order("numero_ticket", {
        ascending: true,
      })
      .range(
        from,
        from + pageSize - 1
      );

    if (error) {
      throw error;
    }

    allTickets = [
      ...allTickets,
      ...(data || []),
    ];

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allTickets;
}

/* =========================================================
   GET
========================================================= */

export async function GET(req) {
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
    const { searchParams } = new URL(req.url);

    const rifaId = limpiarTexto(
      searchParams.get("rifaId")
    );

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    /* =====================================================
       CARGAR DATOS
    ===================================================== */

    const [
      comprasResult,
      freeResult,
      tickets,
      rifaResult,
      sorteoResult,
    ] = await Promise.all([
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
          comprobante_url,
          fecha_compra,
          created_at,
          usuarios (
            id,
            nombre,
            email,
            telefono
          )
        `)
        .eq("rifa_id", rifaId)
        .order("fecha_compra", {
          ascending: false,
        }),

      supabaseAdmin
        .from("free_drop_participations")
        .select(`
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
          email_normalized,
          telefono_normalized,
          social_username,
          estado_residencia,
          risk_score,
          risk_reasons,
          requires_manual_review,
          review_source,
          reviewed_at,
          reviewed_by,
          created_at,
          updated_at
        `)
        .eq("rifa_id", rifaId)
        .order("created_at", {
          ascending: false,
        }),

      traerTodosLosTickets(rifaId),

      supabaseAdmin
        .from("rifas")
        .select(`
          id,
          nombre,
          estado,
          formato
        `)
        .eq("id", rifaId)
        .maybeSingle(),

      supabaseAdmin
        .from("sorteos")
        .select(`
          id,
          rifa_id,
          numero_ganador,
          numero_oficial,
          fecha_sorteo
        `)
        .eq("rifa_id", rifaId)
        .order("fecha_sorteo", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle(),
    ]);

    if (comprasResult.error) {
      console.error(
        "Error cargando compras para usuarios:",
        comprasResult.error
      );

      return responderError(
        comprasResult.error.message ||
          "No se pudieron cargar las compras",
        500
      );
    }

    if (freeResult.error) {
      console.error(
        "Error cargando FREE para usuarios:",
        freeResult.error
      );

      return responderError(
        freeResult.error.message ||
          "No se pudieron cargar las participaciones FREE",
        500
      );
    }

    const compras = Array.isArray(
      comprasResult.data
    )
      ? comprasResult.data
      : [];

    const participacionesFree = Array.isArray(
      freeResult.data
    )
      ? freeResult.data
      : [];

    const ticketsBase = Array.isArray(tickets)
      ? tickets
      : [];

    if (rifaResult.error) {
      console.error(
        "Error cargando rifa para usuarios:",
        rifaResult.error
      );

      return responderError(
        rifaResult.error.message ||
          "No se pudo cargar la rifa",
        500
      );
    }

    if (sorteoResult.error) {
      console.error(
        "Error cargando resultado para usuarios:",
        sorteoResult.error
      );

      return responderError(
        sorteoResult.error.message ||
          "No se pudo cargar el resultado oficial",
        500
      );
    }

    const rifa = rifaResult.data || null;
    const sorteo = sorteoResult.data || null;

    /*
      IMPORTANTE:

      Igual que en Mis Tickets, solamente consideramos
      que existe un ganador oficial cuando la rifa
      está finalizada/cerrada y existe un resultado
      en la tabla sorteos.
    */

    const numeroGanadorOficial =
      esRifaFinalizada(rifa?.estado) && sorteo
        ? normalizarNumeroComparacion(
            sorteo?.numero_oficial ??
              sorteo?.numero_ganador
          )
        : null;

    /*
      Marcamos cada ticket de la rifa.

      Esto funciona tanto para tickets pagados
      como para tickets FREE.
    */

    const ticketsConGanador =
      ticketsBase.map((ticket) => ({
        ...ticket,

        es_ganador:
          Boolean(numeroGanadorOficial) &&
          normalizarNumeroComparacion(
            ticket?.numero_ticket
          ) === numeroGanadorOficial,
      }));

    /* =====================================================
       MAPAS DE TICKETS
    ===================================================== */

    const ticketsPorCompra = new Map();

    const ticketsPorFreeParticipation =
      new Map();

    ticketsConGanador.forEach((ticket) => {
      if (ticket?.compra_id) {
        const key = String(
          ticket.compra_id
        );

        if (!ticketsPorCompra.has(key)) {
          ticketsPorCompra.set(key, []);
        }

        ticketsPorCompra
          .get(key)
          .push(ticket);
      }

      if (
        ticket?.free_drop_participation_id
      ) {
        const key = String(
          ticket.free_drop_participation_id
        );

        if (
          !ticketsPorFreeParticipation.has(
            key
          )
        ) {
          ticketsPorFreeParticipation.set(
            key,
            []
          );
        }

        ticketsPorFreeParticipation
          .get(key)
          .push(ticket);
      }
    });

    /* =====================================================
       MAPA GENERAL DE USUARIOS
    ===================================================== */

    const usuariosMap = new Map();

    /* =====================================================
       PROCESAR COMPRAS
    ===================================================== */

    compras.forEach((compra) => {
      const clave =
        obtenerClaveCompra(compra);

      const nombre = limpiarTexto(
        compra?.nombre_cliente ||
          compra?.usuarios?.nombre ||
          ""
      );

      const email = normalizarEmail(
        compra?.email_cliente ||
          compra?.usuarios?.email ||
          ""
      );

      const telefono = limpiarTexto(
        compra?.telefono_cliente ||
          compra?.usuarios?.telefono ||
          ""
      );

      const fechaTimestamp =
        obtenerTimestamp(
          compra?.fecha_compra,
          compra?.created_at
        );

      if (!usuariosMap.has(clave)) {
        usuariosMap.set(
          clave,
          crearUsuarioBase({
            clave,
            nombre,
            email,
            telefono,
            usuarioId:
              compra?.usuario_id || null,
            fechaTimestamp,
          })
        );
      }

      const usuario =
        usuariosMap.get(clave);

      actualizarDatosUsuario(usuario, {
        nombre,
        email,
        telefono,
        usuarioId:
          compra?.usuario_id || null,
        fechaTimestamp,
      });

      usuario.tiene_compras = true;

      const ticketsCompra =
        ticketsPorCompra.get(
          String(compra.id)
        ) || [];

      const compraNormalizada = {
        ...compra,

        total:
          compra?.monto_total ?? 0,

        tickets: ticketsCompra,
      };

      usuario.compras.push(
        compraNormalizada
      );

      usuario.resumen.compras_total += 1;

      if (
        esCompraAprobada(
          compra?.estado_pago
        )
      ) {
        usuario.resumen.compras_aprobadas +=
          1;

        usuario.resumen.monto_aprobado +=
          Number(
            compra?.monto_total ?? 0
          );

        /*
          Solo consideramos como tickets pagados
          los tickets pertenecientes a compras
          aprobadas.
        */

        ticketsCompra.forEach(
          (ticket) => {
            usuario.tickets_pagados.push(
              ticket
            );
          }
        );
      } else if (
        esCompraPendiente(
          compra?.estado_pago
        )
      ) {
        usuario.resumen.compras_pendientes +=
          1;
      } else if (
        esCompraRechazada(
          compra?.estado_pago
        )
      ) {
        usuario.resumen.compras_rechazadas +=
          1;
      }

      const fechaActividad =
        compra?.fecha_compra ||
        compra?.created_at ||
        null;

      const timestampActividad =
        obtenerTimestamp(
          fechaActividad
        );

      const timestampActual =
        obtenerTimestamp(
          usuario?.ultima_actividad?.fecha
        );

      if (
        timestampActividad >=
        timestampActual
      ) {
        usuario.ultima_actividad = {
          tipo: "compra",
          fecha: fechaActividad,
          estado:
            compra?.estado_pago || "",
          compra_id: compra?.id,
        };
      }
    });

    /* =====================================================
       PROCESAR FREE DROPS
    ===================================================== */

    participacionesFree.forEach(
      (participacion) => {
        const clave =
          obtenerClaveFree(
            participacion
          );

        const nombreCompleto = [
          limpiarTexto(
            participacion?.nombre
          ),
          limpiarTexto(
            participacion?.apellido
          ),
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        const email =
          normalizarEmail(
            participacion?.email_normalized ||
              participacion?.email ||
              ""
          );

        const telefono =
          limpiarTexto(
            participacion?.telefono ||
              ""
          );

        const fechaTimestamp =
          obtenerTimestamp(
            participacion?.updated_at,
            participacion?.created_at
          );

        /*
          Si FREE tiene email y ya existe un usuario
          de compras con ese mismo email, ambas
          actividades terminan bajo la misma clave.
        */

        if (!usuariosMap.has(clave)) {
          usuariosMap.set(
            clave,
            crearUsuarioBase({
              clave,
              nombre: nombreCompleto,
              email,
              telefono,
              usuarioId: null,
              fechaTimestamp,
            })
          );
        }

        const usuario =
          usuariosMap.get(clave);

        actualizarDatosUsuario(
          usuario,
          {
            nombre: nombreCompleto,
            email,
            telefono,
            usuarioId: null,
            fechaTimestamp,
          }
        );

        usuario.tiene_free = true;

        const ticketsFree =
          ticketsPorFreeParticipation.get(
            String(participacion.id)
          ) || [];

        const participacionNormalizada =
          {
            ...participacion,
            tickets: ticketsFree,
          };

        usuario.participaciones_free.push(
          participacionNormalizada
        );

        usuario.resumen.free_total += 1;

        if (
          esFreeValido(
            participacion?.estado
          )
        ) {
          usuario.resumen.free_validos +=
            1;

          /*
            Solo agregamos a tickets_free
            los tickets pertenecientes a una
            participación FREE válida.
          */

          ticketsFree.forEach(
            (ticket) => {
              usuario.tickets_free.push(
                ticket
              );
            }
          );
        } else if (
          esFreePendiente(
            participacion?.estado
          )
        ) {
          usuario.resumen.free_pendientes +=
            1;
        } else if (
          esFreeRechazado(
            participacion?.estado
          )
        ) {
          usuario.resumen.free_rechazados +=
            1;
        } else if (
          esFreeAnulado(
            participacion?.estado
          )
        ) {
          usuario.resumen.free_anulados +=
            1;
        }

        const fechaActividad =
          participacion?.updated_at ||
          participacion?.created_at ||
          null;

        const timestampActividad =
          obtenerTimestamp(
            fechaActividad
          );

        const timestampActual =
          obtenerTimestamp(
            usuario?.ultima_actividad?.fecha
          );

        if (
          timestampActividad >=
          timestampActual
        ) {
          usuario.ultima_actividad = {
            tipo: "free",
            fecha: fechaActividad,
            estado:
              participacion?.estado ||
              "",
            participation_id:
              participacion?.id,
          };
        }
      }
    );

    /* =====================================================
       FINALIZAR USUARIOS
    ===================================================== */

    const usuarios = Array.from(
      usuariosMap.values()
    )
      .map((usuario) => {
        const ticketsPagadosUnicos =
          Array.from(
            new Map(
              usuario.tickets_pagados.map(
                (ticket) => [
                  String(ticket.id),
                  ticket,
                ]
              )
            ).values()
          );

        const ticketsFreeUnicos =
          Array.from(
            new Map(
              usuario.tickets_free.map(
                (ticket) => [
                  String(ticket.id),
                  ticket,
                ]
              )
            ).values()
          );

        ticketsPagadosUnicos.sort(
          (a, b) =>
            Number(a.numero_ticket ?? 0) -
            Number(b.numero_ticket ?? 0)
        );

        ticketsFreeUnicos.sort(
          (a, b) =>
            Number(a.numero_ticket ?? 0) -
            Number(b.numero_ticket ?? 0)
        );

        usuario.tickets_pagados =
          ticketsPagadosUnicos;

        usuario.tickets_free =
          ticketsFreeUnicos;

        usuario.resumen.tickets_pagados =
          ticketsPagadosUnicos.length;

        usuario.resumen.tickets_free =
          ticketsFreeUnicos.length;

        usuario.resumen.tickets_total =
          ticketsPagadosUnicos.length +
          ticketsFreeUnicos.length;

        usuario.compras.sort(
          (a, b) =>
            obtenerTimestamp(
              b?.fecha_compra,
              b?.created_at
            ) -
            obtenerTimestamp(
              a?.fecha_compra,
              a?.created_at
            )
        );

        usuario.participaciones_free.sort(
          (a, b) =>
            obtenerTimestamp(
              b?.updated_at,
              b?.created_at
            ) -
            obtenerTimestamp(
              a?.updated_at,
              a?.created_at
            )
        );

        const {
          ultimaFechaDatos,
          ...usuarioFinal
        } = usuario;

        return usuarioFinal;
      })
      .sort(
        (a, b) =>
          obtenerTimestamp(
            b?.ultima_actividad?.fecha
          ) -
          obtenerTimestamp(
            a?.ultima_actividad?.fecha
          )
      );

    /* =====================================================
       RESUMEN GENERAL
    ===================================================== */

    const resumen = usuarios.reduce(
      (acc, usuario) => {
        acc.usuarios_total += 1;

        if (
          usuario.tiene_compras &&
          usuario.tiene_free
        ) {
          acc.con_ambos += 1;
        } else if (
          usuario.tiene_compras
        ) {
          acc.solo_compras += 1;
        } else if (usuario.tiene_free) {
          acc.solo_free += 1;
        }

        if (usuario.tiene_compras) {
          acc.con_compras += 1;
        }

        if (usuario.tiene_free) {
          acc.con_free += 1;
        }

        acc.compras_total +=
          usuario.resumen.compras_total;

        acc.compras_aprobadas +=
          usuario.resumen.compras_aprobadas;

        acc.monto_aprobado +=
          usuario.resumen.monto_aprobado;

        acc.free_total +=
          usuario.resumen.free_total;

        acc.free_validos +=
          usuario.resumen.free_validos;

        acc.tickets_pagados +=
          usuario.resumen.tickets_pagados;

        acc.tickets_free +=
          usuario.resumen.tickets_free;

        acc.tickets_total +=
          usuario.resumen.tickets_total;

        return acc;
      },
      {
        usuarios_total: 0,

        con_compras: 0,
        con_free: 0,
        con_ambos: 0,

        solo_compras: 0,
        solo_free: 0,

        compras_total: 0,
        compras_aprobadas: 0,

        monto_aprobado: 0,

        free_total: 0,
        free_validos: 0,

        tickets_pagados: 0,
        tickets_free: 0,
        tickets_total: 0,
      }
    );

    /* =====================================================
       RESPUESTA
    ===================================================== */

    return NextResponse.json(
      {
        ok: true,
        rifaId,

        resultado: {
          hay_ganador_oficial:
            Boolean(numeroGanadorOficial),

          numero_ganador:
            numeroGanadorOficial,
        },

        usuarios,
        resumen,
      },
      {
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
      "admin-usuarios error:",
      error
    );

    return responderError(
      error?.message ||
        "Error interno del servidor",
      500
    );
  }
}