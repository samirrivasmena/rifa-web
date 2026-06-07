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
      stats.total ?? resumen.total_numeros ?? resumen.cantidad_numeros
    ),
    vendidos: toNumber(
      stats.vendidos ??
        stats.ticketsVendidos ??
        resumen.tickets_vendidos ??
        resumen.vendidos
    ),
    disponibles: toNumber(
      stats.disponibles ?? resumen.tickets_disponibles ?? resumen.disponibles
    ),
    porcentaje: toNumber(
      stats.porcentaje ?? stats.porcentajeVendido ?? resumen.porcentaje_vendido
    ),
    soldOut: toBoolean(stats.soldOut ?? resumen.sold_out ?? resumen.soldOut),
  };
}

export async function enriquecerRifaConResumen(rifa) {
  if (!rifa?.id) return rifa;

  try {
    const res = await fetch(
      `/api/rifa-resumen?rifaId=${encodeURIComponent(rifa.id)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (res.ok && data?.rifa) {
      const resumen = data.rifa;
      const stats = normalizarStats(resumen.stats || {}, resumen);

      return {
        ...rifa,
        ...resumen,
        total_numeros: toNumber(resumen.total_numeros),
        tickets_vendidos: toNumber(resumen.tickets_vendidos),
        tickets_disponibles: toNumber(resumen.tickets_disponibles),
        porcentaje_vendido: toNumber(resumen.porcentaje_vendido),
        sold_out: toBoolean(resumen.sold_out ?? resumen.soldOut),
        soldOut: toBoolean(resumen.soldOut ?? resumen.sold_out),
        stats,
      };
    }
  } catch (error) {
    console.error("Error enriqueciendo rifa con resumen:", error);
  }

  return rifa;
}

export async function enriquecerListaRifasConResumen(rifas = []) {
  return Promise.all(rifas.map((rifa) => enriquecerRifaConResumen(rifa)));
}