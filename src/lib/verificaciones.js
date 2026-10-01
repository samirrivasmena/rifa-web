/* =========================================================
   VALIDAR EMAIL
========================================================= */

export const validarEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );

/* =========================================================
   FETCH JSON SEGURO

   - Timeout automático
   - Manejo de errores de red
   - Manejo de respuestas que no sean JSON
========================================================= */

async function fetchJsonSeguro(
  url,
  body,
  timeoutMs = 12000
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          body
        ),

        signal:
          controller.signal,

        cache: "no-store",
      }
    );

    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }

    return {
      ok: response.ok,

      status:
        response.status,

      data,
    };
  } catch (error) {
    return {
      ok: false,

      status: 0,

      data: {
        error:
          error?.name ===
          "AbortError"
            ? "La solicitud tardó demasiado. Inténtalo nuevamente."
            : error?.message ||
              "Error de red",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   VERIFICAR TICKETS PAGADOS

   Esta función mantiene el verificador normal que ya
   utilizabas anteriormente.
========================================================= */

export async function verificarTicketsPorEmail(
  email,
  rifaId = null
) {
  const emailLimpio =
    String(email || "")
      .trim()
      .toLowerCase();

  const body = {
    email:
      emailLimpio,
  };

  if (
    rifaId !== null &&
    rifaId !== undefined &&
    rifaId !== ""
  ) {
    body.rifaId =
      rifaId;
  }

  return fetchJsonSeguro(
    "/api/verificar-tickets",
    body
  );
}

/* =========================================================
   VERIFICAR CÓDIGO FREE DROP

   Mantiene funcionando el verificador FREE que ya
   tenías.
========================================================= */

export async function verificarFreeCode(
  codigo
) {
  const codigoLimpio =
    String(codigo || "")
      .trim()
      .toUpperCase();

  return fetchJsonSeguro(
    "/api/verificar-free-code",
    {
      codigo:
        codigoLimpio,
    }
  );
}

/* =========================================================
   SOLICITAR CÓDIGO PARA "MIS TICKETS"

   PASO 1:
   El usuario introduce su email.

   El servidor:
   - comprueba si tiene participaciones
   - genera un código de 6 dígitos
   - guarda únicamente el hash
   - envía el código por email
========================================================= */

export async function solicitarCodigoMisTickets(
  email
) {
  const emailLimpio =
    String(email || "")
      .trim()
      .toLowerCase();

  return fetchJsonSeguro(
    "/api/mis-tickets/solicitar-codigo",
    {
      email:
        emailLimpio,
    }
  );
}

/* =========================================================
   VERIFICAR CÓDIGO Y OBTENER "MIS TICKETS"

   PASO 2:
   El usuario introduce:
   - email
   - código recibido por correo

   Solamente si el código es correcto el servidor
   devuelve sus participaciones.
========================================================= */

export async function verificarMisTickets(
  email,
  codigo
) {
  const emailLimpio =
    String(email || "")
      .trim()
      .toLowerCase();

  const codigoLimpio =
    String(codigo || "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 6);

  return fetchJsonSeguro(
    "/api/mis-tickets",
    {
      email:
        emailLimpio,

      codigo:
        codigoLimpio,
    }
  );
}