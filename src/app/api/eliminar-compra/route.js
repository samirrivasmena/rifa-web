import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function errorResponse(error, status = 400) {
  return NextResponse.json({ error }, { status });
}
export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return errorResponse(auth.error, auth.status);
    let body;
    try { body = await req.json(); } catch { return errorResponse("Cuerpo de la solicitud inválido"); }
    const compraId = String(body?.compraId ?? "").trim();
    if (!UUID.test(compraId)) return errorResponse("ID de compra inválido");
    const { data, error } = await supabaseAdmin.rpc("eliminar_compra_rechazada_segura", { p_compra_id: compraId });
    if (error) {
      console.error("Error eliminando compra:", error.code);
      return errorResponse("No se pudo eliminar la compra", 500);
    }
    if (data === "NO_EXISTE") return errorResponse("La compra no existe", 404);
    if (data === "ESTADO_INVALIDO") return errorResponse("Solo se pueden eliminar compras rechazadas");
    if (data === "TIENE_TICKETS") return errorResponse("La compra todavía tiene tickets asociados. Requiere revisión administrativa.", 409);
    if (data !== "OK") return errorResponse("No se pudo confirmar la eliminación", 500);
    return NextResponse.json({ ok: true, message: "Compra rechazada eliminada correctamente", compra: { id: compraId, estado_pago: "eliminada" } });
  } catch (error) {
    console.error("eliminar-compra error:", error?.name);
    return errorResponse("No se pudo procesar la eliminación de la compra", 500);
  }
}
