import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const BUCKET_COMPROBANTES = "comprobantes";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TYPES_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const EXTENSIONES_POR_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/* =========================================================
   RESPUESTAS
========================================================= */

function errorResponse(mensaje, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: mensaje,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/* =========================================================
   VALIDAR ARCHIVO
========================================================= */

function validarArchivo(file) {
  if (!file) {
    return {
      ok: false,
      error: "Debes seleccionar un comprobante.",
    };
  }

  if (
    typeof file.arrayBuffer !== "function" ||
    typeof file.size !== "number"
  ) {
    return {
      ok: false,
      error: "El comprobante recibido no es válido.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: "El comprobante está vacío.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: "El comprobante no puede superar los 5 MB.",
    };
  }

  const mimeType = String(file.type || "")
    .trim()
    .toLowerCase();

  if (!MIME_TYPES_PERMITIDOS.has(mimeType)) {
    return {
      ok: false,
      error:
        "Formato no permitido. Usa JPG, PNG, WEBP o PDF.",
    };
  }

  return {
    ok: true,
    mimeType,
    extension: EXTENSIONES_POR_MIME[mimeType],
  };
}

/* =========================================================
   FIRMA REAL DEL ARCHIVO

   No confiamos únicamente en file.type.
========================================================= */

function validarFirmaArchivo(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === "image/png") {
    if (buffer.length < 8) return false;

    const firmaPng = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ];

    return firmaPng.every(
      (byte, index) => buffer[index] === byte
    );
  }

  // WEBP: RIFF....WEBP
  if (mimeType === "image/webp") {
    if (buffer.length < 12) return false;

    return (
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  // PDF: %PDF-
  if (mimeType === "application/pdf") {
    if (buffer.length < 5) return false;

    return buffer.toString("ascii", 0, 5) === "%PDF-";
  }

  return false;
}

/* =========================================================
   POST
========================================================= */

export async function POST(req) {
  let rutaSubida = null;

  try {
    /* -----------------------------------------------------
       CONTENT-TYPE
    ----------------------------------------------------- */

    const contentType =
      req.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("multipart/form-data")
    ) {
      return errorResponse(
        "La solicitud debe contener un archivo.",
        415
      );
    }

    /* -----------------------------------------------------
       FORM DATA
    ----------------------------------------------------- */

    let formData;

    try {
      formData = await req.formData();
    } catch {
      return errorResponse(
        "No se pudo leer el comprobante.",
        400
      );
    }

    const file = formData.get("comprobante");

    /* -----------------------------------------------------
       VALIDACIÓN INICIAL
    ----------------------------------------------------- */

    const validacion = validarArchivo(file);

    if (!validacion.ok) {
      return errorResponse(validacion.error, 400);
    }

    /* -----------------------------------------------------
       CONVERTIR A BUFFER
    ----------------------------------------------------- */

    let buffer;

    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch {
      return errorResponse(
        "No se pudo procesar el comprobante.",
        400
      );
    }

    /*
     * Segunda comprobación de tamaño.
     * No dependemos únicamente de file.size.
     */
    if (
      buffer.length <= 0 ||
      buffer.length > MAX_FILE_SIZE
    ) {
      return errorResponse(
        "El tamaño del comprobante no es válido.",
        400
      );
    }

    /* -----------------------------------------------------
       VALIDAR CONTENIDO REAL
    ----------------------------------------------------- */

    const firmaValida = validarFirmaArchivo(
      buffer,
      validacion.mimeType
    );

    if (!firmaValida) {
      return errorResponse(
        "El contenido del archivo no coincide con un formato permitido.",
        400
      );
    }

    /* -----------------------------------------------------
       NOMBRE SEGURO

       No utilizamos el nombre original del usuario.
    ----------------------------------------------------- */

    const fecha = new Date();

    const year = String(
      fecha.getUTCFullYear()
    );

    const month = String(
      fecha.getUTCMonth() + 1
    ).padStart(2, "0");

    const nombreSeguro =
      `${randomUUID()}.${validacion.extension}`;

    rutaSubida =
      `${year}/${month}/${nombreSeguro}`;

    /* -----------------------------------------------------
       SUBIR CON SERVICE ROLE

       El navegador NO necesita permiso INSERT
       sobre storage.objects.
    ----------------------------------------------------- */

    const {
      data: uploadData,
      error: uploadError,
    } = await supabaseAdmin.storage
      .from(BUCKET_COMPROBANTES)
      .upload(rutaSubida, buffer, {
        contentType: validacion.mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "Error subiendo comprobante:",
        uploadError
      );

      rutaSubida = null;

      return errorResponse(
        "No se pudo guardar el comprobante.",
        500
      );
    }

    const path =
      uploadData?.path || rutaSubida;

    /* -----------------------------------------------------
       RESPUESTA

       IMPORTANTE:
       No devolvemos getPublicUrl().

       Devolvemos únicamente la referencia interna
       del objeto en Storage.
    ----------------------------------------------------- */

    return NextResponse.json(
      {
        ok: true,
        comprobantePath: path,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "subir-comprobante error:",
      error
    );

    /*
     * Si ocurrió un error inesperado DESPUÉS de subir,
     * intentamos limpiar el archivo huérfano.
     */
    if (rutaSubida) {
      try {
        await supabaseAdmin.storage
          .from(BUCKET_COMPROBANTES)
          .remove([rutaSubida]);
      } catch (cleanupError) {
        console.error(
          "No se pudo limpiar comprobante huérfano:",
          cleanupError
        );
      }
    }

    return errorResponse(
      "No se pudo procesar el comprobante.",
      500
    );
  }
}

/* =========================================================
   MÉTODOS NO PERMITIDOS
========================================================= */

export async function GET() {
  return errorResponse(
    "Método no permitido.",
    405
  );
}

export async function PUT() {
  return errorResponse(
    "Método no permitido.",
    405
  );
}

export async function PATCH() {
  return errorResponse(
    "Método no permitido.",
    405
  );
}

export async function DELETE() {
  return errorResponse(
    "Método no permitido.",
    405
  );
}