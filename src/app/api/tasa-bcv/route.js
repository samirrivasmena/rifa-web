import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCV_API = "https://bcv.today/api/v1/rate.json";

export async function GET() {
  try {
    const response = await fetch(BCV_API, {
      headers: {
        Accept: "application/json",
      },

      // Actualizamos como máximo cada 30 minutos.
      next: {
        revalidate: 1800,
      },
    });

    if (!response.ok) {
      throw new Error(`BCV respondió ${response.status}`);
    }

    const data = await response.json();

    const tasa = Number(data?.USD);

    if (
      !Number.isFinite(tasa) ||
      tasa <= 0 ||
      tasa > 1000000
    ) {
      throw new Error("Tasa BCV inválida");
    }

    return NextResponse.json(
      {
        ok: true,
        moneda: "USD",
        monedaDestino: "VES",
        tasa,
        fecha: data?.effective_date || data?.date || null,
        fuente: "BCV",
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Error obteniendo tasa BCV:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo obtener la tasa BCV.",
      },
      { status: 503 }
    );
  }
}