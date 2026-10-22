"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Swal from "sweetalert2";

export default function AdminMFASetup() {
  const router = useRouter();

  const iniciadoRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);

  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [codigo, setCodigo] = useState("");

  /* =========================================================
     CARGAR Y CREAR MFA
  ========================================================= */

  useEffect(() => {
    if (iniciadoRef.current) return;

    iniciadoRef.current = true;

    const prepararMFA = async () => {
      try {
        setLoading(true);

        /* =====================================================
           1. COMPROBAR SESIÓN
        ===================================================== */

        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (
          sessionError ||
          !sessionData?.session
        ) {
          await Swal.fire({
            icon: "warning",
            title: "Sesión requerida",
            text: "Primero debes iniciar sesión como administrador.",
          });

          router.replace("/admin-login");
          return;
        }

        const token =
          sessionData.session.access_token;

        /* =====================================================
           2. COMPROBAR QUE ES ADMIN
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
          await supabase.auth.signOut();

          await Swal.fire({
            icon: "error",
            title: "Acceso denegado",
            text: "Esta cuenta no tiene permisos de administrador.",
          });

          router.replace("/admin-login");
          return;
        }

        /* =====================================================
           3. REVISAR FACTORES EXISTENTES
        ===================================================== */

        const {
          data: factorsData,
          error: factorsError,
        } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) {
          throw factorsError;
        }

        const factoresTOTP =
          factorsData?.totp || [];

        /*
          Si ya existe un factor TOTP verificado,
          NO creamos otro accidentalmente.
        */

        const factorVerificado =
          factoresTOTP.find(
            (factor) =>
              factor.status === "verified"
          );

        if (factorVerificado) {
          const {
            data: aalData,
            error: aalError,
          } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

          if (aalError) {
            throw aalError;
          }

          await Swal.fire({
            icon: "info",
            title: "MFA ya está configurado",
            text:
              aalData?.currentLevel === "aal2"
                ? "Tu autenticación de dos factores ya está activa y esta sesión ya fue verificada."
                : "Tu cuenta ya tiene un autenticador registrado.",
          });

          router.replace("/admin");
          return;
        }

        /* =====================================================
           4. LIMPIAR FACTORES TOTP NO VERIFICADOS

           Si una configuración anterior quedó incompleta,
           evitamos acumular factores sin verificar.
        ===================================================== */

        for (const factor of factoresTOTP) {
          if (
            factor?.id &&
            factor.status !== "verified"
          ) {
            try {
              await supabase.auth.mfa.unenroll({
                factorId: factor.id,
              });
            } catch (error) {
              console.error(
                "No se pudo limpiar factor incompleto:",
                error
              );
            }
          }
        }

        /* =====================================================
           5. CREAR NUEVO FACTOR TOTP
        ===================================================== */

        const {
          data: enrollData,
          error: enrollError,
        } =
          await supabase.auth.mfa.enroll({
            factorType: "totp",
            friendlyName:
              "Administrador Sorteos LSD",
          });

        if (enrollError) {
          throw enrollError;
        }

        if (
          !enrollData?.id ||
          !enrollData?.totp?.qr_code
        ) {
          throw new Error(
            "Supabase no devolvió los datos necesarios para configurar MFA."
          );
        }

        setFactorId(
          enrollData.id
        );

        setQrCode(
          enrollData.totp.qr_code
        );

        setSecret(
          enrollData.totp.secret || ""
        );
      } catch (error) {
        console.error(
          "Error preparando MFA:",
          error
        );

        await Swal.fire({
          icon: "error",
          title: "No se pudo configurar MFA",
          text:
            error?.message ||
            "Ocurrió un error preparando la autenticación de dos factores.",
        });
      } finally {
        setLoading(false);
      }
    };

    prepararMFA();
  }, [router]);

  /* =========================================================
     VERIFICAR CÓDIGO
  ========================================================= */

  const verificarCodigo = async (e) => {
    e.preventDefault();

    if (verificando) return;

    const codigoLimpio =
      codigo.replace(/\D/g, "");

    if (
      codigoLimpio.length !== 6
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Código inválido",
        text: "Ingresa los 6 dígitos de tu aplicación Authenticator.",
      });

      return;
    }

    if (!factorId) {
      await Swal.fire({
        icon: "error",
        title: "MFA no preparado",
        text: "No se encontró el factor de autenticación. Recarga la página.",
      });

      return;
    }

    try {
      setVerificando(true);

      /* =====================================================
         1. CREAR CHALLENGE
      ===================================================== */

      const {
        data: challengeData,
        error: challengeError,
      } =
        await supabase.auth.mfa.challenge({
          factorId,
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
         2. VERIFICAR CÓDIGO
      ===================================================== */

      const {
        error: verifyError,
      } =
        await supabase.auth.mfa.verify({
          factorId,
          challengeId:
            challengeData.id,
          code: codigoLimpio,
        });

      if (verifyError) {
        setCodigo("");

        await Swal.fire({
          icon: "error",
          title: "Código incorrecto",
          text: "El código no es válido o ya expiró. Usa el código actual de tu aplicación.",
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
          "El segundo factor fue verificado, pero la sesión todavía no alcanzó AAL2."
        );
      }

      /* =====================================================
         4. MFA ACTIVADO
      ===================================================== */

      await Swal.fire({
        icon: "success",
        title: "MFA activado",
        text: "Tu administrador ahora tiene autenticación de dos factores.",
        confirmButtonText: "Continuar",
      });

      setCodigo("");

      router.replace("/admin");
    } catch (error) {
      console.error(
        "Error verificando MFA:",
        error
      );

      await Swal.fire({
        icon: "error",
        title: "Error verificando MFA",
        text:
          error?.message ||
          "No se pudo verificar el código.",
      });
    } finally {
      setVerificando(false);
    }
  };

  /* =========================================================
     CARGANDO
  ========================================================= */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(135deg, #0f172a, #111827 55%, #0b1220)",
          padding: "20px",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: "16px",
            fontWeight: 700,
          }}
        >
          🔐 Preparando seguridad MFA...
        </div>
      </div>
    );
  }

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
          maxWidth: "480px",
          background:
            "rgba(255,255,255,0.97)",
          borderRadius: "26px",
          padding: "30px",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.3)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              width: "62px",
              height: "62px",
              borderRadius: "18px",
              margin: "0 auto 14px",
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, #111827, #1f2937)",
              color: "#fff",
              fontSize: "28px",
            }}
          >
            🔐
          </div>

          <h1
            style={{
              margin: 0,
              color: "#111827",
              fontSize: "27px",
              fontWeight: 800,
            }}
          >
            Activar verificación 2FA
          </h1>

          <p
            style={{
              color: "#6b7280",
              lineHeight: 1.5,
              marginBottom: 0,
            }}
          >
            Escanea este código con tu
            aplicación Authenticator.
          </p>
        </div>

        {qrCode ? (
          <>
            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: "18px",
                padding: "18px",
                display: "grid",
                placeItems: "center",
                marginBottom: "18px",
              }}
            >
              <img
                src={qrCode}
                alt="Código QR para configurar MFA"
                style={{
                  width: "220px",
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
            </div>

            <div
              style={{
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "14px",
                marginBottom: "18px",
                color: "#475569",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              <strong>
                📱 Paso 1:
              </strong>{" "}
              Abre Google Authenticator,
              Microsoft Authenticator u otra
              aplicación compatible con TOTP y
              escanea el QR.
            </div>

            {secret && (
              <details
                style={{
                  marginBottom: "18px",
                  background: "#fff",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: "14px",
                  padding: "12px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: 700,
                    color: "#374151",
                  }}
                >
                  No puedo escanear el QR
                </summary>

                <p
                  style={{
                    color: "#6b7280",
                    fontSize: "12px",
                    marginBottom: "7px",
                  }}
                >
                  Introduce manualmente esta
                  clave en tu aplicación:
                </p>

                <div
                  style={{
                    padding: "10px",
                    background: "#f3f4f6",
                    borderRadius: "10px",
                    wordBreak:
                      "break-all",
                    fontFamily:
                      "monospace",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {secret}
                </div>

                <p
                  style={{
                    color: "#991b1b",
                    fontSize: "11px",
                    marginBottom: 0,
                  }}
                >
                  No compartas esta clave con
                  nadie.
                </p>
              </details>
            )}

            <form
              onSubmit={
                verificarCodigo
              }
            >
              <label
                style={{
                  display: "block",
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: "8px",
                }}
              >
                Código de 6 dígitos
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={codigo}
                disabled={verificando}
                onChange={(e) => {
                  const valor =
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);

                  setCodigo(valor);
                }}
                style={{
                  width: "100%",
                  padding: "15px",
                  boxSizing: "border-box",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "14px",
                  fontSize: "22px",
                  fontWeight: 800,
                  letterSpacing: "8px",
                  textAlign: "center",
                  outline: "none",
                  color: "#111827",
                  background: "#fff",
                  marginBottom: "14px",
                }}
              />

              <button
                type="submit"
                disabled={
                  verificando ||
                  codigo.length !== 6
                }
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "none",
                  borderRadius: "14px",
                  background:
                    verificando ||
                    codigo.length !== 6
                      ? "#9ca3af"
                      : "linear-gradient(135deg, #111827, #0f172a)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "15px",
                  cursor:
                    verificando ||
                    codigo.length !== 6
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {verificando
                  ? "Verificando..."
                  : "Activar 2FA"}
              </button>
            </form>
          </>
        ) : (
          <div
            style={{
              padding: "16px",
              background: "#fef2f2",
              border:
                "1px solid #fecaca",
              borderRadius: "14px",
              color: "#991b1b",
              textAlign: "center",
            }}
          >
            No se pudo generar el código QR.
          </div>
        )}

        <p
          style={{
            textAlign: "center",
            color: "#6b7280",
            fontSize: "12px",
            marginTop: "18px",
            marginBottom: 0,
          }}
        >
          🔒 Configuración exclusiva del
          administrador
        </p>
      </div>
    </div>
  );
}