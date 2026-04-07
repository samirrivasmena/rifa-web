export function escaparCSV(valor) {
  const texto = String(valor ?? "");

  if (texto.includes('"') || texto.includes(",") || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}