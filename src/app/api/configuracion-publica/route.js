import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// ============================================================
// CAMPOS PÚBLICOS DE CONFIGURACIÓN
//
// Esta API es pública.
//
// No usamos select("*") para evitar que columnas internas
// actuales o añadidas en el futuro se expongan
// automáticamente al navegador.
// ============================================================

const CAMPOS_PUBLICOS_CONFIGURACION = `
  logo_url,
  nombre_marca,
  slogan,
  descripcion_home,

  whatsapp,
  instagram,
  telegram,
  correo,
  facebook,
  tiktok,
  youtube,

  home_titulo,
  home_subtitulo,
  home_mensaje,
  home_boton_comprar,
  home_boton_verificar,

  home_imagen_principal,
  home_imagen_secundaria,

  menu_inicio,
  menu_eventos,
  menu_resultados,
  menu_ganadores,
  menu_pagos,
  menu_contacto,
  menu_verificador,

  principal_titulo_eventos,
  principal_texto_eventos,
  principal_titulo_resultados,
  principal_titulo_ganadores,
  principal_texto_contacto,

  descripcion_principal,
  descripcion,

  slogan_frase_1,
  slogan_frase_2,
  slogan_frase_3,
  slogan_frase_4,

  color_primario,
  color_secundario,
  color_fondo,
  color_texto,
  color_boton,
  color_alerta,
  color_exito,
  color_tarjeta,
  color_borde,
  color_error,
  color_hover,
  color_progreso,
  color_progreso_fondo,

  saturacion_global,
  brillo_global,
  contraste_global,
  tono_global,
  luminosidad_global,

  metodos_pago,

  seo_titulo,
  seo_descripcion,
  seo_imagen,

  popup_activo,
  popup_titulo,
  popup_mensaje,
  popup_boton,
  popup_imagen,
  popup_link,
  popup_color_boton,

  color_punticos,

  notificaciones_activas,
  notificaciones_duracion,
  notificaciones_posicion,
  notificaciones_color_fondo,
  notificaciones_color_texto,
  notificaciones_color_acento,

  footer_texto,
  footer_titulo,
  footer_subtitulo,
  footer_reseña,
  footer_logo_url,

  footer_mostrar_redes,
  footer_mostrar_navegacion,

  footer_whatsapp,
  footer_instagram,
  footer_telegram,
  footer_facebook,
  footer_tiktok,
  footer_youtube,
  footer_correo,

  footer_web_url,
  footer_pais,
  footer_direccion,

  footer_color_fondo,
  footer_color_fondo_2,
  footer_color_texto,
  footer_color_acento,
  footer_color_borde,
  footer_color_hover
`;

// ============================================================
// HEADERS NO-CACHE
// ============================================================

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

// ============================================================
// GET
// ============================================================

export async function GET() {
  try {
    // ========================================================
    // CARGAR CONFIGURACIÓN
    // ========================================================

    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select(CAMPOS_PUBLICOS_CONFIGURACION)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    // ========================================================
    // ERROR DE SUPABASE
    // ========================================================

    if (error) {
      /*
       * El error completo se registra únicamente
       * en el servidor.
       *
       * No enviamos error.message al navegador porque
       * podría contener información técnica de la base
       * de datos.
       */

      console.error(
        "Error Supabase configuracion_sitio:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo cargar la configuración pública",
        },
        {
          status: 500,
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // NO EXISTE CONFIGURACIÓN
    // ========================================================

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No existe configuración pública disponible",
        },
        {
          status: 404,
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    // ========================================================
    // RESPUESTA PÚBLICA
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        /*
         * data solamente contiene los campos definidos
         * en CAMPOS_PUBLICOS_CONFIGURACION.
         *
         * No se devuelven:
         *
         * - id
         * - created_at
         * - updated_at
         *
         * Y cualquier columna interna que agregues en el
         * futuro tampoco se hará pública automáticamente.
         */

        configuracion: data,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    // ========================================================
    // ERROR INESPERADO
    // ========================================================

    console.error(
      "Error general configuración pública:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Error cargando configuración pública",
      },
      {
        status: 500,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}