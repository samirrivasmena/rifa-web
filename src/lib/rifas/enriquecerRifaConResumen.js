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

function normalizarStats(stats = {}, resumen = {}) {
  return {
    total: toNumber(
      stats.total ??
        resumen.total_numeros ??
        resumen.cantidad_numeros
    ),

    vendidos: toNumber(
      stats.vendidos ??
        stats.ticketsVendidos ??
        resumen.tickets_vendidos ??
        resumen.vendidos
    ),

    disponibles: toNumber(
      stats.disponibles ??
        resumen.tickets_disponibles ??
        resumen.disponibles
    ),

    porcentaje: toNumber(
      stats.porcentaje ??
        stats.porcentajeVendido ??
        resumen.porcentaje_vendido
    ),

    soldOut: toBoolean(
      stats.soldOut ??
        resumen.sold_out ??
        resumen.soldOut
    ),
  };
}

export async function enriquecerRifaConResumen(rifa) {
  if (!rifa?.id) return rifa;

  const stats = normalizarStats(
    rifa.stats || {},
    rifa
  );

  return {
    ...rifa,

    total_numeros: stats.total,
    tickets_vendidos: stats.vendidos,
    tickets_disponibles: stats.disponibles,
    porcentaje_vendido: stats.porcentaje,

    sold_out: stats.soldOut,
    soldOut: stats.soldOut,

    stats,
  };
}

export async function enriquecerListaRifasConResumen(rifas = []) {
  return Promise.all(
    rifas.map((rifa) =>
      enriquecerRifaConResumen(rifa)
    )
  );
}