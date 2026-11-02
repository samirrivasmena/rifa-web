"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabase";

export default function AdminPerfilSection({
  adminEmail = "",
  adminToken = "",
}) {
  const nombreVisible =
    adminEmail?.split("@")[0]?.replace(/[._-]/g, " ") ||
    "Administrador";

  const inicial = (adminEmail || "A")
    .charAt(0)
    .toUpperCase();

  /* =========================================================
     ESTADOS
  ========================================================= */

  const [cambiandoPassword, setCambiandoPassword] =
    useState(false);

  const [cambiandoEmail, setCambiandoEmail] =
    useState(false);

  const [
    cerrandoOtrasSesiones,
    setCerrandoOtrasSesiones,
  ] = useState(false);

  const [mfaLoading, setMfaLoading] =
    useState(true);

  const [mfaActivo, setMfaActivo] =
    useState(false);

  const [mfaError, setMfaError] =
    useState("");

  /* =========================================================
     CONSULTAR ESTADO REAL DEL MFA
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const cargarEstadoMFA = async () => {
      try {
        setMfaLoading(true);
        setMfaError("");

        const {
          data: factorsData,
          error: factorsError,
        } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
          throw factorsError;
        }

        const factoresTOTP =
          factorsData?.totp || [];

        const factorVerificado =
          factoresTOTP.some(
            (factor) =>
              factor?.status === "verified"
          );

        if (!mounted) return;

        setMfaActivo(factorVerificado);
      } catch (error) {
        console.error(
          "Error consultando estado MFA:",
          error
        );

        if (!mounted) return;

        setMfaActivo(false);

        setMfaError(
          "No se pudo comprobar el estado del autenticador."
        );
      } finally {
        if (mounted) {
          setMfaLoading(false);
        }
      }
    };

    cargarEstadoMFA();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     VERIFICACIÓN DE SEGURIDAD POR CORREO

     1. Solicita OTP al servidor.
     2. El servidor lo manda al correo administrativo actual.
     3. Pedimos los 6 dígitos.
     4. Verificamos OTP.
     5. Recibimos autorización temporal.
  ========================================================= */

  const verificarSeguridadPorCorreo =
    async (accion) => {
      if (!adminToken) {
        await Swal.fire({
          icon: "error",
          title: "Sesión no disponible",
          text: "No se pudo verificar tu sesión administrativa.",
          confirmButtonText: "Entendido",
        });

        return null;
      }

      /* =====================================================
         ENVIAR CÓDIGO
      ===================================================== */

      Swal.fire({
        title: "Enviando código...",
        text: "Estamos enviando un código de seguridad a tu correo actual.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      let enviarResponse;
      let enviarData;

      try {
        enviarResponse = await fetch(
          "/api/admin-seguridad/enviar-codigo",
          {
            method: "POST",
            cache: "no-store",

            headers: {
              Authorization:
                `Bearer ${adminToken}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              accion,
            }),
          }
        );

        enviarData =
          await enviarResponse
            .json()
            .catch(() => ({}));
      } catch (error) {
        console.error(
          "Error solicitando código:",
          error
        );

        await Swal.fire({
          icon: "error",
          title: "No se pudo enviar",
          text: "No se pudo conectar con el servidor para enviar el código.",
          confirmButtonText: "Entendido",
        });

        return null;
      }

      if (
        !enviarResponse.ok ||
        !enviarData?.ok
      ) {
        if (enviarData?.requiresMfa) {
          await Swal.fire({
            icon: "warning",
            title: "Verificación requerida",
            text:
              enviarData?.error ||
              "Debes verificar nuevamente tu autenticación en dos pasos.",
            confirmButtonText: "Entendido",
          });

          return null;
        }

        await Swal.fire({
          icon: "error",
          title: "No se pudo enviar",
          text:
            enviarData?.error ||
            "No se pudo enviar el código de seguridad.",
          confirmButtonText: "Entendido",
        });

        return null;
      }

      /* =====================================================
         PEDIR CÓDIGO
      ===================================================== */

      const resultadoCodigo =
        await Swal.fire({
          icon: "info",

          title:
            "🔐 Código de seguridad",

          html: `
            <div style="text-align:left;">
              <p
                style="
                  margin:0 0 16px;
                  color:#475569;
                  font-size:13px;
                  line-height:1.6;
                "
              >
                Enviamos un código de
                <strong>6 dígitos</strong>
                a tu correo administrativo actual.
              </p>

              <label
                for="admin-security-code"
                style="
                  display:block;
                  margin-bottom:7px;
                  font-size:12px;
                  font-weight:800;
                "
              >
                Código de seguridad
              </label>

              <input
                id="admin-security-code"
                type="text"
                inputmode="numeric"
                maxlength="6"
                autocomplete="one-time-code"
                class="swal2-input"
                placeholder="000000"
                style="
                  width:100%;
                  margin:0;
                  box-sizing:border-box;
                  text-align:center;
                  font-size:25px;
                  font-weight:900;
                  letter-spacing:8px;
                "
              />

              <div
                style="
                  margin-top:18px;
                  padding:13px 14px;
                  border-radius:12px;
                  background:#f8fafc;
                  color:#475569;
                  font-size:12px;
                  line-height:1.6;
                "
              >
                ⏱️ El código expira en
                <strong>10 minutos</strong>.
                Tienes un máximo de
                <strong>5 intentos</strong>.
              </div>
            </div>
          `,

          showCancelButton: true,

          confirmButtonText:
            "VERIFICAR",

          cancelButtonText:
            "Cancelar",

          confirmButtonColor:
            "#7c3aed",

          cancelButtonColor:
            "#6b7280",

          reverseButtons: true,
          focusConfirm: false,

          didOpen: () => {
            const input =
              document.getElementById(
                "admin-security-code"
              );

            if (input) {
              input.focus();

              input.addEventListener(
                "input",
                () => {
                  input.value =
                    input.value
                      .replace(/\D/g, "")
                      .slice(0, 6);
                }
              );
            }
          },

          preConfirm: () => {
            const codigo =
              document
                .getElementById(
                  "admin-security-code"
                )
                ?.value?.trim() || "";

            if (
              !/^\d{6}$/.test(codigo)
            ) {
              Swal.showValidationMessage(
                "Escribe el código completo de 6 dígitos."
              );

              return false;
            }

            return {
              codigo,
            };
          },
        });

      if (
        !resultadoCodigo.isConfirmed ||
        !resultadoCodigo.value?.codigo
      ) {
        return null;
      }

      /* =====================================================
         VERIFICAR CÓDIGO
      ===================================================== */

      Swal.fire({
        title: "Verificando...",
        text: "Estamos comprobando el código de seguridad.",
        allowOutsideClick: false,
        allowEscapeKey: false,

        didOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        const response =
          await fetch(
            "/api/admin-seguridad/verificar-codigo",
            {
              method: "POST",
              cache: "no-store",

              headers: {
                Authorization:
                  `Bearer ${adminToken}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                accion,

                codigo:
                  resultadoCodigo
                    .value.codigo,
              }),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (
          !response.ok ||
          !data?.ok ||
          !data?.authorizationToken
        ) {
          if (data?.requiresMfa) {
            await Swal.fire({
              icon: "warning",

              title:
                "Verificación requerida",

              text:
                data?.error ||
                "Debes verificar nuevamente tu autenticación en dos pasos.",

              confirmButtonText:
                "Entendido",
            });

            return null;
          }

          await Swal.fire({
            icon: "error",

            title:
              "Código no válido",

            text:
              data?.error ||
              "No se pudo verificar el código.",

            confirmButtonText:
              "Entendido",
          });

          return null;
        }

        return data.authorizationToken;
      } catch (error) {
        console.error(
          "Error verificando código:",
          error
        );

        await Swal.fire({
          icon: "error",

          title:
            "No se pudo verificar",

          text:
            "Ocurrió un error verificando el código de seguridad.",

          confirmButtonText:
            "Entendido",
        });

        return null;
      }
    };

  /* =========================================================
     CAMBIAR CONTRASEÑA
  ========================================================= */

  const abrirCambioPassword =
    async () => {
      if (cambiandoPassword) {
        return;
      }

      try {
        setCambiandoPassword(true);

        /*
         * IMPORTANTE:
         * antes de mostrar la ventana de contraseña
         * exigimos el código enviado al correo.
         */

        const authorizationToken =
          await verificarSeguridadPorCorreo(
            "cambiar_password"
          );

        if (!authorizationToken) {
          return;
        }

        /* =====================================================
           AHORA SÍ PEDIMOS LA NUEVA CONTRASEÑA
        ===================================================== */

        const resultado =
          await Swal.fire({
            title:
              "🔑 Cambiar contraseña",

            html: `
              <div style="text-align:left;">
                <div
                  style="
                    margin-bottom:16px;
                    padding:12px 14px;
                    border-radius:12px;
                    background:#ecfdf5;
                    border:1px solid #a7f3d0;
                    color:#065f46;
                    font-size:12px;
                    line-height:1.5;
                  "
                >
                  ✓ Identidad verificada mediante
                  tu correo administrativo.
                </div>

                <label
                  for="admin-nueva-password"
                  style="
                    display:block;
                    margin-bottom:7px;
                    font-size:12px;
                    font-weight:800;
                  "
                >
                  Nueva contraseña
                </label>

                <input
                  id="admin-nueva-password"
                  type="password"
                  class="swal2-input"
                  placeholder="Nueva contraseña"
                  autocomplete="new-password"
                  style="
                    width:100%;
                    margin:0 0 16px 0;
                    box-sizing:border-box;
                  "
                />

                <label
                  for="admin-confirmar-password"
                  style="
                    display:block;
                    margin-bottom:7px;
                    font-size:12px;
                    font-weight:800;
                  "
                >
                  Confirmar contraseña
                </label>

                <input
                  id="admin-confirmar-password"
                  type="password"
                  class="swal2-input"
                  placeholder="Repite la contraseña"
                  autocomplete="new-password"
                  style="
                    width:100%;
                    margin:0;
                    box-sizing:border-box;
                  "
                />

                <div
                  style="
                    margin-top:18px;
                    padding:13px 14px;
                    border-radius:12px;
                    background:#f8fafc;
                    color:#475569;
                    font-size:12px;
                    line-height:1.6;
                  "
                >
                  <strong>
                    La contraseña debe tener:
                  </strong>
                  <br/>

                  • Al menos 12 caracteres<br/>
                  • Una letra mayúscula<br/>
                  • Una letra minúscula<br/>
                  • Un número<br/>
                  • Un carácter especial
                </div>
              </div>
            `,

            showCancelButton: true,

            confirmButtonText:
              "Cambiar contraseña",

            cancelButtonText:
              "Cancelar",

            confirmButtonColor:
              "#7c3aed",

            cancelButtonColor:
              "#6b7280",

            reverseButtons: true,
            focusConfirm: false,

            preConfirm: () => {
              const nuevaPassword =
                document.getElementById(
                  "admin-nueva-password"
                )?.value || "";

              const confirmarPassword =
                document.getElementById(
                  "admin-confirmar-password"
                )?.value || "";

              if (
                !nuevaPassword ||
                !confirmarPassword
              ) {
                Swal.showValidationMessage(
                  "Debes completar los dos campos."
                );

                return false;
              }

              if (
                nuevaPassword.length <
                12
              ) {
                Swal.showValidationMessage(
                  "La contraseña debe tener al menos 12 caracteres."
                );

                return false;
              }

              if (
                nuevaPassword.length >
                128
              ) {
                Swal.showValidationMessage(
                  "La contraseña es demasiado larga."
                );

                return false;
              }

              if (
                !/[a-z]/.test(
                  nuevaPassword
                )
              ) {
                Swal.showValidationMessage(
                  "Agrega al menos una letra minúscula."
                );

                return false;
              }

              if (
                !/[A-Z]/.test(
                  nuevaPassword
                )
              ) {
                Swal.showValidationMessage(
                  "Agrega al menos una letra mayúscula."
                );

                return false;
              }

              if (
                !/[0-9]/.test(
                  nuevaPassword
                )
              ) {
                Swal.showValidationMessage(
                  "Agrega al menos un número."
                );

                return false;
              }

              if (
                !/[^A-Za-z0-9]/.test(
                  nuevaPassword
                )
              ) {
                Swal.showValidationMessage(
                  "Agrega al menos un carácter especial."
                );

                return false;
              }

              if (
                nuevaPassword !==
                confirmarPassword
              ) {
                Swal.showValidationMessage(
                  "Las contraseñas no coinciden."
                );

                return false;
              }

              return {
                nuevaPassword,
              };
            },
          });

        if (
          !resultado.isConfirmed ||
          !resultado.value
            ?.nuevaPassword
        ) {
          return;
        }

        const confirmacionFinal =
          await Swal.fire({
            icon: "warning",

            title:
              "¿Confirmar cambio?",

            text:
              "Tu contraseña administrativa será reemplazada por la nueva.",

            showCancelButton: true,

            confirmButtonText:
              "Sí, cambiar",

            cancelButtonText:
              "Cancelar",

            confirmButtonColor:
              "#7c3aed",

            cancelButtonColor:
              "#6b7280",

            reverseButtons: true,
          });

        if (
          !confirmacionFinal.isConfirmed
        ) {
          return;
        }

        Swal.fire({
          title:
            "Actualizando contraseña...",

          allowOutsideClick: false,
          allowEscapeKey: false,

          didOpen: () => {
            Swal.showLoading();
          },
        });

        const response =
          await fetch(
            "/api/admin-cambiar-password",
            {
              method: "POST",
              cache: "no-store",

              headers: {
                Authorization:
                  `Bearer ${adminToken}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                nuevaPassword:
                  resultado.value
                    .nuevaPassword,

                authorizationToken,
              }),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (
          !response.ok ||
          !data?.ok
        ) {
          if (data?.requiresMfa) {
            await Swal.fire({
              icon: "warning",

              title:
                "Verificación requerida",

              text:
                data?.error ||
                "Debes verificar nuevamente tu autenticación en dos pasos.",

              confirmButtonText:
                "Entendido",
            });

            return;
          }

          if (
            data?.requiresEmailVerification
          ) {
            await Swal.fire({
              icon: "warning",

              title:
                "Código requerido",

              text:
                data?.error ||
                "Debes verificar nuevamente el código enviado a tu correo.",

              confirmButtonText:
                "Entendido",
            });

            return;
          }

          throw new Error(
            data?.error ||
              "No se pudo cambiar la contraseña."
          );
        }

        await Swal.fire({
          icon: "success",

          title:
            "Contraseña actualizada",

          text:
            "Tu nueva contraseña fue guardada correctamente.",

          confirmButtonText:
            "Entendido",

          confirmButtonColor:
            "#16a34a",
        });
      } catch (error) {
        console.error(
          "Error cambiando contraseña:",
          error
        );

        await Swal.fire({
          icon: "error",

          title:
            "No se pudo cambiar",

          text:
            error?.message ||
            "Ocurrió un error actualizando la contraseña.",

          confirmButtonText:
            "Entendido",
        });
      } finally {
        setCambiandoPassword(false);
      }
    };

  /* =========================================================
     CAMBIAR CORREO
  ========================================================= */

  const abrirCambioEmail =
    async () => {
      if (cambiandoEmail) {
        return;
      }

      try {
        setCambiandoEmail(true);

        /*
         * Primero verificamos el correo actual.
         */

        const authorizationToken =
          await verificarSeguridadPorCorreo(
            "cambiar_email"
          );

        if (!authorizationToken) {
          return;
        }

        /*
         * La autorización demuestra que el
         * código del correo actual fue verificado.
         *
         * Supabase realizará después su propio
         * Secure Email Change.
         */

        const resultado =
          await Swal.fire({
            title:
              "📧 Cambiar correo de acceso",

            html: `
              <div style="text-align:left;">
                <div
                  style="
                    margin-bottom:16px;
                    padding:12px 14px;
                    border-radius:12px;
                    background:#ecfdf5;
                    border:1px solid #a7f3d0;
                    color:#065f46;
                    font-size:12px;
                    line-height:1.5;
                  "
                >
                  ✓ Correo administrativo actual
                  verificado correctamente.
                </div>

                <label
                  for="admin-nuevo-email"
                  style="
                    display:block;
                    margin-bottom:7px;
                    font-size:12px;
                    font-weight:800;
                  "
                >
                  Nuevo correo
                </label>

                <input
                  id="admin-nuevo-email"
                  type="email"
                  class="swal2-input"
                  placeholder="nuevo@correo.com"
                  autocomplete="email"
                  style="
                    width:100%;
                    margin:0;
                    box-sizing:border-box;
                  "
                />

                <div
                  style="
                    margin-top:18px;
                    padding:13px 14px;
                    border-radius:12px;
                    background:#f8fafc;
                    color:#475569;
                    font-size:12px;
                    line-height:1.6;
                  "
                >
                  🛡️ Después de esta verificación,
                  Supabase aplicará también su proceso
                  Secure Email Change.
                </div>
              </div>
            `,

            showCancelButton: true,

            confirmButtonText:
              "Continuar",

            cancelButtonText:
              "Cancelar",

            confirmButtonColor:
              "#7c3aed",

            cancelButtonColor:
              "#6b7280",

            reverseButtons: true,
            focusConfirm: false,

            preConfirm: () => {
              const nuevoEmail =
                document
                  .getElementById(
                    "admin-nuevo-email"
                  )
                  ?.value?.trim()
                  .toLowerCase() ||
                "";

              if (!nuevoEmail) {
                Swal.showValidationMessage(
                  "Debes escribir el nuevo correo."
                );

                return false;
              }

              if (
                nuevoEmail.length > 254
              ) {
                Swal.showValidationMessage(
                  "El correo es demasiado largo."
                );

                return false;
              }

              const emailValido =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                  nuevoEmail
                );

              if (!emailValido) {
                Swal.showValidationMessage(
                  "Escribe un correo válido."
                );

                return false;
              }

              if (
                nuevoEmail ===
                String(
                  adminEmail || ""
                )
                  .trim()
                  .toLowerCase()
              ) {
                Swal.showValidationMessage(
                  "Ese ya es tu correo actual."
                );

                return false;
              }

              return {
                nuevoEmail,
              };
            },
          });

        if (
          !resultado.isConfirmed ||
          !resultado.value
            ?.nuevoEmail
        ) {
          return;
        }

        const nuevoEmail =
          resultado.value.nuevoEmail;

        const confirmacion =
          await Swal.fire({
            icon: "warning",

            title:
              "¿Solicitar cambio de correo?",

            text:
              `Vas a solicitar cambiar tu correo administrativo a ${nuevoEmail}. Supabase enviará las confirmaciones correspondientes.`,

            showCancelButton: true,

            confirmButtonText:
              "Sí, solicitar cambio",

            cancelButtonText:
              "Cancelar",

            confirmButtonColor:
              "#7c3aed",

            cancelButtonColor:
              "#6b7280",

            reverseButtons: true,
          });

        if (
          !confirmacion.isConfirmed
        ) {
          return;
        }

        /*
         * Volvemos a comprobar que la sesión
         * administrativa sigue siendo válida
         * y AAL2 antes de solicitar el cambio.
         */

        const checkResponse =
          await fetch(
            "/api/admin-check",
            {
              method: "GET",
              cache: "no-store",

              headers: {
                Authorization:
                  `Bearer ${adminToken}`,
              },
            }
          );

        const checkData =
          await checkResponse
            .json()
            .catch(() => ({}));

        if (
          !checkResponse.ok ||
          !checkData?.ok
        ) {
          if (
            checkData?.requiresMfa
          ) {
            await Swal.fire({
              icon: "warning",

              title:
                "Verificación requerida",

              text:
                checkData?.error ||
                "Debes verificar nuevamente tu autenticación en dos pasos.",

              confirmButtonText:
                "Entendido",
            });

            return;
          }

          throw new Error(
            checkData?.error ||
              "No se pudo verificar la sesión administrativa."
          );
        }

        /*
         * authorizationToken existe aquí porque
         * el OTP administrativo fue validado.
         *
         * No enviamos este token a Supabase.
         * Supabase mantiene su propia protección
         * Secure Email Change.
         */

        if (!authorizationToken) {
          throw new Error(
            "La autorización de seguridad no está disponible."
          );
        }

        Swal.fire({
          title:
            "Solicitando cambio...",

          allowOutsideClick: false,
          allowEscapeKey: false,

          didOpen: () => {
            Swal.showLoading();
          },
        });

        const { error } =
          await supabase.auth.updateUser(
            {
              email: nuevoEmail,
            }
          );

        if (error) {
          throw error;
        }

        await Swal.fire({
          icon: "success",

          title:
            "Revisa tus correos",

          html: `
            <div style="line-height:1.6;">
              La solicitud fue enviada
              correctamente.
              <br/><br/>

              Completa las confirmaciones de
              seguridad enviadas por Supabase.
              <br/><br/>

              <strong>
                No cierres esta sesión todavía.
              </strong>
            </div>
          `,

          confirmButtonText:
            "Entendido",

          confirmButtonColor:
            "#16a34a",
        });
      } catch (error) {
        console.error(
          "Error cambiando correo:",
          error
        );

        await Swal.fire({
          icon: "error",

          title:
            "No se pudo solicitar el cambio",

          text:
            error?.message ||
            "Ocurrió un error solicitando el cambio de correo.",

          confirmButtonText:
            "Entendido",
        });
      } finally {
        setCambiandoEmail(false);
      }
    };

  /* =========================================================
     CERRAR OTRAS SESIONES
  ========================================================= */

  const cerrarOtrasSesiones =
    async () => {
      if (cerrandoOtrasSesiones) {
        return;
      }

      const confirmacion =
        await Swal.fire({
          icon: "warning",

          title:
            "¿Cerrar otras sesiones?",

          text:
            "Se cerrará tu cuenta en los demás dispositivos. Esta sesión permanecerá abierta.",

          showCancelButton: true,

          confirmButtonText:
            "Sí, cerrar otras",

          cancelButtonText:
            "Cancelar",

          confirmButtonColor:
            "#dc2626",

          cancelButtonColor:
            "#6b7280",

          reverseButtons: true,
        });

      if (
        !confirmacion.isConfirmed
      ) {
        return;
      }

      try {
        setCerrandoOtrasSesiones(
          true
        );

        const { error } =
          await supabase.auth.signOut({
            scope: "others",
          });

        if (error) {
          throw error;
        }

        await Swal.fire({
          icon: "success",

          title:
            "Sesiones cerradas",

          text:
            "Las demás sesiones fueron cerradas. Este dispositivo continúa conectado.",

          confirmButtonText:
            "Entendido",

          confirmButtonColor:
            "#16a34a",
        });
      } catch (error) {
        console.error(
          "Error cerrando otras sesiones:",
          error
        );

        await Swal.fire({
          icon: "error",

          title:
            "No se pudieron cerrar",

          text:
            error?.message ||
            "Ocurrió un error cerrando las demás sesiones.",

          confirmButtonText:
            "Entendido",
        });
      } finally {
        setCerrandoOtrasSesiones(
          false
        );
      }
    };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <section className="admin-profile-page">
      {/* HEADER */}

      <div className="admin-profile-header">
        <div>
          <span className="admin-profile-kicker">
            CUENTA ADMINISTRATIVA
          </span>

          <h2>
            👤 Perfil y Seguridad
          </h2>

          <p>
            Administra los datos principales
            y la seguridad de tu cuenta.
          </p>
        </div>

        <div className="admin-profile-security-badge">
          🛡️ CUENTA PROTEGIDA
        </div>
      </div>

      <div className="admin-profile-grid">
        {/* =====================================================
            PERFIL
        ===================================================== */}

        <div className="admin-profile-card">
          <div className="admin-profile-card-title">
            <span>👤</span>

            <div>
              <h3>Mi perfil</h3>

              <p>
                Información de la cuenta
                administrativa.
              </p>
            </div>
          </div>

          <div className="admin-profile-user">
            <div className="admin-profile-avatar">
              {inicial}
            </div>

            <div>
              <strong
                style={{
                  textTransform:
                    "capitalize",
                }}
              >
                {nombreVisible}
              </strong>

              <span>
                Administrador Principal
              </span>
            </div>
          </div>

          <div className="admin-profile-info-row">
            <div>
              <small>
                CORREO DE ACCESO
              </small>

              <strong>
                {adminEmail ||
                  "No disponible"}
              </strong>
            </div>

            <span className="admin-profile-status success">
              VERIFICADO
            </span>
          </div>

          <div
            className="admin-profile-security-row"
            style={{
              marginTop: "14px",
            }}
          >
            <div>
              <strong>
                Correo administrativo
              </strong>

              <span>
                Cambia el correo utilizado
                para iniciar sesión
              </span>
            </div>

            <button
              type="button"
              onClick={
                abrirCambioEmail
              }
              disabled={
                cambiandoEmail
              }
            >
              {cambiandoEmail
                ? "VERIFICANDO..."
                : "CAMBIAR"}
            </button>
          </div>

          <small className="admin-profile-coming">
            Requiere código de seguridad y
            confirmación por correo.
          </small>
        </div>

        {/* =====================================================
            CONTRASEÑA
        ===================================================== */}

        <div className="admin-profile-card">
          <div className="admin-profile-card-title">
            <span>🔑</span>

            <div>
              <h3>Contraseña</h3>

              <p>
                Administra la contraseña
                utilizada para iniciar sesión.
              </p>
            </div>
          </div>

          <div className="admin-profile-security-row">
            <div>
              <strong>
                Contraseña de acceso
              </strong>

              <span>
                ••••••••••••
              </span>
            </div>

            <button
              type="button"
              onClick={
                abrirCambioPassword
              }
              disabled={
                cambiandoPassword
              }
            >
              {cambiandoPassword
                ? "VERIFICANDO..."
                : "CAMBIAR"}
            </button>
          </div>

          <small className="admin-profile-coming">
            Requiere código enviado a tu
            correo administrativo actual.
          </small>
        </div>

        {/* =====================================================
            MFA
        ===================================================== */}

        <div className="admin-profile-card">
          <div className="admin-profile-card-title">
            <span>🔐</span>

            <div>
              <h3>
                Autenticación en dos pasos
              </h3>

              <p>
                Protección adicional para el
                acceso administrativo.
              </p>
            </div>
          </div>

          <div className="admin-profile-security-row">
            <div>
              <strong>
                Aplicación autenticadora
              </strong>

              <span>
                Código de seguridad de
                6 dígitos
              </span>
            </div>

            {mfaLoading ? (
              <span className="admin-profile-status">
                VERIFICANDO...
              </span>
            ) : mfaActivo ? (
              <span className="admin-profile-status success">
                ACTIVA
              </span>
            ) : (
              <span className="admin-profile-status">
                NO CONFIGURADA
              </span>
            )}
          </div>

          {mfaLoading ? (
            <div className="admin-profile-notice">
              🔄 Comprobando el estado real
              de tu autenticador...
            </div>
          ) : mfaError ? (
            <div className="admin-profile-notice">
              ⚠️ {mfaError}
            </div>
          ) : mfaActivo ? (
            <div className="admin-profile-notice">
              🛡️ Tu autenticador está
              registrado y verificado en
              Supabase.
            </div>
          ) : (
            <div className="admin-profile-notice">
              ⚠️ No se encontró un
              autenticador TOTP verificado.
            </div>
          )}
        </div>

        {/* =====================================================
            SESIONES
        ===================================================== */}

        <div className="admin-profile-card">
          <div className="admin-profile-card-title">
            <span>💻</span>

            <div>
              <h3>
                Sesiones y dispositivos
              </h3>

              <p>
                Controla dónde permanece
                abierta tu cuenta.
              </p>
            </div>
          </div>

          <div className="admin-profile-security-row">
            <div>
              <strong>
                Sesión actual
              </strong>

              <span>
                Este dispositivo
              </span>
            </div>

            <span className="admin-profile-status success">
              ACTIVA
            </span>
          </div>

          <button
            type="button"
            className="admin-profile-danger-button"
            onClick={
              cerrarOtrasSesiones
            }
            disabled={
              cerrandoOtrasSesiones
            }
          >
            {cerrandoOtrasSesiones
              ? "CERRANDO..."
              : "CERRAR OTRAS SESIONES"}
          </button>
        </div>
      </div>
    </section>
  );
}