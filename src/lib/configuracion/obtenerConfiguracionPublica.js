
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   CAMPOS PÚBLICOS DE CONFIGURACIÓN

   Solo información permitida para el sitio público.
   No incluir secretos ni claves administrativas.
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

  "color_reglas_politicas",

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

  /* =======================================================
     MÚSICA
  ======================================================= */

  "musica_activa",
  "musica_url",
  "musica_nombre",
  "musica_volumen",
  "musica_loop",
  "musica_autoplay",
  "musica_mostrar_controles",

  /* =======================================================
     POPUP
  ======================================================= */

  "popup_activo",
  "popup_titulo",
  "popup_mensaje",
  "popup_boton",
  "popup_imagen",
  "popup_link",
  "popup_color_boton",

  /* =======================================================
     NOTIFICACIONES
  ======================================================= */

  "notificaciones_activas",
  "notificaciones_duracion",
  "notificaciones_posicion",

  /* =======================================================
     PÁGINA PRINCIPAL
  ======================================================= */

  "principal_titulo_eventos",
  "principal_texto_eventos",
  "principal_titulo_resultados",
  "principal_titulo_ganadores",
  "principal_texto_contacto",

  /* =======================================================
     FOOTER
  ======================================================= */

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

  /* =======================================================
     AJUSTES VISUALES
  ======================================================= */

  "saturacion_global",
  "brillo_global",
  "contraste_global",
  "tono_global",
  "luminosidad_global",

  /* =======================================================
     TEXTOS Y DESCRIPCIONES
  ======================================================= */

  "descripcion_principal",
  "slogan_frase_1",
  "slogan_frase_2",
  "slogan_frase_3",
  "slogan_frase_4",
  "descripcion",

  /* =======================================================
     LÍNEA DE ANUNCIOS
  ======================================================= */

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
   CAMPOS DE CONSULTA

   Se construyen una sola vez para evitar trabajo
   innecesario en cada llamada.
========================================================= */

const campos = CAMPOS_PUBLICOS.join(",");

/* =========================================================
   CONSULTAR CONFIGURACIÓN EN SUPABASE

   - Solo selecciona los campos públicos.
   - No utiliza caché global de 30 segundos.
   - No modifica datos de Supabase.
========================================================= */

async function consultarConfiguracion() {
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

  return data || null;
}

/* =========================================================
   OBTENER CONFIGURACIÓN PÚBLICA

   - Compatible con las llamadas existentes.
   - Consulta Supabase directamente.
   - Los cambios del administrador se reflejan
     en las siguientes solicitudes al servidor.
========================================================= */

export async function obtenerConfiguracionPublica({
  force = false,
} = {}) {
  // Se conserva force por compatibilidad.
  // Ya no existe una caché global que omitir.
  void force;

  try {
    return await consultarConfiguracion();
  } catch (error) {
    console.error(
      "obtenerConfiguracionPublica error:",
      error
    );

    throw error;
  }
}

/* =========================================================
   INVALIDACIÓN DE CACHÉ

   Se conserva la función por compatibilidad.
   No es necesario invalidar caché porque esta
   versión no mantiene datos en memoria.
========================================================= */

export function invalidarCacheConfiguracionPublica() {
  // Sin caché global que invalidar.
}
