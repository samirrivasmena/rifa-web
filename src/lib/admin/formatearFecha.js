export function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  try {
    let valor = String(fecha).trim();

    const tieneZonaHoraria = /([zZ]|[+-]\d{2}:?\d{2})$/.test(valor);

    if (!tieneZonaHoraria) {
      valor = valor.replace(" ", "T") + "Z";
    } else {
      valor = valor.replace(" ", "T");
    }

    const date = new Date(valor);

    if (Number.isNaN(date.getTime())) return String(fecha);

    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "America/Chicago",
    })
      .format(date)
      .replace(", ", " - ");
  } catch {
    return String(fecha);
  }
}