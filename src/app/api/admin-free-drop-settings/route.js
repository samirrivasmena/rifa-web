import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdmin } from "../../../lib/requireAdmin";

// ============================================================
// SUPABASE SERVER
// ============================================================

function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase"
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

// ============================================================
// HELPERS
// ============================================================

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(valor) {
  return limpiarTexto(valor).toLowerCase();
}

function toBoolean(valor) {
  return (
    valor === true ||
    valor === "true" ||
    valor === 1 ||
    valor === "1"
  );
}

function toNumber(
  valor,
  fallback = 0,
  min = 0
) {
  const num = Number(valor);

  if (!Number.isFinite(num)) {
    return fallback;
  }

  return Math.max(num, min);
}

function responderError(
  mensaje,
  status = 400
) {
  return NextResponse.json(
    {
      error: mensaje,
    },
    {
      status,
    }
  );
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

function defaultSettings(rifaId = null) {
  return {
    id: null,
    rifa_id: rifaId,

    enabled: false,

    total_free_allowed: 250,
    batch_size: 25,

    // Este contador NO debe ser controlado manualmente
    // desde el frontend.
    //
    // El RPC assign_free_drop_participation es quien lo
    // incrementa cuando una participación FREE se registra
    // correctamente.
    released_total: 0,

    one_ticket_per_person: true,
    manual_review: false,

    require_follow: true,
    require_like: true,
    require_comment: true,
    require_share: true,

    share_to_count: 3,

    // Enlaces utilizados por los botones públicos
    // de requisitos sociales.
    instagram_profile_url: "",
    instagram_post_url: "",

    requirements_text:
      "Debes seguir la cuenta, dar me gusta, comentar y compartir a 3 personas.",

    public_message:
      "Participa gratis en el evento activo. Los cupos se liberan por tandas.",

    updated_at: null,
  };
}

/*
 * ============================================================
 * CAPACIDAD FREE COMPROMETIDA
 * ============================================================
 *
 * Esta función utiliza la misma lógica de capacidad que usamos
 * en la administración de FREE Drops.
 *
 * Drops que todavía forman parte del pool operativo:
 *
 * - BORRADOR
 * - PENDIENTE
 * - PROGRAMADO
 * - ACTIVO
 * - PAUSADO
 * - AGOTADO
 *
 * En esos estados se considera comprometido el cupos_total
 * completo del Drop.
 *
 * Drops que ya salieron del ciclo operativo:
 *
 * - CERRADO
 * - ARCHIVADO
 *
 * En esos estados solamente continúan comprometidos los cupos
 * realmente utilizados.
 *
 * Ejemplo:
 *
 * Drop cerrado:
 *
 *   cupos_total  = 25
 *   cupos_usados = 2
 *
 * Capacidad comprometida:
 *
 *   2
 *
 * Los otros 23 cupos vuelven a estar disponibles para crear
 * nuevos Drops.
 *
 * IMPORTANTE:
 *
 * Esto NO modifica cupos_usados.
 * Esto NO modifica released_total.
 * Esto NO elimina historial.
 * Esto NO modifica participaciones.
 * ============================================================
 */

function obtenerCapacidadComprometidaDrop(
  drop
) {
  const estado = normalizarEstado(
    drop?.estado
  );

  const cuposTotal = toNumber(
    drop?.cupos_total,
    0,
    0
  );

  const cuposUsados = Math.min(
    toNumber(
      drop?.cupos_usados,
      0,
      0
    ),
    cuposTotal
  );

  if (
    estado === "cerrado" ||
    estado === "archivado"
  ) {
    return cuposUsados;
  }

  return cuposTotal;
}

/*
 * ============================================================
 * TOTAL FREE ACTUALMENTE COMPROMETIDO
 * ============================================================
 */

async function obtenerTotalReservado(
  supabase,
  rifaId
) {
  const {
    data,
    error,
  } = await supabase
    .from("free_drops")
    .select(
      [
        "id",
        "estado",
        "cupos_total",
        "cupos_usados",
      ].join(", ")
    )
    .eq("rifa_id", rifaId);

  if (error) {
    throw error;
  }

  const drops = Array.isArray(data)
    ? data
    : [];

  return drops.reduce(
    (total, drop) =>
      total +
      obtenerCapacidadComprometidaDrop(
        drop
      ),
    0
  );
}

// ============================================================
// GET
// ============================================================

export async function GET(req) {
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
    const supabase =
      getSupabaseServerClient();

    const { searchParams } =
      new URL(req.url);

    const rifaId = limpiarTexto(
      searchParams.get("rifaId")
    );

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("free_drop_settings")
      .select("*")
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (error) {
      console.error(
        "Error cargando settings:",
        error
      );

      return responderError(
        "No se pudo cargar la configuración",
        500
      );
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        settings:
          defaultSettings(rifaId),
      });
    }

    const totalFreeAllowed =
      toNumber(
        data.total_free_allowed,
        250,
        0
      );

    /*
     * released_total se lee desde la base de datos.
     *
     * No viene del cliente.
     *
     * Este valor es administrado por el flujo
     * transaccional de participaciones FREE.
     */
    const releasedTotal =
      Math.min(
        toNumber(
          data.released_total,
          0,
          0
        ),
        totalFreeAllowed
      );

    return NextResponse.json({
      ok: true,

      settings: {
        ...defaultSettings(rifaId),
        ...data,

        enabled:
          toBoolean(data.enabled),

        total_free_allowed:
          totalFreeAllowed,

        batch_size:
          toNumber(
            data.batch_size,
            25,
            1
          ),

        released_total:
          releasedTotal,

        one_ticket_per_person:
          toBoolean(
            data.one_ticket_per_person
          ),

        manual_review:
          toBoolean(
            data.manual_review
          ),

        require_follow:
          toBoolean(
            data.require_follow
          ),

        require_like:
          toBoolean(
            data.require_like
          ),

        require_comment:
          toBoolean(
            data.require_comment
          ),

        require_share:
          toBoolean(
            data.require_share
          ),

        share_to_count:
          toNumber(
            data.share_to_count,
            3,
            0
          ),

        // URLs para las acciones sociales públicas.
        instagram_profile_url:
          limpiarTexto(
            data.instagram_profile_url
          ),

        instagram_post_url:
          limpiarTexto(
            data.instagram_post_url
          ),

        requirements_text:
          limpiarTexto(
            data.requirements_text
          ) ||
          "Debes seguir la cuenta, dar me gusta, comentar y compartir a 3 personas.",

        public_message:
          limpiarTexto(
            data.public_message
          ) ||
          "Participa gratis en el evento activo. Los cupos se liberan por tandas.",
      },
    });
  } catch (error) {
    console.error(
      "Error en GET admin free drop settings:",
      error
    );

    return responderError(
      "Error inesperado al cargar la configuración",
      500
    );
  }
}

// ============================================================
// PATCH
// ============================================================

export async function PATCH(req) {
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
    const supabase =
      getSupabaseServerClient();

    const body = await req.json();

    const rifaId =
      limpiarTexto(body.rifaId);

    if (!rifaId) {
      return responderError(
        "rifaId es requerido",
        400
      );
    }

    // ========================================================
    // 1. DATOS EDITABLES POR EL ADMIN
    // ========================================================

    let enabled =
      toBoolean(body.enabled);

    let totalFreeAllowed =
      toNumber(
        body.total_free_allowed,
        250,
        0
      );

    const batchSize =
      toNumber(
        body.batch_size,
        25,
        1
      );

    // URLs de Instagram configurables desde Admin.
    const instagramProfileUrl =
      limpiarTexto(
        body.instagram_profile_url
      );

    const instagramPostUrl =
      limpiarTexto(
        body.instagram_post_url
      );

    /*
     * ========================================================
     * IMPORTANTE: released_total
     * ========================================================
     *
     * NO utilizamos:
     *
     *   body.released_total
     *
     * porque released_total no es una configuración editable.
     *
     * Es un contador interno administrado por:
     *
     *   public.assign_free_drop_participation(...)
     *
     * Cada participación FREE exitosa incrementa ese contador
     * dentro de la misma transacción.
     *
     * Permitir que el navegador lo enviara y lo sobrescribiera
     * podría:
     *
     * - disminuir artificialmente el total consumido;
     * - aumentar artificialmente el total consumido;
     * - bloquear participaciones antes de tiempo;
     * - permitir más participaciones que el límite configurado.
     *
     * Por eso, al guardar Settings conservamos SIEMPRE el valor
     * existente en la base de datos.
     * ========================================================
     */

    // ========================================================
    // 2. CARGAR SETTINGS ACTUALES
    // ========================================================

    const {
      data: settingsActuales,
      error: errorSettingsActuales,
    } = await supabase
      .from("free_drop_settings")
      .select(
        "id, rifa_id, released_total"
      )
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (errorSettingsActuales) {
      console.error(
        "Error cargando settings actuales:",
        errorSettingsActuales
      );

      return responderError(
        "No se pudo verificar la configuración actual",
        500
      );
    }

    /*
     * Si todavía no existe configuración para esta rifa,
     * el contador comienza correctamente en 0.
     *
     * Si ya existe, conservamos exactamente el valor real
     * almacenado por el servidor.
     */
    const releasedTotalActual =
      settingsActuales
        ? toNumber(
            settingsActuales.released_total,
            0,
            0
          )
        : 0;

    /*
     * Si FREE TICKETS está habilitado,
     * evitamos dejar el límite general en 0.
     */
    if (
      enabled &&
      totalFreeAllowed <= 0
    ) {
      totalFreeAllowed = 250;
    }

    // ========================================================
    // 3. VALIDACIÓN DE CAPACIDAD DE DROPS
    // ========================================================
    //
    // Ya NO sumamos todo el historial de Drops.
    //
    // CERRADO / ARCHIVADO:
    // solamente conservan como comprometidos sus cupos usados.
    //
    // Los demás estados:
    // conservan su capacidad total.
    // ========================================================

    const totalReservado =
      await obtenerTotalReservado(
        supabase,
        rifaId
      );

    if (
      totalFreeAllowed <
      totalReservado
    ) {
      return responderError(
        `No puedes dejar el total free permitido por debajo de los ${totalReservado} cupos FREE actualmente comprometidos para este evento.`,
        409
      );
    }

    // ========================================================
    // 4. PROTEGER released_total
    // ========================================================
    //
    // total_free_allowed tampoco puede quedar por debajo de la
    // cantidad FREE que YA fue consumida históricamente.
    //
    // Esto es diferente de totalReservado:
    //
    // - totalReservado protege capacidad de Drops.
    // - releasedTotalActual protege participaciones ya usadas.
    // ========================================================

    if (
      totalFreeAllowed <
      releasedTotalActual
    ) {
      return responderError(
        `No puedes dejar el total free permitido por debajo de las ${releasedTotalActual} participaciones FREE ya registradas para este evento.`,
        409
      );
    }

    // ========================================================
    // 5. PAYLOAD
    // ========================================================

    const payload = {
      rifa_id: rifaId,

      enabled,

      total_free_allowed:
        totalFreeAllowed,

      batch_size:
        batchSize,

      /*
       * Nunca utilizamos body.released_total.
       *
       * Conservamos el contador real de la base de datos.
       */
      released_total:
        releasedTotalActual,

      one_ticket_per_person:
        toBoolean(
          body.one_ticket_per_person
        ),

      manual_review:
        toBoolean(
          body.manual_review
        ),

      require_follow:
        toBoolean(
          body.require_follow
        ),

      require_like:
        toBoolean(
          body.require_like
        ),

      require_comment:
        toBoolean(
          body.require_comment
        ),

      require_share:
        toBoolean(
          body.require_share
        ),

      share_to_count:
        toNumber(
          body.share_to_count,
          3,
          0
        ),

      // Enlaces sociales configurados para este evento.
      instagram_profile_url:
        instagramProfileUrl,

      instagram_post_url:
        instagramPostUrl,

      requirements_text:
        limpiarTexto(
          body.requirements_text
        ) ||
        "Debes seguir la cuenta, dar me gusta, comentar y compartir a 3 personas.",

      public_message:
        limpiarTexto(
          body.public_message
        ) ||
        "Participa gratis en el evento activo. Los cupos se liberan por tandas.",

      updated_at:
        new Date().toISOString(),
    };

    // ========================================================
    // 6. GUARDAR
    // ========================================================

    const {
      data,
      error,
    } = await supabase
      .from("free_drop_settings")
      .upsert(
        payload,
        {
          onConflict: "rifa_id",
        }
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "Error guardando settings:",
        error
      );

      return responderError(
        "No se pudo guardar la configuración",
        500
      );
    }

    // ========================================================
    // 7. RESPUESTA
    // ========================================================

    return NextResponse.json({
      ok: true,

      settings: {
        ...defaultSettings(rifaId),
        ...data,

        /*
         * Dejamos explícitamente el contador que realmente
         * quedó almacenado.
         */
        released_total:
          toNumber(
            data.released_total,
            releasedTotalActual,
            0
          ),

        instagram_profile_url:
          limpiarTexto(
            data.instagram_profile_url
          ),

        instagram_post_url:
          limpiarTexto(
            data.instagram_post_url
          ),
      },

      message:
        "Configuración guardada correctamente",
    });
  } catch (error) {
    console.error(
      "Error en PATCH admin free drop settings:",
      error
    );

    return responderError(
      "Error inesperado al guardar la configuración",
      500
    );
  }
}