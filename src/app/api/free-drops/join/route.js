import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


// ============================================================
// SUPABASE SERVER
// ============================================================

function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Faltan variables de entorno de Supabase");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================================
// HELPERS
// ============================================================

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarTelefono(valor) {
  return String(valor ?? "").replace(/[^\d]/g, "");
}

function esVerdadero(valor) {
  return (
    valor === true ||
    valor === "true" ||
    valor === 1 ||
    valor === "1"
  );
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
}

function validarTelefono(telefono) {
  const value = normalizarTelefono(telefono);
  return value.length >= 8 && value.length <= 15;
}

function responderError(mensaje, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: mensaje,
    },
    { status }
  );
}

function getSiteBaseUrl(req) {
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_URL ||
    "";

  let base = String(envBase || "").trim();

  if (!base) {
    const origin = req.headers.get("origin") || "";

    if (origin) {
      base = origin;
    }
  }

  if (base && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }

  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}

// ============================================================
// TURNSTILE
// ============================================================

async function verificarTurnstile(token, ip = "") {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "Falta TURNSTILE_SECRET_KEY en el servidor"
    );
  }

  if (!token) {
    return false;
  }

  const formData = new URLSearchParams();

  formData.append("secret", secret);
  formData.append("response", token);

  if (ip) {
    formData.append("remoteip", ip);
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 8000);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    return data.success === true;
  } catch (error) {
    console.error(
      "Error validando Turnstile:",
      error
    );

    throw new Error(
      "No se pudo validar el CAPTCHA"
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// CÓDIGO FREE
// ============================================================

function generarCodigoBase() {
  return `FREE-${Math.floor(
    100000 + Math.random() * 900000
  )}`;
}

async function generarCodigoFreeUnico(supabase) {
  for (let intento = 0; intento < 10; intento++) {
    const codigo = generarCodigoBase();

    const { data, error } = await supabase
      .from("free_drop_participations")
      .select("id")
      .eq("codigo_unico", codigo)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return codigo;
    }
  }

  // Fallback extremadamente improbable.
  const extra = String(Date.now()).slice(-6);

  return `FREE-${extra}`;
}

// ============================================================
// MENSAJES RPC
// ============================================================

function interpretarErrorRpc(error) {
  const mensaje = String(
    error?.message ||
    error?.details ||
    error?.hint ||
    ""
  );

  if (
    mensaje.includes("FREE_DUPLICATE_EMAIL") ||
    mensaje.includes("FREE_DUPLICATE_PHONE") ||
    mensaje.includes("FREE_DUPLICATE_PARTICIPATION")
  ) {
    return {
      status: 409,
      mensaje:
        "Ya existe una participación gratis asociada con estos DATOS en este evento. Solo se permite una participación gratis por persona y por evento.",
    };
  }

  if (mensaje.includes("FREE_DROP_NOT_FOUND")) {
    return {
      status: 404,
      mensaje: "No se encontró el free drop",
    };
  }

  if (mensaje.includes("FREE_DROP_NOT_ACTIVE")) {
    return {
      status: 409,
      mensaje:
        "El free drop seleccionado no está activo",
    };
  }

  if (mensaje.includes("FREE_DROP_SOLD_OUT")) {
    return {
      status: 409,
      mensaje: "Este free drop ya está agotado",
    };
  }

  if (mensaje.includes("FREE_DROP_NO_CAPACITY")) {
    return {
      status: 409,
      mensaje:
        "Este free drop no tiene cupos disponibles",
    };
  }

  if (mensaje.includes("FREE_CAMPAIGN_DISABLED")) {
    return {
      status: 409,
      mensaje:
        "La campaña de free drops está desactivada",
    };
  }

  if (mensaje.includes("FREE_SETTINGS_NOT_FOUND")) {
    return {
      status: 409,
      mensaje:
        "Este evento no tiene configurado el sistema de free drops",
    };
  }

  if (
    mensaje.includes("FREE_TOTAL_DISABLED") ||
    mensaje.includes("FREE_TOTAL_EXHAUSTED")
  ) {
    return {
      status: 409,
      mensaje:
        "Ya se alcanzó el total de participaciones gratuitas permitidas",
    };
  }

  if (mensaje.includes("FREE_NO_TICKETS_AVAILABLE")) {
    return {
      status: 409,
      mensaje:
        "No quedan números disponibles para este evento",
    };
  }

  if (mensaje.includes("FREE_TICKET_ASSIGNMENT_FAILED")) {
    return {
      status: 409,
      mensaje:
        "El número seleccionado dejó de estar disponible. Intenta nuevamente.",
    };
  }

  if (mensaje.includes("FREE_RULES")) {
    return {
      status: 400,
      mensaje:
        "Debes aceptar las reglas oficiales",
    };
  }

  if (mensaje.includes("FREE_ELIGIBILITY")) {
    return {
      status: 400,
      mensaje:
        "Debes confirmar que cumples los requisitos de participación",
    };
  }

  if (mensaje.includes("FREE_VALIDATION")) {
    return {
      status: 400,
      mensaje:
        "Los datos de participación no son válidos",
    };
  }

  return {
    status: 500,
    mensaje:
      "No se pudo registrar la participación gratis",
  };
}

// ============================================================
// POST
// ============================================================

export async function POST(req) {
  const supabase = getSupabaseServerClient();

  try {
    // ========================================================
    // 1. BODY
    // ========================================================

    const body = await req.json();

    const nombre = limpiarTexto(body.nombre);
    const apellido = limpiarTexto(body.apellido);

    const email = limpiarTexto(
      body.email
    ).toLowerCase();

    const telefonoOriginal = limpiarTexto(
      body.telefono
    );

    const telefono = normalizarTelefono(
      telefonoOriginal
    );

    const estadoResidencia = limpiarTexto(
      body.estado
    );

    const freeDropIdRaw = limpiarTexto(
      body.freeDropId
    );

    const captchaToken = limpiarTexto(
      body.captchaToken
    );

    const aceptaReglas = esVerdadero(
      body.aceptaReglas
    );

    const cumpleRequisitos = esVerdadero(
      body.elegibilidad
    );

    const socialUsername = limpiarTexto(
      body.social_username ||
      body.socialUsername
    );

    const evidenceUrl = limpiarTexto(
      body.evidence_url ||
      body.evidenceUrl
    );

    // ========================================================
    // 2. VALIDACIONES
    // ========================================================

    if (
      !nombre ||
      !apellido ||
      !email ||
      !telefono ||
      !estadoResidencia
    ) {
      return responderError(
        "Faltan datos obligatorios",
        400
      );
    }

    if (!validarEmail(email)) {
      return responderError(
        "El correo electrónico no es válido",
        400
      );
    }

    if (!validarTelefono(telefono)) {
      return responderError(
        "El teléfono no es válido",
        400
      );
    }

    if (!aceptaReglas) {
      return responderError(
        "Debes aceptar las reglas oficiales",
        400
      );
    }

    if (!cumpleRequisitos) {
      return responderError(
        "Debes confirmar que cumples los requisitos de participación",
        400
      );
    }

    if (!captchaToken) {
      return responderError(
        "Debes completar el CAPTCHA",
        400
      );
    }

    // ========================================================
    // 3. IP / USER AGENT
    // ========================================================

    const forwardedFor =
      req.headers.get("x-forwarded-for") || "";

    const clientIp =
      forwardedFor.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    const userAgent =
      req.headers.get("user-agent") || "";

    // ========================================================
    // 4. CAPTCHA
    // ========================================================

    const captchaOk = await verificarTurnstile(
      captchaToken,
      clientIp
    );

    if (!captchaOk) {
      return responderError(
        "CAPTCHA inválido o expirado",
        400
      );
    }

    // ========================================================
    // 5. FREE DROP
    //
    // El frontend normalmente envía freeDropId.
    // Conservamos también el fallback de tu implementación.
    // ========================================================

    let dropActivo = null;

    if (freeDropIdRaw) {
      const { data, error } = await supabase
        .from("free_drops")
        .select(
          `
            id,
            rifa_id,
            nombre,
            numero_drop,
            cupos_total,
            cupos_usados,
            estado
          `
        )
        .eq("id", freeDropIdRaw)
        .maybeSingle();

      if (error) {
        console.error(
          "Error buscando free drop:",
          error
        );

        return responderError(
          "No se pudo buscar el free drop",
          500
        );
      }

      if (
        !data ||
        String(data.estado || "")
          .toLowerCase() !== "activo"
      ) {
        return responderError(
          "El free drop seleccionado no está activo",
          409
        );
      }

      dropActivo = data;
    } else {
      const { data, error } = await supabase
        .from("free_drops")
        .select(
          `
            id,
            rifa_id,
            nombre,
            numero_drop,
            cupos_total,
            cupos_usados,
            estado
          `
        )
        .eq("estado", "activo")
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (error) {
        console.error(
          "Error buscando drop activo:",
          error
        );

        return responderError(
          "No se pudo buscar el drop activo",
          500
        );
      }

      dropActivo =
        Array.isArray(data) && data.length > 0
          ? data[0]
          : null;

      if (!dropActivo) {
        return responderError(
          "No hay un free drop activo en este momento",
          404
        );
      }
    }

    // ========================================================
    // 6. RIFA
    // ========================================================

    const { data: rifaData, error: errorRifa } =
      await supabase
        .from("rifas")
        .select("id, nombre, formato")
        .eq("id", dropActivo.rifa_id)
        .maybeSingle();

    if (errorRifa) {
      console.error(
        "Error cargando rifa:",
        errorRifa
      );

      return responderError(
        "No se pudo cargar la rifa relacionada",
        500
      );
    }

    if (!rifaData) {
      return responderError(
        "No se encontró la rifa relacionada",
        404
      );
    }

    const eventoNombre =
      rifaData.nombre || "Evento";

    const padLength =
      rifaData.formato === "3digitos"
        ? 3
        : 4;

    // ========================================================
    // 7. CÓDIGO FREE
    // ========================================================

    const codigoUnico =
      await generarCodigoFreeUnico(supabase);

    // ========================================================
    // 8. RPC TRANSACCIONAL
    // ========================================================

    const {
      data: rpcData,
      error: rpcError,
    } = await supabase.rpc(
      "assign_free_drop_participation",
      {
        p_free_drop_id: Number(
          dropActivo.id
        ),

        p_nombre: nombre,
        p_apellido: apellido,

        p_email: email,

        p_telefono: telefonoOriginal,

        p_telefono_normalized:
          telefono,

        p_estado_residencia:
          estadoResidencia,

        p_codigo_unico: codigoUnico,

        p_acepta_reglas:
          aceptaReglas,

        p_cumple_requisitos:
          cumpleRequisitos,

        p_social_username:
          socialUsername || null,

        p_evidence_url:
          evidenceUrl || null,

        p_ip_address:
          clientIp || null,

        p_user_agent:
          userAgent || null,
      }
    );

    if (rpcError) {
      console.error(
        "Error RPC FREE:",
        rpcError
      );

      const interpretado =
        interpretarErrorRpc(rpcError);

      return responderError(
        interpretado.mensaje,
        interpretado.status
      );
    }

    const resultado =
      Array.isArray(rpcData)
        ? rpcData[0]
        : rpcData;

    if (!resultado) {
      return responderError(
        "No se recibió el resultado de la participación",
        500
      );
    }

    // ========================================================
    // 9. RESULTADO DE LA TRANSACCIÓN
    // ========================================================

    const requiresReview =
      Boolean(resultado.manual_review);

    const estadoVisual =
      String(
        resultado.participation_estado ||
        ""
      ).toLowerCase() === "pendiente"
        ? "PENDIENTE"
        : "VÁLIDA";

    const freeDropNombre =
      dropActivo.nombre ||
      `FREE DROP #${dropActivo.numero_drop}`;

const tieneNumeroParticipacion =
  resultado.numero_ticket !== null &&
  resultado.numero_ticket !== undefined &&
  resultado.numero_ticket !== "";

const numeroParticipacion =
  tieneNumeroParticipacion
    ? Number(resultado.numero_ticket)
    : null;

const numeroFormateado =
  numeroParticipacion !== null &&
  Number.isFinite(numeroParticipacion)
    ? `#${String(numeroParticipacion).padStart(
        padLength,
        "0"
      )}`
    : null;

// ========================================================
// 10. EMAIL
//
// NUEVO FLUJO:
//
// Al registrarse NO se envía correo de ticket.
// La participación queda PENDIENTE y sin número.
//
// El correo definitivo se envía únicamente después
// de que Admin APRUEBA la participación y el backend
// asigna el número oficial.
// ========================================================

const emailEnviado = false;

    // ========================================================
    // 11. RESPUESTA COMPATIBLE CON TU FRONTEND ACTUAL
    // ========================================================

    return NextResponse.json({
      ok: true,

      message: requiresReview
        ? "Participación registrada. Queda pendiente de revisión."
        : "Participación registrada correctamente.",

      requires_review:
        requiresReview,

      estado_visual:
        estadoVisual,

      codigo_free:
        resultado.codigo_unico ||
        codigoUnico,

      numero_participacion:
        numeroParticipacion,

      email_enviado:
        emailEnviado,

      participacion: {
        id:
          resultado.participation_id,

        rifa_id:
          dropActivo.rifa_id,

        free_drop_id:
          resultado.drop_id,

        ticket_id:
          resultado.ticket_id,

        nombre,
        apellido,
        email,

        telefono:
          telefonoOriginal,

        estado_residencia:
          estadoResidencia,

        codigo_unico:
          resultado.codigo_unico ||
          codigoUnico,

        estado:
          resultado.participation_estado,

        numero_participacion:
          numeroParticipacion,

        numero_participacion_formateado:
          numeroFormateado,

        codigo_free:
          resultado.codigo_unico ||
          codigoUnico,

        estado_visual:
          estadoVisual,

        evento:
          eventoNombre,

        free_drop:
          freeDropNombre,
      },

      ticket: {
        id:
          resultado.ticket_id,

        numero_ticket:
          numeroParticipacion,
      },

      drop: {
        id:
          resultado.drop_id,

        nombre:
          freeDropNombre,

        numero_drop:
          dropActivo.numero_drop,

        estado:
          resultado.drop_estado,

        cupos_usados:
          Number(
            resultado.cupos_usados || 0
          ),

        cupos_total:
          Number(
            resultado.cupos_total || 0
          ),

        cupos_disponibles:
          Math.max(
            Number(
              resultado.cupos_total || 0
            ) -
            Number(
              resultado.cupos_usados || 0
            ),
            0
          ),
      },

      settings: {
        enabled: true,

        total_free_allowed:
          Number(
            resultado.total_free_allowed ||
            0
          ),

        released_total:
          Number(
            resultado.released_total ||
            0
          ),

        remaining_total:
          Math.max(
            Number(
              resultado.total_free_allowed ||
              0
            ) -
            Number(
              resultado.released_total ||
              0
            ),
            0
          ),
      },
    });
  } catch (error) {
    console.error(
      "Error en free drop participar:",
      error
    );

    return responderError(
      "Error inesperado al registrar la participación",
      500
    );
  }
}