import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMisTicketsCodeEmail } from "@/lib/sendMisTicketsCodeEmail";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CODIGO_DURACION_MINUTOS = 10;
const ESPERA_REENVIO_SEGUNDOS = 60;

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

function crearCodigo() {
  return crypto.randomInt(
    100000,
    1000000
  ).toString();
}

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

function respuestaGenerica() {
  return NextResponse.json({
    ok: true,

    mensaje:
      "Si el correo está asociado a participaciones, recibirás un código de 6 dígitos.",

    expiresIn:
      CODIGO_DURACION_MINUTOS * 60,
  });
}

/* =========================================================
   POST /api/mis-tickets/solicitar-codigo
========================================================= */

export async function POST(req) {
  try {
    const body = await req.json();

    const email =
      limpiarEmail(
        body?.email
      );

    /* =====================================================
       VALIDAR EMAIL
    ===================================================== */

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Email requerido",
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
       VALIDAR VARIABLES DE ENTORNO
    ===================================================== */

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

    if (!process.env.RESEND_API_KEY) {
      console.error(
        "Falta RESEND_API_KEY"
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "El servicio de correo no está configurado",
        },
        {
          status: 500,
        }
      );
    }

    if (!process.env.EMAIL_FROM) {
      console.error(
        "Falta EMAIL_FROM"
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "El remitente de correo no está configurado",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       1. COMPROBAR SI EXISTE USUARIO
    ===================================================== */

    const {
      data: usuario,
      error: usuarioError,
    } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .ilike(
        "email",
        email
      )
      .limit(1)
      .maybeSingle();

    if (usuarioError) {
      console.error(
        "Error buscando usuario para OTP:",
        usuarioError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo procesar la solicitud",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       2. COMPROBAR SI TIENE COMPRAS
    ===================================================== */

    let tieneCompras = false;

    if (usuario?.id) {
      const {
        data: compra,
        error: compraError,
      } = await supabaseAdmin
        .from("compras")
        .select("id")
        .eq(
          "usuario_id",
          usuario.id
        )
        .limit(1)
        .maybeSingle();

      if (compraError) {
        console.error(
          "Error buscando compras para OTP:",
          compraError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "No se pudo procesar la solicitud",
          },
          {
            status: 500,
          }
        );
      }

      tieneCompras =
        Boolean(compra?.id);
    }

    /* =====================================================
       3. COMPROBAR FREE POR email_normalized
    ===================================================== */

    const {
      data: freeNormalizado,
      error: freeNormalizadoError,
    } = await supabaseAdmin
      .from(
        "free_drop_participations"
      )
      .select("id")
      .eq(
        "email_normalized",
        email
      )
      .limit(1)
      .maybeSingle();

    if (freeNormalizadoError) {
      console.error(
        "Error buscando FREE normalizado para OTP:",
        freeNormalizadoError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo procesar la solicitud",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       4. COMPATIBILIDAD CON FREE ANTIGUOS
    ===================================================== */

    let freeAntiguo = null;

    if (!freeNormalizado?.id) {
      const {
        data: freeAntiguoData,
        error: freeAntiguoError,
      } = await supabaseAdmin
        .from(
          "free_drop_participations"
        )
        .select("id")
        .ilike(
          "email",
          email
        )
        .limit(1)
        .maybeSingle();

      if (freeAntiguoError) {
        console.error(
          "Error buscando FREE antiguo para OTP:",
          freeAntiguoError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "No se pudo procesar la solicitud",
          },
          {
            status: 500,
          }
        );
      }

      freeAntiguo =
        freeAntiguoData;
    }

    const tieneFree =
      Boolean(
        freeNormalizado?.id ||
        freeAntiguo?.id
      );

    const tieneParticipacion =
      tieneCompras ||
      tieneFree;

    /* =====================================================
       NO REVELAR SI EL EMAIL EXISTE O NO

       Por seguridad devolvemos el mismo mensaje.
    ===================================================== */

    if (!tieneParticipacion) {
      return respuestaGenerica();
    }

    /* =====================================================
       5. RATE LIMIT

       No permitir generar otro código antes de 60 segundos.
    ===================================================== */

    const {
      data: ultimoOtp,
      error: ultimoOtpError,
    } = await supabaseAdmin
      .from("mis_tickets_otps")
      .select(`
        id,
        created_at
      `)
      .eq(
        "email",
        email
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (ultimoOtpError) {
      console.error(
        "Error consultando último OTP:",
        ultimoOtpError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo generar el código",
        },
        {
          status: 500,
        }
      );
    }

    if (ultimoOtp?.created_at) {
      const creado =
        new Date(
          ultimoOtp.created_at
        ).getTime();

      const ahoraServidor =
        Date.now();

      const diferenciaSegundos =
        Math.floor(
          (ahoraServidor - creado) /
            1000
        );

      /*
       * Aplicamos el límite únicamente cuando
       * la fecha recibida es coherente.
       *
       * Permitimos hasta 5 segundos de diferencia
       * entre el reloj del servidor y la base de datos.
       *
       * Si created_at aparece muy adelantado,
       * no dejamos al usuario atrapado permanentemente
       * en "Espera 60 segundos".
       */
      if (
        diferenciaSegundos >= -5 &&
        diferenciaSegundos <
          ESPERA_REENVIO_SEGUNDOS
      ) {
        const diferenciaSegura =
          Math.max(
            0,
            diferenciaSegundos
          );

        const retryAfter =
          Math.max(
            1,
            Math.min(
              ESPERA_REENVIO_SEGUNDOS,
              ESPERA_REENVIO_SEGUNDOS -
                diferenciaSegura
            )
          );

        return NextResponse.json(
          {
            ok: false,

            error:
              `Espera ${retryAfter} segundo${
                retryAfter === 1
                  ? ""
                  : "s"
              } antes de solicitar otro código.`,

            retryAfter,
          },
          {
            status: 429,

            headers: {
              "Retry-After":
                String(
                  retryAfter
                ),
            },
          }
        );
      }
    }

    /* =====================================================
       6. GENERAR CÓDIGO
    ===================================================== */

    const codigo =
      crearCodigo();

    const codigoHash =
      crearHashCodigo(
        email,
        codigo
      );

    const ahora =
      new Date();

    const expiresAt =
      new Date(
        ahora.getTime() +
          CODIGO_DURACION_MINUTOS *
            60 *
            1000
      );

    /* =====================================================
       7. INVALIDAR CÓDIGOS ANTERIORES
    ===================================================== */

    const {
      error: invalidarError,
    } = await supabaseAdmin
      .from("mis_tickets_otps")
      .update({
        usado: true,
      })
      .eq(
        "email",
        email
      )
      .eq(
        "usado",
        false
      );

    if (invalidarError) {
      console.error(
        "Error invalidando OTP anteriores:",
        invalidarError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo generar el código",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       8. GUARDAR NUEVO OTP
    ===================================================== */

    const {
      data: nuevoOtp,
      error: insertarError,
    } = await supabaseAdmin
      .from("mis_tickets_otps")
      .insert({
        email,

        codigo_hash:
          codigoHash,

        expires_at:
          expiresAt.toISOString(),

        intentos: 0,

        usado: false,
      })
      .select("id")
      .single();

    if (insertarError) {
      console.error(
        "Error guardando OTP:",
        insertarError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo generar el código",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       9. ENVIAR CÓDIGO POR EMAIL
    ===================================================== */

    try {
      await sendMisTicketsCodeEmail({
        to: email,
        codigo,
      });
    } catch (emailError) {
      console.error(
        "Error enviando OTP por email:",
        emailError
      );

      /*
       * Si el correo no pudo enviarse,
       * invalidamos el código para que
       * no quede activo.
       */

      if (nuevoOtp?.id) {
        const {
          error: invalidarNuevoError,
        } = await supabaseAdmin
          .from(
            "mis_tickets_otps"
          )
          .update({
            usado: true,
          })
          .eq(
            "id",
            nuevoOtp.id
          );

        if (
          invalidarNuevoError
        ) {
          console.error(
            "Error invalidando OTP después de fallo de email:",
            invalidarNuevoError
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo enviar el código de verificación. Inténtalo nuevamente.",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       RESPUESTA

       NUNCA devolvemos el código ni su hash.
    ===================================================== */

    return NextResponse.json({
      ok: true,

      mensaje:
        "Si el correo está asociado a participaciones, recibirás un código de 6 dígitos.",

      expiresIn:
        CODIGO_DURACION_MINUTOS *
        60,

      retryAfter:
        ESPERA_REENVIO_SEGUNDOS,
    });
  } catch (error) {
    console.error(
      "Error general solicitar código Mis Tickets:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "Error interno al solicitar el código",
      },
      {
        status: 500,
      }
    );
  }
}