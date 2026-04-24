"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { RefreshCcw } from "lucide-react";

import { getAdminAuthHeaders } from "../../lib/getAdminAuthHeaders";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEstadoBadgeStyle(estado) {
  switch (String(estado || "").toLowerCase()) {
    case "activa":
    case "publicada":
    case "disponible":
      return {
        background: "rgba(34, 197, 94, 0.12)",
        color: "#86efac",
        border: "1px solid rgba(34, 197, 94, 0.22)",
      };
    case "cerrada":
      return {
        background: "rgba(245, 158, 11, 0.12)",
        color: "#fbbf24",
        border: "1px solid rgba(245, 158, 11, 0.22)",
      };
    case "finalizada":
      return {
        background: "rgba(59, 130, 246, 0.12)",
        color: "#93c5fd",
        border: "1px solid rgba(59, 130, 246, 0.22)",
      };
    case "agotada":
    case "agotado":
      return {
        background: "rgba(248, 113, 113, 0.12)",
        color: "#fca5a5",
        border: "1px solid rgba(248, 113, 113, 0.22)",
      };
    default:
      return {
        background: "rgba(148, 163, 184, 0.12)",
        color: "#cbd5e1",
        border: "1px solid rgba(148, 163, 184, 0.18)",
      };
  }
}

function EstadoBadge({ estado }) {
  const style = getEstadoBadgeStyle(estado);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "800",
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        letterSpacing: "0.2px",
        ...style,
      }}
    >
      {estado || "Sin estado"}
    </span>
  );
}

function BoolBadge({ value, trueText = "Sí", falseText = "No" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "800",
        whiteSpace: "nowrap",
        background: value ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.12)",
        color: value ? "#bbf7d0" : "#cbd5e1",
        border: value
          ? "1px solid rgba(34, 197, 94, 0.22)"
          : "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      {value ? trueText : falseText}
    </span>
  );
}

export default function RifasSection({
  rifas = [],
  onRecargarRifas,
  onSeleccionarRifa,
  formatearFecha,
}) {
  const [creandoRifa, setCreandoRifa] = useState(false);
  const [activandoRifa, setActivandoRifa] = useState(null);
  const [eliminandoRifa, setEliminandoRifa] = useState(null);
  const [cerrandoRifa, setCerrandoRifa] = useState(null);
  const [finalizandoRifa, setFinalizandoRifa] = useState(null);
  const [editandoRifa, setEditandoRifa] = useState(null);

  const [portadaFile, setPortadaFile] = useState(null);
  const [previewPortada, setPreviewPortada] = useState("");

  const [portadaScrollFile, setPortadaScrollFile] = useState(null);
  const [previewPortadaScroll, setPreviewPortadaScroll] = useState("");

  const [nombreRifa, setNombreRifa] = useState("");
  const [descripcionRifa, setDescripcionRifa] = useState("");
  const [premioRifa, setPremioRifa] = useState("");
  const [precioTicketRifa, setPrecioTicketRifa] = useState("");
  const [formatoRifa, setFormatoRifa] = useState("4digitos");
  const [fechaSorteoRifa, setFechaSorteoRifa] = useState("");
  const [horaSorteoRifa, setHoraSorteoRifa] = useState("");
  const [fechaCierreRifa, setFechaCierreRifa] = useState("");
  const [publicadaRifa, setPublicadaRifa] = useState(false);
  const [destacadaRifa, setDestacadaRifa] = useState(false);

  useEffect(() => {
    return () => {
      if (previewPortada) URL.revokeObjectURL(previewPortada);
      if (previewPortadaScroll) URL.revokeObjectURL(previewPortadaScroll);
    };
  }, [previewPortada, previewPortadaScroll]);

  const rifasOrdenadas = useMemo(() => {
    return [...rifas].sort((a, b) => {
      const fechaA = new Date(a.created_at || a.fecha_creacion || 0).getTime();
      const fechaB = new Date(b.created_at || b.fecha_creacion || 0).getTime();
      return fechaB - fechaA;
    });
  }, [rifas]);

  const resumenRifas = useMemo(() => {
    const total = rifas.length;
    const publicadas = rifas.filter(
      (r) => r.publicada === true || r.publicada === 1 || r.publicada === "1" || r.publicada === "true"
    ).length;

    const activas = rifas.filter((r) =>
      ["activa", "disponible", "publicada"].includes(String(r.estado || "").toLowerCase())
    ).length;

    const finalizadas = rifas.filter((r) =>
      ["finalizada", "finalizado", "cerrada"].includes(String(r.estado || "").toLowerCase())
    ).length;

    const destacadas = rifas.filter((r) => Boolean(r.destacada)).length;

    return { total, publicadas, activas, finalizadas, destacadas };
  }, [rifas]);

  const formatFecha = (value) => {
    try {
      return typeof formatearFecha === "function" ? formatearFecha(value) : value || "Sin fecha";
    } catch {
      return value || "Sin fecha";
    }
  };

  const subirImagenRifa = async (file) => {
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

  const resetFormulario = () => {
    setNombreRifa("");
    setDescripcionRifa("");
    setPremioRifa("");
    setPrecioTicketRifa("");
    setFormatoRifa("4digitos");
    setFechaSorteoRifa("");
    setHoraSorteoRifa("");
    setFechaCierreRifa("");
    setPublicadaRifa(false);
    setDestacadaRifa(false);
    setPortadaFile(null);
    setPreviewPortada("");
    setPortadaScrollFile(null);
    setPreviewPortadaScroll("");
  };

  const crearRifa = async (e) => {
    e.preventDefault();

    if (!nombreRifa.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Campo requerido",
        text: "Debes ingresar un nombre para la rifa",
      });
      return;
    }

    try {
      setCreandoRifa(true);

      let portadaUrl = "";
      let portadaScrollUrl = "";

      if (portadaFile) portadaUrl = await subirImagenRifa(portadaFile);
      if (portadaScrollFile) portadaScrollUrl = await subirImagenRifa(portadaScrollFile);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/crear-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombreRifa.trim(),
          descripcion: descripcionRifa.trim(),
          premio: premioRifa.trim(),
          precio_ticket: precioTicketRifa,
          formato: formatoRifa,
          portada_url: portadaUrl,
          portada_scroll_url: portadaScrollUrl,
          fecha_sorteo: fechaSorteoRifa || null,
          hora_sorteo: horaSorteoRifa || null,
          fecha_cierre: fechaCierreRifa || null,
          publicada: publicadaRifa,
          destacada: destacadaRifa,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo crear la rifa",
        });
        return;
      }

      resetFormulario();

      await Swal.fire({
        icon: "success",
        title: "Rifa creada",
        text: "La rifa se creó correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo crear la rifa",
      });
    } finally {
      setCreandoRifa(false);
    }
  };

  const editarRifa = async (rifa) => {
    if (!rifa?.id) return;

    const nombre = escapeHtml(rifa.nombre || "");
    const descripcion = escapeHtml(rifa.descripcion || "");
    const premio = escapeHtml(rifa.premio || "");
    const precio = escapeHtml(rifa.precio_ticket ?? "");
    const formato = escapeHtml(rifa.formato || "4digitos");
    const fechaSorteo = escapeHtml(rifa.fecha_sorteo || "");
    const horaSorteo = escapeHtml(rifa.hora_sorteo || "");
    const fechaCierre = escapeHtml(rifa.fecha_cierre || "");
    const publicadaChecked = rifa.publicada ? "checked" : "";
    const destacadaChecked = rifa.destacada ? "checked" : "";

    const { value: formValues } = await Swal.fire({
      title: `Editar rifa: ${nombre || "Rifa"}`,
      width: 1080,
      padding: 0,
      background: "#10131a",
      color: "#f8fafc",
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      customClass: {
        popup: "swal-edit-rifa-popup",
        title: "swal-edit-rifa-title",
        htmlContainer: "swal-edit-rifa-html",
        confirmButton: "swal-edit-rifa-confirm",
        cancelButton: "swal-edit-rifa-cancel",
        actions: "swal-edit-rifa-actions",
      },
      didOpen: () => {
        document.getElementById("swal-nombre")?.focus();
      },
      html: `
        <div class="swal-edit-rifa-layout">
          <section class="swal-edit-rifa-panel">
            <div class="swal-edit-rifa-panel-head">
              <h3>Datos principales</h3>
              <span class="swal-edit-rifa-panel-badge">ID: ${escapeHtml(rifa.id)}</span>
            </div>

            <div class="swal-edit-rifa-field">
              <label>Nombre de la rifa</label>
              <input
                id="swal-nombre"
                class="swal-edit-rifa-input"
                type="text"
                value="${nombre}"
                placeholder="Ej: TRIAL DORADO"
              />
            </div>

            <div class="swal-edit-rifa-field">
              <label>Descripción</label>
              <textarea
                id="swal-descripcion"
                class="swal-edit-rifa-textarea"
                rows="5"
                placeholder="Describe la rifa..."
              >${descripcion}</textarea>
            </div>

            <div class="swal-edit-rifa-field">
              <label>Premio principal</label>
              <input
                id="swal-premio"
                class="swal-edit-rifa-input"
                type="text"
                value="${premio}"
                placeholder="Ej: Toyota Corolla 2025"
              />
            </div>

            <div class="swal-edit-rifa-switches">
              <label class="swal-edit-rifa-switch">
                <input id="swal-publicada" type="checkbox" ${publicadaChecked} />
                <span class="swal-edit-rifa-switch-track">
                  <span class="swal-edit-rifa-switch-thumb"></span>
                </span>
                <div>
                  <strong>Publicada</strong>
                  <p>Visible para los usuarios</p>
                </div>
              </label>

              <label class="swal-edit-rifa-switch">
                <input id="swal-destacada" type="checkbox" ${destacadaChecked} />
                <span class="swal-edit-rifa-switch-track">
                  <span class="swal-edit-rifa-switch-thumb"></span>
                </span>
                <div>
                  <strong>Destacada</strong>
                  <p>Aparece con prioridad</p>
                </div>
              </label>
            </div>
          </section>

          <aside class="swal-edit-rifa-sidebar">
            <section class="swal-edit-rifa-panel">
              <div class="swal-edit-rifa-panel-head">
                <h3>Configuración</h3>
                <span class="swal-edit-rifa-panel-badge dark">
                  ${rifa.formato === "3digitos" ? "3 dígitos" : "4 dígitos"}
                </span>
              </div>

              <div class="swal-edit-rifa-field">
                <label>Precio ticket</label>
                <input
                  id="swal-precio"
                  class="swal-edit-rifa-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value="${precio}"
                  placeholder="0.00"
                />
              </div>

              <div class="swal-edit-rifa-field">
                <label>Formato</label>
                <select id="swal-formato" class="swal-edit-rifa-input">
                  <option value="4digitos" ${formato === "4digitos" ? "selected" : ""}>0000 al 9999</option>
                  <option value="3digitos" ${formato === "3digitos" ? "selected" : ""}>000 al 999</option>
                </select>
              </div>

              <div class="swal-edit-rifa-field">
                <label>Fecha sorteo</label>
                <input
                  id="swal-fecha-sorteo"
                  class="swal-edit-rifa-input"
                  type="date"
                  value="${fechaSorteo}"
                />
              </div>

              <div class="swal-edit-rifa-field">
                <label>Hora sorteo</label>
                <input
                  id="swal-hora-sorteo"
                  class="swal-edit-rifa-input"
                  type="time"
                  value="${horaSorteo}"
                />
              </div>

              <div class="swal-edit-rifa-field">
                <label>Fecha cierre</label>
                <input
                  id="swal-fecha-cierre"
                  class="swal-edit-rifa-input"
                  type="date"
                  value="${fechaCierre}"
                />
              </div>
            </section>

            <section class="swal-edit-rifa-preview">
              <p class="swal-edit-rifa-preview-kicker">Vista rápida</p>
              <h4>${nombre || "Nombre de la rifa"}</h4>
              <p class="swal-edit-rifa-preview-text">
                ${descripcion || "Sin descripción todavía."}
              </p>

              <div class="swal-edit-rifa-preview-grid">
                <div>
                  <span>Premio</span>
                  <strong>${premio || "Sin premio"}</strong>
                </div>

                <div>
                  <span>Ticket</span>
                  <strong>$${Number(rifa.precio_ticket || 0).toFixed(2)}</strong>
                </div>

                <div>
                  <span>Formato</span>
                  <strong>${rifa.formato === "3digitos" ? "3 dígitos" : "4 dígitos"}</strong>
                </div>

                <div>
                  <span>Rango</span>
                  <strong>${rifa.formato === "3digitos" ? "000 al 999" : "0000 al 9999"}</strong>
                </div>
              </div>

              <div class="swal-edit-rifa-preview-badges">
                <span class="${rifa.publicada ? "active" : ""}">
                  ${rifa.publicada ? "Publicada" : "No publicada"}
                </span>
                <span class="${rifa.destacada ? "highlight" : ""}">
                  ${rifa.destacada ? "Destacada" : "Normal"}
                </span>
              </div>
            </section>
          </aside>
        </div>
      `,
      preConfirm: () => {
        const nombre = document.getElementById("swal-nombre")?.value?.trim();
        const descripcion = document.getElementById("swal-descripcion")?.value?.trim();
        const premio = document.getElementById("swal-premio")?.value?.trim();
        const precio_ticket = document.getElementById("swal-precio")?.value;
        const formato = document.getElementById("swal-formato")?.value;
        const fecha_sorteo = document.getElementById("swal-fecha-sorteo")?.value;
        const hora_sorteo = document.getElementById("swal-hora-sorteo")?.value;
        const fecha_cierre = document.getElementById("swal-fecha-cierre")?.value;
        const publicada = document.getElementById("swal-publicada")?.checked;
        const destacada = document.getElementById("swal-destacada")?.checked;

        if (!nombre) {
          Swal.showValidationMessage("El nombre es obligatorio");
          return false;
        }

        return {
          nombre,
          descripcion,
          premio,
          precio_ticket,
          formato,
          fecha_sorteo,
          hora_sorteo,
          fecha_cierre,
          publicada,
          destacada,
        };
      },
    });

    if (!formValues) return;

    try {
      setEditandoRifa(rifa.id);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/editar-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId: rifa.id,
          ...formValues,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo editar la rifa",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Rifa actualizada",
        text: "Los datos de la rifa fueron actualizados correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo editar la rifa",
      });
    } finally {
      setEditandoRifa(null);
    }
  };

  const cambiarPortadaPrincipalRifa = async (rifa) => {
    if (!rifa?.id) return;

    const { value: file } = await Swal.fire({
      title: `Cambiar portada principal de "${rifa.nombre}"`,
      input: "file",
      inputAttributes: {
        accept: "image/*",
        "aria-label": "Selecciona una imagen",
      },
      showCancelButton: true,
      confirmButtonText: "Subir portada principal",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7c3aed",
      cancelButtonColor: "#6b7280",
    });

    const fileSelected = file instanceof File ? file : file?.[0] || null;
    if (!fileSelected) return;

    try {
      Swal.fire({
        title: "Subiendo portada principal...",
        text: "Espera un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const portadaUrl = await subirImagenRifa(fileSelected);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/actualizar-portadas-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId: rifa.id,
          portada_url: portadaUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo actualizar la portada principal",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Portada principal actualizada",
        text: "La portada principal fue actualizada correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo actualizar la portada principal",
      });
    }
  };

  const cambiarPortadaScrollRifa = async (rifa) => {
    if (!rifa?.id) return;

    const { value: file } = await Swal.fire({
      title: `Cambiar portada scroll de "${rifa.nombre}"`,
      input: "file",
      inputAttributes: {
        accept: "image/*",
        "aria-label": "Selecciona una imagen",
      },
      showCancelButton: true,
      confirmButtonText: "Subir portada scroll",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7c3aed",
      cancelButtonColor: "#6b7280",
    });

    const fileSelected = file instanceof File ? file : file?.[0] || null;
    if (!fileSelected) return;

    try {
      Swal.fire({
        title: "Subiendo portada scroll...",
        text: "Espera un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const portadaScrollUrl = await subirImagenRifa(fileSelected);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/actualizar-portadas-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId: rifa.id,
          portada_scroll_url: portadaScrollUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo actualizar la portada scroll",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Portada scroll actualizada",
        text: "La portada scroll fue actualizada correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo actualizar la portada scroll",
      });
    }
  };

  const activarRifa = async (rifa) => {
    const confirmar = await Swal.fire({
      title: "¿Activar esta rifa?",
      text: `La rifa "${rifa.nombre}" pasará a estar activa`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, activar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setActivandoRifa(rifa.id);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/activar-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rifaId: rifa.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo activar la rifa",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Rifa activada",
        text: "La rifa fue activada correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo activar la rifa",
      });
    } finally {
      setActivandoRifa(null);
    }
  };

  const cerrarRifa = async (rifa) => {
    const confirmar = await Swal.fire({
      title: "¿Cerrar rifa?",
      text: `La rifa "${rifa.nombre}" dejará de aceptar compras`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d97706",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setCerrandoRifa(rifa.id);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/cerrar-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rifaId: rifa.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo cerrar la rifa",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Rifa cerrada",
        text: "La rifa fue cerrada correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cerrar la rifa",
      });
    } finally {
      setCerrandoRifa(null);
    }
  };

  const finalizarRifa = async (rifa) => {
    const padLength = rifa.formato === "3digitos" ? 3 : 4;
    const numeroInicio =
      rifa.numero_inicio !== undefined && rifa.numero_inicio !== null
        ? Number(rifa.numero_inicio)
        : 0;
    const numeroFin =
      rifa.numero_fin !== undefined && rifa.numero_fin !== null
        ? Number(rifa.numero_fin)
        : rifa.formato === "3digitos"
        ? 999
        : 9999;

    const { value: numeroGanador } = await Swal.fire({
      title: "Finalizar rifa",
      text: `Ingresa el número ganador para "${rifa.nombre}"`,
      input: "text",
      inputPlaceholder: padLength === 3 ? "000 - 999" : "0000 - 9999",
      showCancelButton: true,
      confirmButtonText: "Finalizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#6b7280",
      inputValidator: (value) => {
        if (!value) return "Debes ingresar un número ganador";

        const limpio = value.replace(/\D/g, "").slice(0, padLength);
        if (!limpio) return "Número inválido";

        const numero = Number(limpio);
        if (Number.isNaN(numero)) return "Número inválido";

        if (numero < numeroInicio || numero > numeroFin) {
          return `El número debe estar entre ${String(numeroInicio).padStart(
            padLength,
            "0"
          )} y ${String(numeroFin).padStart(padLength, "0")}`;
        }

        return null;
      },
    });

    if (!numeroGanador) return;

    try {
      setFinalizandoRifa(rifa.id);

      const limpio = numeroGanador.replace(/\D/g, "").slice(0, padLength);
      const numero = Number(limpio);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/finalizar-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId: rifa.id,
          numeroGanador: numero,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo finalizar la rifa",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Rifa finalizada",
        text: `Número ganador: ${String(data.numero_ganador).padStart(padLength, "0")}`,
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo finalizar la rifa",
      });
    } finally {
      setFinalizandoRifa(null);
    }
  };

  const eliminarRifa = async (rifa) => {
    const confirmar = await Swal.fire({
      title: "¿Eliminar rifa?",
      text: `Se intentará eliminar la rifa "${rifa.nombre}"`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#b91c1c",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setEliminandoRifa(rifa.id);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/eliminar-rifa", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rifaId: rifa.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "No se puede eliminar",
          text: data.error || "No se pudo eliminar la rifa",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Rifa eliminada",
        text: "La rifa fue eliminada correctamente",
      });

      if (onRecargarRifas) await onRecargarRifas();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar la rifa",
      });
    } finally {
      setEliminandoRifa(null);
    }
  };

  const summaryCardStyle = {
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    background:
      "linear-gradient(180deg, rgba(24, 24, 32, 0.94), rgba(16, 18, 24, 0.94))",
    padding: "16px 18px",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
    minHeight: "92px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const sectionCardStyle = {
    borderRadius: "28px",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    background:
      "linear-gradient(180deg, rgba(20, 22, 28, 0.96), rgba(14, 15, 20, 0.96))",
    boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
    padding: "22px",
  };

  const formGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
    marginTop: "18px",
  };

  const panelStyle = {
    borderRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    background: "rgba(255,255,255,0.02)",
    padding: "18px",
  };

  const inputStyle = {
    width: "100%",
    borderRadius: "18px",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    background: "rgba(255,255,255,0.03)",
    color: "#f8fafc",
    padding: "14px 16px",
    outline: "none",
    boxShadow: "none",
  };

  const uploadBoxStyle = {
    position: "relative",
    minHeight: "170px",
    borderRadius: "22px",
    border: "1px dashed rgba(148, 163, 184, 0.32)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "16px",
  };

  const uploadOverlayStyle = {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.36))",
    display: "flex",
    alignItems: "end",
    justifyContent: "start",
    padding: "14px",
  };

  const uploadPreviewStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    position: "absolute",
    inset: 0,
  };

  const miniInfoStyle = {
    borderRadius: "18px",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    background: "rgba(255,255,255,0.025)",
    padding: "12px 14px",
  };

  const actionButtonStyle = {
    width: "fit-content",
    minWidth: "160px",
  };

  return (
    <div
      className="adminpro-card"
      style={{
        ...sectionCardStyle,
        padding: "22px",
      }}
    >
      <div
        className="adminpro-section-head"
        style={{
          alignItems: "center",
          gap: "18px",
          marginBottom: "8px",
        }}
      >
        <div>
          <h2 style={{ marginBottom: "6px" }}>Gestión de Rifas</h2>
          <p style={{ color: "#94a3b8" }}>
            Crea, activa, edita, cierra, finaliza o elimina rifas.
          </p>
        </div>

        <button
          className="adminpro-primary-btn"
          onClick={onRecargarRifas}
          type="button"
        >
          <RefreshCcw size={16} />
          Actualizar datos
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginTop: "18px",
          marginBottom: "18px",
        }}
      >
        <div style={summaryCardStyle}>
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
            Total de rifas
          </span>
          <strong style={{ fontSize: "26px", color: "#f8fafc" }}>{resumenRifas.total}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
            Publicadas
          </span>
          <strong style={{ fontSize: "26px", color: "#86efac" }}>
            {resumenRifas.publicadas}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
            Activas
          </span>
          <strong style={{ fontSize: "26px", color: "#93c5fd" }}>{resumenRifas.activas}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
            Finalizadas
          </span>
          <strong style={{ fontSize: "26px", color: "#fbbf24" }}>
            {resumenRifas.finalizadas}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
            Destacadas
          </span>
          <strong style={{ fontSize: "26px", color: "#c084fc" }}>
            {resumenRifas.destacadas}
          </strong>
        </div>
      </div>

      <form
        className="adminpro-form-card"
        onSubmit={crearRifa}
        style={{
          ...panelStyle,
          padding: "22px",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "10px",
          }}
        >
          <div>
            <h3 style={{ marginBottom: "6px" }}>Crear nueva rifa</h3>
            <p style={{ color: "#94a3b8", margin: 0 }}>
              Completa la información base. Luego podrás editar portadas, estado y
              publicación.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 800,
                color: "#cbd5e1",
                border: "1px solid rgba(148, 163, 184, 0.14)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              Panel premium
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 800,
                color: "#86efac",
                border: "1px solid rgba(34, 197, 94, 0.18)",
                background: "rgba(34, 197, 94, 0.08)",
              }}
            >
              Live
            </span>
          </div>
        </div>

        <div style={formGridStyle}>
          <section style={panelStyle}>
            <div style={{ display: "grid", gap: "14px" }}>
              <input
                type="text"
                placeholder="Nombre de la rifa"
                value={nombreRifa}
                onChange={(e) => setNombreRifa(e.target.value)}
                className="adminpro-input"
                style={inputStyle}
              />

              <textarea
                placeholder="Descripción (opcional)"
                value={descripcionRifa}
                onChange={(e) => setDescripcionRifa(e.target.value)}
                className="adminpro-input"
                style={{
                  ...inputStyle,
                  minHeight: "130px",
                  resize: "vertical",
                  paddingTop: "14px",
                }}
              />

              <input
                type="text"
                placeholder="Premio principal"
                value={premioRifa}
                onChange={(e) => setPremioRifa(e.target.value)}
                className="adminpro-input"
                style={inputStyle}
              />

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio por ticket"
                value={precioTicketRifa}
                onChange={(e) => setPrecioTicketRifa(e.target.value)}
                className="adminpro-input"
                style={inputStyle}
              />
            </div>
          </section>

          <aside style={panelStyle}>
            <div style={{ display: "grid", gap: "14px" }}>
              <select
                value={formatoRifa}
                onChange={(e) => setFormatoRifa(e.target.value)}
                className="adminpro-input"
                style={inputStyle}
              >
                <option value="3digitos">000 al 999</option>
                <option value="4digitos">0000 al 9999</option>
              </select>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <input
                  type="date"
                  value={fechaSorteoRifa}
                  onChange={(e) => setFechaSorteoRifa(e.target.value)}
                  className="adminpro-input"
                  style={inputStyle}
                />

                <input
                  type="time"
                  value={horaSorteoRifa}
                  onChange={(e) => setHoraSorteoRifa(e.target.value)}
                  className="adminpro-input"
                  style={inputStyle}
                />

                <input
                  type="date"
                  value={fechaCierreRifa}
                  onChange={(e) => setFechaCierreRifa(e.target.value)}
                  className="adminpro-input"
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{
                    flex: "1 1 220px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    borderRadius: "18px",
                    padding: "14px 16px",
                    border: "1px solid rgba(148, 163, 184, 0.14)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#e2e8f0",
                    fontWeight: 800,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={publicadaRifa}
                    onChange={(e) => setPublicadaRifa(e.target.checked)}
                  />
                  <div>
                    <div>Publicada</div>
                    <small style={{ color: "#94a3b8" }}>Visible para usuarios</small>
                  </div>
                </label>

                <label
                  style={{
                    flex: "1 1 220px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    borderRadius: "18px",
                    padding: "14px 16px",
                    border: "1px solid rgba(148, 163, 184, 0.14)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#e2e8f0",
                    fontWeight: 800,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={destacadaRifa}
                    onChange={(e) => setDestacadaRifa(e.target.checked)}
                  />
                  <div>
                    <div>Destacada</div>
                    <small style={{ color: "#94a3b8" }}>Aparece con prioridad</small>
                  </div>
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "14px",
                }}
              >
                <label style={uploadBoxStyle}>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPortadaFile(file);
                      setPreviewPortada(URL.createObjectURL(file));
                    }}
                  />

                  {previewPortada ? (
                    <>
                      <img
                        src={previewPortada}
                        alt="Preview portada principal"
                        style={uploadPreviewStyle}
                      />
                      <div style={uploadOverlayStyle}>
                        <div>
                          <div style={{ fontWeight: 800, color: "#fff" }}>
                            Portada principal
                          </div>
                          <div style={{ color: "#cbd5e1", fontSize: "12px" }}>
                            Cambiar imagen
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ fontSize: "28px", marginBottom: "6px" }}>🖼️</div>
                      <div style={{ fontWeight: 800, color: "#f8fafc" }}>
                        Portada principal
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
                        Haz clic para subir una imagen
                      </div>
                    </div>
                  )}
                </label>

                <label style={uploadBoxStyle}>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPortadaScrollFile(file);
                      setPreviewPortadaScroll(URL.createObjectURL(file));
                    }}
                  />

                  {previewPortadaScroll ? (
                    <>
                      <img
                        src={previewPortadaScroll}
                        alt="Preview portada scroll"
                        style={uploadPreviewStyle}
                      />
                      <div style={uploadOverlayStyle}>
                        <div>
                          <div style={{ fontWeight: 800, color: "#fff" }}>
                            Portada scroll
                          </div>
                          <div style={{ color: "#cbd5e1", fontSize: "12px" }}>
                            Cambiar imagen
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ fontSize: "28px", marginBottom: "6px" }}>🧭</div>
                      <div style={{ fontWeight: 800, color: "#f8fafc" }}>
                        Portada scroll
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
                        Imagen secundaria para detalle
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </aside>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            marginTop: "18px",
          }}
        >
          <button
            type="submit"
            className="adminpro-primary-btn"
            disabled={creandoRifa}
            style={actionButtonStyle}
          >
            {creandoRifa ? "Creando..." : "Crear rifa"}
          </button>
        </div>
      </form>

      {rifasOrdenadas.length === 0 ? (
        <div
          className="adminpro-empty-box"
          style={{
            ...panelStyle,
            textAlign: "center",
            padding: "32px",
            color: "#94a3b8",
          }}
        >
          No hay rifas disponibles o siguen cargando.
        </div>
      ) : (
        <div
          className="adminpro-rifas-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "18px",
          }}
        >
          {rifasOrdenadas.map((rifa) => {
            const padLength = rifa.formato === "3digitos" ? 3 : 4;
            const numeroInicio =
              rifa.numero_inicio !== undefined && rifa.numero_inicio !== null
                ? Number(rifa.numero_inicio)
                : 0;
            const numeroFin =
              rifa.numero_fin !== undefined && rifa.numero_fin !== null
                ? Number(rifa.numero_fin)
                : rifa.formato === "3digitos"
                ? 999
                : 9999;

            const stats = rifa.stats || {
              compras: 0,
              ticketsVendidos: 0,
              disponibles: 0,
              porcentajeVendido: 0,
            };

            const estado = String(rifa.estado || "").toLowerCase();

            return (
              <article
                key={rifa.id}
                className="adminpro-rifa-card"
                style={{
                  ...panelStyle,
                  padding: "18px",
                  display: "grid",
                  gap: "16px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "14px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginBottom: "6px",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "20px", color: "#f8fafc" }}>
                        {rifa.nombre || "Sin nombre"}
                      </h3>

                      {rifa.destacada && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "#f5d0fe",
                            border: "1px solid rgba(192,132,252,0.22)",
                            background: "rgba(192,132,252,0.10)",
                          }}
                        >
                          ⭐ Destacada
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: "#94a3b8",
                        lineHeight: 1.6,
                      }}
                    >
                      {rifa.descripcion || "Sin descripción"}
                    </p>
                  </div>

                  <EstadoBadge estado={rifa.estado} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "16px",
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "22px",
                      border: "1px solid rgba(148, 163, 184, 0.12)",
                      overflow: "hidden",
                      minHeight: "220px",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
                    }}
                  >
                    {rifa.portada_url ? (
                      <img
                        src={rifa.portada_url}
                        alt={rifa.nombre}
                        style={{
                          width: "100%",
                          height: "100%",
                          minHeight: "220px",
                          maxHeight: "260px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          minHeight: "220px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                          textAlign: "center",
                          padding: "16px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "30px", marginBottom: "6px" }}>🖼️</div>
                          <div style={{ fontWeight: 700 }}>Sin portada principal</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: "14px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Premio</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {rifa.premio || "No definido"}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Precio ticket</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f87171" }}>
                          ${Number(rifa.precio_ticket || 0).toFixed(2)}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Formato</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {rifa.formato === "3digitos" ? "3 dígitos" : "4 dígitos"}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Rango</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {String(numeroInicio).padStart(padLength, "0")} al{" "}
                          {String(numeroFin).padStart(padLength, "0")}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Cantidad</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {rifa.cantidad_numeros ?? numeroFin - numeroInicio + 1}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Creada</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {formatFecha(rifa.created_at || rifa.fecha_creacion)}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Fecha sorteo</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {rifa.fecha_sorteo || "Sin fecha"}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Hora sorteo</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {rifa.hora_sorteo || "Sin hora"}
                        </strong>
                      </div>

                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Fecha cierre</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {rifa.fecha_cierre || "Sin fecha"}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "2px",
                      }}
                    >
                      <BoolBadge
                        value={Boolean(rifa.publicada)}
                        trueText="Publicada"
                        falseText="No publicada"
                      />
                      <BoolBadge
                        value={Boolean(rifa.destacada)}
                        trueText="Destacada"
                        falseText="No destacada"
                      />
                      <BoolBadge
                        value={["activa", "disponible", "publicada"].includes(estado)}
                        trueText="Disponible"
                        falseText="No disponible"
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "10px",
                      }}
                    >
                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Compras</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {stats.compras}
                        </strong>
                      </div>
                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Vendidos</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {stats.ticketsVendidos}
                        </strong>
                      </div>
                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Disponibles</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {stats.disponibles}
                        </strong>
                      </div>
                      <div style={miniInfoStyle}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Avance</span>
                        <strong style={{ display: "block", marginTop: "4px", color: "#f8fafc" }}>
                          {stats.porcentajeVendido}%
                        </strong>
                      </div>
                    </div>

                    <div
                      className="adminpro-progress small"
                      style={{
                        height: "10px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        className="adminpro-progress-fill"
                        style={{
                          width: `${Math.min(Number(stats.porcentajeVendido || 0), 100)}%`,
                          height: "100%",
                          background:
                            "linear-gradient(90deg, rgba(124,58,237,1) 0%, rgba(59,130,246,1) 100%)",
                          borderRadius: "999px",
                        }}
                      />
                    </div>

                    <div
                      className="adminpro-actions-wrap"
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "4px",
                      }}
                    >
                      <button
                        className="adminpro-soft-btn purple"
                        onClick={() => onSeleccionarRifa && onSeleccionarRifa(rifa.id)}
                        type="button"
                      >
                        Ver dashboard
                      </button>

                      <button
                        className="adminpro-soft-btn blue"
                        onClick={() => editarRifa(rifa)}
                        disabled={editandoRifa === rifa.id}
                        type="button"
                      >
                        {editandoRifa === rifa.id ? "Editando..." : "Editar"}
                      </button>

                      <button
                        className="adminpro-soft-btn dark"
                        onClick={() => cambiarPortadaPrincipalRifa(rifa)}
                        type="button"
                      >
                        Portada principal
                      </button>

                      <button
                        className="adminpro-soft-btn purple"
                        onClick={() => cambiarPortadaScrollRifa(rifa)}
                        type="button"
                      >
                        Portada scroll
                      </button>

                      {rifa.estado !== "activa" && rifa.estado !== "finalizada" && (
                        <button
                          className="adminpro-soft-btn blue"
                          onClick={() => activarRifa(rifa)}
                          disabled={activandoRifa === rifa.id}
                          type="button"
                        >
                          {activandoRifa === rifa.id ? "Activando..." : "Activar"}
                        </button>
                      )}

                      {rifa.estado === "activa" && (
                        <button
                          className="adminpro-soft-btn orange"
                          onClick={() => cerrarRifa(rifa)}
                          disabled={cerrandoRifa === rifa.id}
                          type="button"
                        >
                          {cerrandoRifa === rifa.id ? "Cerrando..." : "Cerrar"}
                        </button>
                      )}

                      {(rifa.estado === "activa" || rifa.estado === "cerrada") && (
                        <button
                          className="adminpro-soft-btn green"
                          onClick={() => finalizarRifa(rifa)}
                          disabled={finalizandoRifa === rifa.id}
                          type="button"
                        >
                          {finalizandoRifa === rifa.id ? "Finalizando..." : "Finalizar"}
                        </button>
                      )}

                      <button
                        className="adminpro-soft-btn red"
                        onClick={() => eliminarRifa(rifa)}
                        disabled={eliminandoRifa === rifa.id}
                        type="button"
                      >
                        {eliminandoRifa === rifa.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}