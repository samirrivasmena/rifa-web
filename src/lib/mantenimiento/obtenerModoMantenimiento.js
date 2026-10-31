import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   OBTENER MODO MANTENIMIENTO GLOBAL
   - Solo se ejecuta en el servidor.
   - Lee el estado directamente desde Supabase.
   - Fail-open: si Supabase falla, NO bloqueamos accidentalmente
     toda la página.
========================================================= */

export async function obtenerModoMantenimiento() {
  try {
    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("modo_mantenimiento")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Error consultando modo mantenimiento:",
        error
      );

      return false;
    }

    return data?.modo_mantenimiento === true;
  } catch (error) {
    console.error(
      "Error inesperado consultando modo mantenimiento:",
      error
    );

    return false;
  }
}