export const validarEmail = (email) => /\S+@\S+\.\S+/.test(email);

async function fetchJsonSeguro(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
}

export async function verificarTicketsPorEmail(email) {
  return fetchJsonSeguro("/api/verificar-tickets", { email });
}

export async function verificarFreeCode(codigo) {
  return fetchJsonSeguro("/api/verificar-free-code", { codigo });
}