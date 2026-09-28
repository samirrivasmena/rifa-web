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

function responderError(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

export async function GET(req) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const rifaId = limpiarTexto(searchParams.get("rifaId"));

    if (!rifaId) {
      return responderError("rifaId es requerido", 400);
    }

    const { data, error } = await supabase
      .from("free_drop_settings")
      .select(
        [
          "enabled",
          "total_free_allowed",
          "batch_size",
          "released_total",
          "one_ticket_per_person",
          "manual_review",
          "require_follow",
          "require_like",
          "require_comment",
          "require_share",
          "share_to_count",
          "instagram_profile_url",
          "instagram_post_url",
          "requirements_text",
          "public_message",
          "updated_at",
        ].join(",")
      )
      .eq("rifa_id", rifaId)
      .maybeSingle();

    if (error) {
      console.error("Error cargando configuración pública:", error);

      return responderError(
        "No se pudo cargar la configuración",
        500
      );
    }

    const settings = data || {
      enabled: false,
      total_free_allowed: 0,
      batch_size: 0,
      released_total: 0,

      one_ticket_per_person: true,
      manual_review: false,

      require_follow: false,
      require_like: false,
      require_comment: false,
      require_share: false,

      share_to_count: 0,

      // ======================================================
      // INSTAGRAM
      // ======================================================

      instagram_profile_url: "",
      instagram_post_url: "",

      requirements_text: "",
      public_message: "",

      updated_at: null,
    };

    // ========================================================
    // NORMALIZAR URLS PÚBLICAS
    // ========================================================

    const instagramProfileUrl = limpiarTexto(
      settings.instagram_profile_url
    );

    const instagramPostUrl = limpiarTexto(
      settings.instagram_post_url
    );

    // ========================================================
    // TOTAL RESTANTE
    // ========================================================

    const remaining_total = Math.max(
      Number(settings.total_free_allowed || 0) -
        Number(settings.released_total || 0),
      0
    );

    // ========================================================
    // RESPUESTA PÚBLICA
    // ========================================================

    return NextResponse.json({
      ok: true,

      settings: {
        ...settings,

        instagram_profile_url: instagramProfileUrl,
        instagram_post_url: instagramPostUrl,

        remaining_total,
      },
    });
  } catch (error) {
    console.error(
      "Error en GET /api/free-drops/settings:",
      error
    );

    return responderError(
      "Error inesperado al cargar la configuración",
      500
    );
  }
}