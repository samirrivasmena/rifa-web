import { NextResponse } from "next/server";
import { obtenerRifasPublicas } from "@/lib/rifas/obtenerRifasPublicas";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   HEADERS — SIN CACHÉ
========================================================= */

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/* =========================================================
   GET — RIFAS PÚBLICAS
========================================================= */

export async function GET() {
  try {
    const rifas = await obtenerRifasPublicas();

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
    /*
     * IMPORTANTE:
     *
     * El error completo solamente se registra
     * en el servidor.
     *
     * No enviamos error.message al navegador
     * porque esta es una API pública.
     */

    console.error(
      "rifas-publicas error:",
      error
    );

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