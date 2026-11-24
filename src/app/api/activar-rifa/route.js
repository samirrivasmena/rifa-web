import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({error:auth.error},{status:auth.status});
    const body = await req.json().catch(()=>null);
    const rifaId = String(body?.rifaId ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rifaId)) return NextResponse.json({error:"ID de rifa inválido"},{status:400});
    const {data,error} = await supabaseAdmin.rpc("lsd_activar_rifa_segura",{p_rifa_id:rifaId});
    if (error) { console.error("activar-rifa",error); return NextResponse.json({error:error.code==="P0001"?error.message:"No se pudo activar la rifa"},{status:error.code==="P0001"?409:500}); }
    return NextResponse.json(data);
  } catch(error) { console.error(error); return NextResponse.json({error:"Error interno del servidor"},{status:500}); }
}
