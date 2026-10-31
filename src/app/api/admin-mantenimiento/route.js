import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respuesta(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function noAutorizado(auth) {
  return respuesta(
    {
      ok: false,
      error: auth.error || "No autorizado",
    },
    auth.status || 401
  );
}

/* =========================================================
   GET
   CONSULTAR ESTADO DE MANTENIMIENTO
   SOLO ADMIN
========================================================= */

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return noAutorizado(auth);
    }

    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("id, modo_mantenimiento")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error GET admin-mantenimiento:", error);

      return respuesta(
        {
          ok: false,
          error: "No se pudo consultar el modo mantenimiento.",
        },
        500
      );
    }

    if (!data) {
      return respuesta(
        {
          ok: false,
          error: "No existe configuración del sitio.",
        },
        404
      );
    }

    return respuesta({
      ok: true,
      modo_mantenimiento: data.modo_mantenimiento === true,
    });
  } catch (error) {
    console.error("Error GET admin-mantenimiento:", error);

    return respuesta(
      {
        ok: false,
        error: "Error interno consultando mantenimiento.",
      },
      500
    );
  }
}

/* =========================================================
   PUT
   ACTIVAR / DESACTIVAR MANTENIMIENTO
   SOLO ADMIN
========================================================= */

export async function PUT(request) {
  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return noAutorizado(auth);
    }

    const body = await request.json();

    if (typeof body?.activo !== "boolean") {
      return respuesta(
        {
          ok: false,
          error: "El campo activo debe ser true o false.",
        },
        400
      );
    }

    const { data: actual, error: errorActual } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (errorActual) {
      console.error(
        "Error buscando configuración para mantenimiento:",
        errorActual
      );

      return respuesta(
        {
          ok: false,
          error: "No se pudo consultar la configuración.",
        },
        500
      );
    }

    if (!actual?.id) {
      return respuesta(
        {
          ok: false,
          error: "No existe configuración del sitio.",
        },
        404
      );
    }

    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .update({
        modo_mantenimiento: body.activo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", actual.id)
      .select("modo_mantenimiento")
      .single();

    if (error) {
      console.error("Error PUT admin-mantenimiento:", error);

      return respuesta(
        {
          ok: false,
          error: "No se pudo cambiar el modo mantenimiento.",
        },
        500
      );
    }

    return respuesta({
      ok: true,
      modo_mantenimiento: data.modo_mantenimiento === true,
    });
  } catch (error) {
    console.error("Error PUT admin-mantenimiento:", error);

    return respuesta(
      {
        ok: false,
        error: "Error interno cambiando mantenimiento.",
      },
      500
    );
  }
}