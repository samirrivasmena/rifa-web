import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const accion = "guardar";
const mensaje = "Ganador oficial guardado correctamente";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const responder = (data, status=200) => NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return responder({ok:false,error:auth.error},auth.status);
    let body;
    try { body = await req.json(); } catch { return responder({ok:false,error:"Solicitud inválida"},400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return responder({ok:false,error:"Solicitud inválida"},400);
    const rifaId = String(body.rifaId ?? body.rifa_id ?? "").trim();
    const sorteoId = String(body.sorteoId ?? body.sorteo_id ?? "").trim();
    if (accion === "editar" ? !uuid.test(sorteoId) : !uuid.test(rifaId)) return responder({ok:false,error:"Identificador inválido"},400);
    const raw = body.numeroGanador ?? body.numero_ganador ?? body.numero;
    let numero = null;
    if (["guardar","editar","finalizar"].includes(accion)) {
      if (raw != null) {
        const texto = String(raw).trim();
        if (!/^\d{1,4}$/.test(texto)) return responder({ok:false,error:"Número inválido"},400);
        numero = Number(texto);
      } else if (accion !== "editar") return responder({ok:false,error:"Falta el número oficial"},400);
    }
    const {data,error} = await supabaseAdmin.rpc("lsd_resultado_seguro",{p_accion:accion,p_rifa_id:accion==="editar"?null:rifaId,p_sorteo_id:accion==="editar"?sorteoId:null,p_numero:numero,p_datos:body});
    if (error) {
      console.error("Resultado seguro",accion,error.code,error.message);
      return responder({ok:false,error:error.code==="P0001"?error.message:"No se pudo completar la operación"},error.code==="P0001"?409:500);
    }
    return responder({...data,mensaje,message:mensaje});
  } catch(error) {
    console.error("Resultado seguro",accion,error);
    return responder({ok:false,error:"Error interno del servidor"},500);
  }
}
