import { NextResponse } from "next/server";
import { obtenerConfiguracionPublica } from "@/lib/configuracion/obtenerConfiguracionPublica";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================================================
   HEADERS NO-CACHE
========================================================= */

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

/* =========================================================
   GET
========================================================= */

export async function GET() {
  try {
    const configuracion =
      await obtenerConfiguracionPublica();

    /* =======================================================
       NO EXISTE CONFIGURACIÓN
    ======================================================= */

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

    /* =======================================================
       RESPUESTA PÚBLICA
    ======================================================= */

    return NextResponse.json(
      {
        ok: true,
        configuracion,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
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