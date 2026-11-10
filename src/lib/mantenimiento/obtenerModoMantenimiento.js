
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   MODO MANTENIMIENTO GLOBAL

   - Solo se ejecuta en el servidor.
   - Caché local de 5 segundos.
   - Evita solicitudes simultáneas duplicadas.
   - Fail-open: si Supabase falla, no bloqueamos
     accidentalmente toda la página.
========================================================= */

const CACHE_DURATION_MS = 5 * 1000;

let cachedValue = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

export async function obtenerModoMantenimiento() {
  const ahora = Date.now();

  // Reutilizar el estado si sigue vigente.
  if (
    cachedValue !== null &&
    ahora < cacheExpiresAt
  ) {
    return cachedValue;
  }

  // Compartir una solicitud que ya esté en curso.
  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = (async () => {
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

      const mantenimiento =
        data?.modo_mantenimiento === true;

      cachedValue = mantenimiento;
      cacheExpiresAt =
        Date.now() + CACHE_DURATION_MS;

      return mantenimiento;
    } catch (error) {
      console.error(
        "Error inesperado consultando modo mantenimiento:",
        error
      );

      return false;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}
