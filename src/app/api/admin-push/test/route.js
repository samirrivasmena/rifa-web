import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { enviarPushAdmins } from "@/lib/adminPush";

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
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/* =========================================================
   POST
   ENVIAR NOTIFICACIÓN PUSH DE PRUEBA

   SOLO ADMIN AUTENTICADO
========================================================= */

export async function POST(req) {
  try {
    /* -----------------------------------------------------
       SEGURIDAD ADMIN
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       ENVIAR PUSH
    ----------------------------------------------------- */

const resultado = await enviarPushAdmins({
  title: "🔔 Sistema de notificaciones activo",
  body: "Las alertas del panel administrativo están funcionando correctamente.",
  url: "/admin",
  tag: `admin-push-test-${Date.now()}`,
});

    /* -----------------------------------------------------
       RESPUESTA
    ----------------------------------------------------- */

    if (!resultado?.ok) {
      return json(
        {
          ok: false,
          error:
            resultado?.error ||
            "No se pudo enviar la notificación",
          resultado,
        },
        500
      );
    }

    return json({
      ok: true,
      message:
        "Notificación de prueba procesada.",
      resultado,
    });
  } catch (error) {
    console.error(
      "Error en prueba Admin Push:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "Error enviando notificación de prueba",
      },
      500
    );
  }
}