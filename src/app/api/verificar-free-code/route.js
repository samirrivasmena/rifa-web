import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" };
const normalizar = (v) => String(v ?? "").trim().toLowerCase();
const mismo = (a,b) => a != null && b != null && String(a) === String(b);
function responderError(error,status=400,headers={}) {
  return NextResponse.json({error},{status,headers:{...HEADERS,...headers}});
}
function estadoVisualParticipacion(estado) {
  const v=normalizar(estado);
  if (["activo","valida","válida","aprobado","aprobada","approved"].includes(v)) return "VÁLIDA";
  if (["pendiente","pending"].includes(v)) return "PENDIENTE";
  if (["rechazado","rechazada","rejected"].includes(v)) return "RECHAZADA";
  if (["anulado","anulada","cancelado","cancelada"].includes(v)) return "ANULADA";
  return String(estado || "DESCONOCIDO").toUpperCase();
}
export async function POST(req) {
  try {
    const body=await req.json().catch(()=>null);
    if (!body || typeof body!=="object" || Array.isArray(body)) return responderError("Solicitud inválida");
    const codigo=String(body.codigo || body.codigo_free || body.codigoUnico || body.codigo_unico || "").trim().toUpperCase();
    if (!codigo) return responderError("El código FREE es requerido");
    if (!/^FREE-\d{6}$/.test(codigo)) return responderError("Código FREE inválido");
    const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Configuración incompleta");
    const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const ip=(req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "local").split(",")[0].trim();
    const clave=createHmac("sha256",process.env.MIS_TICKETS_OTP_SECRET || key).update(`free-code:${ip}`).digest("hex");
    const limite=await supabase.rpc("limitar_verificacion_free",{p_clave:clave});
    if (limite.error || !Number.isInteger(limite.data) || limite.data<0) throw limite.error || new Error("Rate limit inválido");
    if (limite.data>0) return responderError("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",429,{"Retry-After":String(limite.data)});
    const {data:p,error}=await supabase.from("free_drop_participations").select("id,rifa_id,free_drop_id,ticket_id,codigo_unico,estado,created_at").eq("codigo_unico",codigo).maybeSingle();
    if (error) throw error;
    if (!p) return responderError("Código FREE no encontrado",404);
    const visual=estadoVisualParticipacion(p.estado);
    const [eventoRes,dropRes,ticketRes]=await Promise.all([
      supabase.from("rifas").select("id,nombre,formato").eq("id",p.rifa_id).maybeSingle(),
      supabase.from("free_drops").select("id,nombre,numero_drop,rifa_id").eq("id",p.free_drop_id).maybeSingle(),
      visual==="VÁLIDA" && p.ticket_id ? supabase.from("tickets").select("id,numero_ticket").eq("id",p.ticket_id).eq("rifa_id",p.rifa_id).eq("free_drop_id",p.free_drop_id).eq("free_drop_participation_id",p.id).eq("estado","asignado").eq("tipo","free").is("compra_id",null).is("reserva_expira_at",null).maybeSingle() : Promise.resolve({data:null,error:null})
    ]);
    for (const r of [eventoRes,dropRes,ticketRes]) if (r.error) throw r.error;
    const evento=eventoRes.data, drop=dropRes.data;
    const ticket=evento && drop && mismo(drop.rifa_id,p.rifa_id) ? ticketRes.data : null;
    const numero=Number.isSafeInteger(ticket?.numero_ticket) && ticket.numero_ticket>=0 ? ticket.numero_ticket : null;
    if (visual==="VÁLIDA" && numero===null) return responderError("No se pudo confirmar el número de participación. Contacta con soporte.",409);
    const pad=evento?.formato==="3digitos"?3:4;
    return NextResponse.json({ok:true,participacion:{codigo:p.codigo_unico,estado:p.estado,estado_visual:visual,fecha_iso:p.created_at,evento:evento?.nombre || "Evento",rifa:{id:evento?.id || null,nombre:evento?.nombre || "Evento",formato:evento?.formato || "4digitos"},free_drop:drop?.nombre || `FREE DROP #${drop?.numero_drop || ""}`,free_drop_numero:drop?.numero_drop ?? null,free_drop_id:drop?.id || null,numero_participacion:numero,numero_participacion_formateado:numero===null?null:`#${String(numero).padStart(pad,"0")}`}},{headers:HEADERS});
  } catch(error) {
    console.error("Error verificando código FREE:",error);
    return responderError("Error inesperado al verificar el código FREE",500);
  }
}
