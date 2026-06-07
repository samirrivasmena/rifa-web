export function getRifaProgress(rifa = {}) {
  const stats = rifa?.stats || {};

  const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const toBoolean = (value) => {
    if (
      value === true ||
      value === 1 ||
      value === "1" ||
      String(value).trim().toLowerCase() === "true"
    ) {
      return true;
    }

    return false;
  };

  const inicio = toNumber(rifa?.numero_inicio);
  const fin = toNumber(rifa?.numero_fin);

  const totalPorRango = fin >= inicio ? fin - inicio + 1 : 0;
  const totalPorCantidad = toNumber(rifa?.cantidad_numeros);

  const totalCandidates = [
    toNumber(stats.total),
    toNumber(rifa?.total_numeros),
    totalPorRango,
    totalPorCantidad,
  ];

  const total = totalCandidates.find((v) => v > 0) || 0;

  const vendidosCandidates = [
    toNumber(stats.vendidos),
    toNumber(stats.ticketsVendidos),
    toNumber(rifa?.tickets_vendidos),
    toNumber(rifa?.vendidos),
  ];

  const vendidosRaw = vendidosCandidates.find((v) => v > 0) || 0;
  const vendidos = total > 0 ? Math.min(vendidosRaw, total) : vendidosRaw;

  const disponiblesRaw =
    toNumber(stats.disponibles) ||
    toNumber(rifa?.tickets_disponibles) ||
    Math.max(total - vendidos, 0);

  const disponibles =
    total > 0
      ? Math.min(Math.max(disponiblesRaw, 0), total - vendidos)
      : Math.max(disponiblesRaw, 0);

  const porcentajeRaw =
    total > 0
      ? Number(((vendidos / total) * 100).toFixed(2))
      : toNumber(stats.porcentaje) ||
        toNumber(stats.porcentajeVendido) ||
        toNumber(rifa?.porcentaje_vendido) ||
        0;

  const porcentaje =
    total > 0 ? Math.min(Math.max(porcentajeRaw, 0), 100) : porcentajeRaw;

  const soldOut =
    toBoolean(stats.soldOut ?? rifa?.sold_out) ||
    (total > 0 && vendidos >= total);

  return {
    total,
    vendidos,
    tickets_vendidos: vendidos,
    disponibles,
    tickets_disponibles: disponibles,
    porcentaje,
    porcentaje_vendido: porcentaje,
    soldOut,
    sold_out: soldOut,
    faltantes: Math.max(total - vendidos, 0),
  };
}