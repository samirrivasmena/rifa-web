
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    { error: mensaje },
    { status }
  );
}

/* =========================================================
   POST — SUBIR IMAGEN OPTIMIZADA
========================================================= */

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    let formData;

    try {
      formData = await req.formData();
    } catch {
      return errorResponse(
        "No se pudo procesar el archivo",
        400
      );
    }

    const file = formData.get("file");

    if (
      !file ||
      typeof file.arrayBuffer !== "function"
    ) {
      return errorResponse(
        "No se recibió ningún archivo"
      );
    }

    if (
      !Number.isFinite(file.size) ||
      file.size <= 0
    ) {
      return errorResponse("El archivo está vacío");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        "La imagen no puede superar los 10 MB",
        413
      );
    }

    const contentType = String(
      file.type || ""
    ).trim().toLowerCase();

    if (!TIPOS_PERMITIDOS.includes(contentType)) {
      return errorResponse(
        "Formato no permitido. Usa JPG, PNG o WEBP."
      );
    }

    let buffer;

    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return errorResponse(
        "No se pudo leer la imagen"
      );
    }

    if (
      buffer.length === 0 ||
      buffer.length > MAX_FILE_SIZE
    ) {
      return errorResponse(
        "Tamaño de imagen no permitido",
        413
      );
    }

    /* =====================================================
       VALIDAR EL CONTENIDO REAL DE LA IMAGEN
    ===================================================== */

    let metadata;

    try {
      metadata = await sharp(buffer, {
        limitInputPixels: 40000000,
        failOn: "error",
      }).metadata();
    } catch {
      return errorResponse(
        "La imagen está dañada o no es válida"
      );
    }

    const formatos = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    if (formatos[metadata.format] !== contentType) {
      return errorResponse(
        "El contenido no coincide con el formato de imagen"
      );
    }

    /* =====================================================
       OPTIMIZAR IMAGEN
    ===================================================== */

    let imagenOptimizada;

    try {
      imagenOptimizada = await sharp(buffer, {
        limitInputPixels: 40000000,
        failOn: "error",
      })
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: WEBP_QUALITY,
          effort: 5,
        })
        .toBuffer();
    } catch (error) {
      console.error(
        "Error optimizando portada:",
        error
      );

      return errorResponse(
        "No se pudo optimizar la imagen",
        400
      );
    }

    if (!imagenOptimizada.length) {
      return errorResponse(
        "La imagen optimizada está vacía"
      );
    }

    /* =====================================================
       NOMBRE ÚNICO PARA CACHÉ SEGURA
    ===================================================== */

    const nombreArchivo =
      `portadas/${Date.now()}-${randomUUID()}.webp`;

    /* =====================================================
       SUBIR A SUPABASE STORAGE
    ===================================================== */

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("rifas")
        .upload(nombreArchivo, imagenOptimizada, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Error subiendo imagen de rifa:",
        uploadError
      );

      return errorResponse(
        "No se pudo subir la imagen",
        500
      );
    }

    /* =====================================================
       OBTENER URL PÚBLICA
    ===================================================== */

    const { data } = supabaseAdmin.storage
      .from("rifas")
      .getPublicUrl(nombreArchivo);

    const publicUrl = String(
      data?.publicUrl || ""
    ).trim();

    if (!publicUrl) {
      const { error: removeError } =
        await supabaseAdmin.storage
          .from("rifas")
          .remove([nombreArchivo]);

      if (removeError) {
        console.error(
          "No se pudo limpiar la imagen:",
          removeError
        );
      }

      return errorResponse(
        "No se pudo obtener la URL de la imagen",
        500
      );
    }

    /* =====================================================
       RESPUESTA COMPATIBLE CON TU ADMIN
    ===================================================== */

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path: nombreArchivo,
    });
  } catch (error) {
    console.error(
      "subir-imagen-rifa error:",
      error
    );

    return errorResponse(
      "Error interno del servidor",
      500
    );
  }
}
