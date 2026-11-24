
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SETTINGS = {
  enabled:false,
  modo_compra:"ambos",
  max_numeros_por_compra:100,
  reserva_horas:24,
  buscador_activo:true,
  actualizacion_automatica:true,
  bendecidos_activos:false
};

function responder(data,status=200) {
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
}

function responderError(error,status=400) {
  return responder({ok:false,error},status);
}

function esUuid(valor) {
  return typeof valor==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

async function verificarRifa(rifaId) {
  const {data,error}=await supabaseAdmin.from("rifas").select("id").eq("id",rifaId).maybeSingle();
  if(error)throw error;
  return Boolean(data);
}

async function obtenerStats(rifaId) {
  const {data,error}=await supabaseAdmin.rpc("get_rifa_stats_seleccion_manual",{p_rifa_id:rifaId});
  if(error)throw error;
  return Array.isArray(data)?data[0]??null:data;
}

export async function GET(req) {
  const auth=await requireAdmin(req);
  if(!auth.ok)return responderError(auth.error,auth.status);
  try {
    const {searchParams}=new URL(req.url);
    const rifaId=searchParams.get("rifaId");
    if(!esUuid(rifaId))return responderError("ID de rifa inválido.");

    if(searchParams.get("soloStats")==="1") {
      const stats=await obtenerStats(rifaId);
      return stats?responder({ok:true,stats}):responderError("La rifa no existe.",404);
    }

    if(!(await verificarRifa(rifaId)))return responderError("La rifa no existe.",404);

    const [config,resultado,premios]=await Promise.all([
      supabaseAdmin.from("seleccion_manual_settings").select("*").eq("rifa_id",rifaId).maybeSingle(),
      obtenerStats(rifaId).then(stats=>({stats})).catch(error=>({error})),
      supabaseAdmin.from("tickets")
        .select("numero_ticket,premio_bendecido,estado,compra_id,free_drop_id,free_drop_participation_id,reserva_expira_at,tipo")
        .eq("rifa_id",rifaId)
        .gt("premio_bendecido",0)
        .order("numero_ticket")
        .limit(1000)
    ]);

    if(premios.error)throw premios.error;
    if(config.error)throw config.error;
    if(resultado.error)console.error("Estadísticas selección manual:",resultado.error);

    return responder({
      ok:true,
      settings:{
        ...DEFAULT_SETTINGS,
        ...(config.data||{}),
        rifa_id:rifaId
      },
      bendecidos:premios.data||[],
      stats:resultado.stats??null,
      statsError:resultado.error?"No se pudieron cargar las estadísticas.":null
    });
  }catch(error){
    console.error("Error cargando selección manual:",error);
    return responderError("No se pudo cargar la configuración.",500);
  }
}

export async function PATCH(req) {
  const auth=await requireAdmin(req);
  if(!auth.ok)return responderError(auth.error,auth.status);
  try {
    const body=await req.json().catch(()=>null);
    const rifaId=body?.rifaId;

    if(!esUuid(rifaId))return responderError("ID de rifa inválido.");
    if(!(await verificarRifa(rifaId)))return responderError("La rifa no existe.",404);

    if(body.accion==="premio") {
      const {numero,premio}=body;
      if(
        !Number.isInteger(numero)||
        numero<0||
        !Number.isFinite(premio)||
        premio<0||
        premio>9999999999.99||
        Math.abs(premio*100-Math.round(premio*100))>0.0001
      ){
        return responderError("Número o premio inválido.");
      }

      const {data,error}=await supabaseAdmin.rpc("lsd_configurar_bendecido",{
        p_rifa_id:rifaId,
        p_numero:numero,
        p_premio:premio
      });

      if(error)return responderError(error.code==="P0001"?error.message:"No se pudo guardar el premio.",409);
      return responder({ok:true,ticket:data});
    }

    const modo=body.modo_compra;
    const maximo=body.max_numeros_por_compra;

    if(!["ambos","manual","automatica"].includes(modo)){
      return responderError("Modo de compra inválido.");
    }

    if(!Number.isInteger(maximo)||maximo<1||maximo>100){
      return responderError("El máximo debe estar entre 1 y 100.");
    }

    for(const campo of ["enabled","buscador_activo","actualizacion_automatica","bendecidos_activos"]){
      if(typeof body[campo]!=="boolean"){
        return responderError(`El campo ${campo} debe ser verdadero o falso.`);
      }
    }

    if(body.bendecidos_activos&&modo==="manual"){
      return responderError("Los números bendecidos requieren permitir la asignación automática.");
    }

    const payload={
      rifa_id:rifaId,
      enabled:body.enabled,
      modo_compra:modo,
      max_numeros_por_compra:maximo,
      reserva_horas:24,
      buscador_activo:body.buscador_activo,
      actualizacion_automatica:body.actualizacion_automatica,
      bendecidos_activos:body.bendecidos_activos,
      updated_at:new Date().toISOString()
    };

    const {data,error}=await supabaseAdmin
      .from("seleccion_manual_settings")
      .upsert(payload,{onConflict:"rifa_id"})
      .select("*")
      .single();

    if(error)throw error;

    if(data.bendecidos_activos!==body.bendecidos_activos){
      return responderError("No se pudo confirmar el estado de los números bendecidos.",409);
    }

    return responder({
      ok:true,
      settings:data,
      message:"Configuración guardada correctamente."
    });
  }catch(error){
    console.error("Error guardando selección manual:",error);
    return responderError("No se pudo guardar la configuración.",500);
  }
}
