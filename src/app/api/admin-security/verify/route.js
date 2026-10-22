import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req) {
  try {
    /* =====================================================
       1. COMPROBAR CONFIGURACIÓN DEL SERVIDOR
    ===================================================== */

    const secretKey = String(
      process.env.TURNSTILE_SECRET_KEY || ""
    ).trim();

    if (!secretKey) {
      console.error(
        "SEGURIDAD: TURNSTILE_SECRET_KEY no está configurada"
      );

      return json(
        {
          ok: false,
          error: "Configuración de seguridad incompleta",
        },
        500
      );
    }

    /* =====================================================
       2. LEER TOKEN ENVIADO POR EL LOGIN
    ===================================================== */

    let body;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          ok: false,
          error: "Solicitud inválida",
        },
        400
      );
    }

    const token = String(
      body?.turnstileToken || ""
    ).trim();

    if (!token) {
      return json(
        {
          ok: false,
          error: "Verificación de seguridad requerida",
        },
        400
      );
    }

    /*
      Evitamos aceptar entradas absurdamente grandes.
      Esto no reemplaza Turnstile; simplemente endurece
      nuestro endpoint.
    */
    if (token.length > 4096) {
      return json(
        {
          ok: false,
          error: "Verificación de seguridad inválida",
        },
        400
      );
    }

    /* =====================================================
       3. OBTENER IP DEL CLIENTE

       Cloudflare puede utilizar remoteip como información
       adicional durante la validación.
    ===================================================== */

    const forwardedFor =
      req.headers.get("x-forwarded-for") || "";

    const clientIp =
      forwardedFor
        .split(",")[0]
        ?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    /* =====================================================
       4. ENVIAR TOKEN A CLOUDFLARE SITEVERIFY
    ===================================================== */

    const formData = new URLSearchParams();

    formData.append(
      "secret",
      secretKey
    );

    formData.append(
      "response",
      token
    );

    if (clientIp) {
      formData.append(
        "remoteip",
        clientIp
      );
    }

    let cloudflareResponse;

    try {
      cloudflareResponse =
        await fetch(
          TURNSTILE_VERIFY_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              formData.toString(),

            cache: "no-store",
          }
        );
    } catch (error) {
      console.error(
        "Error conectando con Turnstile:",
        error
      );

      return json(
        {
          ok: false,
          error:
            "No se pudo completar la verificación de seguridad",
        },
        503
      );
    }

    if (!cloudflareResponse.ok) {
      console.error(
        "Turnstile respondió con HTTP:",
        cloudflareResponse.status
      );

      return json(
        {
          ok: false,
          error:
            "No se pudo completar la verificación de seguridad",
        },
        503
      );
    }

    /* =====================================================
       5. LEER RESPUESTA DE CLOUDFLARE
    ===================================================== */

    let resultado;

    try {
      resultado =
        await cloudflareResponse.json();
    } catch {
      return json(
        {
          ok: false,
          error:
            "Respuesta de seguridad inválida",
        },
        503
      );
    }

    /* =====================================================
       6. VERIFICAR RESULTADO
    ===================================================== */

    if (!resultado?.success) {
      console.warn(
        "Turnstile rechazó una verificación:",
        resultado?.["error-codes"] || []
      );

      return json(
        {
          ok: false,
          error:
            "No se pudo verificar que eres una persona real",
        },
        403
      );
    }

    /* =====================================================
       7. VALIDAR HOSTNAME EN PRODUCCIÓN

       Evita aceptar un token generado para otro dominio.
    ===================================================== */

    const hostname =
      String(
        resultado?.hostname || ""
      )
        .trim()
        .toLowerCase();

    const hostnamesPermitidos =
      new Set([
        "sorteoslsd.com",
        "www.sorteoslsd.com",
        "localhost",
        "192.168.1.154",
      ]);

    if (
      hostname &&
      !hostnamesPermitidos.has(
        hostname
      )
    ) {
      console.warn(
        "Turnstile hostname rechazado:",
        hostname
      );

      return json(
        {
          ok: false,
          error:
            "Origen de verificación no autorizado",
        },
        403
      );
    }

    /* =====================================================
       8. CAPTCHA CORRECTO
    ===================================================== */

    return json({
      ok: true,
      verified: true,
    });
  } catch (error) {
    console.error(
      "admin-security/verify error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "Error interno de seguridad",
      },
      500
    );
  }
}