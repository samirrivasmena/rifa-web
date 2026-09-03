import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS_CONFIGURACION = [
  "logo_url",
  "nombre_marca",
  "slogan",
  "descripcion_home",
  "whatsapp",
  "instagram",
  "telegram",
  "correo",

  "home_titulo",
  "home_subtitulo",
  "home_mensaje",
  "home_boton_comprar",
  "home_boton_verificar",
  "home_imagen_principal",
  "home_imagen_secundaria",

  "color_primario",
  "color_secundario",
  "color_fondo",
  "color_texto",
  "color_boton",
  "color_alerta",
  "color_exito",
  "color_tarjeta",
  "color_borde",
  "color_error",
  "color_hover",
  "color_progreso",
  "color_progreso_fondo",

  "metodos_pago",

  "menu_inicio",
  "menu_eventos",
  "menu_resultados",
  "menu_ganadores",
  "menu_pagos",
  "menu_contacto",
  "menu_verificador",

  "facebook",
  "tiktok",
  "youtube",

  "seo_titulo",
  "seo_descripcion",
  "seo_imagen",

  "popup_activo",
  "popup_titulo",
  "popup_mensaje",
  "popup_boton",
  "popup_imagen",
  "popup_link",

  "notificaciones_activas",
  "notificaciones_duracion",
  "notificaciones_posicion",

  "principal_titulo_eventos",
  "principal_texto_eventos",
  "principal_titulo_resultados",
  "principal_titulo_ganadores",
  "principal_texto_contacto",

  "footer_texto",
  "footer_mostrar_redes",

  "saturacion_global",
  "brillo_global",
  "contraste_global",
  "tono_global",
  "luminosidad_global",

  "descripcion_principal",
  "slogan_frase_1",
  "slogan_frase_2",
  "slogan_frase_3",
  "slogan_frase_4",
  "descripcion",
];

function limpiarPayload(body) {
  const payload = {};

  for (const campo of CAMPOS_CONFIGURACION) {
    if (Object.prototype.hasOwnProperty.call(body, campo)) {
      payload[campo] = body[campo];
    }
  }

  return payload;
}

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

/* =========================================================
   GET
   Obtener configuración actual
========================================================= */

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Error GET configuracion_sitio:",
        error
      );

      return respuestaSinCache(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    if (!data) {
      return respuestaSinCache(
        {
          ok: false,
          error:
            "No existe ninguna configuración en configuracion_sitio.",
        },
        404
      );
    }

    return respuestaSinCache({
      ok: true,
      configuracion: data,
    });
  } catch (error) {
    console.error(
      "Error GET admin-configuracion:",
      error
    );

    return respuestaSinCache(
      {
        ok: false,
        error:
          error?.message ||
          "Error cargando configuración",
      },
      500
    );
  }
}

/* =========================================================
   PUT
   Actualizar configuración actual
========================================================= */

export async function PUT(request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respuestaSinCache(
        {
          ok: false,
          error: "Datos de configuración inválidos.",
        },
        400
      );
    }

    const payload = limpiarPayload(body);

    /* -----------------------------------------------------
       Métodos de pago
    ----------------------------------------------------- */

    if (Array.isArray(payload.metodos_pago)) {
      payload.metodos_pago = payload.metodos_pago.map(
        (metodo, index) => ({
          id:
            metodo?.id ||
            `metodo-${Date.now()}-${index}`,

          activo:
            metodo?.activo !== false,

          orden:
            Number.isFinite(Number(metodo?.orden))
              ? Number(metodo.orden)
              : index + 1,

          nombre:
            metodo?.nombre || "",

          cuenta:
            metodo?.cuenta || "",

          titular:
            metodo?.titular || "",

          subtitulo:
            metodo?.subtitulo || "",

          descripcion:
            metodo?.descripcion || "",

          logo:
            metodo?.logo || "",
        })
      );
    }

    /* -----------------------------------------------------
       Fecha de actualización
    ----------------------------------------------------- */

    payload.updated_at = new Date().toISOString();

    /* -----------------------------------------------------
       Buscar configuración existente
    ----------------------------------------------------- */

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
        "Error buscando configuración:",
        errorActual
      );

      return respuestaSinCache(
        {
          ok: false,
          error: errorActual.message,
        },
        500
      );
    }

    let data;
    let error;

    /* =====================================================
       ACTUALIZAR CONFIGURACIÓN EXISTENTE
    ===================================================== */

    if (actual?.id) {
      const resultado = await supabaseAdmin
        .from("configuracion_sitio")
        .update(payload)
        .eq("id", actual.id)
        .select("*")
        .single();

      data = resultado.data;
      error = resultado.error;
    }

    /* =====================================================
       CREAR CONFIGURACIÓN SI NO EXISTE
    ===================================================== */

    else {
      const resultado = await supabaseAdmin
        .from("configuracion_sitio")
        .insert(payload)
        .select("*")
        .single();

      data = resultado.data;
      error = resultado.error;
    }

    /* -----------------------------------------------------
       Error guardando
    ----------------------------------------------------- */

    if (error) {
      console.error(
        "Error guardando configuración:",
        error
      );

      return respuestaSinCache(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return respuestaSinCache({
      ok: true,
      configuracion: data,
    });
  } catch (error) {
    console.error(
      "Error PUT admin-configuracion:",
      error
    );

    return respuestaSinCache(
      {
        ok: false,
        error:
          error?.message ||
          "Error guardando configuración",
      },
      500
    );
  }
}