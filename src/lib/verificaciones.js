export const validarEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );

async function fetchJsonSeguro(
  url,
  body,
  timeoutMs = 12000
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        error:
          error?.name === "AbortError"
            ? "La solicitud tardó demasiado"
            : error?.message || "Error de red",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function verificarTicketsPorEmail(
  email,
  rifaId = null
) {
  const emailLimpio = String(email || "")
    .trim()
    .toLowerCase();

  const rifaIdLimpio =
    rifaId === null || rifaId === undefined
      ? null
      : String(rifaId).trim();

  return fetchJsonSeguro(
    "/api/verificar-tickets",
    {
      email: emailLimpio,
      rifaId: rifaIdLimpio,
    }
  );
}

export async function verificarFreeCode(codigo) {
  const codigoLimpio = String(codigo || "")
    .trim()
    .toUpperCase();

  return fetchJsonSeguro(
    "/api/verificar-free-code",
    {
      codigo: codigoLimpio,
    }
  );
}