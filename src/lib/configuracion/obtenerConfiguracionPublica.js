import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   CAMPOS PÚBLICOS DE CONFIGURACIÓN

   IMPORTANTE:
   Solo contiene información que puede ser enviada
   al sitio público.

   NO incluye secretos, claves ni datos administrativos.
========================================================= */

const CAMPOS_PUBLICOS = [
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

  "color_punticos",
  "notificaciones_color_fondo",
  "notificaciones_color_texto",
  "notificaciones_color_acento",

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
  "popup_color_boton",

  "notificaciones_activas",
  "notificaciones_duracion",
  "notificaciones_posicion",

  "principal_titulo_eventos",
  "principal_texto_eventos",
  "principal_titulo_resultados",
  "principal_titulo_ganadores",
  "principal_texto_contacto",

  "footer_titulo",
  "footer_subtitulo",
  "footer_texto",
  "footer_reseña",
  "footer_logo_url",
  "footer_mostrar_navegacion",
  "footer_mostrar_redes",
  "footer_whatsapp",
  "footer_instagram",
  "footer_telegram",
  "footer_facebook",
  "footer_tiktok",
  "footer_youtube",
  "footer_correo",
  "footer_web_url",
  "footer_pais",
  "footer_direccion",
  "footer_color_fondo",
  "footer_color_fondo_2",
  "footer_color_texto",
  "footer_color_acento",
  "footer_color_borde",
  "footer_color_hover",

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

  "linea_anuncios_activa",
  "linea_anuncios_mensaje_1",
  "linea_anuncios_mensaje_2",
  "linea_anuncios_mensaje_3",
  "linea_anuncios_color_fondo",
  "linea_anuncios_color_texto",
  "linea_anuncios_color_separador",
  "linea_anuncios_velocidad",
  "linea_anuncios_negrita",
  "linea_anuncios_mostrar_movil",
  "linea_anuncios_mostrar_escritorio",
];

/* =========================================================
   OBTENER CONFIGURACIÓN PÚBLICA
========================================================= */

export async function obtenerConfiguracionPublica() {
  try {
    const campos = CAMPOS_PUBLICOS.join(",");

    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select(campos)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Error obteniendo configuración pública:",
        error
      );

      throw error;
    }

    if (!data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error(
      "obtenerConfiguracionPublica error:",
      error
    );

    throw error;
  }
}