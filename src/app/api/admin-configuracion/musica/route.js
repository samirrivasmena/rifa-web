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

function bytesCoinciden(bytes, firma) {
  if (bytes.length < firma.length) return false;

  return firma.every((byte, index) => bytes[index] === byte);
}

function esMp3Valido(bytes) {
  // MP3 con metadata ID3
  if (bytesCoinciden(bytes, [0x49, 0x44, 0x33])) {
    return true;
  }

  // MP3 que comienza directamente con MPEG frame sync.
  if (
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    (bytes[1] & 0xe0) === 0xe0
  ) {
    return true;
  }

  return false;
}

export async function POST(request) {
  let nombreArchivoSubido = null;

  try {
    // =========================================================
    // 1. AUTORIZACIÓN ADMIN
    // =========================================================

    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return respuestaNoAutorizada(auth);
    }

    // =========================================================
    // 2. LEER ARCHIVO
    // =========================================================

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return respuestaSinCache(
        {
          ok: false,
          error: "Archivo de música inválido.",
        },
        400
      );
    }

    // =========================================================
    // 3. VALIDAR MIME
    // =========================================================

    const tiposPermitidos = [
      "audio/mpeg",
      "audio/mp3",
    ];

    if (!tiposPermitidos.includes(file.type)) {
      return respuestaSinCache(
        {
          ok: false,
          error: "Solo se permiten archivos MP3.",
        },
        400
      );
    }

    // =========================================================
    // 4. VALIDAR TAMAÑO
    // =========================================================

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    if (file.size <= 0) {
      return respuestaSinCache(
        {
          ok: false,
          error: "El archivo está vacío.",
        },
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return respuestaSinCache(
        {
          ok: false,
          error: "La música no puede superar 20 MB.",
        },
        400
      );
    }

    // =========================================================
    // 5. VALIDAR CONTENIDO REAL DEL ARCHIVO
    // =========================================================

    const buffer = Buffer.from(await file.arrayBuffer());
    const primerosBytes = buffer.subarray(0, 16);

    if (!esMp3Valido(primerosBytes)) {
      return respuestaSinCache(
        {
          ok: false,
          error: "El archivo no parece ser un MP3 válido.",
        },
        400
      );
    }

    // =========================================================
    // 6. OBTENER CONFIGURACIÓN ACTUAL
    // =========================================================

    const { data: actual, error: errorActual } =
      await supabaseAdmin
        .from("configuracion_sitio")
        .select("id, musica_url")
        .limit(1)
        .maybeSingle();

    if (errorActual) {
      console.error(
        "Error buscando configuración:",
        errorActual
      );

      return respuestaSinCache(
        {
          ok: false,
          error: "No se pudo obtener la configuración.",
        },
        500
      );
    }

    // =========================================================
    // 7. SUBIR NUEVA MÚSICA
    // =========================================================

    nombreArchivoSubido =
      `musica-${Date.now()}-${crypto.randomUUID()}.mp3`;

    const { error: errorUpload } =
      await supabaseAdmin.storage
        .from("musica")
        .upload(nombreArchivoSubido, buffer, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
          upsert: false,
        });

    if (errorUpload) {
      console.error(
        "Error subiendo música:",
        errorUpload
      );

      return respuestaSinCache(
        {
          ok: false,
          error: "No se pudo subir la música.",
        },
        500
      );
    }

    // =========================================================
    // 8. OBTENER URL PÚBLICA
    // =========================================================

    const { data: urlData } =
      supabaseAdmin.storage
        .from("musica")
        .getPublicUrl(nombreArchivoSubido);

    const musicaUrl =
      String(urlData?.publicUrl || "").trim();

    if (!musicaUrl) {
      await supabaseAdmin.storage
        .from("musica")
        .remove([nombreArchivoSubido]);

      return respuestaSinCache(
        {
          ok: false,
          error: "No se pudo generar la URL de la música.",
        },
        500
      );
    }

    // =========================================================
    // 9. GUARDAR URL EN CONFIGURACIÓN
    // =========================================================

    const payload = {
      musica_url: musicaUrl,
      updated_at: new Date().toISOString(),
    };

    let data;
    let error;

    if (actual?.id) {
      const resultado =
        await supabaseAdmin
          .from("configuracion_sitio")
          .update(payload)
          .eq("id", actual.id)
          .select(
            "id, musica_url, musica_nombre, musica_activa, musica_volumen, musica_loop, musica_autoplay, musica_mostrar_controles, updated_at"
          )
          .single();

      data = resultado.data;
      error = resultado.error;
    } else {
      const resultado =
        await supabaseAdmin
          .from("configuracion_sitio")
          .insert(payload)
          .select(
            "id, musica_url, musica_nombre, musica_activa, musica_volumen, musica_loop, musica_autoplay, musica_mostrar_controles, updated_at"
          )
          .single();

      data = resultado.data;
      error = resultado.error;
    }

    if (error) {
      console.error(
        "Error guardando música en configuracion_sitio:",
        error
      );

      // Evita dejar el archivo nuevo huérfano.
      await supabaseAdmin.storage
        .from("musica")
        .remove([nombreArchivoSubido]);

      return respuestaSinCache(
        {
          ok: false,
          error: "No se pudo guardar la música en la configuración.",
        },
        500
      );
    }

    // =========================================================
    // 10. ELIMINAR ARCHIVO ANTERIOR SI ERA DE NUESTRO BUCKET
    // =========================================================

    const urlAnterior = String(actual?.musica_url || "");

    if (urlAnterior && urlAnterior !== musicaUrl) {
      try {
        const marcador = "/storage/v1/object/public/musica/";
        const posicion = urlAnterior.indexOf(marcador);

        if (posicion !== -1) {
          const rutaAnterior = decodeURIComponent(
            urlAnterior.slice(posicion + marcador.length)
          );

          if (rutaAnterior) {
            await supabaseAdmin.storage
              .from("musica")
              .remove([rutaAnterior]);
          }
        }
      } catch (errorEliminar) {
        // No hacemos fallar la actualización si solo falla
        // la limpieza del archivo anterior.
        console.error(
          "No se pudo eliminar la música anterior:",
          errorEliminar
        );
      }
    }

    // =========================================================
    // 11. RESPUESTA
    // =========================================================

    return respuestaSinCache({
      ok: true,
      configuracion: data,
    });
  } catch (error) {
    console.error(
      "Error en POST /api/admin-configuracion/musica:",
      error
    );

    return respuestaSinCache(
      {
        ok: false,
        error: "Error inesperado al subir la música.",
      },
      500
    );
  }
}