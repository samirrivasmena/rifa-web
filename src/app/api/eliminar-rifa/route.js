import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();
    const rifaId = String(body?.rifaId || body?.rifa_id || "").trim();

    if (!rifaId) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    /*
     * La eliminación completa se realiza dentro de PostgreSQL
     * mediante una sola función transaccional.
     *
     * La función:
     * - bloquea rifas con historial protegido;
     * - permite eliminar inventario DISPONIBLE precreado;
     * - permite eliminar compras RECHAZADAS descartables;
     * - protege participaciones FREE;
     * - protege auditoría FREE;
     * - protege sorteos/resultados;
     * - protege tickets realmente utilizados.
     */
    const { data, error } = await supabaseAdmin.rpc(
      "admin_delete_empty_rifa",
      {
        p_rifa_id: rifaId,
      }
    );

    if (error) {
      console.error("admin_delete_empty_rifa RPC error:", error);

      return NextResponse.json(
        {
          error:
            error.message ||
            "No se pudo eliminar la rifa",
        },
        { status: 500 }
      );
    }

    if (!data?.ok) {
      if (data?.code === "RIFA_NOT_FOUND") {
        return NextResponse.json(
          {
            error: data.message || "La rifa no existe",
            code: data.code,
          },
          { status: 404 }
        );
      }

      if (data?.code === "RIFA_HAS_HISTORY") {
        return NextResponse.json(
          {
            error:
              data.message ||
              "No se puede eliminar esta rifa porque contiene historial que debe conservarse.",
            code: data.code,
            history: data.history || null,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: data?.message || "No se pudo eliminar la rifa",
          code: data?.code || "RIFA_DELETE_FAILED",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      code: data.code || "RIFA_DELETED",
      message: data.message || "Rifa eliminada correctamente",
      deleted: data.deleted || null,
    });
  } catch (error) {
    console.error("eliminar-rifa error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}