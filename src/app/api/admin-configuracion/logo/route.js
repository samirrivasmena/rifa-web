import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respuestaSinCache(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function respuestaNoAutorizada(auth) {
  return respuestaSinCache(
    {
      ok: false,
      error: auth.error || "No autorizado",
    },
    auth.status || 401
  );
}

export async function POST(request) {
  try {
    // =========================================================
    // 1. AUTORIZACIÓN ADMIN
    // =========================================================

    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return respuestaNoAutorizada(auth);
    }

    // =========================================================
    // 2. FORM DATA
    // =========================================================

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return respuestaSinCache(
        {
          ok: false,
          error: "Archivo inválido.",
        },
        400
      );
    }

    // =========================================================
    // 3. VALIDAR TIPO
    // =========================================================

    const tiposPermitidos = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!tiposPermitidos.includes(file.type)) {
      return respuestaSinCache(
        {
          ok: false,
          error: "Solo se permiten PNG, JPG o WEBP.",
        },
        400
      );
    }

    // =========================================================
    // 4. VALIDAR TAMAÑO
    // =========================================================

    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return respuestaSinCache(
        {
          ok: false,
          error: "El logo no puede superar 5 MB.",
        },
        400
      );
    }

    // =========================================================
    // 5. EXTENSIÓN CONTROLADA POR MIME
    //
    // No confiamos en la extensión enviada por el navegador.
    // =========================================================

    const extensiones = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };

    const extension = extensiones[file.type];

    const nombreArchivo =
      `logo-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    // =========================================================
    // 6. SUBIR A STORAGE
    // =========================================================

    const { error: errorUpload } =
      await supabaseAdmin.storage
        .from("logos")
        .upload(nombreArchivo, file, {
          contentType: file.type,
          upsert: false,
        });

    if (errorUpload) {
      console.error(
        "Error subiendo logo a Storage:",
        errorUpload
      );

      return respuestaSinCache(
        {
          ok: false,
          error: "No se pudo subir el logo.",
        },
        500
      );
    }

    // =========================================================
    // 7. URL PÚBLICA
    // =========================================================

    const { data: urlData } =
      supabaseAdmin.storage
        .from("logos")
        .getPublicUrl(nombreArchivo);

    const logoUrl =
      String(urlData?.publicUrl || "").trim();

    if (!logoUrl) {
      console.error(
        "No se pudo obtener la URL pública del logo:",
        nombreArchivo
      );

      return respuestaSinCache(
        {
          ok: false,
          error: "No se pudo generar la URL del logo.",
        },
        500
      );
    }

    // =========================================================
    // 8. CONFIGURACIÓN ACTUAL
    // =========================================================

    const {
      data: actual,
      error: errorActual,
    } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (errorActual) {
      console.error(
        "Error buscando configuración del sitio:",
        errorActual
      );

      return respuestaSinCache(
        {
          ok: false,
          error:
            "No se pudo actualizar la configuración del sitio.",
        },
        500
      );
    }

    const payload = {
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    };

    // =========================================================
    // 9. ACTUALIZAR / CREAR CONFIGURACIÓN
    // =========================================================

    let data;
    let error;

    if (actual?.id) {
      const resultado =
        await supabaseAdmin
          .from("configuracion_sitio")
          .update(payload)
          .eq("id", actual.id)
          .select("id, logo_url, updated_at")
          .single();

      data = resultado.data;
      error = resultado.error;
    } else {
      const resultado =
        await supabaseAdmin
          .from("configuracion_sitio")
          .insert(payload)
          .select("id, logo_url, updated_at")
          .single();

      data = resultado.data;
      error = resultado.error;
    }

    if (error) {
      console.error(
        "Error guardando logo en configuracion_sitio:",
        error
      );

      return respuestaSinCache(
        {
          ok: false,
          error:
            "No se pudo guardar el logo en la configuración.",
        },
        500
      );
    }

    // =========================================================
    // 10. RESPUESTA
    // =========================================================

    return respuestaSinCache({
      ok: true,
      configuracion: data,
    });
  } catch (error) {
    console.error(
      "Error en POST /api/admin-configuracion/logo:",
      error
    );

    return respuestaSinCache(
      {
        ok: false,
        error: "Error inesperado al subir el logo.",
      },
      500
    );
  }
}