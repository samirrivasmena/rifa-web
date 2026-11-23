import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getRifaProgress } from "../../../lib/getRifaProgress";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
function responderJSON(data,status=200){return NextResponse.json(data,{status,headers:{"Cache-Control":status===200?"public, s-maxage=10, stale-while-revalidate=20":"no-store"}});}
export async function GET(req){
 try {
 const id=new URL(req.url).searchParams.get("rifaId");
 let q=supabaseAdmin.from("rifas").select("id,nombre,descripcion,numero_inicio,numero_fin,cantidad_numeros,formato,estado,portada_url,portada_scroll_url,premio,precio_ticket,fecha_sorteo,hora_sorteo,publicada,destacada").eq("publicada",true);
 q=id?q.eq("id",id):q.order("created_at",{ascending:false});
 const {data:rifa,error}=await q.limit(1).maybeSingle();
 if(error)throw error;
 if(!rifa)return responderJSON({ok:true,rifa:null});
 const {data:r,error:e}=await supabaseAdmin.from("resumen_publico_tickets_por_rifa").select("rifa_id,total_numeros,tickets_pagados,tickets_free,tickets_ocupados,tickets_reservados,tickets_disponibles,disponibles_inventario,tickets_otros_ocupados").eq("rifa_id",rifa.id).single();
 if(e)throw e;
 const s=getRifaProgress({...rifa,...r});
 return responderJSON({ok:true,rifa:{...rifa,total_numeros:s.total,tickets_vendidos:s.vendidos,tickets_pagados:s.pagados,tickets_free:s.free,tickets_ocupados:s.ocupados,tickets_reservados:s.reservados,tickets_disponibles:s.disponibles,porcentaje_vendido:s.porcentaje,porcentaje_ocupado:s.porcentajeOcupado,sold_out:s.soldOut,stats:{...s,ticketsVendidos:s.vendidos,disponiblesInventario:Number(r.disponibles_inventario),otrosOcupados:Number(r.tickets_otros_ocupados)}}});
 }catch(e){console.error("rifa-resumen",e);return responderJSON({ok:false,error:"No se pudo cargar el resumen de la rifa"},500);}
}