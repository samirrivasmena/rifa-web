import { supabaseAdmin } from "./supabaseAdmin";

export async function requireAdmin(req) {
  try {
    const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    // =========================================================
    // 1. COMPROBAR CONFIGURACIÓN DEL ADMIN
    // =========================================================

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

    // =========================================================
    // 2. OBTENER TOKEN BEARER
    // =========================================================

    const authHeader =
      req.headers.get("authorization") || "";

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

    // =========================================================
    // 3. VERIFICAR TOKEN CON SUPABASE
    // =========================================================

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

    // =========================================================
    // 4. COMPROBAR EMAIL DEL ADMINISTRADOR
    // =========================================================

    const userEmail = String(user.email || "")
      .trim()
      .toLowerCase();

    if (!userEmail || userEmail !== ADMIN_EMAIL) {
      return {
        ok: false,
        status: 403,
        error: "Acceso denegado",
      };
    }

    // =========================================================
    // 5. COMPROBAR MFA / AAL2
    // =========================================================
    //
    // Le pasamos explícitamente el JWT que llegó en la petición.
    // Supabase comprueba el nivel de autenticación de ESA sesión.
    //
    // aal1 = contraseña solamente
    // aal2 = contraseña + segundo factor MFA
    // =========================================================

    const {
      data: aalData,
      error: aalError,
    } =
      await supabaseAdmin.auth.mfa.getAuthenticatorAssuranceLevel(
        token
      );

    if (aalError) {
      console.error(
        "SEGURIDAD: error comprobando MFA:",
        aalError
      );

      return {
        ok: false,
        status: 401,
        error: "No se pudo verificar la seguridad MFA",
        requiresMfa: true,
      };
    }

    if (aalData?.currentLevel !== "aal2") {
      return {
        ok: false,
        status: 403,
        error: "Se requiere verificación MFA",
        requiresMfa: true,
      };
    }

    // =========================================================
    // 6. ADMIN COMPLETAMENTE VERIFICADO
    // =========================================================

    return {
      ok: true,

      user: {
        id: user.id,
        email: user.email,
      },

      aal: "aal2",
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