import { supabaseAdmin } from "./supabaseAdmin";

export async function requireAdmin(req) {
  try {
    const ADMIN_USER_ID = String(
      process.env.ADMIN_USER_ID || ""
    ).trim();

    const ADMIN_EMAIL = String(
      process.env.ADMIN_EMAIL || ""
    )
      .trim()
      .toLowerCase();

    // =========================================================
    // 1. COMPROBAR CONFIGURACIÓN DEL ADMIN
    // =========================================================

    if (!ADMIN_USER_ID) {
      console.error(
        "SEGURIDAD: falta configurar ADMIN_USER_ID en las variables de entorno"
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

    const token =
      authHeader.slice(7).trim();

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
    // 4. COMPROBAR USER ID DEL ADMINISTRADOR
    // =========================================================
    //
    // El User UID es ahora la identidad principal del Admin.
    //
    // Cambiar:
    // - contraseña
    // - correo
    // - nombre
    //
    // NO cambia este UUID.
    // =========================================================

    const userId =
      String(user.id || "").trim();

    if (
      !userId ||
      userId !== ADMIN_USER_ID
    ) {
      return {
        ok: false,
        status: 403,
        error: "Acceso denegado",
      };
    }

    // =========================================================
    // 5. COMPROBACIÓN TEMPORAL DEL EMAIL
    // =========================================================
    //
    // ADMIN_EMAIL se conserva durante la migración.
    // NO bloqueamos el acceso por email porque el User UID
    // es ahora la identidad principal.
    //
    // Si el email no coincide, solo dejamos constancia
    // en el servidor.
    // =========================================================

    const userEmail =
      String(user.email || "")
        .trim()
        .toLowerCase();

    if (
      ADMIN_EMAIL &&
      userEmail &&
      userEmail !== ADMIN_EMAIL
    ) {
      console.warn(
        "SEGURIDAD: el email del administrador no coincide con ADMIN_EMAIL, pero el ADMIN_USER_ID sí es válido."
      );
    }

    // =========================================================
    // 6. COMPROBAR MFA / AAL2
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
        error:
          "No se pudo verificar la seguridad MFA",
        requiresMfa: true,
      };
    }

    if (
      aalData?.currentLevel !== "aal2"
    ) {
      return {
        ok: false,
        status: 403,
        error:
          "Se requiere verificación MFA",
        requiresMfa: true,
      };
    }

    // =========================================================
    // 7. ADMIN COMPLETAMENTE VERIFICADO
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
    console.error(
      "requireAdmin error:",
      error
    );

    return {
      ok: false,
      status: 500,
      error:
        "Error interno de autenticación",
    };
  }
}