import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/requireAdmin";
import { obtenerHistorialGanadores } from "../../../../lib/historialGanadores/obtenerHistorial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS_PRIVADOS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(req) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: admin.error || "No autorizado",
          ...(admin.requiresMfa ? { requiresMfa: true } : {}),
        },
        { status: admin.status || 401, headers: HEADERS_PRIVADOS }
      );
    }

    // Consulta directamente la lógica compartida, sin fetch a la ruta pública.
    const { datos, status } = await obtenerHistorialGanadores({ esAdministrador: true });
    return NextResponse.json(datos, { status, headers: HEADERS_PRIVADOS });
  } catch (error) {
    console.error("Error en historial administrativo:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno del historial" },
      { status: 500, headers: HEADERS_PRIVADOS }
    );
  }
}
