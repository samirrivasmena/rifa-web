export function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  try {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;

    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const anio = date.getFullYear();

    let horas = date.getHours();
    const minutos = String(date.getMinutes()).padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";
    horas = horas % 12 || 12;

    return `${dia}/${mes}/${anio} - ${String(horas).padStart(2, "0")}:${minutos} ${ampm}`;
  } catch {
    return fecha;
  }
}