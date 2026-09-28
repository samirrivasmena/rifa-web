"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";

function toBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toNumber(value, fallback = 0, min = 0) {
  const num = Number(value);

  if (!Number.isFinite(num)) return fallback;

  return Math.max(num, min);
}

function emptyForm() {
  return {
    enabled: false,

    total_free_allowed: 250,
    batch_size: 25,
    released_total: 0,

    one_ticket_per_person: true,
    manual_review: false,

    require_follow: true,
    require_like: true,
    require_comment: true,
    require_share: true,

    share_to_count: 3,

    // ========================================================
    // INSTAGRAM
    // ========================================================

    instagram_profile_url: "",
    instagram_post_url: "",

    requirements_text:
      "Debes seguir la cuenta, dar me gusta, comentar y compartir a 3 personas.",

    public_message:
      "Participa gratis en el evento activo. Los cupos se liberan por tandas.",
  };
}

export default function AdminFreeDropsSettingsSection({
  rifaSeleccionada,
}) {
  const rifaId = rifaSeleccionada?.id || null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm());

  const disabled = loading || saving;

  // ==========================================================
  // CARGAR CONFIGURACIÓN
  // ==========================================================

  const cargarSettings = useCallback(async () => {
    if (!rifaId) return;

    try {
      setLoading(true);

      const headers = await getAdminAuthHeaders();

      const res = await fetch(
        `/api/admin-free-drop-settings?rifaId=${encodeURIComponent(rifaId)}`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || "No se pudo cargar la configuración"
        );
      }

      if (data.settings) {
        const totalRaw = toNumber(
          data.settings.total_free_allowed,
          250,
          0
        );

        const enabled = toBool(data.settings.enabled);

        setForm({
          enabled,

          total_free_allowed:
            enabled && totalRaw <= 0 ? 250 : totalRaw,

          batch_size: toNumber(
            data.settings.batch_size,
            25,
            1
          ),

          released_total: toNumber(
            data.settings.released_total,
            0,
            0
          ),

          one_ticket_per_person: toBool(
            data.settings.one_ticket_per_person
          ),

          manual_review: toBool(
            data.settings.manual_review
          ),

          require_follow: toBool(
            data.settings.require_follow
          ),

          require_like: toBool(
            data.settings.require_like
          ),

          require_comment: toBool(
            data.settings.require_comment
          ),

          require_share: toBool(
            data.settings.require_share
          ),

          share_to_count: toNumber(
            data.settings.share_to_count,
            3,
            0
          ),

          // ==================================================
          // INSTAGRAM
          // ==================================================

          instagram_profile_url:
            data.settings.instagram_profile_url || "",

          instagram_post_url:
            data.settings.instagram_post_url || "",

          requirements_text:
            data.settings.requirements_text ||
            "Debes seguir la cuenta, dar me gusta, comentar y compartir a 3 personas.",

          public_message:
            data.settings.public_message ||
            "Participa gratis en el evento activo. Los cupos se liberan por tandas.",
        });
      } else {
        setForm(emptyForm());
      }
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error.message ||
          "No se pudo cargar la configuración",
      });
    } finally {
      setLoading(false);
    }
  }, [rifaId]);

  useEffect(() => {
    cargarSettings();
  }, [cargarSettings]);

  // ==========================================================
  // CAMBIOS DEL FORMULARIO
  // ==========================================================

  const handleChange = (e) => {
    const {
      name,
      type,
      checked,
      value,
    } = e.target;

    setForm((prev) => {
      if (type === "checkbox") {
        if (
          name === "enabled" &&
          checked &&
          Number(prev.total_free_allowed || 0) <= 0
        ) {
          return {
            ...prev,
            enabled: checked,
            total_free_allowed: 250,
          };
        }

        return {
          ...prev,
          [name]: checked,
        };
      }

      if (type === "number") {
        return {
          ...prev,
          [name]:
            value === ""
              ? ""
              : Number(value),
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  // ==========================================================
  // FREE RESTANTES
  // ==========================================================

  const freeRestantes = useMemo(() => {
    return Math.max(
      Number(form.total_free_allowed || 0) -
        Number(form.released_total || 0),
      0
    );
  }, [
    form.total_free_allowed,
    form.released_total,
  ]);

  // ==========================================================
  // GUARDAR CONFIGURACIÓN
  // ==========================================================

  const guardarSettings = async (e) => {
    e.preventDefault();

    if (!rifaId) {
      await Swal.fire({
        icon: "warning",
        title: "Selecciona una rifa",
        text:
          "Primero selecciona una rifa para configurar los free drops.",
      });

      return;
    }

    const total = Number(
      form.total_free_allowed || 0
    );

    const liberados = Number(
      form.released_total || 0
    );

    const batch = Number(
      form.batch_size || 0
    );

    const shareToCount = Number(
      form.share_to_count || 0
    );

    // ========================================================
    // VALIDACIONES EXISTENTES
    // ========================================================

    if (form.enabled && total <= 0) {
      await Swal.fire({
        icon: "warning",
        title: "Configuración inválida",
        text:
          "Para activar free drops debes colocar un total mayor a 0.",
      });

      return;
    }

    if (batch <= 0) {
      await Swal.fire({
        icon: "warning",
        title: "Configuración inválida",
        text:
          "La cantidad por tanda debe ser mayor a 0.",
      });

      return;
    }

    if (liberados > total) {
      await Swal.fire({
        icon: "warning",
        title: "Configuración inválida",
        text:
          "Los liberados no pueden ser mayores que el total permitido.",
      });

      return;
    }

    // ========================================================
    // VALIDACIÓN DE COMPARTIR
    // ========================================================

    if (
      form.require_share &&
      shareToCount <= 0
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Configuración inválida",
        text:
          "Si el requisito de compartir está activo, debes indicar al menos 1 persona.",
      });

      return;
    }

    // ========================================================
    // VALIDACIÓN URL PERFIL INSTAGRAM
    // ========================================================

    if (
      form.require_follow &&
      !String(
        form.instagram_profile_url || ""
      ).trim()
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Falta el perfil de Instagram",
        text:
          "Como el requisito “Seguir la cuenta” está activo, debes colocar la URL del perfil de Instagram.",
      });

      return;
    }

    // ========================================================
    // VALIDACIÓN URL PUBLICACIÓN / REEL
    // ========================================================

    if (
      (form.require_like ||
        form.require_comment) &&
      !String(
        form.instagram_post_url || ""
      ).trim()
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Falta la publicación de Instagram",
        text:
          "Como el requisito de Me gusta o Comentar está activo, debes colocar la URL de la publicación o Reel.",
      });

      return;
    }

    try {
      setSaving(true);

      const headers =
        await getAdminAuthHeaders();

      const res = await fetch(
        "/api/admin-free-drop-settings",
        {
          method: "PATCH",

          headers: {
            ...headers,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            rifaId,

            enabled:
              form.enabled,

            total_free_allowed:
              total,

            batch_size:
              batch,

            /*
             * Lo enviamos para conservar la estructura
             * existente del frontend.
             *
             * El backend NO confía en este valor y conserva
             * released_total directamente desde la base
             * de datos.
             */
            released_total:
              liberados,

            one_ticket_per_person:
              form.one_ticket_per_person,

            manual_review:
              form.manual_review,

            require_follow:
              form.require_follow,

            require_like:
              form.require_like,

            require_comment:
              form.require_comment,

            require_share:
              form.require_share,

            share_to_count:
              shareToCount,

            // ================================================
            // INSTAGRAM
            // ================================================

            instagram_profile_url:
              String(
                form.instagram_profile_url ||
                  ""
              ).trim(),

            instagram_post_url:
              String(
                form.instagram_post_url ||
                  ""
              ).trim(),

            requirements_text:
              form.requirements_text,

            public_message:
              form.public_message,
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            "No se pudo guardar la configuración"
        );
      }

      await Swal.fire({
        icon: "success",
        title: "Guardado",
        text:
          data.message ||
          "Configuración actualizada correctamente",
      });

      await cargarSettings();
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error.message ||
          "No se pudo guardar la configuración",
      });
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // SIN RIFA SELECCIONADA
  // ==========================================================

  if (!rifaId) {
    return (
      <section
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",
          border:
            "1px solid rgba(255,255,255,.08)",
          borderRadius: "18px",
          padding: "24px",
          color: "#fff",
          boxShadow:
            "0 10px 30px rgba(0,0,0,.20)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
          }}
        >
          Configuración de Free Drops
        </h2>

        <p
          style={{
            marginTop: "10px",
            opacity: 0.8,
          }}
        >
          Selecciona una rifa para configurar
          los free drops.
        </p>
      </section>
    );
  }

  // ==========================================================
  // ESTILOS
  // ==========================================================

  const cardStyle = {
    background:
      "rgba(17,24,39,.92)",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius: "16px",

    padding: "16px",

    boxShadow:
      "0 10px 30px rgba(0,0,0,.18)",
  };

  const inputStyle = {
    width: "100%",

    minHeight: "44px",

    borderRadius: "12px",

    border:
      "1px solid rgba(255,255,255,.10)",

    background:
      "rgba(3,7,18,.92)",

    color: "#fff",

    padding: "0 12px",

    outline: "none",
  };

  const readOnlyInputStyle = {
    ...inputStyle,

    background:
      "rgba(15,23,42,.72)",

    opacity: 0.8,

    cursor: "not-allowed",
  };

  const textareaStyle = {
    width: "100%",

    borderRadius: "12px",

    border:
      "1px solid rgba(255,255,255,.10)",

    background:
      "rgba(3,7,18,.92)",

    color: "#fff",

    padding: "12px",

    outline: "none",

    resize: "vertical",

    minHeight: "120px",

    lineHeight: 1.6,
  };

  const labelStyle = {
    display: "block",

    fontSize: "12px",

    fontWeight: 700,

    letterSpacing: ".02em",

    textTransform: "uppercase",

    opacity: 0.78,

    marginBottom: "8px",
  };

  const summaryCardStyle = {
    ...cardStyle,

    display: "flex",

    flexDirection: "column",

    gap: "6px",

    minHeight: "86px",

    justifyContent: "center",
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section
      style={{
        marginTop: "18px",

        background:
          "linear-gradient(180deg, rgba(15,23,42,.97), rgba(15,23,42,.92))",

        border:
          "1px solid rgba(255,255,255,.08)",

        borderRadius: "20px",

        padding: "18px",

        color: "#fff",
      }}
    >
      {/* =====================================================
          CABECERA
      ===================================================== */}

      <div
        className="adminpro-section-head"
        style={{
          marginBottom: "16px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            Configuración de Free Drops
          </h2>

          <p
            style={{
              marginTop: "8px",
              opacity: 0.75,
            }}
          >
            Ajusta cuántos tickets gratis
            quieres liberar y cómo funcionará
            la campaña.
          </p>
        </div>
      </div>

      {/* =====================================================
          RESUMEN
      ===================================================== */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",

          gap: "12px",

          marginBottom: "18px",
        }}
      >
        <div style={summaryCardStyle}>
          <span
            style={{
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Estado
          </span>

          <strong
            style={{
              color: form.enabled
                ? "#22c55e"
                : "#f59e0b",

              fontSize: "20px",

              lineHeight: 1.2,
            }}
          >
            {form.enabled
              ? "ACTIVO"
              : "DESACTIVADO"}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span
            style={{
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Total permitido
          </span>

          <strong
            style={{
              fontSize: "20px",
            }}
          >
            {form.total_free_allowed || 0}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span
            style={{
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Liberados
          </span>

          <strong
            style={{
              fontSize: "20px",
            }}
          >
            {form.released_total || 0}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span
            style={{
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Restantes
          </span>

          <strong
            style={{
              fontSize: "20px",
            }}
          >
            {freeRestantes}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span
            style={{
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Tanda
          </span>

          <strong
            style={{
              fontSize: "20px",
            }}
          >
            {form.batch_size || 0}
          </strong>
        </div>
      </div>

      {/* =====================================================
          FORMULARIO
      ===================================================== */}

      <form onSubmit={guardarSettings}>
        {/* ===================================================
            SWITCHES Y CANTIDADES
        =================================================== */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",

            gap: "14px",
          }}
        >
          {[
            [
              "Activar free drops",
              "enabled",
            ],

            [
              "Revisión manual",
              "manual_review",
            ],

            [
              "1 ticket por persona",
              "one_ticket_per_person",
            ],

            [
              "Seguir la cuenta",
              "require_follow",
            ],

            [
              "Dar me gusta",
              "require_like",
            ],

            [
              "Comentar",
              "require_comment",
            ],

            [
              "Compartir",
              "require_share",
            ],
          ].map(([label, name]) => (
            <label
              key={name}
              style={{
                ...cardStyle,

                display: "flex",

                alignItems: "center",

                justifyContent:
                  "space-between",

                gap: "12px",
              }}
            >
              <span style={labelStyle}>
                {label}
              </span>

              <input
                type="checkbox"
                name={name}
                checked={Boolean(
                  form[name]
                )}
                onChange={handleChange}
                disabled={disabled}
              />
            </label>
          ))}

          {/* TOTAL FREE */}

          <label style={cardStyle}>
            <span style={labelStyle}>
              Total tickets gratis permitidos
            </span>

            <input
              type="number"
              name="total_free_allowed"
              min="0"
              value={
                form.total_free_allowed
              }
              onChange={handleChange}
              disabled={disabled}
              style={inputStyle}
            />
          </label>

          {/* CANTIDAD POR TANDA */}

          <label style={cardStyle}>
            <span style={labelStyle}>
              Cantidad por tanda
            </span>

            <input
              type="number"
              name="batch_size"
              min="1"
              value={form.batch_size}
              onChange={handleChange}
              disabled={disabled}
              style={inputStyle}
            />
          </label>

          {/* YA LIBERADOS */}

          <label style={cardStyle}>
            <span style={labelStyle}>
              Ya liberados
            </span>

            <input
              type="number"
              name="released_total"
              min="0"
              value={
                form.released_total
              }
              readOnly
              aria-readonly="true"
              style={
                readOnlyInputStyle
              }
            />

            <small
              style={{
                display: "block",

                marginTop: "8px",

                opacity: 0.7,

                lineHeight: 1.45,
              }}
            >
              Este contador se actualiza
              automáticamente cuando se
              registran participaciones FREE.
            </small>
          </label>

          {/* COMPARTIR */}

          <label style={cardStyle}>
            <span style={labelStyle}>
              Compartir a cuántas personas
            </span>

            <input
              type="number"
              name="share_to_count"
              min="0"
              value={
                form.share_to_count
              }
              onChange={handleChange}
              disabled={disabled}
              style={inputStyle}
            />

            <small
              style={{
                display: "block",

                marginTop: "8px",

                opacity: 0.7,

                lineHeight: 1.45,
              }}
            >
              Este número aparecerá
              automáticamente en el requisito
              público de compartir.
            </small>
          </label>
        </div>

        {/* ===================================================
            CONFIGURACIÓN DE INSTAGRAM
        =================================================== */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(300px, 1fr))",

            gap: "14px",

            marginTop: "14px",
          }}
        >
          {/* URL PERFIL */}

          <label style={cardStyle}>
            <span style={labelStyle}>
              URL del perfil de Instagram
            </span>

            <input
              type="url"
              name="instagram_profile_url"
              value={
                form.instagram_profile_url
              }
              onChange={handleChange}
              disabled={disabled}
              placeholder="https://www.instagram.com/tu_cuenta/"
              autoComplete="off"
              style={inputStyle}
            />

            <small
              style={{
                display: "block",

                marginTop: "8px",

                opacity: 0.7,

                lineHeight: 1.45,
              }}
            >
              Se utilizará en el botón
              “Abrir Instagram” cuando
              Seguir la cuenta esté activo.
            </small>
          </label>

          {/* URL PUBLICACIÓN */}

          <label style={cardStyle}>
            <span style={labelStyle}>
              URL de la publicación / Reel
            </span>

            <input
              type="url"
              name="instagram_post_url"
              value={
                form.instagram_post_url
              }
              onChange={handleChange}
              disabled={disabled}
              placeholder="https://www.instagram.com/reel/..."
              autoComplete="off"
              style={inputStyle}
            />

            <small
              style={{
                display: "block",

                marginTop: "8px",

                opacity: 0.7,

                lineHeight: 1.45,
              }}
            >
              Se utilizará en el botón
              “Ver publicación” para los
              requisitos de Me gusta y
              Comentar.
            </small>
          </label>
        </div>

        {/* ===================================================
            TEXTOS
        =================================================== */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "1fr",

            gap: "14px",

            marginTop: "14px",
          }}
        >
          <label style={cardStyle}>
            <span style={labelStyle}>
              Texto de requisitos
            </span>

            <textarea
              name="requirements_text"
              value={
                form.requirements_text
              }
              onChange={handleChange}
              rows={4}
              disabled={disabled}
              style={textareaStyle}
            />
          </label>

          <label style={cardStyle}>
            <span style={labelStyle}>
              Mensaje público
            </span>

            <textarea
              name="public_message"
              value={
                form.public_message
              }
              onChange={handleChange}
              rows={4}
              disabled={disabled}
              style={textareaStyle}
            />
          </label>
        </div>

        {/* ===================================================
            BOTONES
        =================================================== */}

        <div
          style={{
            display: "flex",

            justifyContent:
              "flex-end",

            gap: "12px",

            flexWrap: "wrap",

            marginTop: "16px",
          }}
        >
          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={
              cargarSettings
            }
            disabled={disabled}
          >
            {loading
              ? "Cargando..."
              : "Recargar"}
          </button>

          <button
            type="submit"
            className="adminpro-red-btn"
            disabled={disabled}
          >
            {saving
              ? "Guardando..."
              : "Guardar configuración"}
          </button>
        </div>
      </form>
    </section>
  );
}