/* =========================================================
   DELETE
   Desactiva las notificaciones Push de este dispositivo.
========================================================= */

export async function DELETE(req) {
  try {
    // -------------------------------------------------------
    // AUTENTICACIÓN ADMIN
    // -------------------------------------------------------

    const admin = await requireAdmin(req);

    if (!admin.ok) {
      return json(
        {
          ok: false,
          error: admin.error || "No autorizado",
        },
        admin.status || 401
      );
    }

    // -------------------------------------------------------
    // BODY
    // -------------------------------------------------------

    let body;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          ok: false,
          error: "Solicitud inválida",
        },
        400
      );
    }

    const endpoint = textoSeguro(
      body?.endpoint,
      4000
    );

    if (!endpoint || !endpointValido(endpoint)) {
      return json(
        {
          ok: false,
          error: "Endpoint push inválido",
        },
        400
      );
    }

    // -------------------------------------------------------
    // ELIMINAR ÚNICAMENTE ESTE DISPOSITIVO
    // -------------------------------------------------------

    const { error } = await supabaseAdmin
      .from("admin_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("admin_user_id", admin.user.id);

    if (error) {
      console.error(
        "Error desactivando suscripción push:",
        error
      );

      return json(
        {
          ok: false,
          error:
            "No se pudieron desactivar las notificaciones de este dispositivo",
        },
        500
      );
    }

    return json({
      ok: true,
      message:
        "Notificaciones desactivadas en este dispositivo",
    });
  } catch (error) {
    console.error(
      "admin push unsubscribe error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "No se pudieron desactivar las notificaciones",
      },
      500
    );
  }
}