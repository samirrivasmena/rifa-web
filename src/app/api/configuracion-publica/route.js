
import { NextResponse } from "next/server";
import { obtenerConfiguracionPublica } from "@/lib/configuracion/obtenerConfiguracionPublica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN DE CACHÉ PÚBLICA

   - Permite reutilizar respuestas en cachés compartidas.
   - Reduce posibles consultas repetidas a Supabase.
   - El navegador debe revalidar la respuesta.
   - Conserva la estructura original de la API.
========================================================= */

const CACHE_PUBLICA_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
  "X-Content-Type-Options": "nosniff",
};

/* =========================================================
   RESPUESTAS DE ERROR SIN CACHÉ

   No almacenar respuestas de error.
========================================================= */

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/* =========================================================
   GET - CONFIGURACIÓN PÚBLICA
========================================================= */

export async function GET() {
  try {
    /* =====================================================
       1. OBTENER CONFIGURACIÓN DESDE LA FUNCIÓN EXISTENTE
    ===================================================== */

    const configuracion =
      await obtenerConfiguracionPublica();

    /* =====================================================
       2. CONFIGURACIÓN NO ENCONTRADA
    ===================================================== */

    if (!configuracion) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No existe configuración pública disponible",
        },
        {
          status: 404,
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    /* =====================================================
       3. RESPUESTA PÚBLICA OPTIMIZADA
    ===================================================== */

    return NextResponse.json(
      {
        ok: true,
        configuracion,
      },
      {
        status: 200,
        headers: CACHE_PUBLICA_HEADERS,
      }
    );
  } catch (error) {
    /* =====================================================
       4. MANEJO DE ERRORES
    ===================================================== */

    console.error(
      "Error general configuración pública:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Error cargando configuración pública",
      },
      {
        status: 500,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}
