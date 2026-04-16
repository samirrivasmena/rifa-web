export function getRifaProgress(rifa = {}) {
  const totalRaw = Number(
    rifa?.cantidad_numeros ?? rifa?.total_tickets ?? rifa?.numeros_totales ?? 0
  );

  const vendidosRaw = Number(
    rifa?.tickets_vendidos ?? rifa?.vendidos ?? rifa?.ticketsVendidos ?? 0
  );

  const total = Number.isFinite(totalRaw) ? totalRaw : 0;
  const vendidos = Number.isFinite(vendidosRaw) ? vendidosRaw : 0;

  const porcentaje = total > 0 ? Math.min((vendidos / total) * 100, 100) : 0;
  const soldOut = total > 0 && vendidos >= total;
  const faltantes = Math.max(total - vendidos, 0);

  return {
    total,
    vendidos,
    porcentaje,
    soldOut,
    faltantes,
  };
}