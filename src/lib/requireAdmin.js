import { supabaseAdmin } from "./supabaseAdmin";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "samirrivasmena@gmail.com";

export async function requireAdmin(req) {
  try {
    // NextRequest/Next Headers: siempre usa get('authorization')
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    if (!authHeader) {
      return { ok: false, status: 401, error: "No autorizado: falta token" };
    }

    // Soporta "Bearer <token>" o "<token>" a secas
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return { ok: false, status: 401, error: "No autorizado: token inválido" };
    }

    // Verifica JWT y obtiene usuario
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      return {
        ok: false,
        status: 401,
        error: userErr?.message || "No autorizado: token inválido",
      };
    }

    const email = userData.user.email?.toLowerCase();

    if (!email || email !== ADMIN_EMAIL.toLowerCase()) {
      return { ok: false, status: 403, error: "Acceso denegado" };
    }

    return { ok: true, user: userData.user };
  } catch (error) {
    console.error("requireAdmin error:", error);
    return { ok: false, status: 500, error: error.message || "Error interno" };
  }
}