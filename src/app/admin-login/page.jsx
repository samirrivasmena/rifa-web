"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Swal from "sweetalert2";

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
      <path
        d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12l1.8 1.8L15 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.5 12a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6A2.5 2.5 0 0012 17a2.5 2.5 0 002.4-3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.2 8.2C3.9 9.4 3 12 3 12s3.5 7 9 7c1.1 0 2.1-.2 3-.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 5.5A9.9 9.9 0 0112 5c6.5 0 10 7 10 7s-1 2.4-2.8 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AdminLogin() {
  const router = useRouter();

  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState(false);

  /* =========================================================
     MFA
  ========================================================= */

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  /* =========================================================
     TURNSTILE
  ========================================================= */

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    if (!siteKey) {
      console.error(
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY no está configurada"
      );

      setTurnstileError(true);
      return;
    }

    const renderTurnstile = () => {
      if (cancelled) return;

      if (
        !window.turnstile ||
        !turnstileContainerRef.current
      ) {
        retryTimer = setTimeout(renderTurnstile, 100);
        return;
      }

      if (turnstileWidgetIdRef.current !== null) {
        return;
      }

      try {
        const widgetId = window.turnstile.render(
          turnstileContainerRef.current,
          {
            sitekey: siteKey,

            theme: "light",

            size: "flexible",

            appearance: "always",

            callback: (token) => {
              if (cancelled) return;

              setTurnstileToken(token || "");
              setTurnstileReady(Boolean(token));
              setTurnstileError(false);
            },

            "expired-callback": () => {
              if (cancelled) return;

              setTurnstileToken("");
              setTurnstileReady(false);
            },

            "timeout-callback": () => {
              if (cancelled) return;

              setTurnstileToken("");
              setTurnstileReady(false);
            },

            "error-callback": () => {
              if (cancelled) return;

              setTurnstileToken("");
              setTurnstileReady(false);
              setTurnstileError(true);
            },
          }
        );

        turnstileWidgetIdRef.current = widgetId;
      } catch (error) {
        console.error(
          "Error cargando Turnstile:",
          error
        );

        setTurnstileError(true);
      }
    };

    const scriptExistente = document.querySelector(
      'script[data-admin-turnstile="true"]'
    );

    if (scriptExistente) {
      renderTurnstile();
    } else {
      const script = document.createElement("script");

      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

      script.async = true;
      script.defer = true;

      script.dataset.adminTurnstile = "true";

      script.onload = () => {
        renderTurnstile();
      };

      script.onerror = () => {
        if (cancelled) return;

        console.error(
          "No se pudo cargar Cloudflare Turnstile"
        );

        setTurnstileError(true);
      };

      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      if (
        window.turnstile &&
        turnstileWidgetIdRef.current !== null
      ) {
        try {
          window.turnstile.remove(
            turnstileWidgetIdRef.current
          );
        } catch {
          // No hacemos nada.
        }
      }

      turnstileWidgetIdRef.current = null;
    };
  }, [siteKey]);

  /* =========================================================
     REINICIAR TURNSTILE
  ========================================================= */

  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileReady(false);

    if (
      window.turnstile &&
      turnstileWidgetIdRef.current !== null
    ) {
      try {
        window.turnstile.reset(
          turnstileWidgetIdRef.current
        );
      } catch (error) {
        console.error(
          "No se pudo reiniciar Turnstile:",
          error
        );
      }
    }
  };

  /* =========================================================
     COMPROBAR MFA
  ========================================================= */

  const comprobarMFA = async () => {
    const {
      data: aalData,
      error: aalError,
    } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      throw aalError;
    }

    /*
      Si ya estamos en AAL2, MFA ya fue verificado.
    */

    if (aalData?.currentLevel === "aal2") {
      return {
        required: false,
        verified: true,
      };
    }

    /*
      aal1 -> aal2:
      contraseña correcta y existe MFA,
      pero todavía falta verificarlo.
    */

    if (
      aalData?.currentLevel === "aal1" &&
      aalData?.nextLevel === "aal2"
    ) {
      const {
        data: factorsData,
        error: factorsError,
      } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw factorsError;
      }

      const factor =
        factorsData?.totp?.find(
          (item) =>
            item.status === "verified"
        );

      if (!factor?.id) {
        throw new Error(
          "No se encontró el autenticador MFA registrado."
        );
      }

      setMfaFactorId(factor.id);
      setMfaCode("");
      setMfaRequired(true);

      return {
        required: true,
        verified: false,
      };
    }

    throw new Error(
      "No se pudo determinar el nivel de seguridad MFA."
    );
  };

  /* =========================================================
     FINALIZAR LOGIN ADMIN
  ========================================================= */

  const finalizarLoginAdmin = async () => {
    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    const token =
      sessionData?.session?.access_token;

    if (sessionError || !token) {
      await supabase.auth.signOut();

      throw new Error(
        "No se pudo obtener una sesión válida."
      );
    }

    /* =====================================================
       COMPROBAR ADMIN + AAL2 EN EL SERVIDOR
    ===================================================== */

    const adminRes = await fetch(
      "/api/admin-check",
      {
        method: "GET",

        cache: "no-store",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

    let adminData = null;

    try {
      adminData =
        await adminRes.json();
    } catch {
      adminData = null;
    }

    if (
      !adminRes.ok ||
      !adminData?.ok
    ) {
      throw new Error(
        adminData?.error ||
        "No se pudo verificar el acceso administrativo."
      );
    }

    /* =====================================================
       LOGIN COMPLETAMENTE CORRECTO
       LIMPIAR INTENTOS FALLIDOS
    ===================================================== */

    try {
      const clearRes = await fetch(
        "/api/admin-security/rate-limit",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          cache: "no-store",

          body: JSON.stringify({
            action: "success",
          }),
        }
      );

      if (!clearRes.ok) {
        console.error(
          "No se pudo limpiar el contador de intentos."
        );
      }
    } catch (clearError) {
      console.error(
        "Error limpiando intentos:",
        clearError
      );
    }

    /* =====================================================
       ENTRAR AL ADMIN
    ===================================================== */

    await Swal.fire({
      icon: "success",
      title: "Bienvenido",
      text: "Acceso seguro concedido al panel admin",
      timer: 1200,
      showConfirmButton: false,
    });

    setPassword("");
    setMfaCode("");
    setMfaFactorId("");
    setMfaRequired(false);

    router.replace("/admin");
  };

  /* =========================================================
     VERIFICAR CÓDIGO MFA
  ========================================================= */

  const verificarMFA = async (e) => {
    e.preventDefault();

    if (mfaLoading) return;

    const codigo =
      mfaCode.replace(/\D/g, "");

    if (codigo.length !== 6) {
      await Swal.fire({
        icon: "warning",
        title: "Código incompleto",
        text: "Ingresa los 6 dígitos de tu aplicación Authenticator.",
      });

      return;
    }

    if (!mfaFactorId) {
      await Swal.fire({
        icon: "error",
        title: "MFA no disponible",
        text: "No se encontró el autenticador registrado. Inicia sesión nuevamente.",
      });

      return;
    }

    try {
      setMfaLoading(true);

      /* =====================================================
         1. CREAR CHALLENGE MFA
      ===================================================== */

      const {
        data: challengeData,
        error: challengeError,
      } =
        await supabase.auth.mfa.challenge({
          factorId: mfaFactorId,
        });

      if (challengeError) {
        throw challengeError;
      }

      if (!challengeData?.id) {
        throw new Error(
          "No se pudo crear el desafío MFA."
        );
      }

      /* =====================================================
         2. VERIFICAR CÓDIGO TOTP
      ===================================================== */

      const {
        error: verifyError,
      } =
        await supabase.auth.mfa.verify({
          factorId: mfaFactorId,

          challengeId:
            challengeData.id,

          code: codigo,
        });

      if (verifyError) {
        setMfaCode("");

        await Swal.fire({
          icon: "error",
          title: "Código incorrecto",
          text: "El código no es válido o expiró. Usa el código actual de tu Authenticator.",
        });

        return;
      }

      /* =====================================================
         3. CONFIRMAR AAL2
      ===================================================== */

      const {
        data: aalData,
        error: aalError,
      } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        throw aalError;
      }

      if (
        aalData?.currentLevel !== "aal2"
      ) {
        throw new Error(
          "La sesión todavía no alcanzó el nivel MFA requerido."
        );
      }

      /* =====================================================
         4. MFA CORRECTO
         AHORA SÍ COMPROBAR ADMIN
      ===================================================== */

      await finalizarLoginAdmin();
    } catch (error) {
      console.error(
        "Error verificando MFA:",
        error
      );

      await Swal.fire({
        icon: "error",
        title: "Error de verificación",
        text:
          error?.message ||
          "No se pudo completar la verificación MFA.",
      });
    } finally {
      setMfaLoading(false);
    }
  };

  /* =========================================================
     LOGIN
  ========================================================= */

  const iniciarSesion = async (e) => {
    e.preventDefault();

    if (loading) return;

    const emailLimpio =
      email.trim().toLowerCase();

    const passwordLimpia =
      password;

    if (
      !emailLimpio ||
      !passwordLimpia
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Debes ingresar tu correo y contraseña",
      });

      return;
    }

    if (
      !turnstileToken ||
      !turnstileReady
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Verificación requerida",
        text: "Completa la verificación de seguridad antes de continuar",
      });

      return;
    }

    try {
      setLoading(true);

      /* =====================================================
         1. COMPROBAR BLOQUEO / RATE LIMIT
      ===================================================== */

      const rateCheckRes = await fetch(
        "/api/admin-security/rate-limit",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          cache: "no-store",

          body: JSON.stringify({
            action: "check",
          }),
        }
      );

      let rateCheckData = null;

      try {
        rateCheckData =
          await rateCheckRes.json();
      } catch {
        rateCheckData = null;
      }

      if (
        rateCheckRes.status === 429 ||
        rateCheckData?.blocked ||
        rateCheckData?.allowed === false
      ) {
        const segundos =
          Math.max(
            1,
            Number(
              rateCheckData?.retryAfter
            ) || 60
          );

        const minutos =
          Math.ceil(
            segundos / 60
          );

        resetTurnstile();

        await Swal.fire({
          icon: "warning",
          title:
            "Acceso temporalmente bloqueado",

          text:
            minutos <= 1
              ? "Demasiados intentos. Espera aproximadamente 1 minuto antes de volver a intentarlo."
              : `Demasiados intentos. Espera aproximadamente ${minutos} minutos antes de volver a intentarlo.`,

          confirmButtonText:
            "Entendido",
        });

        return;
      }

      if (
        !rateCheckRes.ok ||
        !rateCheckData?.ok
      ) {
        resetTurnstile();

        await Swal.fire({
          icon: "error",
          title:
            "Seguridad no disponible",
          text:
            "No se pudo comprobar la seguridad del acceso. Inténtalo nuevamente.",
        });

        return;
      }

      /* =====================================================
         2. VALIDAR TURNSTILE EN EL SERVIDOR
      ===================================================== */

      const seguridadRes =
        await fetch(
          "/api/admin-security/verify",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache: "no-store",

            body: JSON.stringify({
              turnstileToken,
            }),
          }
        );

      let seguridadData = null;

      try {
        seguridadData =
          await seguridadRes.json();
      } catch {
        seguridadData = null;
      }

      /*
        Turnstile es de un solo uso.
      */

      resetTurnstile();

      if (
        !seguridadRes.ok ||
        !seguridadData?.ok ||
        !seguridadData?.verified
      ) {
        await Swal.fire({
          icon: "error",
          title:
            "Verificación rechazada",

          text:
            seguridadData?.error ||
            "No se pudo completar la verificación de seguridad",
        });

        return;
      }

      /* =====================================================
         3. AUTENTICAR CONTRASEÑA CON SUPABASE
      ===================================================== */

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword({
          email: emailLimpio,
          password: passwordLimpia,
        });

      /* =====================================================
         4. CONTRASEÑA INCORRECTA
         REGISTRAR INTENTO FALLIDO
      ===================================================== */

      if (error) {
        setPassword("");

        let failureData = null;

        try {
          const failureRes =
            await fetch(
              "/api/admin-security/rate-limit",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                cache: "no-store",

                body: JSON.stringify({
                  action: "failure",
                }),
              }
            );

          try {
            failureData =
              await failureRes.json();
          } catch {
            failureData = null;
          }
        } catch (rateError) {
          console.error(
            "No se pudo registrar el intento fallido:",
            rateError
          );
        }

        if (
          failureData?.blocked &&
          Number(
            failureData?.retryAfter
          ) > 0
        ) {
          const minutos =
            Math.max(
              1,
              Math.ceil(
                Number(
                  failureData.retryAfter
                ) / 60
              )
            );

          await Swal.fire({
            icon: "warning",
            title:
              "Demasiados intentos",

            text:
              minutos <= 1
                ? "El acceso ha sido bloqueado temporalmente. Espera aproximadamente 1 minuto."
                : `El acceso ha sido bloqueado temporalmente. Espera aproximadamente ${minutos} minutos.`,

            confirmButtonText:
              "Entendido",
          });

          return;
        }

        await Swal.fire({
          icon: "error",
          title: "Error de acceso",
          text:
            "Correo o contraseña inválidos",
        });

        return;
      }

      /* =====================================================
         5. COMPROBAR SESIÓN
      ===================================================== */

      const token =
        data?.session?.access_token;

      if (!token) {
        await supabase.auth.signOut();

        setPassword("");

        await Swal.fire({
          icon: "error",
          title: "Acceso rechazado",
          text:
            "No se pudo crear una sesión válida",
        });

        return;
      }

      /* =====================================================
         6. COMPROBAR MFA
      ===================================================== */

      const estadoMFA =
        await comprobarMFA();

      /*
        Si tenemos:
        currentLevel = aal1
        nextLevel = aal2

        NO llamamos a admin-check todavía.

        Primero debemos verificar el código
        de la aplicación Authenticator.
      */

      if (estadoMFA.required) {
        setPassword("");
        return;
      }

      /* =====================================================
         7. SI YA ESTÁ EN AAL2
         FINALIZAR LOGIN
      ===================================================== */

      await finalizarLoginAdmin();
    } catch (error) {
      console.error(
        "Error inesperado login:",
        error
      );

      resetTurnstile();

      await Swal.fire({
        icon: "error",
        title: "Error inesperado",
        text:
          error?.message ||
          "Ocurrió un error al iniciar sesión",
      });
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.14), transparent 35%), linear-gradient(135deg, #0f172a, #111827 55%, #0b1220)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background:
            "rgba(255,255,255,0.96)",
          borderRadius: "26px",
          padding: "34px",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.3)",
          border:
            "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* ===============================================
            CABECERA
        =============================================== */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "18px",
              margin: "0 auto 14px",
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, #111827, #1f2937)",
              color: "#fff",
              boxShadow:
                "0 12px 30px rgba(17,24,39,0.28)",
            }}
          >
            <ShieldIcon />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.03em",
            }}
          >
            {mfaRequired
              ? "Verificación 2FA"
              : "Admin Login"}
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            {mfaRequired
              ? "Confirma tu identidad para continuar"
              : "Acceso exclusivo para administrador"}
          </p>
        </div>

        {/* ===============================================
            FORMULARIO
        =============================================== */}

        <form
          onSubmit={
            mfaRequired
              ? verificarMFA
              : iniciarSesion
          }
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {/* =============================================
              MFA
          ============================================= */}

          {mfaRequired && (
            <>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "14px",
                  background: "#f0fdf4",
                  border:
                    "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                🔐 Contraseña correcta.
                <br />
                Confirma tu identidad con tu
                aplicación Authenticator.
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  Código Authenticator
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  value={mfaCode}
                  disabled={mfaLoading}
                  onChange={(e) => {
                    const valor =
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);

                    setMfaCode(valor);
                  }}
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: "14px",
                    border:
                      "1px solid #d1d5db",
                    outline: "none",
                    boxSizing:
                      "border-box",
                    background: "#fff",
                    color: "#111827",
                    textAlign: "center",
                    fontSize: "22px",
                    fontWeight: 800,
                    letterSpacing: "8px",
                  }}
                />

                <p
                  style={{
                    margin:
                      "9px 0 0 0",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  📱 Introduce el código actual
                  de 6 dígitos de tu aplicación.
                </p>
              </div>
            </>
          )}

          {/* =============================================
              LOGIN NORMAL
          ============================================= */}

          {!mfaRequired && (
            <>
              {/* CORREO */}

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  Correo
                </label>

                <input
                  type="email"
                  placeholder="Tu correo admin"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  autoComplete="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding:
                      "14px 16px",
                    borderRadius: "14px",
                    border:
                      "1px solid #d1d5db",
                    outline: "none",
                    fontSize: "15px",
                    color: "#111827",
                    background: "#fff",
                    boxSizing:
                      "border-box",
                  }}
                />
              </div>

              {/* CONTRASEÑA */}

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  Contraseña
                </label>

                <div
                  style={{
                    position: "relative",
                  }}
                >
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    autoComplete="current-password"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding:
                        "14px 52px 14px 16px",
                      borderRadius:
                        "14px",
                      border:
                        "1px solid #d1d5db",
                      outline: "none",
                      fontSize: "15px",
                      color: "#111827",
                      background: "#fff",
                      boxSizing:
                        "border-box",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (prev) => !prev
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      border: "none",
                      background:
                        "transparent",
                      color: "#6b7280",
                      cursor: loading
                        ? "not-allowed"
                        : "pointer",
                      padding: "4px",
                      display: "grid",
                      placeItems:
                        "center",
                    }}
                  >
                    <EyeIcon
                      open={
                        showPassword
                      }
                    />
                  </button>
                </div>
              </div>

              {/* =============================================
                  CLOUDFLARE TURNSTILE
              ============================================= */}

              <div
                style={{
                  width: "100%",
                  minHeight: "66px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "center",
                  overflow: "hidden",
                }}
              >
                <div
                  ref={
                    turnstileContainerRef
                  }
                  style={{
                    width: "100%",
                  }}
                />
              </div>

              {turnstileError && (
                <div
                  style={{
                    padding:
                      "10px 12px",
                    borderRadius:
                      "12px",
                    background:
                      "#fef2f2",
                    border:
                      "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    textAlign: "center",
                  }}
                >
                  No se pudo cargar la
                  verificación de seguridad.
                  Recarga la página e
                  inténtalo nuevamente.
                </div>
              )}
            </>
          )}

          {/* =============================================
              BOTÓN
          ============================================= */}

          <button
            type="submit"
            disabled={
              mfaRequired
                ? mfaLoading ||
                  mfaCode.length !== 6
                : loading ||
                  !turnstileReady ||
                  turnstileError
            }
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "none",

              background:
                (
                  mfaRequired
                    ? mfaLoading ||
                      mfaCode.length !== 6
                    : loading ||
                      !turnstileReady ||
                      turnstileError
                )
                  ? "linear-gradient(135deg, #6b7280, #9ca3af)"
                  : "linear-gradient(135deg, #111827, #0f172a)",

              color: "#fff",
              fontWeight: "800",
              fontSize: "16px",

              cursor:
                (
                  mfaRequired
                    ? mfaLoading ||
                      mfaCode.length !== 6
                    : loading ||
                      !turnstileReady ||
                      turnstileError
                )
                  ? "not-allowed"
                  : "pointer",

              marginTop: "4px",

              boxShadow:
                (
                  mfaRequired
                    ? mfaLoading ||
                      mfaCode.length !== 6
                    : loading ||
                      !turnstileReady ||
                      turnstileError
                )
                  ? "none"
                  : "0 12px 28px rgba(17,24,39,0.28)",
            }}
          >
            {mfaRequired
              ? mfaLoading
                ? "Verificando código..."
                : "Verificar y entrar 🔐"
              : loading
                ? "Verificando..."
                : !turnstileReady
                  ? "Completando seguridad..."
                  : "Entrar al panel admin"}
          </button>
        </form>

        {/* ===============================================
            PIE
        =============================================== */}

        <p
          style={{
            marginTop: "16px",
            marginBottom: 0,
            textAlign: "center",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          🔒 Acceso protegido · Solo personal autorizado
        </p>
      </div>
    </div>
  );
}