import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
   POST — RUTA ANTIGUA DESHABILITADA
========================================================= */

export async function POST() {
  /*
   * IMPORTANTE:
   *
   * Esta ruta antigua permitía consultar tickets
   * utilizando únicamente:
   *
   * - email
   * - rifaId
   *
   * Eso podía permitir que una persona consultara
   * información de tickets pertenecientes a otro usuario
   * si conocía su correo electrónico.
   *
   * El flujo seguro actual es:
   *
   * 1. /api/mis-tickets/solicitar-codigo
   * 2. Código de 6 dígitos enviado al correo
   * 3. /api/mis-tickets
   * 4. Verificación OTP
   * 5. Mostrar tickets
   *
   * Por seguridad esta ruta queda deshabilitada.
   */

  return NextResponse.json(
    {
      ok: false,
      error:
        "Esta ruta ya no está disponible. Utiliza la verificación segura de Mis Tickets.",
      code: "ENDPOINT_DEPRECATED",
    },
    {
      status: 410,
      headers: NO_CACHE_HEADERS,
    }
  );
}

/* =========================================================
   OTROS MÉTODOS
========================================================= */

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método no disponible",
    },
    {
      status: 405,
      headers: {
        ...NO_CACHE_HEADERS,
        Allow: "POST",
      },
    }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método no disponible",
    },
    {
      status: 405,
      headers: {
        ...NO_CACHE_HEADERS,
        Allow: "POST",
      },
    }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método no disponible",
    },
    {
      status: 405,
      headers: {
        ...NO_CACHE_HEADERS,
        Allow: "POST",
      },
    }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método no disponible",
    },
    {
      status: 405,
      headers: {
        ...NO_CACHE_HEADERS,
        Allow: "POST",
      },
    }
  );
}