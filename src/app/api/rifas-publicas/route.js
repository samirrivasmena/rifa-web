import { NextResponse } from "next/server";
import { obtenerRifasPublicas } from "@/lib/rifas/obtenerRifasPublicas";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "rifas-publicas error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error interno del servidor",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}