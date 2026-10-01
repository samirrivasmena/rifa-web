import { NextResponse } from "next/server";

import crypto from "crypto";



import { supabaseAdmin } from "../../../lib/supabaseAdmin";



export const dynamic = "force-dynamic";

export const revalidate = 0;

export const runtime = "nodejs";



/* =========================================================

   HELPERS

========================================================= */



function limpiarEmail(valor) {

  return String(valor || "")

    .trim()

    .toLowerCase();

}



function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
}



function esCompraAprobada(estado) {

  const e = String(estado || "")

    .trim()

    .toLowerCase();



  return [

    "aprobado",

    "aprobada",

    "approved",

    "pagado",

    "pagada",

    "paid",

    "activo",

    "activa",

  ].includes(e);

}



function obtenerDigitosFormato(formato) {

  const valor = String(formato || "")

    .trim()

    .toLowerCase();



  if (

    valor.includes("3") ||

    valor === "000"

  ) {

    return 3;

  }



  return 4;

}



function formatearNumero(numero, formato = null) {

  if (

    numero === null ||

    numero === undefined ||

    numero === ""

  ) {

    return null;

  }



  const digitos =

    obtenerDigitosFormato(formato);



  return String(numero).padStart(

    digitos,

    "0"

  );

}



/* =========================================================

   GANADOR HELPERS

========================================================= */



function esRifaFinalizada(estado) {

  const valor = String(estado || "")

    .trim()

    .toLowerCase();



  return [

    "finalizada",

    "finalizado",

    "cerrada",

    "cerrado",

  ].includes(valor);

}



function obtenerNumeroGanadorOficial(

  rifa,

  sorteo

) {

  if (

    !esRifaFinalizada(rifa?.estado) ||

    !sorteo

  ) {

    return null;

  }



  const numeroGanador =

    sorteo?.numero_oficial ??

    sorteo?.numero_ganador;



  if (

    numeroGanador === null ||

    numeroGanador === undefined ||

    numeroGanador === ""

  ) {

    return null;

  }



  return formatearNumero(

    numeroGanador,

    rifa?.formato

  );

}



function esTicketGanador(

  numeroTicket,

  rifa,

  sorteo

) {

  const numeroGanador =

    obtenerNumeroGanadorOficial(

      rifa,

      sorteo

    );



  if (

    !numeroGanador ||

    numeroTicket === null ||

    numeroTicket === undefined ||

    numeroTicket === ""

  ) {

    return false;

  }



  const numeroTicketOficial =

    formatearNumero(

      numeroTicket,

      rifa?.formato

    );



  return (

    numeroTicketOficial ===

    numeroGanador

  );

}



/* =========================================================

   OTP HELPERS

========================================================= */



function crearHashCodigo(email, codigo) {

  const secret =

    process.env.MIS_TICKETS_OTP_SECRET;



  if (!secret) {

    throw new Error(

      "Falta MIS_TICKETS_OTP_SECRET"

    );

  }



  return crypto

    .createHmac("sha256", secret)

    .update(`${email}:${codigo}`)

    .digest("hex");

}



function hashesIguales(hashA, hashB) {

  try {

    const a = Buffer.from(

      String(hashA || ""),

      "hex"

    );



    const b = Buffer.from(

      String(hashB || ""),

      "hex"

    );



    if (

      a.length === 0 ||

      b.length === 0 ||

      a.length !== b.length

    ) {

      return false;

    }



    return crypto.timingSafeEqual(a, b);

  } catch {

    return false;

  }

}



/* =========================================================

   POST /api/mis-tickets

========================================================= */



export async function POST(req) {

  try {

    const body = await req.json();



    const email = limpiarEmail(

      body?.email

    );



    const codigo = String(

      body?.codigo || ""

    )

      .trim()

      .replace(/\D/g, "");



    /* =====================================================

       VALIDAR EMAIL

    ===================================================== */



    if (!email) {

      return NextResponse.json(

        {

          ok: false,

          error: "Email requerido",

        },

        {

          status: 400,

        }

      );

    }



    if (!esEmailValido(email)) {

      return NextResponse.json(

        {

          ok: false,

          error:

            "Ingresa un correo electrónico válido",

        },

        {

          status: 400,

        }

      );

    }



    /* =====================================================

       VALIDAR CÓDIGO

    ===================================================== */



    if (!/^\d{6}$/.test(codigo)) {

      return NextResponse.json(

        {

          ok: false,

          error:

            "Ingresa el código de 6 dígitos enviado a tu correo",

        },

        {

          status: 400,

        }

      );

    }



    if (

      !process.env.MIS_TICKETS_OTP_SECRET

    ) {

      console.error(

        "Falta MIS_TICKETS_OTP_SECRET"

      );



      return NextResponse.json(

        {

          ok: false,

          error:

            "El sistema de verificación no está configurado",

        },

        {

          status: 500,

        }

      );

    }



    /* =====================================================

       BUSCAR OTP ACTIVO

    ===================================================== */



    const {

      data: otp,

      error: otpError,

    } = await supabaseAdmin

      .from("mis_tickets_otps")

      .select(

        `

        id,

        email,

        codigo_hash,

        expires_at,

        intentos,

        usado,

        created_at

        `

      )

      .eq("email", email)

      .eq("usado", false)

      .gt(

        "expires_at",

        new Date().toISOString()

      )

      .order("created_at", {

        ascending: false,

      })

      .limit(1)

      .maybeSingle();



    if (otpError) {

      console.error(

        "Error consultando OTP:",

        otpError

      );



      return NextResponse.json(

        {

          ok: false,

          error:

            "No se pudo verificar el código",

        },

        {

          status: 500,

        }

      );

    }



    if (!otp) {

      return NextResponse.json(

        {

          ok: false,

          error:

            "Código inválido o vencido. Solicita uno nuevo.",

        },

        {

          status: 401,

        }

      );

    }



    /* =====================================================

       CONTROL DE INTENTOS

    ===================================================== */



    const intentosActuales =

      Number(otp?.intentos || 0);



    if (intentosActuales >= 5) {

      await supabaseAdmin

        .from("mis_tickets_otps")

        .update({

          usado: true,

        })

        .eq("id", otp.id);



      return NextResponse.json(

        {

          ok: false,

          error:

            "Este código alcanzó el máximo de intentos. Solicita uno nuevo.",

        },

        {

          status: 401,

        }

      );

    }



    /* =====================================================

       COMPARAR CÓDIGO

    ===================================================== */



    const codigoHash =

      crearHashCodigo(

        email,

        codigo

      );



    const codigoCorrecto =

      hashesIguales(

        codigoHash,

        otp.codigo_hash

      );



    if (!codigoCorrecto) {

      const nuevosIntentos =

        intentosActuales + 1;



      const agotado =

        nuevosIntentos >= 5;



      const {

        error: actualizarIntentosError,

      } = await supabaseAdmin

        .from("mis_tickets_otps")

        .update({

          intentos:

            nuevosIntentos,

          usado:

            agotado,

        })

        .eq("id", otp.id);



      if (actualizarIntentosError) {

        console.error(

          "Error actualizando intentos OTP:",

          actualizarIntentosError

        );

      }



      const restantes =

        Math.max(

          0,

          5 - nuevosIntentos

        );



      return NextResponse.json(

        {

          ok: false,



          error: agotado

            ? "Código inválido. Alcanzaste el máximo de intentos. Solicita uno nuevo."

            : `Código incorrecto. Te quedan ${restantes} intento${

                restantes === 1

                  ? ""

                  : "s"

              }.`,



          intentosRestantes:

            restantes,

        },

        {

          status: 401,

        }

      );

    }



    /* =====================================================

       CONSUMIR OTP



       Desde este momento el código no puede volver

       a utilizarse.

    ===================================================== */



    const {

      data: otpConsumido,

      error: consumirOtpError,

    } = await supabaseAdmin

      .from("mis_tickets_otps")

      .update({

        usado: true,

        intentos:

          intentosActuales + 1,

      })

      .eq("id", otp.id)

      .eq("usado", false)

      .select("id")

      .maybeSingle();



    if (

      consumirOtpError ||

      !otpConsumido

    ) {

      console.error(

        "Error consumiendo OTP:",

        consumirOtpError

      );



      return NextResponse.json(

        {

          ok: false,

          error:

            "No se pudo completar la verificación. Solicita un código nuevo.",

        },

        {

          status: 409,

        }

      );

    }



    /* =====================================================

       1. BUSCAR USUARIO

    ===================================================== */



    const {

      data: usuario,

      error: usuarioError,

    } = await supabaseAdmin

      .from("usuarios")

      .select(

        `

        id,

        nombre,

        email,

        telefono

        `

      )

      .ilike("email", email)

      .limit(1)

      .maybeSingle();



    if (usuarioError) {

      console.error(

        "Error buscando usuario:",

        usuarioError

      );



      return NextResponse.json(

        {

          ok: false,

          error:

            "No se pudo consultar el usuario",

        },

        {

          status: 500,

        }

      );

    }



    /* =====================================================

       2. BUSCAR COMPRAS

    ===================================================== */



    let compras = [];

    let comprasValidas = [];

    let ticketsPagados = [];



    if (usuario?.id) {

      const {

        data: comprasData,

        error: comprasError,

      } = await supabaseAdmin

        .from("compras")

        .select(

          `

          id,

          usuario_id,

          cantidad_tickets,

          monto_total,

          referencia,

          estado_pago,

          fecha_compra,

          metodo_pago,

          rifa_id,

          created_at,

          captura_inmediata

          `

        )

        .eq(

          "usuario_id",

          usuario.id

        )

        .order(

          "fecha_compra",

          {

            ascending: false,

          }

        );



      if (comprasError) {

        console.error(

          "Error buscando compras:",

          comprasError

        );



        return NextResponse.json(

          {

            ok: false,

            error:

              "No se pudieron consultar las compras",

          },

          {

            status: 500,

          }

        );

      }



      compras =

        comprasData || [];



      comprasValidas =

        compras.filter((compra) =>

          esCompraAprobada(

            compra?.estado_pago

          )

        );



      /* ===================================================

         3. BUSCAR TICKETS PAGADOS

      =================================================== */



      const compraIds =

        comprasValidas

          .map(

            (compra) =>

              compra?.id

          )

          .filter(Boolean);



      if (compraIds.length > 0) {

        const {

          data: ticketsData,

          error: ticketsError,

        } = await supabaseAdmin

          .from("tickets")

          .select(

            `

            id,

            numero_ticket,

            compra_id,

            fecha_asignacion,

            rifa_id,

            usuario_id,

            tipo,

            estado,

            created_at

            `

          )

          .in(

            "compra_id",

            compraIds

          )

          .order(

            "numero_ticket",

            {

              ascending: true,

            }

          );



        if (ticketsError) {

          console.error(

            "Error buscando tickets pagados:",

            ticketsError

          );



          return NextResponse.json(

            {

              ok: false,

              error:

                "No se pudieron consultar los tickets comprados",

            },

            {

              status: 500,

            }

          );

        }



        ticketsPagados =

          ticketsData || [];

      }

    }



    /* =====================================================

       4. BUSCAR PARTICIPACIONES FREE



       No hacemos embed de tickets porque existen

       varias relaciones entre free_drop_participations

       y tickets.

    ===================================================== */



    let participacionesFree = [];



    const {

      data: freeNormalizado,

      error: freeNormalizadoError,

    } = await supabaseAdmin

      .from(

        "free_drop_participations"

      )

      .select(

        `

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

        created_at,

        email_normalized

        `

      )

      .eq(

        "email_normalized",

        email

      )

      .order(

        "created_at",

        {

          ascending: false,

        }

      );



    if (freeNormalizadoError) {

      console.error(

        "Error buscando FREE por email_normalized:",

        freeNormalizadoError

      );



      return NextResponse.json(

        {

          ok: false,

          error:

            "No se pudieron consultar las participaciones FREE",

        },

        {

          status: 500,

        }

      );

    }



    participacionesFree =

      freeNormalizado || [];



    /* =====================================================

       COMPATIBILIDAD CON PARTICIPACIONES ANTIGUAS



       Si una participación vieja no tiene

       email_normalized, también buscamos por email.

    ===================================================== */



    const {

      data: freePorEmail,

      error: freeEmailError,

    } = await supabaseAdmin

      .from(

        "free_drop_participations"

      )

      .select(

        `

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

        created_at,

        email_normalized

        `

      )

      .ilike(

        "email",

        email

      )

      .order(

        "created_at",

        {

          ascending: false,

        }

      );



    if (freeEmailError) {

      console.error(

        "Error buscando FREE por email:",

        freeEmailError

      );



      return NextResponse.json(

        {

          ok: false,

          error:

            "No se pudieron consultar las participaciones FREE",

        },

        {

          status: 500,

        }

      );

    }



    /* =====================================================

       ELIMINAR DUPLICADOS FREE

    ===================================================== */



    const freeMap =

      new Map();



    [

      ...(participacionesFree || []),

      ...(freePorEmail || []),

    ].forEach(

      (participacion) => {

        if (!participacion?.id) {

          return;

        }



        freeMap.set(

          String(

            participacion.id

          ),

          participacion

        );

      }

    );



    participacionesFree =

      Array.from(

        freeMap.values()

      );



    /* =====================================================

       5. BUSCAR TICKETS FREE POR ticket_id

    ===================================================== */



    const ticketIdsFree = [

      ...new Set(

        participacionesFree

          .map(

            (participacion) =>

              participacion?.ticket_id

          )

          .filter(Boolean)

      ),

    ];



    let ticketsFreeDB = [];



    if (ticketIdsFree.length > 0) {

      const {

        data: ticketsFreeData,

        error: ticketsFreeError,

      } = await supabaseAdmin

        .from("tickets")

        .select(

          `

          id,

          numero_ticket,

          compra_id,

          fecha_asignacion,

          rifa_id,

          usuario_id,

          tipo,

          estado,

          free_drop_id,

          free_drop_participation_id,

          asignado_a_nombre,

          asignado_a_email,

          asignado_a_telefono,

          asignado_at,

          created_at

          `

        )

        .in(

          "id",

          ticketIdsFree

        );



      if (ticketsFreeError) {

        console.error(

          "Error buscando tickets FREE:",

          ticketsFreeError

        );



        return NextResponse.json(

          {

            ok: false,

            error:

              "No se pudieron consultar los números FREE",

          },

          {

            status: 500,

          }

        );

      }



      ticketsFreeDB =

        ticketsFreeData || [];

    }



    const ticketsFreePorId =

      new Map(

        ticketsFreeDB.map(

          (ticket) => [

            String(ticket.id),

            ticket,

          ]

        )

      );



    /* =====================================================

       6. BUSCAR FREE DROPS

    ===================================================== */



    const freeDropIds = [

      ...new Set(

        participacionesFree

          .map(

            (participacion) =>

              participacion?.free_drop_id

          )

          .filter(

            (id) =>

              id !== null &&

              id !== undefined

          )

      ),

    ];



    let freeDrops = [];



    if (freeDropIds.length > 0) {

      const {

        data: freeDropsData,

        error: freeDropsError,

      } = await supabaseAdmin

        .from("free_drops")

        .select(

          `

          id,

          nombre,

          numero_drop,

          estado,

          rifa_id

          `

        )

        .in(

          "id",

          freeDropIds

        );



      if (freeDropsError) {

        console.error(

          "Error buscando FREE Drops:",

          freeDropsError

        );



        return NextResponse.json(

          {

            ok: false,

            error:

              "No se pudo consultar la información de los FREE Drops",

          },

          {

            status: 500,

          }

        );

      }



      freeDrops =

        freeDropsData || [];

    }



    const freeDropsPorId =

      new Map(

        freeDrops.map(

          (drop) => [

            String(drop.id),

            drop,

          ]

        )

      );



    /* =====================================================

       7. REUNIR TODOS LOS IDs DE RIFAS

    ===================================================== */



    const rifaIds = [

      ...new Set(

        [

          ...compras.map(

            (compra) =>

              compra?.rifa_id

          ),



          ...ticketsPagados.map(

            (ticket) =>

              ticket?.rifa_id

          ),



          ...participacionesFree.map(

            (participacion) =>

              participacion?.rifa_id

          ),



          ...ticketsFreeDB.map(

            (ticket) =>

              ticket?.rifa_id

          ),

        ].filter(Boolean)

      ),

    ];



    /* =====================================================

       8. BUSCAR INFORMACIÓN DE LAS RIFAS

    ===================================================== */



    let rifas = [];



    if (rifaIds.length > 0) {

      const {

        data: rifasData,

        error: rifasError,

      } = await supabaseAdmin

        .from("rifas")

        .select(

          `

          id,

          nombre,

          estado,

          formato,

          fecha_sorteo

          `

        )

        .in(

          "id",

          rifaIds

        );



      if (rifasError) {

        console.error(

          "Error buscando rifas:",

          rifasError

        );



        return NextResponse.json(

          {

            ok: false,

            error:

              "No se pudieron consultar los eventos",

          },

          {

            status: 500,

          }

        );

      }



      rifas =

        rifasData || [];

    }



    const rifasPorId =

      new Map(

        rifas.map(

          (rifa) => [

            String(rifa.id),

            rifa,

          ]

        )

      );



    /* =====================================================

       8.1 BUSCAR RESULTADOS OFICIALES

    ===================================================== */



    let sorteos = [];



    if (rifaIds.length > 0) {

      const {

        data: sorteosData,

        error: sorteosError,

      } = await supabaseAdmin

        .from("sorteos")

        .select(

          `

          id,

          rifa_id,

          numero_ganador,

          numero_oficial,

          fecha_sorteo

          `

        )

        .in(

          "rifa_id",

          rifaIds

        )

        .order(

          "fecha_sorteo",

          {

            ascending: false,

          }

        );



      if (sorteosError) {

        console.error(

          "Error buscando resultados oficiales:",

          sorteosError

        );



        return NextResponse.json(

          {

            ok: false,

            error:

              "No se pudieron consultar los resultados oficiales",

          },

          {

            status: 500,

          }

        );

      }



      sorteos =

        sorteosData || [];

    }



    const sorteosPorRifa =

      new Map();



    sorteos.forEach(

      (sorteo) => {

        const key = String(

          sorteo?.rifa_id || ""

        );



        if (

          key &&

          !sorteosPorRifa.has(key)

        ) {

          sorteosPorRifa.set(

            key,

            sorteo

          );

        }

      }

    );



    /* =====================================================

       9. CREAR LOS EVENTOS

    ===================================================== */



    const eventos =

      new Map();



    const asegurarEvento = (

      rifaId

    ) => {

      if (!rifaId) {

        return null;

      }



      const key =

        String(rifaId);



      if (!eventos.has(key)) {

        eventos.set(

          key,

          {

            rifa:

              rifasPorId.get(key) || {

                id: rifaId,

                nombre: "Evento",

                estado: null,

                formato: null,

                fecha_sorteo:

                  null,

              },



            compras: [],



            ticketsPagados: [],



            ticketsFree: [],

          }

        );

      }



      return eventos.get(key);

    };



    /* =====================================================

       10. AGREGAR COMPRAS A SU EVENTO

    ===================================================== */



    compras.forEach(

      (compra) => {

        const evento =

          asegurarEvento(

            compra?.rifa_id

          );



        if (!evento) return;



        evento.compras.push({

          id:

            compra.id,



          cantidad_tickets:

            compra.cantidad_tickets,



          monto_total:

            compra.monto_total,



          referencia:

            compra.referencia,



          estado_pago:

            compra.estado_pago,



          fecha_compra:

            compra.fecha_compra,



          metodo_pago:

            compra.metodo_pago,



          captura_inmediata:

            compra.captura_inmediata,

        });

      }

    );



    /* =====================================================

       11. AGREGAR TICKETS PAGADOS

    ===================================================== */



    ticketsPagados.forEach(

      (ticket) => {

        const evento =

          asegurarEvento(

            ticket?.rifa_id

          );



        if (!evento) return;



        const rifa =

          evento.rifa;



        const sorteo =

          sorteosPorRifa.get(

            String(

              ticket?.rifa_id || ""

            )

          ) || null;



        evento.ticketsPagados.push({

          id:

            ticket.id,



          numero_ticket:

            ticket.numero_ticket,



          numero_oficial:

            formatearNumero(

              ticket.numero_ticket,

              rifa?.formato

            ),



          es_ganador:

            esTicketGanador(

              ticket.numero_ticket,

              rifa,

              sorteo

            ),



          compra_id:

            ticket.compra_id,



          tipo:

            ticket.tipo ||

            "pagado",



          estado:

            ticket.estado,



          fecha:

            ticket.fecha_asignacion ||

            ticket.created_at ||

            null,

        });

      }

    );



    /* =====================================================

       12. AGREGAR FREE DROP

    ===================================================== */



    participacionesFree.forEach(

      (participacion) => {

        const evento =

          asegurarEvento(

            participacion?.rifa_id

          );



        if (!evento) return;



        const ticket =

          participacion?.ticket_id

            ? ticketsFreePorId.get(

                String(

                  participacion.ticket_id

                )

              ) || null

            : null;



        const sorteo =

          sorteosPorRifa.get(

            String(

              participacion?.rifa_id ||

              ticket?.rifa_id ||

              ""

            )

          ) || null;



        const freeDrop =

          participacion?.free_drop_id !==

            null &&

          participacion?.free_drop_id !==

            undefined

            ? freeDropsPorId.get(

                String(

                  participacion.free_drop_id

                )

              ) || null

            : null;



        evento.ticketsFree.push({

          id:

            participacion.id,



          ticket_id:

            participacion.ticket_id ||

            null,



          numero_ticket:

            ticket?.numero_ticket ??

            null,



          numero_oficial:

            formatearNumero(

              ticket?.numero_ticket,

              evento?.rifa?.formato

            ),



          es_ganador:

            esTicketGanador(

              ticket?.numero_ticket,

              evento?.rifa,

              sorteo

            ),



          codigo:

            participacion.codigo_unico,



          estado:

            participacion.estado,



          free_drop:

            freeDrop?.nombre ||

            (freeDrop?.numero_drop

              ? `FREE DROP ${freeDrop.numero_drop}`

              : "FREE DROP"),



          free_drop_id:

            participacion.free_drop_id,



          numero_drop:

            freeDrop?.numero_drop ??

            null,



          residencia:

            participacion.estado_residencia,



          fecha:

            participacion.created_at,



          nombre:

            participacion.nombre,



          apellido:

            participacion.apellido,

        });

      }

    );



    /* =====================================================

       13. ORDENAR TICKETS

    ===================================================== */



    eventos.forEach(

      (evento) => {

        evento.ticketsPagados.sort(

          (a, b) =>

            Number(

              a?.numero_ticket ?? 0

            ) -

            Number(

              b?.numero_ticket ?? 0

            )

        );



        evento.ticketsFree.sort(

          (a, b) =>

            new Date(

              b?.fecha || 0

            ).getTime() -

            new Date(

              a?.fecha || 0

            ).getTime()

        );



        evento.compras.sort(

          (a, b) =>

            new Date(

              b?.fecha_compra || 0

            ).getTime() -

            new Date(

              a?.fecha_compra || 0

            ).getTime()

        );

      }

    );



    /* =====================================================

       14. CONVERTIR MAP A ARRAY

    ===================================================== */



    const eventosFinales =

      Array.from(

        eventos.values()

      );



    eventosFinales.sort(

      (a, b) => {

        const fechaA =

          new Date(

            a?.rifa?.fecha_sorteo ||

              0

          ).getTime();



        const fechaB =

          new Date(

            b?.rifa?.fecha_sorteo ||

              0

          ).getTime();



        return fechaB - fechaA;

      }

    );



    /* =====================================================

       15. USUARIO PÚBLICO



       Si no existe en usuarios pero sí existe en FREE,

       usamos los datos básicos de la participación.

    ===================================================== */



    const primeraFree =

      participacionesFree[0] ||

      null;



    const usuarioPublico =

      usuario

        ? {

            id:

              usuario.id,



            nombre:

              usuario.nombre ||

              primeraFree?.nombre ||

              "",



            email:

              usuario.email ||

              email,

          }

        : primeraFree

        ? {

            id: null,



            nombre: [

              primeraFree.nombre,

              primeraFree.apellido,

            ]

              .filter(Boolean)

              .join(" "),



            email,

          }

        : null;



    /* =====================================================

       16. TOTALES

    ===================================================== */



    const totalPagados =

      ticketsPagados.length;



    const totalFree =

      participacionesFree.length;



    const total =

      totalPagados +

      totalFree;



    /* =====================================================

       17. SIN RESULTADOS

    ===================================================== */



    if (

      !usuario &&

      compras.length === 0 &&

      participacionesFree.length === 0

    ) {

      return NextResponse.json({

        ok: true,



        encontrado: false,



        mensaje:

          "No encontramos participaciones con este correo",



        usuario: null,



        total: 0,



        totalPagados: 0,



        totalFree: 0,



        eventos: [],

      });

    }



    /* =====================================================

       RESPUESTA FINAL

    ===================================================== */



    return NextResponse.json({

      ok: true,



      encontrado:

        total > 0 ||

        compras.length > 0,



      usuario:

        usuarioPublico,



      total,



      totalPagados,



      totalFree,



      eventos:

        eventosFinales,

    });

  } catch (error) {

    console.error(

      "Error general /api/mis-tickets:",

      error

    );



    return NextResponse.json(

      {

        ok: false,



        error:

          error?.message ||

          "Error interno al consultar Mis Tickets",

      },

      {

        status: 500,

      }

    );

  }

}