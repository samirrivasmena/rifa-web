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

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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

const HOSTNAMES_PERMITIDOS = new Set([
  "sorteoslsd.com",
  "www.sorteoslsd.com",
  "localhost",
  "192.168.1.154",
]);

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
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

/* =========================================================
   OBTENER IP DEL CLIENTE
========================================================= */

function obtenerIp(req) {
  const forwardedFor =
    req.headers.get("x-forwarded-for") || "";

  const primeraIp = forwardedFor
    .split(",")[0]
    ?.trim();

  if (primeraIp) {
    return primeraIp.slice(0, 200);
  }

  const realIp =
    req.headers.get("x-real-ip") || "";

  if (realIp.trim()) {
    return realIp.trim().slice(0, 200);
  }

  return "";
}

/* =========================================================
   VERIFICAR TURNSTILE
========================================================= */

async function verificarTurnstile(req, token) {
  const secretKey = String(
    process.env.TURNSTILE_SECRET_KEY || ""
  ).trim();

  if (!secretKey) {
    console.error(
      "SEGURIDAD: TURNSTILE_SECRET_KEY no está configurada"
    );

    return {
      ok: false,
      status: 500,
      error: "Configuración de seguridad incompleta.",
    };
  }

  const tokenLimpio =
    String(token || "").trim();

  if (!tokenLimpio) {
    return {
      ok: false,
      status: 400,
      error: "Completa la verificación de seguridad.",
    };
  }

  if (tokenLimpio.length > 4096) {
    return {
      ok: false,
      status: 400,
      error: "Verificación de seguridad inválida.",
    };
  }

  const formData =
    new URLSearchParams();

  formData.append(
    "secret",
    secretKey
  );

  formData.append(
    "response",
    tokenLimpio
  );

  const clientIp =
    obtenerIp(req);

  if (clientIp) {
    formData.append(
      "remoteip",
      clientIp
    );
  }

  let cloudflareResponse;

  try {
    cloudflareResponse =
      await fetch(
        TURNSTILE_VERIFY_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            formData.toString(),

          cache: "no-store",
        }
      );
  } catch (error) {
    console.error(
      "Error conectando con Turnstile:",
      error
    );

    return {
      ok: false,
      status: 503,
      error:
        "No se pudo completar la verificación de seguridad.",
    };
  }

  if (!cloudflareResponse.ok) {
    console.error(
      "Turnstile respondió con HTTP:",
      cloudflareResponse.status
    );

    return {
      ok: false,
      status: 503,
      error:
        "No se pudo completar la verificación de seguridad.",
    };
  }

  let resultado;

  try {
    resultado =
      await cloudflareResponse.json();
  } catch {
    return {
      ok: false,
      status: 503,
      error:
        "Respuesta de seguridad inválida.",
    };
  }

  if (!resultado?.success) {
    console.warn(
      "Turnstile rechazó una verificación:",
      resultado?.["error-codes"] || []
    );

    return {
      ok: false,
      status: 403,
      error:
        "No se pudo verificar que eres una persona real.",
    };
  }

  const hostname =
    String(
      resultado?.hostname || ""
    )
      .trim()
      .toLowerCase();

  if (
    !hostname ||
    !HOSTNAMES_PERMITIDOS.has(hostname)
  ) {
    console.warn(
      "Turnstile hostname rechazado:",
      hostname || "(vacío)"
    );

    return {
      ok: false,
      status: 403,
      error:
        "Origen de verificación no autorizado.",
    };
  }

  return {
    ok: true,
  };
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

  const mimeType =
    String(file.type || "")
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
    extension:
      EXTENSIONES_POR_MIME[mimeType],
  };
}

/* =========================================================
   FIRMA REAL DEL ARCHIVO
========================================================= */

function validarFirmaArchivo(buffer, mimeType) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
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
    if (buffer.length < 8) {
      return false;
    }

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
      (byte, index) =>
        buffer[index] === byte
    );
  }

  // WEBP: RIFF....WEBP
  if (mimeType === "image/webp") {
    if (buffer.length < 12) {
      return false;
    }

    return (
      buffer.toString(
        "ascii",
        0,
        4
      ) === "RIFF" &&
      buffer.toString(
        "ascii",
        8,
        12
      ) === "WEBP"
    );
  }

  // PDF: %PDF-
  if (mimeType === "application/pdf") {
    if (buffer.length < 5) {
      return false;
    }

    return (
      buffer.toString(
        "ascii",
        0,
        5
      ) === "%PDF-"
    );
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
      formData =
        await req.formData();
    } catch {
      return errorResponse(
        "No se pudo leer el comprobante.",
        400
      );
    }

    const file =
      formData.get("comprobante");

    const turnstileToken =
      String(
        formData.get("turnstileToken") || ""
      ).trim();

    /* -----------------------------------------------------
       TURNSTILE

       Lo comprobamos ANTES de convertir y subir el archivo.
    ----------------------------------------------------- */

    const seguridad =
      await verificarTurnstile(
        req,
        turnstileToken
      );

    if (!seguridad.ok) {
      return errorResponse(
        seguridad.error,
        seguridad.status
      );
    }

    /* -----------------------------------------------------
       VALIDACIÓN INICIAL DEL ARCHIVO
    ----------------------------------------------------- */

    const validacion =
      validarArchivo(file);

    if (!validacion.ok) {
      return errorResponse(
        validacion.error,
        400
      );
    }

    /* -----------------------------------------------------
       CONVERTIR A BUFFER
    ----------------------------------------------------- */

    let buffer;

    try {
      const arrayBuffer =
        await file.arrayBuffer();

      buffer =
        Buffer.from(arrayBuffer);
    } catch {
      return errorResponse(
        "No se pudo procesar el comprobante.",
        400
      );
    }

    /*
     * Segunda comprobación de tamaño.
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

    const firmaValida =
      validarFirmaArchivo(
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
    ----------------------------------------------------- */

    const fecha =
      new Date();

    const year =
      String(
        fecha.getUTCFullYear()
      );

    const month =
      String(
        fecha.getUTCMonth() + 1
      ).padStart(2, "0");

    const nombreSeguro =
      `${randomUUID()}.${validacion.extension}`;

    rutaSubida =
      `${year}/${month}/${nombreSeguro}`;

    /* -----------------------------------------------------
       SUBIR CON SERVICE ROLE
    ----------------------------------------------------- */

    const {
      data: uploadData,
      error: uploadError,
    } =
      await supabaseAdmin.storage
        .from(
          BUCKET_COMPROBANTES
        )
        .upload(
          rutaSubida,
          buffer,
          {
            contentType:
              validacion.mimeType,

            cacheControl: "3600",

            upsert: false,
          }
        );

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
      uploadData?.path ||
      rutaSubida;

    /* -----------------------------------------------------
       RESPUESTA

       No devolvemos una URL pública.
    ----------------------------------------------------- */

    return NextResponse.json(
      {
        ok: true,
        comprobantePath: path,
      },
      {
        status: 201,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
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
          .from(
            BUCKET_COMPROBANTES
          )
          .remove([
            rutaSubida,
          ]);
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