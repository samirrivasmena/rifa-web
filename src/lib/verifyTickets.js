export const validarEmail = (email) => /\S+@\S+\.\S+/.test(email);

export async function verificarTicketsPorEmail(email) {
  const response = await fetch("/api/verificar-tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    data,
  };
}