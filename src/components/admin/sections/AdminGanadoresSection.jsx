"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { getAdminAuthHeaders } from "../../../lib/getAdminAuthHeaders";

export default function AdminGanadoresSection({
  rifaSeleccionada,
  recargarTodo,
  formatearFecha,
}) {
  const [ganadores, setGanadores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(null);
  const [showSecondImage, setShowSecondImage] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowSecondImage(window.scrollY > 180);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const cargarGanadores = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/historial-ganadores", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudieron cargar los ganadores",
        });
        return;
      }

      setGanadores(Array.isArray(data.ganadores) ? data.ganadores : []);
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

  const ganadoresFiltrados = useMemo(() => {
    if (!rifaSeleccionada?.id) return ganadores;

    return ganadores.filter(
      (g) => String(g.rifa_id) === String(rifaSeleccionada.id)
    );
  }, [ganadores, rifaSeleccionada]);

  const subirImagen = async (file) => {
    if (!file) return "";

    const formData = new FormData();
    formData.append("file", file);

    const headers = await getAdminAuthHeaders();

    const res = await fetch("/api/subir-imagen-rifa", {
      method: "POST",
      headers: {
        Authorization: headers.Authorization || "",
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "No se pudo subir la imagen");
    }

    return data.url || data.publicUrl || "";
  };

  const editarGanador = async (ganador) => {
    const rifa = ganador.rifas || {};
    const padLength = rifa.formato === "3digitos" ? 3 : 4;

    const numeroActual =
      ganador.numero_oficial ||
      String(ganador.numero_ganador || "").padStart(padLength, "0");

    const { value: formValues } = await Swal.fire({
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
        htmlContainer: "winner-modal-html",
      },
      html: `
        <div class="winner-modal-grid">
          <div class="winner-modal-row">
            <div class="winner-field">
              <label>Nombre del ganador</label>
              <input 
                id="swal-nombre-ganador" 
                value="${ganador.nombre_ganador || ""}" 
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
            <label>Descripción del resultado</label>
            <textarea 
              id="swal-descripcion-ganador" 
              placeholder="Ej: Ganador oficial de la rifa..."
            >${ganador.descripcion_resultado || ""}</textarea>
          </div>

          <div class="winner-upload-grid">
            <label class="winner-upload-card">
              <span class="winner-upload-icon">🖼️</span>
              <strong>Foto principal</strong>
              <small>Si no subes una, se usa la foto del premio</small>
              <input id="swal-foto-principal" type="file" accept="image/*" hidden />
            </label>

            <label class="winner-upload-card">
              <span class="winner-upload-icon">📸</span>
              <strong>Foto secundaria</strong>
              <small>Si no subes una, se usa la segunda foto del premio</small>
              <input id="swal-foto-secundaria" type="file" accept="image/*" hidden />
            </label>
          </div>

          <div class="winner-modal-row">
            <div class="winner-field">
              <label>Ciudad</label>
              <input 
                id="swal-ciudad-ganador" 
                value="${ganador.ciudad_ganador || ""}" 
                placeholder="Ej: Chicago" 
              />
            </div>

            <div class="winner-field">
              <label>Instagram</label>
              <input 
                id="swal-instagram-ganador" 
                value="${ganador.instagram_ganador || ""}" 
                placeholder="@usuario" 
              />
            </div>
          </div>

          <div class="winner-modal-row">
            <div class="winner-field">
              <label>Estado entrega</label>
              <select id="swal-estado-entrega">
                <option value="pendiente" ${
                  ganador.estado_entrega !== "entregado" ? "selected" : ""
                }>
                  Pendiente
                </option>
                <option value="entregado" ${
                  ganador.estado_entrega === "entregado" ? "selected" : ""
                }>
                  Entregado
                </option>
              </select>
            </div>

            <div class="winner-field">
              <label>Nota interna</label>
              <textarea
                id="swal-nota-interna"
                placeholder="Ganador contactado por WhatsApp..."
              >${ganador.nota_interna || ""}</textarea>
            </div>
          </div>
        </div>
      `,
      preConfirm: () => {
        const numero = document
          .getElementById("swal-numero-ganador")
          ?.value?.replace(/\D/g, "")
          ?.slice(0, padLength);

        if (!numero) {
          Swal.showValidationMessage("Debes ingresar un número ganador");
          return false;
        }

        return {
          numero_ganador: numero,
          nombre_ganador:
            document.getElementById("swal-nombre-ganador")?.value?.trim() || "",
          descripcion_resultado:
            document.getElementById("swal-descripcion-ganador")?.value?.trim() ||
            "",
          ciudad_ganador:
            document.getElementById("swal-ciudad-ganador")?.value?.trim() || "",
          instagram_ganador:
            document.getElementById("swal-instagram-ganador")?.value?.trim() ||
            "",
          estado_entrega:
            document.getElementById("swal-estado-entrega")?.value ||
            "pendiente",
          nota_interna:
            document.getElementById("swal-nota-interna")?.value?.trim() || "",
          fotoPrincipal:
            document.getElementById("swal-foto-principal")?.files?.[0] || null,
          fotoSecundaria:
            document.getElementById("swal-foto-secundaria")?.files?.[0] || null,
        };
      },
    });

    if (!formValues) return;

    try {
      setGuardando(ganador.id);

      let fotoGanadorUrl = ganador.foto_ganador_url || "";
      let fotoGanadorSecundariaUrl =
        ganador.foto_ganador_secundaria_url || "";

      if (formValues.fotoPrincipal) {
        fotoGanadorUrl = await subirImagen(formValues.fotoPrincipal);
      }

      if (formValues.fotoSecundaria) {
        fotoGanadorSecundariaUrl = await subirImagen(formValues.fotoSecundaria);
      }

      const res = await fetch("/api/editar-ganador", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sorteoId: ganador.id,
          padLength,
          numero_ganador: formValues.numero_ganador,
          nombre_ganador: formValues.nombre_ganador,
          descripcion_resultado: formValues.descripcion_resultado,
          foto_ganador_url: fotoGanadorUrl,
          foto_ganador_secundaria_url: fotoGanadorSecundariaUrl,
          ciudad_ganador: formValues.ciudad_ganador,
          instagram_ganador: formValues.instagram_ganador,
          estado_entrega: formValues.estado_entrega,
          fecha_entrega:
            formValues.estado_entrega === "entregado"
              ? ganador.fecha_entrega || new Date().toISOString()
              : null,
          nota_interna: formValues.nota_interna,
          fuente: rifa.nombre || "Rifa",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo editar el ganador",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Ganador actualizado",
        text: "Los datos del resultado fueron actualizados correctamente",
      });

      await cargarGanadores();
      if (recargarTodo) await recargarTodo();
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo editar el ganador",
      });
    } finally {
      setGuardando(null);
    }
  };

  const marcarComoEntregado = async (ganador) => {
    const confirmar = await Swal.fire({
      icon: "question",
      title: "¿Marcar como entregado?",
      text: "Se guardará la fecha de entrega automáticamente.",
      showCancelButton: true,
      confirmButtonText: "Sí, marcar entregado",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    const rifa = ganador.rifas || {};
    const padLength = rifa.formato === "3digitos" ? 3 : 4;

    try {
      setGuardando(ganador.id);

      const res = await fetch("/api/editar-ganador", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sorteoId: ganador.id,
          padLength,
          numero_ganador: ganador.numero_ganador,
          nombre_ganador: ganador.nombre_ganador,
          descripcion_resultado: ganador.descripcion_resultado,
          foto_ganador_url: ganador.foto_ganador_url,
          foto_ganador_secundaria_url: ganador.foto_ganador_secundaria_url,
          ciudad_ganador: ganador.ciudad_ganador,
          instagram_ganador: ganador.instagram_ganador,
          estado_entrega: "entregado",
          fecha_entrega: new Date().toISOString(),
          nota_interna:
            ganador.nota_interna || "Premio marcado como entregado.",
          fuente: rifa.nombre || "Rifa",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo marcar como entregado",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Premio entregado",
        text: "El estado fue actualizado correctamente.",
      });

      await cargarGanadores();
      if (recargarTodo) await recargarTodo();
    } catch (error) {
      console.error(error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo marcar como entregado",
      });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="adminpro-page-stack">
      <div className="adminpro-card">
        <div className="adminpro-section-head">
          <div>
            <h2>Ganador</h2>
            <p>
              Edita la información visual que aparece en la sección Resultados.
            </p>
          </div>

          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={cargarGanadores}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {!ganadoresFiltrados.length ? (
          <div className="adminpro-empty-box">
            <p>🏆 No hay ganadores para la rifa seleccionada.</p>
            <p style={{ marginTop: "8px", fontSize: "14px" }}>
              Primero registra un ganador oficial en Validar Ganador.
            </p>
          </div>
        ) : (
          <div className="admin-winners-grid">
            {ganadoresFiltrados.map((ganador) => {
              const rifa = ganador.rifas || {};
              const padLength = rifa.formato === "3digitos" ? 3 : 4;

              const numero =
                ganador.numero_oficial ||
                String(ganador.numero_ganador || "").padStart(padLength, "0");

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

              const fotoVisible =
                showSecondImage && fotoSecundaria
                  ? fotoSecundaria
                  : fotoPrincipal;

              return (
                <article key={ganador.id} className="admin-winner-card">
                  <div className="admin-winner-card-head">
                    <div>
                      <span className="adminpro-badge-box">
                        🏆 Resultado oficial
                      </span>

                      <h3>
                        {ganador.nombre_ganador || "Ganador sin nombre"}
                      </h3>

                      <p>{rifa.nombre || "Rifa"}</p>
                    </div>

                    <div className="admin-winner-number">
                      <small>Número</small>
                      <strong>{numero}</strong>
                    </div>
                  </div>

                  <div className="admin-winner-image-wrap">
                    {fotoVisible ? (
                      <img
                        src={fotoVisible}
                        alt={ganador.nombre_ganador || "Ganador"}
                        className="admin-winner-image"
                      />
                    ) : (
                      <div className="admin-winner-empty">
                        🖼️
                        <br />
                        Sin foto disponible
                      </div>
                    )}

                    {fotoPrincipal && fotoSecundaria && (
                      <div className="admin-winner-image-indicator">
                        {showSecondImage ? "Foto secundaria" : "Foto principal"}
                      </div>
                    )}
                  </div>

                  <div className="admin-winner-info">
                    <div>
                      <span>Premio</span>
                      <strong>{rifa.premio || "Sin premio"}</strong>
                    </div>

                    <div>
                      <span>Ciudad</span>
                      <strong>{ganador.ciudad_ganador || "Sin ciudad"}</strong>
                    </div>

                    <div>
                      <span>Estado</span>
                      <strong>
                        {ganador.estado_entrega === "entregado"
                          ? "✅ Entregado"
                          : "⏳ Pendiente"}
                      </strong>
                    </div>

                    <div>
                      <span>Fecha entrega</span>
                      <strong>
                        {ganador.fecha_entrega
                          ? formatearFecha?.(ganador.fecha_entrega) ||
                            ganador.fecha_entrega
                          : "Sin entregar"}
                      </strong>
                    </div>

                    <div>
                      <span>Fecha resultado</span>
                      <strong>
                        {formatearFecha?.(ganador.fecha_sorteo) ||
                          ganador.fecha_sorteo ||
                          "Sin fecha"}
                      </strong>
                    </div>

                    {ganador.instagram_ganador ? (
                      <div>
                        <span>Instagram</span>
                        <strong>{ganador.instagram_ganador}</strong>
                      </div>
                    ) : null}
                  </div>

                  <div className="admin-winner-description">
                    <strong>Descripción</strong>
                    <p>{ganador.descripcion_resultado || "Sin descripción"}</p>
                  </div>

                  <div className="admin-winner-description">
                    <strong>Nota interna</strong>
                    <p>{ganador.nota_interna || "Sin observaciones"}</p>
                  </div>

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
                      onClick={() => editarGanador(ganador)}
                      disabled={guardando === ganador.id}
                    >
                      {guardando === ganador.id
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

                    {ganador.estado_entrega !== "entregado" && (
                      <button
                        type="button"
                        className="adminpro-soft-btn green"
                        onClick={() => marcarComoEntregado(ganador)}
                        disabled={guardando === ganador.id}
                      >
                        Marcar como entregado
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}