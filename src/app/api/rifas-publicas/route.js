
import { NextResponse } from "next/server";
import { obtenerRifasPublicas } from "@/lib/rifas/obtenerRifasPublicas";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   CONFIGURACIÓN DE CACHÉ
========================================================= */

const CACHE_DURATION_MS = 15 * 1000;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store",
};

let cachedRifas = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

/* =========================================================
   OBTENER RIFAS CON CACHÉ TEMPORAL
========================================================= */

async function obtenerRifasConCache() {
  const ahora = Date.now();

  if (cachedRifas !== null && ahora < cacheExpiresAt) {
    return cachedRifas;
  }

  // Evita repetir consultas simultáneas en el mismo proceso.
  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = (async () => {
    const rifas = await obtenerRifasPublicas();

    cachedRifas = rifas;
    cacheExpiresAt = Date.now() + CACHE_DURATION_MS;

    return rifas;
  })();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}

/* =========================================================
   GET — RIFAS PÚBLICAS
========================================================= */

export async function GET() {
  try {
    const rifas = await obtenerRifasConCache();

    return NextResponse.json(
      {
        ok: true,
        rifas,
      },
      {
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error("rifas-publicas error:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
      },
      {
        status: 500,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}
