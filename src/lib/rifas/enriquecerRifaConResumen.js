import { getRifaProgress } from "../getRifaProgress";
export async function enriquecerRifaConResumen(rifa) {
 if (!rifa?.id) return rifa;
 const s = getRifaProgress(rifa);
 return {...rifa,total_numeros:s.total,tickets_vendidos:s.vendidos,tickets_pagados:s.pagados,tickets_free:s.free,tickets_reservados:s.reservados,tickets_ocupados:s.ocupados,tickets_disponibles:s.disponibles,porcentaje_vendido:s.porcentaje,porcentaje_ocupado:s.porcentajeOcupado,sold_out:s.soldOut,soldOut:s.soldOut,stats:{...rifa.stats,...s,ticketsVendidos:s.vendidos}};
}
export async function enriquecerListaRifasConResumen(rifas=[]) {return Promise.all(rifas.map(enriquecerRifaConResumen));}