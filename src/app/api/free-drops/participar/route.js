import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function normalizarTelefono(valor) {
  return String(valor ?? "").replace(/[^\d]/g, "");
}

function generarCodigoUnico() {
  return `FREE-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function validarEmail(email) {
  const value = String(email || "").trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(value);
}

function validarTelefono(telefono) {
  const value = String(telefono || "").replace(/[^\d]/g, "");
  return value.length >= 8 && value.length <= 15;
}

async function verificarTurnstile(token, ip = "") {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    throw new Error("Falta TURNSTILE_SECRET_KEY en el servidor");
  }

  if (!token) return false;

  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);

  if (ip) {
    formData.append("remoteip", ip);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  return data.success === true;
}

function responderError(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

export async function POST(req) {
  const supabase = getSupabaseServerClient();

  try {
    const body = await req.json();

    const nombre = limpiarTexto(body.nombre);
    const email = limpiarTexto(body.email).toLowerCase();
    const telefonoOriginal = limpiarTexto(body.telefono);
    const telefono = normalizarTelefono(telefonoOriginal);
    const freeDropId = limpiarTexto(body.freeDropId);
    const captchaToken = limpiarTexto(body.captchaToken);

    const socialUsername = limpiarTexto(body.social_username || body.socialUsername);
    const evidenceUrl = limpiarTexto(body.evidence_url || body.evidenceUrl);

    if (!nombre || !email || !telefono) {
      return responderError("Faltan datos obligatorios", 400);
    }

    if (!validarEmail(email)) {
      return responderError("El correo electrónico no es válido", 400);
    }

    if (!validarTelefono(telefono)) {
      return responderError("El teléfono no es válido", 400);
    }

    if (!captchaToken) {
      return responderError("Debes completar el CAPTCHA", 400);
    }

    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const clientIp =
      forwardedFor.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    const captchaOk = await verificarTurnstile(captchaToken, clientIp);

    if (!captchaOk) {
      return responderError("CAPTCHA inválido o expirado", 400);
    }

    // ==========================================================
    // 1) BUSCAR FREE DROP ACTIVO
    // ==========================================================
    let dropActivo = null;

    if (freeDropId) {
      const { data: drop, error: errorDrop } = await supabase
        .from("free_drops")
        .select("id, rifa_id, nombre, numero_drop, cupos_total, cupos_usados, estado")
        .eq("id", freeDropId)
        .maybeSingle();

      if (errorDrop) {
        console.error("Error buscando free drop por ID:", errorDrop);
        return responderError("No se pudo buscar el free drop", 500);
      }

      if (!drop || normalizarTexto(drop.estado) !== "activo") {
        return responderError(
          "El free drop seleccionado no está activo",
          409
        );
      }

      dropActivo = drop;
    } else {
      const { data: dropsActivos, error: errorDrop } = await supabase
        .from("free_drops")
        .select("id, rifa_id, nombre, numero_drop, cupos_total, cupos_usados, estado")
        .eq("estado", "activo")
        .order("created_at", { ascending: false })
        .limit(1);

      if (errorDrop) {
        console.error("Error buscando drop activo:", errorDrop);
        return responderError("No se pudo buscar el drop activo", 500);
      }

      dropActivo = Array.isArray(dropsActivos) ? dropsActivos[0] : null;

      if (!dropActivo) {
        return responderError(
          "No hay un free drop activo en este momento",
          404
        );
      }
    }

    // ==========================================================
    // 2) CARGAR CONFIGURACIÓN GENERAL DE FREE DROPS
    // ==========================================================
    const { data: settings, error: errorSettings } = await supabase
      .from("free_drop_settings")
      .select(
        "enabled,total_free_allowed,batch_size,released_total,one_ticket_per_person,manual_review,require_follow,require_like,require_comment,require_share,share_to_count,requirements_text,public_message"
      )
      .eq("rifa_id", dropActivo.rifa_id)
      .maybeSingle();

    if (errorSettings) {
      console.error("Error cargando free_drop_settings:", errorSettings);
      return responderError("No se pudo cargar la configuración del free drop", 500);
    }

    if (!settings || !settings.enabled) {
      return responderError(
        "La campaña de free drops está desactivada",
        409
      );
    }

    const totalFreeAllowed = Number(settings.total_free_allowed || 0);
    const releasedTotal = Number(settings.released_total || 0);
    const remainingTotal = Math.max(totalFreeAllowed - releasedTotal, 0);

    if (totalFreeAllowed > 0 && remainingTotal <= 0) {
      return responderError(
        "Ya se liberó el total de free drops permitidos",
        409
      );
    }

    // ==========================================================
    // 3) VALIDAR PARTICIPACIÓN ÚNICA
    // ==========================================================
    if (settings.one_ticket_per_person !== false) {
      const { data: yaExisteEmail, error: errorEmail } = await supabase
        .from("free_drop_participations")
        .select("id")
        .eq("free_drop_id", dropActivo.id)
        .eq("email_normalized", email)
        .maybeSingle();

      if (errorEmail) {
        console.error("Error verificando email:", errorEmail);
        return responderError("No se pudo verificar el correo", 500);
      }

      if (yaExisteEmail) {
        return responderError(
          "Ya participaste en este free drop con este correo",
          409
        );
      }

      const { data: yaExisteTelefono, error: errorTelefono } = await supabase
        .from("free_drop_participations")
        .select("id")
        .eq("free_drop_id", dropActivo.id)
        .eq("telefono_normalized", telefono)
        .maybeSingle();

      if (errorTelefono) {
        console.error("Error verificando teléfono:", errorTelefono);
        return responderError("No se pudo verificar el teléfono", 500);
      }

      if (yaExisteTelefono) {
        return responderError(
          "Ya participaste en este free drop con este teléfono",
          409
        );
      }
    }

    // ==========================================================
    // 4) BUSCAR UN TICKET DISPONIBLE REAL
    // ==========================================================
    const { data: ticketsLibres, error: errorTickets } = await supabase
      .from("tickets")
      .select("id, numero_ticket")
      .eq("rifa_id", dropActivo.rifa_id)
      .eq("estado", "disponible")
      .order("numero_ticket", { ascending: true });

    if (errorTickets) {
      console.error("Error buscando tickets libres:", errorTickets);
      return responderError("No se pudieron buscar tickets disponibles", 500);
    }

    if (!ticketsLibres || ticketsLibres.length === 0) {
      return responderError("No hay tickets disponibles para asignar", 409);
    }

    const ticketElegido =
      ticketsLibres[Math.floor(Math.random() * ticketsLibres.length)];

    const estadoParticipacion = settings.manual_review ? "pendiente" : "activo";
    const codigoUnico = generarCodigoUnico();

    // ==========================================================
    // 5) RESERVAR TICKET
    // ==========================================================
    const { data: ticketReservado, error: errorTicketReserva } = await supabase
      .from("tickets")
      .update({
        tipo: "free",
        estado: "asignado",
        free_drop_id: dropActivo.id,
        asignado_a_nombre: nombre,
        asignado_a_email: email,
        asignado_a_telefono: telefonoOriginal,
        asignado_at: new Date().toISOString(),
      })
      .eq("id", ticketElegido.id)
      .eq("estado", "disponible")
      .select("id, numero_ticket")
      .maybeSingle();

    if (errorTicketReserva) {
      console.error("Error reservando ticket:", errorTicketReserva);
      return responderError("No se pudo asignar el ticket", 500);
    }

    if (!ticketReservado) {
      return responderError(
        "Ese ticket ya no está disponible. Intenta de nuevo.",
        409
      );
    }

    // ==========================================================
    // 6) CREAR PARTICIPACIÓN
    // ==========================================================
    const { data: participacionCreada, error: errorParticipacion } =
      await supabase
        .from("free_drop_participations")
        .insert([
          {
            rifa_id: dropActivo.rifa_id,
            free_drop_id: dropActivo.id,
            ticket_id: ticketReservado.id,
            nombre,
            email,
            email_normalized: email,
            telefono: telefonoOriginal,
            telefono_normalized: telefono,
            codigo_unico: codigoUnico,
            estado: estadoParticipacion,
            social_username: socialUsername || null,
            evidence_url: evidenceUrl || null,
            ip_address: clientIp || null,
            user_agent: req.headers.get("user-agent") || null,
          },
        ])
        .select(
          "id, rifa_id, free_drop_id, ticket_id, nombre, email, telefono, codigo_unico, estado, created_at"
        )
        .single();

    if (errorParticipacion) {
      console.error("Error creando participación:", errorParticipacion);

      await supabase
        .from("tickets")
        .update({
          tipo: null,
          estado: "disponible",
          free_drop_id: null,
          asignado_a_nombre: null,
          asignado_a_email: null,
          asignado_a_telefono: null,
          asignado_at: null,
        })
        .eq("id", ticketReservado.id);

      if (errorParticipacion.code === "23505") {
        return responderError(
          "Ya participaste en este free drop con esos datos",
          409
        );
      }

      return responderError("No se pudo registrar la participación", 500);
    }

    // ==========================================================
    // 7) ACTUALIZAR CUPOS DEL DROP
    // ==========================================================
    const nuevosUsados = Number(dropActivo.cupos_usados || 0) + 1;
    const estadoDropFinal =
      nuevosUsados >= Number(dropActivo.cupos_total || 0)
        ? "agotado"
        : "activo";

    const { error: errorActualizarDrop } = await supabase
      .from("free_drops")
      .update({
        cupos_usados: nuevosUsados,
        estado: estadoDropFinal,
      })
      .eq("id", dropActivo.id);

    if (errorActualizarDrop) {
      console.error("Error actualizando free drop:", errorActualizarDrop);

      await supabase
        .from("free_drop_participations")
        .delete()
        .eq("id", participacionCreada.id);

      await supabase
        .from("tickets")
        .update({
          tipo: null,
          estado: "disponible",
          free_drop_id: null,
          asignado_a_nombre: null,
          asignado_a_email: null,
          asignado_a_telefono: null,
          asignado_at: null,
        })
        .eq("id", ticketReservado.id);

      return responderError("No se pudo actualizar el free drop", 500);
    }

    // ==========================================================
    // 8) ACTUALIZAR CONTADOR GENERAL DE CONFIGURACIÓN
    // ==========================================================
    const nuevosLiberados = releasedTotal + 1;

    const { error: errorActualizarSettings } = await supabase
      .from("free_drop_settings")
      .update({
        released_total: nuevosLiberados,
      })
      .eq("rifa_id", dropActivo.rifa_id);

    if (errorActualizarSettings) {
      console.error("Error actualizando settings:", errorActualizarSettings);

      await supabase
        .from("free_drops")
        .update({
          cupos_usados: Number(dropActivo.cupos_usados || 0),
          estado: dropActivo.estado,
        })
        .eq("id", dropActivo.id);

      await supabase
        .from("free_drop_participations")
        .delete()
        .eq("id", participacionCreada.id);

      await supabase
        .from("tickets")
        .update({
          tipo: null,
          estado: "disponible",
          free_drop_id: null,
          asignado_a_nombre: null,
          asignado_a_email: null,
          asignado_a_telefono: null,
          asignado_at: null,
        })
        .eq("id", ticketReservado.id);

      return responderError("No se pudo actualizar la configuración del free drop", 500);
    }

    // ==========================================================
    // RESPUESTA FINAL
    // ==========================================================
    return NextResponse.json({
      ok: true,
      message: settings.manual_review
        ? "Participación registrada. Queda pendiente de revisión."
        : "Participación registrada correctamente.",
      requires_review: Boolean(settings.manual_review),
      participacion: participacionCreada,
      ticket: {
        id: ticketReservado.id,
        numero_ticket: ticketReservado.numero_ticket,
      },
      drop: {
        id: dropActivo.id,
        estado: estadoDropFinal,
        cupos_usados: nuevosUsados,
        cupos_total: dropActivo.cupos_total,
        cupos_disponibles: Math.max(
          Number(dropActivo.cupos_total || 0) - nuevosUsados,
          0
        ),
      },
      settings: {
        enabled: Boolean(settings.enabled),
        total_free_allowed: totalFreeAllowed,
        released_total: nuevosLiberados,
        remaining_total: Math.max(totalFreeAllowed - nuevosLiberados, 0),
      },
    });
  } catch (error) {
    console.error("Error en free drop participar:", error);
    return responderError("Error inesperado al registrar la participación", 500);
  }
}