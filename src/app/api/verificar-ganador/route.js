import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   HELPERS
========================================================= */

function esUuidValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor || "").trim()
  );
}

function normalizarNumero(valor, padLength = 4) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");

  if (!soloNumeros) {
    return null;
  }

  const numero = Number(soloNumeros);

  if (!Number.isInteger(numero)) {
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

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
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
    const body = await req.json();

    const rifaId = String(
      body.rifaId ??
        body.rifa_id ??
        ""
    ).trim();

    const padLength =
      Number.isInteger(
        Number(body.padLength)
      ) && Number(body.padLength) > 0
        ? Number(body.padLength)
        : 4;

    const numeroNormalizado =
      normalizarNumero(
        body.numero ??
          body.numero_ticket,
        padLength
      );

    /* =====================================================
       VALIDACIONES
    ===================================================== */

    if (
      !rifaId ||
      rifaId === "null" ||
      rifaId === "undefined" ||
      !esUuidValido(rifaId)
    ) {
      return NextResponse.json(
        {
          error:
            "Selecciona una rifa válida antes de buscar el ganador",
        },
        {
          status: 400,
        }
      );
    }

    if (!numeroNormalizado) {
      return NextResponse.json(
        {
          error: "Número inválido",
        },
        {
          status: 400,
        }
      );
    }

    const {
      numero,
      numeroOficial,
    } = numeroNormalizado;

    /* =====================================================
       RIFA
    ===================================================== */

    const {
      data: rifaData,
      error: rifaError,
    } = await supabaseAdmin
      .from("rifas")
      .select(`
        id,
        nombre,
        estado
      `)
      .eq("id", rifaId)
      .maybeSingle();

    if (rifaError) {
      return NextResponse.json(
        {
          error: `Error al buscar la rifa: ${rifaError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (!rifaData) {
      return NextResponse.json(
        {
          error: "La rifa no existe",
        },
        {
          status: 404,
        }
      );
    }

    /* =====================================================
       BUSCAR TICKET

       IMPORTANTE:
       No filtramos por compra_id porque el ticket también
       puede venir de FREE DROP.
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
        asignado_a_telefono,
        asignado_at
      `)
      .eq("rifa_id", rifaId)
      .eq("numero_ticket", numero)
      .maybeSingle();

    if (ticketError) {
      return NextResponse.json(
        {
          error: ticketError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       TICKET NO EXISTE
    ===================================================== */

    if (!ticketData) {
      return NextResponse.json({
        existe: false,
        ocupado: false,
        vendido: false,

        es_free: false,
        tipo: "disponible",

        numero_ticket: numero,
        numero_oficial: numeroOficial,

        compra_id: null,
        compra: null,

        usuario: null,

        free_drop: null,
        codigo_free: null,
        participacion: null,

        sorteo: null,

        esGanador: false,

        mensaje: `El número ${numeroOficial} no fue vendido ni asignado por FREE DROP`,
      });
    }

    /* =====================================================
       DETERMINAR TIPO DE TICKET
    ===================================================== */

    const estadoTicket =
      normalizarTexto(
        ticketData.estado
      );

    const tipoTicket =
      normalizarTexto(
        ticketData.tipo
      );

    const esCompra = Boolean(
      ticketData.compra_id
    );

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
      esCompra || esFreeAsignado;

    /* =====================================================
       TICKET DISPONIBLE
    ===================================================== */

    if (!ocupado) {
      return NextResponse.json({
        existe: false,
        ocupado: false,
        vendido: false,

        es_free: false,
        tipo: "disponible",

        numero_ticket: numero,
        numero_oficial: numeroOficial,

        compra_id: null,
        compra: null,

        usuario: null,

        free_drop: null,
        codigo_free: null,
        participacion: null,

        sorteo: null,

        esGanador: false,

        mensaje: `El número ${numeroOficial} no fue vendido ni asignado por FREE DROP`,
      });
    }

    /* =====================================================
       VARIABLES
    ===================================================== */

    let compraData = null;
    let usuario = null;

    let participacionFree = null;
    let freeDropData = null;

    /* =====================================================
       TICKET PAGADO
    ===================================================== */

    if (esCompra) {
      const {
        data,
        error,
      } = await supabaseAdmin
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
        .eq(
          "id",
          ticketData.compra_id
        )
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      compraData = data || null;

      /*
        Primero intentamos cargar la tabla usuarios.
        Si no existe usuario_id o faltan datos,
        utilizamos los datos guardados directamente
        en la compra.

        Como último respaldo usamos los datos que
        quedaron guardados en el ticket.
      */

      let usuarioRegistrado = null;

      if (compraData?.usuario_id) {
        const {
          data: usuarioData,
          error: usuarioError,
        } = await supabaseAdmin
          .from("usuarios")
          .select(`
            id,
            nombre,
            email,
            telefono
          `)
          .eq(
            "id",
            compraData.usuario_id
          )
          .maybeSingle();

        if (usuarioError) {
          return NextResponse.json(
            {
              error:
                usuarioError.message,
            },
            {
              status: 500,
            }
          );
        }

        usuarioRegistrado =
          usuarioData || null;
      }

      const nombre =
        limpiarTexto(
          usuarioRegistrado?.nombre
        ) ||
        limpiarTexto(
          compraData?.nombre_cliente
        ) ||
        limpiarTexto(
          ticketData?.asignado_a_nombre
        ) ||
        null;

      const email =
        limpiarTexto(
          usuarioRegistrado?.email
        ) ||
        limpiarTexto(
          compraData?.email_cliente
        ) ||
        limpiarTexto(
          ticketData?.asignado_a_email
        ) ||
        null;

      const telefono =
        limpiarTexto(
          usuarioRegistrado?.telefono
        ) ||
        limpiarTexto(
          compraData?.telefono_cliente
        ) ||
        limpiarTexto(
          ticketData?.asignado_a_telefono
        ) ||
        null;

      /*
        Siempre construimos el objeto usuario con
        la mejor información disponible.
      */

      usuario = {
        id:
          usuarioRegistrado?.id ||
          compraData?.usuario_id ||
          null,

        nombre,
        email,
        telefono,
      };
    }

    /* =====================================================
       TICKET FREE
    ===================================================== */

    if (esFreeAsignado) {
      let freeParticipationQuery =
        supabaseAdmin
          .from(
            "free_drop_participations"
          )
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

            estado_residencia,

            acepta_reglas,
            cumple_requisitos,

            social_username,
            evidence_url,

            created_at,
            updated_at
          `);

      /*
        La relación principal es
        free_drop_participation_id.

        Si un ticket antiguo no tiene ese campo,
        usamos ticket_id como respaldo.
      */

      if (
        ticketData.free_drop_participation_id
      ) {
        freeParticipationQuery =
          freeParticipationQuery.eq(
            "id",
            ticketData.free_drop_participation_id
          );
      } else {
        freeParticipationQuery =
          freeParticipationQuery.eq(
            "ticket_id",
            ticketData.id
          );
      }

      const {
        data: freeData,
        error: freeError,
      } =
        await freeParticipationQuery.maybeSingle();

      if (freeError) {
        return NextResponse.json(
          {
            error: freeError.message,
          },
          {
            status: 500,
          }
        );
      }

      participacionFree =
        freeData || null;

      const freeDropId =
        participacionFree?.free_drop_id ||
        ticketData.free_drop_id;

      /* ===================================================
         FREE DROP
      =================================================== */

      if (freeDropId) {
        const {
          data: dropData,
          error: dropError,
        } = await supabaseAdmin
          .from("free_drops")
          .select(`
            id,
            nombre,
            numero_drop,
            estado,
            rifa_id
          `)
          .eq("id", freeDropId)
          .maybeSingle();

        if (dropError) {
          return NextResponse.json(
            {
              error:
                dropError.message,
            },
            {
              status: 500,
            }
          );
        }

        freeDropData =
          dropData || null;
      }

      /*
        Construimos el usuario FREE.

        Si por alguna razón faltara un dato en
        la participación, usamos el snapshot
        guardado en el ticket como respaldo.
      */

      const nombreParticipacion = [
        limpiarTexto(
          participacionFree?.nombre
        ),
        limpiarTexto(
          participacionFree?.apellido
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      usuario = {
        id: null,

        nombre:
          nombreParticipacion ||
          limpiarTexto(
            ticketData?.asignado_a_nombre
          ) ||
          null,

        email:
          limpiarTexto(
            participacionFree?.email
          ) ||
          limpiarTexto(
            ticketData?.asignado_a_email
          ) ||
          null,

        telefono:
          limpiarTexto(
            participacionFree?.telefono
          ) ||
          limpiarTexto(
            ticketData?.asignado_a_telefono
          ) ||
          null,
      };
    }

    /* =====================================================
       RESULTADO / SORTEO
    ===================================================== */

    const {
      data: sorteosData,
      error: sorteoError,
    } = await supabaseAdmin
      .from("sorteos")
      .select(`
        id,
        numero_ganador,
        numero_oficial,
        fecha_sorteo,
        fuente,
        rifa_id
      `)
      .eq("rifa_id", rifaId)
      .order(
        "fecha_sorteo",
        {
          ascending: false,
        }
      )
      .limit(1);

    if (sorteoError) {
      return NextResponse.json(
        {
          error:
            sorteoError.message,
        },
        {
          status: 500,
        }
      );
    }

    const sorteoData =
      Array.isArray(sorteosData) &&
      sorteosData.length > 0
        ? sorteosData[0]
        : null;

    /* =====================================================
       RESPUESTA
    ===================================================== */

    const esFree =
      Boolean(esFreeAsignado);

    return NextResponse.json({
      existe: true,
      ocupado: true,

      vendido: esCompra,

      es_free: esFree,

      tipo: esFree
        ? "free"
        : "compra",

      numero_ticket:
        ticketData.numero_ticket,

      numero_oficial:
        numeroOficial,

      /* ===================================================
         COMPRA
      =================================================== */

      compra_id:
        ticketData.compra_id ??
        null,

      compra: compraData
        ? {
            id: compraData.id,

            usuario_id:
              compraData.usuario_id ||
              null,

            nombre_cliente:
              compraData.nombre_cliente ||
              null,

            email_cliente:
              compraData.email_cliente ||
              null,

            telefono_cliente:
              compraData.telefono_cliente ||
              null,

            cantidad_tickets:
              compraData.cantidad_tickets ??
              null,

            monto_total:
              compraData.monto_total ??
              null,

            referencia:
              compraData.referencia ||
              null,

            metodo_pago:
              compraData.metodo_pago ||
              null,

            estado_pago:
              compraData.estado_pago ||
              null,

            fecha_compra:
              compraData.fecha_compra ||
              compraData.created_at ||
              null,
          }
        : null,

      /* ===================================================
         USUARIO / PARTICIPANTE
      =================================================== */

      usuario,

      /* ===================================================
         FREE DROP
      =================================================== */

      free_drop: freeDropData
        ? {
            id:
              freeDropData.id,

            nombre:
              freeDropData.nombre,

            numero_drop:
              freeDropData.numero_drop,

            estado:
              freeDropData.estado,
          }
        : null,

      codigo_free:
        participacionFree?.codigo_unico ||
        null,

      participacion:
        participacionFree
          ? {
              ...participacionFree,

              free_drop:
                freeDropData?.nombre ||
                null,

              free_drop_numero:
                freeDropData?.numero_drop ??
                null,

              numero_participacion:
                ticketData.numero_ticket,

              codigo:
                participacionFree.codigo_unico,

              social_username:
                participacionFree.social_username ||
                null,
            }
          : null,

      /* ===================================================
         SORTEO
      =================================================== */

      sorteo:
        sorteoData || null,

      /*
        Aquí significa que el número consultado
        está ocupado y puede registrarse como ganador.

        La condición de "ganador oficial" se controla
        posteriormente cuando se guarda el resultado.
      */
      esGanador: ocupado,

      mensaje: esFree
        ? `🟢 El número ${numeroOficial} pertenece a una participación FREE válida`
        : `✅ El número ${numeroOficial} sí fue vendido en esta rifa`,
    });
  } catch (error) {
    console.error(
      "verificar-ganador error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error interno del servidor",
      },
      {
        status: 500,
      }
    );
  }
}