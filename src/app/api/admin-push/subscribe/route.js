import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   RESPUESTA SIN CACHÉ
========================================================= */

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/* =========================================================
   VALIDACIONES
========================================================= */

function textoSeguro(valor, max = 500) {
  return String(valor || "")
    .trim()
    .slice(0, max);
}

function endpointValido(endpoint) {
  try {
    const url = new URL(endpoint);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/* =========================================================
   POST
   Registra o actualiza este dispositivo del administrador.
========================================================= */

export async function POST(req) {
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

    const subscription = body?.subscription;

    const endpoint = textoSeguro(
      subscription?.endpoint,
      4000
    );

    const p256dh = textoSeguro(
      subscription?.keys?.p256dh,
      1000
    );

    const auth = textoSeguro(
      subscription?.keys?.auth,
      1000
    );

    // -------------------------------------------------------
    // VALIDACIÓN DE LA SUSCRIPCIÓN
    // -------------------------------------------------------

    if (
      !endpoint ||
      !p256dh ||
      !auth ||
      !endpointValido(endpoint)
    ) {
      return json(
        {
          ok: false,
          error: "Suscripción push inválida",
        },
        400
      );
    }

    // -------------------------------------------------------
    // USER AGENT
    // -------------------------------------------------------

    const userAgent = textoSeguro(
      req.headers.get("user-agent"),
      1000
    );

    const ahora = new Date().toISOString();

    // -------------------------------------------------------
    // UPSERT
    //
    // endpoint tiene UNIQUE en Supabase.
    // Si este teléfono ya estaba registrado, simplemente
    // actualizamos sus datos en lugar de duplicarlo.
    // -------------------------------------------------------

    const { data, error } = await supabaseAdmin
      .from("admin_push_subscriptions")
      .upsert(
        {
          admin_user_id: admin.user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent || null,
          updated_at: ahora,
        },
        {
          onConflict: "endpoint",
        }
      )
      .select("id, created_at, updated_at")
      .single();

    if (error) {
      console.error(
        "Error guardando suscripción push:",
        error
      );

      return json(
        {
          ok: false,
          error:
            "No se pudo registrar este dispositivo para notificaciones",
        },
        500
      );
    }

    return json({
      ok: true,
      message:
        "Dispositivo registrado correctamente",
      subscription: {
        id: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  } catch (error) {
    console.error(
      "admin push subscribe error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "No se pudo configurar las notificaciones",
      },
      500
    );
  }
}