import { supabaseAdmin } from "./supabaseAdmin";

export async function requireAdmin(req) {
  try {
    const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    // Si ADMIN_EMAIL no está configurado en el servidor,
    // bloqueamos el acceso en vez de usar un correo de respaldo.
    if (!ADMIN_EMAIL) {
      console.error(
        "SEGURIDAD: falta configurar ADMIN_EMAIL en las variables de entorno"
      );

      return {
        ok: false,
        status: 500,
        error: "Configuración de administrador incompleta",
      };
    }

    // Obtener Authorization: Bearer <token>
    const authHeader = req.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return {
        ok: false,
        status: 401,
        error: "No autorizado",
      };
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return {
        ok: false,
        status: 401,
        error: "No autorizado",
      };
    }

    // Supabase verifica el token en el servidor y devuelve
    // el usuario real asociado a esa sesión.
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return {
        ok: false,
        status: 401,
        error: "Sesión inválida o expirada",
      };
    }

    const userEmail = String(user.email || "")
      .trim()
      .toLowerCase();

    // Tener una cuenta válida de Supabase NO es suficiente.
    // También debe coincidir con el administrador configurado.
    if (!userEmail || userEmail !== ADMIN_EMAIL) {
      return {
        ok: false,
        status: 403,
        error: "Acceso denegado",
      };
    }

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  } catch (error) {
    console.error("requireAdmin error:", error);

    return {
      ok: false,
      status: 500,
      error: "Error interno de autenticación",
    };
  }
}