import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limpiarTexto = valor => String(valor ?? "").trim() || null;
const responder = (data,status=200) => NextResponse.json(data,{status});
export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return responder({error:auth.error},auth.status);
    const body = await req.json().catch(()=>null);
    if (!body || typeof body!=="object" || Array.isArray(body)) return responder({error:"Solicitud inválida"},400);
    const rifaId = limpiarTexto(body.rifaId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rifaId ?? "")) return responder({error:"ID de rifa inválido"},400);
    const nombre = limpiarTexto(body.nombre);
    const formato = limpiarTexto(body.formato);
    const precio = Number(body.precio_ticket);
    if (!nombre) return responder({error:"El nombre de la rifa es obligatorio"},400);
    if (!["3digitos","4digitos"].includes(formato)) return responder({error:"Formato inválido"},400);
    if (typeof body.precio_ticket==="boolean" || !Number.isFinite(precio) || precio<=0) return responder({error:"El precio del ticket debe ser mayor a 0"},400);
    const {data:actual,error:lectura} = await supabaseAdmin.from("rifas").select("id,formato,numero_inicio,numero_fin").eq("id",rifaId).maybeSingle();
    if (lectura) { console.error(lectura); return responder({error:"No se pudo validar la rifa"},500); }
    if (!actual) return responder({error:"La rifa no existe"},404);
    const cambios = {nombre,formato,precio_ticket:precio,numero_inicio:formato===actual.formato?actual.numero_inicio:0,numero_fin:formato===actual.formato?actual.numero_fin:formato==="3digitos"?999:9999};
    for (const campo of ["descripcion","premio","fecha_sorteo","hora_sorteo","fecha_cierre"]) if (Object.hasOwn(body,campo)) cambios[campo]=limpiarTexto(body[campo]);
    for (const campo of ["publicada","destacada"]) if (Object.hasOwn(body,campo)) {
      if (![true,false,1,0,"1","0","true","false"].includes(body[campo])) return responder({error:`Valor inválido: ${campo}`},400);
      cambios[campo]=[true,1,"1","true"].includes(body[campo]);
    }
    const {data,error} = await supabaseAdmin.from("rifas").update(cambios).eq("id",rifaId).select("*").single();
    if (error) { console.error("editar-rifa",error); return responder({error:error.code==="P0001"?error.message:"No se pudo actualizar la rifa"},error.code==="P0001"?409:500); }
    return responder({ok:true,message:"Rifa actualizada correctamente",rifa:data});
  } catch(error) { console.error(error); return responder({error:"Error interno del servidor"},500); }
}
