import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function respuestaSinCache(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return respuestaSinCache(
        { ok: false, error: "Archivo inválido." },
        400
      );
    }

    const tiposPermitidos = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!tiposPermitidos.includes(file.type)) {
      return respuestaSinCache(
        { ok: false, error: "Solo se permiten PNG, JPG o WEBP." },
        400
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return respuestaSinCache(
        { ok: false, error: "El logo no puede superar 5 MB." },
        400
      );
    }

    const extension =
      file.name?.split(".").pop()?.toLowerCase() || "png";

    const nombreArchivo = `logo-${Date.now()}.${extension}`;

    const { error: errorUpload } = await supabaseAdmin.storage
      .from("logos")
      .upload(nombreArchivo, file, {
        contentType: file.type,
        upsert: true,
      });

    if (errorUpload) {
      return respuestaSinCache(
        { ok: false, error: errorUpload.message },
        500
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("logos")
      .getPublicUrl(nombreArchivo);

    const logoUrl = urlData?.publicUrl || "";

    if (!logoUrl) {
      return respuestaSinCache(
        { ok: false, error: "No se pudo generar la URL del logo." },
        500
      );
    }

    const { data: actual, error: errorActual } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (errorActual) {
      return respuestaSinCache(
        { ok: false, error: errorActual.message },
        500
      );
    }

    const payload = {
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    };

    let data;
    let error;

    if (actual?.id) {
      const resultado = await supabaseAdmin
        .from("configuracion_sitio")
        .update(payload)
        .eq("id", actual.id)
        .select("*")
        .single();

      data = resultado.data;
      error = resultado.error;
    } else {
      const resultado = await supabaseAdmin
        .from("configuracion_sitio")
        .insert(payload)
        .select("*")
        .single();

      data = resultado.data;
      error = resultado.error;
    }

    if (error) {
      return respuestaSinCache(
        { ok: false, error: error.message },
        500
      );
    }

    return respuestaSinCache({
      ok: true,
      configuracion: data,
    });
  } catch (error) {
    console.error("Error subiendo logo:", error);
    return respuestaSinCache(
      {
        ok: false,
        error: error?.message || "Error subiendo logo.",
      },
      500
    );
  }
}