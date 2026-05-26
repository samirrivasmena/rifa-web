import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { ADMIN_EMAIL } from "../../../lib/admin/adminConstants";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const user = data?.user || null;

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Sesión inválida" },
        { status: 401 }
      );
    }

    const email = String(user.email || "").toLowerCase();
    const adminEmail = String(ADMIN_EMAIL || "").toLowerCase();

    if (email !== adminEmail) {
      return NextResponse.json(
        { ok: false, error: "Acceso denegado" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("admin-check error:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo verificar el acceso" },
      { status: 500 }
    );
  }
}