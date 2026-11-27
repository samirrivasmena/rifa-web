export function getRifaProgress(rifa = {}) {
  const s = rifa.stats || {};
  const n = v => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);

  const rango = rifa.numero_inicio != null && rifa.numero_fin != null
    ? n(Number(rifa.numero_fin) - Number(rifa.numero_inicio) + 1)
    : 0;

  const total = n(s.total ?? rifa.total_numeros ?? rifa.cantidad_numeros ?? rango);
  const vendidos = Math.min(total, n(rifa.tickets_pagados ?? s.pagados ?? s.ticketsPagados ?? s.vendidos ?? rifa.tickets_vendidos));
  const free = n(rifa.tickets_free ?? s.free ?? s.ticketsFree);
  const reservados = n(rifa.tickets_reservados ?? s.reservados ?? s.ticketsReservados);
  const ocupados = Math.min(total, n(rifa.tickets_ocupados ?? s.ocupados ?? s.ticketsOcupados ?? vendidos + free + reservados));
  const disponibles = Math.max(total - ocupados, 0);

  const confirmados = Math.min(total, vendidos + free);

  const porcentaje = total
    ? Number((vendidos * 100 / total).toFixed(2))
    : 0;

  const porcentajeConfirmado = total
    ? Number((confirmados * 100 / total).toFixed(2))
    : 0;

  const porcentajeOcupado = total
    ? Number((ocupados * 100 / total).toFixed(2))
    : 0;

  const soldOut = total > 0 && confirmados >= total;

  return {
    total,
    vendidos,
    tickets_vendidos: vendidos,
    pagados: vendidos,
    ticketsPagados: vendidos,
    free,
    ticketsFree: free,
    reservados,
    ticketsReservados: reservados,
    ocupados,
    ticketsOcupados: ocupados,
    disponibles,
    tickets_disponibles: disponibles,
    porcentaje,
    porcentaje_vendido: porcentaje,
    porcentajeVendido: porcentaje,
    porcentajeOcupado,
    confirmados,
    porcentajeConfirmado,
    soldOut,
    sold_out: soldOut,
    faltantes: total - vendidos,
  };
}