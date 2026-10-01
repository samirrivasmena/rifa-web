import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const auth = await requireAdmin(req);

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: auth.user.id,
          email: auth.user.email,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("admin-check error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo verificar el acceso",
      },
      {
        status: 500,
      }
    );
  }
}