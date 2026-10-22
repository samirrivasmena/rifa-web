"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "../../../lib/getAdminAuthHeaders";

/* =========================================================
   HELPERS
========================================================= */

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function obtenerDigitosRifa(rifa) {
  const formato = rifa?.formato;

  if (
    typeof formato === "number" &&
    Number.isInteger(formato) &&
    formato > 0
  ) {
    return formato;
  }

  const formatoTexto = String(formato ?? "")
    .trim()
    .toLowerCase();

  const match = formatoTexto.match(/(\d+)/);

  if (match) {
    const numero = Number(match[1]);

    if (
      Number.isInteger(numero) &&
      numero > 0 &&
      numero <= 10
    ) {
      return numero;
    }
  }

  const total =
    Number(rifa?.cantidad_numeros) ||
    Number(rifa?.total_numeros) ||
    Number(rifa?.cantidadNumeros) ||
    0;

  if (total > 0) {
    return Math.max(
      1,
      String(Math.max(0, total - 1)).length
    );
  }

  return 3;
}

function formatearNumeroTicket(valor, digitos = 3) {
  const limpio = limpiarTexto(valor);

  if (!limpio) return "";

  const soloNumeros = limpio.replace(/\D/g, "");

  if (!soloNumeros) return limpio;

  return soloNumeros.padStart(digitos, "0");
}

function normalizarInstagram(valor) {
  const limpio = limpiarTexto(valor);

  if (!limpio) return "";

  return `@${limpio.replace(/^@+/, "")}`;
}

function obtenerUrlInstagram(valor) {
  const usuario = normalizarInstagram(valor).replace(
    /^@/,
    ""
  );

  if (!usuario) return "";

  return `https://www.instagram.com/${encodeURIComponent(
    usuario
  )}/`;
}

function formatearMonto(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return valor ? String(valor) : "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numero);
}

async function copiarTexto(
  texto,
  mensaje = "Copiado"
) {
  const valor = limpiarTexto(texto);

  if (!valor) return;

  try {
    await navigator.clipboard.writeText(valor);

    await Swal.fire({
      icon: "success",
      title: mensaje,
      timer: 1000,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error(error);

    await Swal.fire({
      icon: "error",
      title: "No se pudo copiar",
      text: "Copia el dato manualmente.",
    });
  }
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function AdminGanadoresSection({
  rifaSeleccionada,
  recargarTodo,
  formatearFecha,
}) {
  const [ganadores, setGanadores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] =
    useState(null);

  /* =======================================================
     CARGAR GANADORES
  ======================================================= */

  const cargarGanadores = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/historial-ganadores",
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text:
            data.error ||
            "No se pudieron cargar los ganadores",
        });

        return;
      }

      setGanadores(
        Array.isArray(data.ganadores)
          ? data.ganadores
          : []
      );
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los ganadores",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGanadores();
  }, []);

  /* =======================================================
     FILTRAR POR RIFA
  ======================================================= */

  const ganadoresFiltrados = useMemo(() => {
    if (!rifaSeleccionada?.id) {
      return ganadores;
    }

    return ganadores.filter(
      (ganador) =>
        String(ganador.rifa_id) ===
        String(rifaSeleccionada.id)
    );
  }, [ganadores, rifaSeleccionada]);

  /* =======================================================
     SUBIR IMAGEN
  ======================================================= */

  const subirImagen = async (file) => {
    if (!file) return "";

    const formData = new FormData();

    formData.append("file", file);

    const headers =
      await getAdminAuthHeaders();

    const res = await fetch(
      "/api/subir-imagen-rifa",
      {
        method: "POST",

        headers: {
          Authorization:
            headers.Authorization || "",
        },

        body: formData,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
          "No se pudo subir la imagen"
      );
    }

    return data.url || data.publicUrl || "";
  };

  /* =======================================================
     EDITAR GANADOR
  ======================================================= */

  const editarGanador = async (ganador) => {
    const rifa = ganador.rifas || {};

    const padLength =
      obtenerDigitosRifa(rifa);

    const numeroActual =
      formatearNumeroTicket(
        ganador.numero_oficial ??
          ganador.numero_ganador,
        padLength
      );

    const nombreAutomatico =
      ganador?.propietario?.nombre ||
      ganador?.nombre_ganador ||
      "";

    const instagramAutomatico =
      ganador?.participacion_free
        ?.social_username ||
      ganador?.instagram_ganador ||
      "";

    const { value: formValues } =
      await Swal.fire({
        title: "Editar resultado del ganador",

        width: 980,

        background: "#10131a",

        color: "#f8fafc",

        showCancelButton: true,

        confirmButtonText: "Guardar cambios",

        cancelButtonText: "Cancelar",

        confirmButtonColor: "#7c3aed",

        cancelButtonColor: "#6b7280",

        customClass: {
          popup: "winner-modal-popup",
          htmlContainer:
            "winner-modal-html",
        },

        html: `
          <div class="winner-modal-grid">

            <div class="winner-modal-row">

              <div class="winner-field">
                <label>Nombre del ganador</label>

                <input
                  id="swal-nombre-ganador"
                  value="${nombreAutomatico}"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div class="winner-field">
                <label>Número ganador</label>

                <input
                  id="swal-numero-ganador"
                  value="${numeroActual}"
                  maxlength="${padLength}"
                  inputmode="numeric"
                />
              </div>

            </div>

            <div class="winner-field">

              <label>
                Descripción del resultado
              </label>

              <textarea
                id="swal-descripcion-ganador"
                placeholder="Ej: Ganador oficial de la rifa..."
              >${
                ganador.descripcion_resultado ||
                ""
              }</textarea>

            </div>

            <div class="winner-upload-grid">

              <label class="winner-upload-card">

                <span class="winner-upload-icon">
                  🖼️
                </span>

                <strong>
                  Foto principal
                </strong>

                <small>
                  Si no subes una, se usa la foto del premio
                </small>

                <input
                  id="swal-foto-principal"
                  type="file"
                  accept="image/*"
                  hidden
                />

              </label>

              <label class="winner-upload-card">

                <span class="winner-upload-icon">
                  📸
                </span>

                <strong>
                  Foto secundaria
                </strong>

                <small>
                  Si no subes una, se usa la segunda foto del premio
                </small>

                <input
                  id="swal-foto-secundaria"
                  type="file"
                  accept="image/*"
                  hidden
                />

              </label>

            </div>

            <div class="winner-modal-row">

              <div class="winner-field">

                <label>Ciudad</label>

                <input
                  id="swal-ciudad-ganador"
                  value="${
                    ganador.ciudad_ganador ||
                    ""
                  }"
                  placeholder="Ej: Chicago"
                />

              </div>

              <div class="winner-field">

                <label>Instagram</label>

                <input
                  id="swal-instagram-ganador"
                  value="${instagramAutomatico}"
                  placeholder="@usuario"
                />

              </div>

            </div>

            <div class="winner-modal-row">

              <div class="winner-field">

                <label>
                  Estado entrega
                </label>

                <select
                  id="swal-estado-entrega"
                >

                  <option
                    value="pendiente"
                    ${
                      ganador.estado_entrega !==
                      "entregado"
                        ? "selected"
                        : ""
                    }
                  >
                    Pendiente
                  </option>

                  <option
                    value="entregado"
                    ${
                      ganador.estado_entrega ===
                      "entregado"
                        ? "selected"
                        : ""
                    }
                  >
                    Entregado
                  </option>

                </select>

              </div>

              <div class="winner-field">

                <label>
                  Nota interna
                </label>

                <textarea
                  id="swal-nota-interna"
                  placeholder="Ganador contactado por WhatsApp..."
                >${
                  ganador.nota_interna || ""
                }</textarea>

              </div>

            </div>

          </div>
        `,

        preConfirm: () => {
          const numero = document
            .getElementById(
              "swal-numero-ganador"
            )
            ?.value?.replace(/\D/g, "")
            ?.slice(0, padLength);

          if (!numero) {
            Swal.showValidationMessage(
              "Debes ingresar un número ganador"
            );

            return false;
          }

          return {
            numero_ganador: numero,

            nombre_ganador:
              document
                .getElementById(
                  "swal-nombre-ganador"
                )
                ?.value?.trim() || "",

            descripcion_resultado:
              document
                .getElementById(
                  "swal-descripcion-ganador"
                )
                ?.value?.trim() || "",

            ciudad_ganador:
              document
                .getElementById(
                  "swal-ciudad-ganador"
                )
                ?.value?.trim() || "",

            instagram_ganador:
              document
                .getElementById(
                  "swal-instagram-ganador"
                )
                ?.value?.trim() || "",

            estado_entrega:
              document.getElementById(
                "swal-estado-entrega"
              )?.value || "pendiente",

            nota_interna:
              document
                .getElementById(
                  "swal-nota-interna"
                )
                ?.value?.trim() || "",

            fotoPrincipal:
              document.getElementById(
                "swal-foto-principal"
              )?.files?.[0] || null,

            fotoSecundaria:
              document.getElementById(
                "swal-foto-secundaria"
              )?.files?.[0] || null,
          };
        },
      });

    if (!formValues) return;

    try {
      setGuardando(ganador.id);

      let fotoGanadorUrl =
        ganador.foto_ganador_url || "";

      let fotoGanadorSecundariaUrl =
        ganador.foto_ganador_secundaria_url ||
        "";

      if (formValues.fotoPrincipal) {
        fotoGanadorUrl =
          await subirImagen(
            formValues.fotoPrincipal
          );
      }

      if (formValues.fotoSecundaria) {
        fotoGanadorSecundariaUrl =
          await subirImagen(
            formValues.fotoSecundaria
          );
      }

      const res = await fetch(
        "/api/editar-ganador",
        {
          method: "POST",

          headers: {
            ...(await getAdminAuthHeaders()),
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            sorteoId: ganador.id,

            padLength,

            numero_ganador:
              formValues.numero_ganador,

            nombre_ganador:
              formValues.nombre_ganador,

            descripcion_resultado:
              formValues.descripcion_resultado,

            foto_ganador_url:
              fotoGanadorUrl,

            foto_ganador_secundaria_url:
              fotoGanadorSecundariaUrl,

            ciudad_ganador:
              formValues.ciudad_ganador,

            instagram_ganador:
              formValues.instagram_ganador,

            estado_entrega:
              formValues.estado_entrega,

            fecha_entrega:
              formValues.estado_entrega ===
              "entregado"
                ? ganador.fecha_entrega ||
                  new Date().toISOString()
                : null,

            nota_interna:
              formValues.nota_interna,

            fuente:
              rifa.nombre || "Rifa",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text:
            data.error ||
            "No se pudo editar el ganador",
        });

        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Ganador actualizado",
        text: "Los datos del resultado fueron actualizados correctamente",
      });

      await cargarGanadores();

      if (recargarTodo) {
        await recargarTodo();
      }
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error.message ||
          "No se pudo editar el ganador",
      });
    } finally {
      setGuardando(null);
    }
  };

  /* =======================================================
     MARCAR COMO ENTREGADO
  ======================================================= */

  const marcarComoEntregado = async (
    ganador
  ) => {
    const confirmar = await Swal.fire({
      icon: "question",

      title: "¿Marcar como entregado?",

      text: "Se guardará la fecha de entrega automáticamente.",

      showCancelButton: true,

      confirmButtonText:
        "Sí, marcar entregado",

      cancelButtonText: "Cancelar",

      confirmButtonColor: "#16a34a",

      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    const rifa = ganador.rifas || {};

    const padLength =
      obtenerDigitosRifa(rifa);

    try {
      setGuardando(ganador.id);

      const res = await fetch(
        "/api/editar-ganador",
        {
          method: "POST",

          headers: {
            ...(await getAdminAuthHeaders()),
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            sorteoId: ganador.id,

            padLength,

            numero_ganador:
              ganador.numero_ganador,

            nombre_ganador:
              ganador.nombre_ganador ||
              ganador?.propietario?.nombre ||
              "",

            descripcion_resultado:
              ganador.descripcion_resultado,

            foto_ganador_url:
              ganador.foto_ganador_url,

            foto_ganador_secundaria_url:
              ganador.foto_ganador_secundaria_url,

            ciudad_ganador:
              ganador.ciudad_ganador,

            instagram_ganador:
              ganador.instagram_ganador ||
              ganador?.participacion_free
                ?.social_username ||
              "",

            estado_entrega: "entregado",

            fecha_entrega:
              new Date().toISOString(),

            nota_interna:
              ganador.nota_interna ||
              "Premio marcado como entregado.",

            fuente:
              rifa.nombre || "Rifa",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text:
            data.error ||
            "No se pudo marcar como entregado",
        });

        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Premio entregado",
        text: "El estado fue actualizado correctamente.",
      });

      await cargarGanadores();

      if (recargarTodo) {
        await recargarTodo();
      }
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error.message ||
          "No se pudo marcar como entregado",
      });
    } finally {
      setGuardando(null);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="adminpro-page-stack">
      <div className="adminpro-card">

        {/* HEADER */}

        <div className="adminpro-section-head">
          <div>
            <h2>🏆 Ganadores</h2>

            <p>
              Historial oficial de ganadores,
              tickets y entrega de premios.
            </p>
          </div>

          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={cargarGanadores}
            disabled={loading}
          >
            {loading
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>

        {/* SIN GANADORES */}

        {!ganadoresFiltrados.length ? (
          <div className="adminpro-empty-box">
            <p>
              🏆 No hay ganadores para la
              rifa seleccionada.
            </p>

            <p
              style={{
                marginTop: "8px",
                fontSize: "14px",
              }}
            >
              Primero registra un ganador
              oficial en Validar Ganador.
            </p>
          </div>
        ) : (
          <div className="admin-winners-grid">
            {ganadoresFiltrados.map(
              (ganador) => {
                const rifa =
                  ganador.rifas || {};

                const padLength =
                  obtenerDigitosRifa(rifa);

                const numero =
                  formatearNumeroTicket(
                    ganador.numero_oficial ??
                      ganador.numero_ganador,
                    padLength
                  );

                const esFree =
                  ganador.es_free === true ||
                  String(
                    ganador.tipo_ticket || ""
                  ).toLowerCase() === "free";

                const propietario =
                  ganador.propietario || {};

                const compra =
                  ganador.compra_ganadora ||
                  null;

                const participacionFree =
                  ganador.participacion_free ||
                  null;

                const freeDrop =
                  ganador.free_drop_ganador ||
                  null;

                const nombrePropietario =
                  propietario.nombre ||
                  ganador.nombre_ganador ||
                  "Ganador sin nombre";

                const emailPropietario =
                  propietario.email || "";

                const telefonoPropietario =
                  propietario.telefono || "";

                const instagramFree =
                  participacionFree
                    ?.social_username || "";

                const instagramMostrar =
                  instagramFree ||
                  ganador.instagram_ganador ||
                  "";

                const codigoFree =
                  participacionFree?.codigo ||
                  participacionFree
                    ?.codigo_unico ||
                  "";

                const nombreFreeDrop =
                  freeDrop?.nombre ||
                  (freeDrop?.numero_drop
                    ? `FREE DROP #${freeDrop.numero_drop}`
                    : "");

                const fotoPrincipal =
                  ganador.foto_ganador_url ||
                  rifa.portada_url ||
                  rifa.portada_scroll_url ||
                  "";

                const fotoSecundaria =
                  ganador.foto_ganador_secundaria_url ||
                  rifa.portada_scroll_url ||
                  rifa.portada_url ||
                  "";

                const hayDosFotos =
                  Boolean(fotoPrincipal) &&
                  Boolean(fotoSecundaria) &&
                  fotoPrincipal !==
                    fotoSecundaria;

                return (
                  <article
                    key={ganador.id}
                    className="admin-winner-card"
                  >
                    {/* CABECERA */}

                    <div className="admin-winner-card-head">
                      <div>
                        <span className="adminpro-badge-box">
                          🏆 Resultado oficial
                        </span>

                        <h3>
                          {nombrePropietario}
                        </h3>

                        <p>
                          {rifa.nombre ||
                            "Rifa"}
                        </p>
                      </div>

                      <div className="admin-winner-number">
                        <small>
                          Número
                        </small>

                        <strong>
                          {numero}
                        </strong>
                      </div>
                    </div>

                    {/* GANADOR DESTACADO */}

                    <div
                      style={{
                        marginTop: "16px",
                        padding: "18px",
                        borderRadius: "16px",
                        border:
                          "1px solid rgba(245, 158, 11, 0.45)",
                        background:
                          "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(234,179,8,0.05))",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                900,
                              letterSpacing:
                                ".08em",
                              color:
                                "#fbbf24",
                            }}
                          >
                            🏆 GANADOR DE ESTA
                            RIFA
                          </div>

                          <div
                            style={{
                              marginTop:
                                "7px",
                              fontSize:
                                "20px",
                              fontWeight:
                                900,
                            }}
                          >
                            #{numero}
                          </div>
                        </div>

                        <span
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            padding:
                              "8px 12px",
                            borderRadius:
                              "999px",
                            fontSize:
                              "12px",
                            fontWeight:
                              900,
                            border: esFree
                              ? "1px solid rgba(168,85,247,.45)"
                              : "1px solid rgba(59,130,246,.45)",
                            background:
                              esFree
                                ? "rgba(168,85,247,.14)"
                                : "rgba(59,130,246,.14)",
                          }}
                        >
                          {esFree
                            ? "🎁 TICKET FREE"
                            : "🎟️ TICKET PAGADO"}
                        </span>
                      </div>
                    </div>

                    {/* =====================================
                        GALERÍA DE FOTOS
                    ===================================== */}

                    <div className="admin-winner-gallery">
                      {fotoPrincipal ||
                      fotoSecundaria ? (
                        <div className="admin-winner-gallery-track">

                          {fotoPrincipal && (
                            <div className="admin-winner-gallery-slide">
                              <img
                                src={
                                  fotoPrincipal
                                }
                                alt={`${nombrePropietario} - Foto principal`}
                                className="admin-winner-gallery-image"
                              />

                              <span className="admin-winner-gallery-label">
                                Foto principal
                              </span>
                            </div>
                          )}

                          {hayDosFotos && (
                            <div className="admin-winner-gallery-slide">
                              <img
                                src={
                                  fotoSecundaria
                                }
                                alt={`${nombrePropietario} - Foto secundaria`}
                                className="admin-winner-gallery-image"
                              />

                              <span className="admin-winner-gallery-label">
                                Foto secundaria
                              </span>
                            </div>
                          )}

                        </div>
                      ) : (
                        <div className="admin-winner-gallery-empty">
                          <span>🖼️</span>

                          <strong>
                            Sin foto disponible
                          </strong>
                        </div>
                      )}

                      {hayDosFotos && (
                        <div className="admin-winner-gallery-hint">
                          <span>●</span>
                          <span>●</span>

                          <small>
                            Desliza para ver
                            las fotos
                          </small>
                        </div>
                      )}
                    </div>

                    {/* PROPIETARIO */}

                    <div
                      style={{
                        marginTop: "16px",
                        padding: "16px",
                        borderRadius: "14px",
                        background:
                          "rgba(255,255,255,.035)",
                        border:
                          "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          marginBottom:
                            "14px",
                        }}
                      >
                        👤 Propietario del
                        número ganador
                      </div>

                      <div className="admin-winner-info">
                        <div>
                          <span>
                            Nombre
                          </span>

                          <strong>
                            {
                              nombrePropietario
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Email
                          </span>

                          <strong>
                            {emailPropietario ||
                              "Sin email"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Teléfono
                          </span>

                          <strong>
                            {telefonoPropietario ||
                              "Sin teléfono"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Tipo
                          </span>

                          <strong>
                            {esFree
                              ? "🎁 FREE"
                              : "🎟️ Pagado"}
                          </strong>
                        </div>
                      </div>

                      {(emailPropietario ||
                        telefonoPropietario) && (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap:
                              "wrap",
                            marginTop:
                              "12px",
                          }}
                        >
                          {emailPropietario && (
                            <button
                              type="button"
                              className="adminpro-soft-btn dark"
                              onClick={() =>
                                copiarTexto(
                                  emailPropietario,
                                  "Email copiado"
                                )
                              }
                            >
                              📋 Copiar email
                            </button>
                          )}

                          {telefonoPropietario && (
                            <button
                              type="button"
                              className="adminpro-soft-btn dark"
                              onClick={() =>
                                copiarTexto(
                                  telefonoPropietario,
                                  "Teléfono copiado"
                                )
                              }
                            >
                              📋 Copiar
                              teléfono
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* FREE */}

                    {esFree && (
                      <div
                        style={{
                          marginTop:
                            "14px",
                          padding: "16px",
                          borderRadius:
                            "14px",
                          background:
                            "rgba(168,85,247,.08)",
                          border:
                            "1px solid rgba(168,85,247,.24)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              900,
                            marginBottom:
                              "14px",
                          }}
                        >
                          🎁 Información del
                          ticket FREE
                        </div>

                        <div className="admin-winner-info">
                          <div>
                            <span>
                              Código FREE
                            </span>

                            <strong>
                              {codigoFree ||
                                "Sin código"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Free Drop
                            </span>

                            <strong>
                              {nombreFreeDrop ||
                                "Free Drop"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Instagram
                            </span>

                            <strong>
                              {instagramMostrar
                                ? normalizarInstagram(
                                    instagramMostrar
                                  )
                                : "Sin Instagram"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Estado FREE
                            </span>

                            <strong>
                              {participacionFree
                                ?.estado ||
                                "—"}
                            </strong>
                          </div>
                        </div>

                        {(codigoFree ||
                          instagramMostrar) && (
                          <div
                            style={{
                              display:
                                "flex",
                              gap: "8px",
                              flexWrap:
                                "wrap",
                              marginTop:
                                "12px",
                            }}
                          >
                            {codigoFree && (
                              <button
                                type="button"
                                className="adminpro-soft-btn dark"
                                onClick={() =>
                                  copiarTexto(
                                    codigoFree,
                                    "Código FREE copiado"
                                  )
                                }
                              >
                                📋 Copiar
                                código FREE
                              </button>
                            )}

                            {instagramMostrar && (
                              <>
                                <button
                                  type="button"
                                  className="adminpro-soft-btn dark"
                                  onClick={() =>
                                    copiarTexto(
                                      normalizarInstagram(
                                        instagramMostrar
                                      ),
                                      "Instagram copiado"
                                    )
                                  }
                                >
                                  📋 Copiar
                                  Instagram
                                </button>

                                <a
                                  href={obtenerUrlInstagram(
                                    instagramMostrar
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="adminpro-soft-btn dark"
                                >
                                  📸 Ver
                                  Instagram
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* COMPRA PAGADA */}

                    {!esFree && compra && (
                      <div
                        style={{
                          marginTop:
                            "14px",
                          padding: "16px",
                          borderRadius:
                            "14px",
                          background:
                            "rgba(59,130,246,.07)",
                          border:
                            "1px solid rgba(59,130,246,.22)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              900,
                            marginBottom:
                              "14px",
                          }}
                        >
                          🎟️ Información de
                          la compra
                        </div>

                        <div className="admin-winner-info">
                          <div>
                            <span>
                              Cantidad tickets
                            </span>

                            <strong>
                              {compra.cantidad_tickets ??
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Monto
                            </span>

                            <strong>
                              {formatearMonto(
                                compra.monto_total
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Estado pago
                            </span>

                            <strong>
                              {compra.estado_pago ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Método
                            </span>

                            <strong>
                              {compra.metodo_pago ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Referencia
                            </span>

                            <strong>
                              {compra.referencia ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Fecha compra
                            </span>

                            <strong>
                              {compra.fecha_compra
                                ? formatearFecha?.(
                                    compra.fecha_compra
                                  ) ||
                                  compra.fecha_compra
                                : "—"}
                            </strong>
                          </div>
                        </div>

                        {compra.referencia && (
                          <div
                            style={{
                              marginTop:
                                "12px",
                            }}
                          >
                            <button
                              type="button"
                              className="adminpro-soft-btn dark"
                              onClick={() =>
                                copiarTexto(
                                  compra.referencia,
                                  "Referencia copiada"
                                )
                              }
                            >
                              📋 Copiar
                              referencia
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PREMIO / ENTREGA */}

                    <div className="admin-winner-info">
                      <div>
                        <span>
                          Premio
                        </span>

                        <strong>
                          {rifa.premio ||
                            "Sin premio"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Ciudad
                        </span>

                        <strong>
                          {ganador.ciudad_ganador ||
                            "Sin ciudad"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Estado
                        </span>

                        <strong>
                          {ganador.estado_entrega ===
                          "entregado"
                            ? "✅ Entregado"
                            : "⏳ Pendiente"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Fecha entrega
                        </span>

                        <strong>
                          {ganador.fecha_entrega
                            ? formatearFecha?.(
                                ganador.fecha_entrega
                              ) ||
                              ganador.fecha_entrega
                            : "Sin entregar"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Fecha resultado
                        </span>

                        <strong>
                          {formatearFecha?.(
                            ganador.fecha_sorteo
                          ) ||
                            ganador.fecha_sorteo ||
                            "Sin fecha"}
                        </strong>
                      </div>

                      {instagramMostrar ? (
                        <div>
                          <span>
                            Instagram
                          </span>

                          <strong>
                            {normalizarInstagram(
                              instagramMostrar
                            )}
                          </strong>
                        </div>
                      ) : null}
                    </div>

                    {/* DESCRIPCIÓN */}

                    <div className="admin-winner-description">
                      <strong>
                        Descripción
                      </strong>

                      <p>
                        {ganador.descripcion_resultado ||
                          "Sin descripción"}
                      </p>
                    </div>

                    {/* NOTA INTERNA */}

                    <div className="admin-winner-description">
                      <strong>
                        Nota interna
                      </strong>

                      <p>
                        {ganador.nota_interna ||
                          "Sin observaciones"}
                      </p>
                    </div>

                    {/* ACCIONES */}

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="adminpro-primary-btn"
                        onClick={() =>
                          editarGanador(
                            ganador
                          )
                        }
                        disabled={
                          guardando ===
                          ganador.id
                        }
                      >
                        {guardando ===
                        ganador.id
                          ? "Guardando..."
                          : "Editar resultado"}
                      </button>

                      <a
                        href="/principal#historial-ganadores"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="adminpro-soft-btn dark"
                      >
                        Ver resultado público
                      </a>

                      {ganador.estado_entrega !==
                        "entregado" && (
                        <button
                          type="button"
                          className="adminpro-soft-btn green"
                          onClick={() =>
                            marcarComoEntregado(
                              ganador
                            )
                          }
                          disabled={
                            guardando ===
                            ganador.id
                          }
                        >
                          Marcar como
                          entregado
                        </button>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ===================================================
          ESTILOS DE LA GALERÍA
          Los dejamos aquí para que NO tengas que modificar
          otro archivo CSS.
      =================================================== */}

      <style jsx>{`
        .admin-winner-gallery {
          width: 100%;
          margin-top: 16px;
          overflow: hidden;
          border-radius: 16px;
        }

        .admin-winner-gallery-track {
          display: flex;
          width: 100%;
          gap: 12px;
        }

        .admin-winner-gallery-slide {
          position: relative;
          flex: 1 1 0;
          min-width: 0;
          height: 320px;
          overflow: hidden;
          border-radius: 16px;
          background: #0d111b;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .admin-winner-gallery-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .admin-winner-gallery-label {
          position: absolute;
          z-index: 2;
          left: 12px;
          bottom: 12px;

          padding: 6px 10px;

          border-radius: 999px;

          background: rgba(
            9,
            12,
            20,
            0.82
          );

          color: #ffffff;

          font-size: 11px;
          font-weight: 800;

          backdrop-filter: blur(8px);
        }

        .admin-winner-gallery-empty {
          height: 240px;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          gap: 8px;

          border-radius: 16px;

          background: rgba(
            255,
            255,
            255,
            0.03
          );

          border: 1px dashed
            rgba(255, 255, 255, 0.12);

          color: #94a3b8;
        }

        .admin-winner-gallery-empty
          span {
          font-size: 32px;
        }

        .admin-winner-gallery-hint {
          display: none;
        }

        /* ===============================================
           TABLET
        =============================================== */

        @media (max-width: 1000px) {
          .admin-winner-gallery-slide {
            height: 280px;
          }
        }

        /* ===============================================
           TELÉFONOS
        =============================================== */

        @media (max-width: 768px) {
          .admin-winner-gallery {
            margin-top: 12px;
            overflow: visible;
            border-radius: 14px;
          }

          .admin-winner-gallery-track {
            display: flex;

            width: 100%;

            gap: 10px;

            overflow-x: auto;
            overflow-y: hidden;

            scroll-snap-type: x
              mandatory;

            scroll-behavior: smooth;

            overscroll-behavior-x:
              contain;

            -webkit-overflow-scrolling:
              touch;

            scrollbar-width: none;

            touch-action: pan-x;

            padding-bottom: 2px;
          }

          .admin-winner-gallery-track::-webkit-scrollbar {
            display: none;
          }

          .admin-winner-gallery-slide {
            flex: 0 0 100%;

            width: 100%;
            min-width: 100%;

            height: 225px;

            border-radius: 14px;

            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          .admin-winner-gallery-image {
            width: 100%;
            height: 100%;

            object-fit: cover;
            object-position: center;
          }

          .admin-winner-gallery-label {
            left: 10px;
            bottom: 10px;

            padding: 5px 9px;

            font-size: 10px;
          }

          .admin-winner-gallery-hint {
            display: flex;
            align-items: center;
            justify-content: center;

            gap: 5px;

            margin-top: 8px;

            color: #64748b;
          }

          .admin-winner-gallery-hint
            span {
            font-size: 7px;
          }

          .admin-winner-gallery-hint
            small {
            margin-left: 5px;

            font-size: 10px;
            font-weight: 700;
          }

          .admin-winner-gallery-empty {
            height: 210px;
          }
        }

        /* ===============================================
           TELÉFONOS PEQUEÑOS
        =============================================== */

        @media (max-width: 480px) {
          .admin-winner-gallery-slide {
            height: 200px;
          }

          .admin-winner-gallery-empty {
            height: 190px;
          }
        }
      `}</style>
    </div>
  );
}