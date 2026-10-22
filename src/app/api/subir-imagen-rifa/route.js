import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const TIPOS_PERMITIDOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/* =========================================================
   RESPUESTA DE ERROR
========================================================= */

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    {
      error: mensaje,
    },
    {
      status,
    }
  );
}

/* =========================================================
   POST — SUBIR IMAGEN DE RIFA
========================================================= */

export async function POST(req) {
  /* -------------------------------------------------------
     SOLO ADMINISTRADOR
  ------------------------------------------------------- */

  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  try {
    /* -----------------------------------------------------
       FORM DATA
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       VALIDAR ARCHIVO
    ----------------------------------------------------- */

    if (
      !file ||
      typeof file.arrayBuffer !== "function"
    ) {
      return errorResponse(
        "No se recibió ningún archivo",
        400
      );
    }

    /* -----------------------------------------------------
       VALIDAR TAMAÑO
    ----------------------------------------------------- */

    const fileSize = Number(file.size || 0);

    if (fileSize <= 0) {
      return errorResponse(
        "El archivo está vacío",
        400
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return errorResponse(
        "La imagen no puede superar los 10 MB",
        413
      );
    }

    /* -----------------------------------------------------
       VALIDAR TIPO
    ----------------------------------------------------- */

    const contentType = String(
      file.type || ""
    )
      .trim()
      .toLowerCase();

    const extension =
      TIPOS_PERMITIDOS[contentType];

    if (!extension) {
      return errorResponse(
        "Formato no permitido. Usa JPG, PNG o WEBP.",
        400
      );
    }

    /* -----------------------------------------------------
       LEER ARCHIVO
    ----------------------------------------------------- */

    let buffer;

    try {
      const arrayBuffer =
        await file.arrayBuffer();

      buffer = Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(
        "Error leyendo imagen de rifa:",
        error
      );

      return errorResponse(
        "No se pudo leer la imagen",
        400
      );
    }

    if (!buffer.length) {
      return errorResponse(
        "El archivo está vacío",
        400
      );
    }

    /*
     * Segunda comprobación del tamaño usando
     * los bytes realmente recibidos.
     */

    if (buffer.length > MAX_FILE_SIZE) {
      return errorResponse(
        "La imagen no puede superar los 10 MB",
        413
      );
    }

    /* -----------------------------------------------------
       NOMBRE SEGURO GENERADO POR EL SERVIDOR
    ----------------------------------------------------- */

    const nombreArchivo =
      `portadas/${Date.now()}-${randomUUID()}.${extension}`;

    /* -----------------------------------------------------
       SUBIR A SUPABASE STORAGE
    ----------------------------------------------------- */

    const {
      error: uploadError,
    } = await supabaseAdmin.storage
      .from("rifas")
      .upload(
        nombreArchivo,
        buffer,
        {
          contentType,
          upsert: false,
          cacheControl: "3600",
        }
      );

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

    /* -----------------------------------------------------
       OBTENER URL PÚBLICA
    ----------------------------------------------------- */

    const {
      data,
    } = supabaseAdmin.storage
      .from("rifas")
      .getPublicUrl(nombreArchivo);

    const publicUrl =
      String(data?.publicUrl || "").trim();

    if (!publicUrl) {
      console.error(
        "La imagen se subió pero no se pudo obtener su URL pública:",
        nombreArchivo
      );

      /*
       * Intentamos eliminar el archivo para no dejar
       * un objeto huérfano en Storage.
       */

      const {
        error: removeError,
      } = await supabaseAdmin.storage
        .from("rifas")
        .remove([nombreArchivo]);

      if (removeError) {
        console.error(
          "No se pudo eliminar la imagen huérfana:",
          removeError
        );
      }

      return errorResponse(
        "No se pudo obtener la URL de la imagen",
        500
      );
    }

    /* -----------------------------------------------------
       RESPUESTA
    ----------------------------------------------------- */

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path: nombreArchivo,
    });
  } catch (error) {
    /*
     * El detalle real queda solamente
     * registrado en el servidor.
     */

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