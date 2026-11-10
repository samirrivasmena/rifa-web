import { NextResponse } from "next/server";
import { obtenerHistorialGanadores } from "../../../lib/historialGanadores/obtenerHistorial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS_PUBLICOS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=30",
  "X-Content-Type-Options": "nosniff",
};
const HEADERS_SIN_CACHE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  // Esta ruta NUNCA admite modo administrativo, incluso con Authorization.
  const { datos, status } = await obtenerHistorialGanadores({ esAdministrador: false });
  return NextResponse.json(datos, {
    status,
    headers: status === 200 ? HEADERS_PUBLICOS : HEADERS_SIN_CACHE,
  });
}
