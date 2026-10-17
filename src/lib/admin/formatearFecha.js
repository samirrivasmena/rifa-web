/* =========================================================
   FORMATEAR FECHA GENERAL
   Mantiene el formato que ya utilizas actualmente
========================================================= */

export function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  try {
    let valor = String(fecha).trim();

    const tieneZonaHoraria =
      /([zZ]|[+-]\d{2}:?\d{2})$/.test(valor);

    if (!tieneZonaHoraria) {
      valor = valor.replace(" ", "T") + "Z";
    } else {
      valor = valor.replace(" ", "T");
    }

    const date = new Date(valor);

    if (Number.isNaN(date.getTime())) {
      return String(fecha);
    }

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

/* =========================================================
   FORMATEAR FECHA PÚBLICA
   Para cards de eventos, finalizados y ganadores

   Ejemplo:
   2026-10-20
   →
   20 de octubre de 2026
========================================================= */

export function formatearFechaPublica(fecha) {
  if (!fecha) return "";

  try {
    const valor = String(fecha).trim();

    /*
     * Tomamos directamente año, mes y día.
     *
     * Esto evita que una fecha como 2026-10-20
     * cambie accidentalmente al día 19 por
     * diferencias de zona horaria.
     */
    const coincidencia = valor.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (!coincidencia) {
      return valor;
    }

    const [, anio, mes, dia] = coincidencia;

    const meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];

    const indiceMes = Number(mes) - 1;

    const nombreMes = meses[indiceMes];

    if (!nombreMes) {
      return valor;
    }

    const numeroDia = Number(dia);

    if (
      !Number.isInteger(numeroDia) ||
      numeroDia < 1 ||
      numeroDia > 31
    ) {
      return valor;
    }

    return `${numeroDia} de ${nombreMes} de ${anio}`;
  } catch {
    return String(fecha);
  }
}

/* =========================================================
   FORMATEAR HORA PÚBLICA
   Para cards de eventos

   Ejemplos:

   20:00
   →
   8:00 PM

   13:30:00
   →
   1:30 PM

   09:15
   →
   9:15 AM
========================================================= */

export function formatearHoraPublica(hora) {
  if (!hora) return "";

  try {
    const valor = String(hora).trim();

    const coincidencia = valor.match(
      /^(\d{1,2}):(\d{2})/
    );

    if (!coincidencia) {
      return valor;
    }

    const horas = Number(coincidencia[1]);
    const minutos = Number(coincidencia[2]);

    if (
      !Number.isInteger(horas) ||
      horas < 0 ||
      horas > 23 ||
      !Number.isInteger(minutos) ||
      minutos < 0 ||
      minutos > 59
    ) {
      return valor;
    }

    const periodo =
      horas >= 12 ? "PM" : "AM";

    const hora12 =
      horas % 12 || 12;

    const minutosFormateados =
      String(minutos).padStart(2, "0");

    return `${hora12}:${minutosFormateados} ${periodo}`;
  } catch {
    return String(hora);
  }
}