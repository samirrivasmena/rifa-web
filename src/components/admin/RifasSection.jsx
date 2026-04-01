"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { RefreshCcw } from "lucide-react";

import { getAdminAuthHeaders } from "../../lib/getAdminAuthHeaders";
import { supabase } from "../../lib/supabase";

function getEstadoBadgeStyle(estado) {
  switch (estado) {
    case "activa":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
      };
    case "cerrada":
      return {
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fdba74",
      };
    case "finalizada":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "1px solid #93c5fd",
      };
    default:
      return {
        background: "#e5e7eb",
        color: "#374151",
        border: "1px solid #d1d5db",
      };
  }
}

function EstadoBadge({ estado }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "800",
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        ...getEstadoBadgeStyle(estado),
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
        padding: "5px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "800",
        whiteSpace: "nowrap",
        background: value ? "#dcfce7" : "#e5e7eb",
        color: value ? "#166534" : "#374151",
        border: value ? "1px solid #86efac" : "1px solid #d1d5db",
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

  const rifasOrdenadas = useMemo(() => {
    return [...rifas].sort((a, b) => {
      const fechaA = new Date(a.created_at || a.fecha_creacion || 0).getTime();
      const fechaB = new Date(b.created_at || b.fecha_creacion || 0).getTime();
      return fechaB - fechaA;
    });
  }, [rifas]);

const subirImagenRifa = async (file) => {
  if (!file) return "";

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/subir-imagen-rifa", {
    method: "POST",
    headers: {
      Authorization: (await getAdminAuthHeaders()).Authorization || "",
    },
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "No se pudo subir la imagen");
  }

  return data.url || "";
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

      const res = await fetch("/api/crear-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

    const { value: formValues } = await Swal.fire({
      title: `Editar rifa: ${rifa.nombre}`,
      width: 800,
      html: `
        <div style="display:grid;gap:14px;text-align:left;">
          <input id="swal-nombre" class="swal2-input" placeholder="Nombre" value="${rifa.nombre || ""}">
          <textarea id="swal-descripcion" class="swal2-textarea" placeholder="Descripción">${rifa.descripcion || ""}</textarea>
          <input id="swal-premio" class="swal2-input" placeholder="Premio" value="${rifa.premio || ""}">
          <input id="swal-precio" class="swal2-input" type="number" step="0.01" min="0" placeholder="Precio ticket" value="${rifa.precio_ticket ?? ""}">
          <select id="swal-formato" class="swal2-select">
            <option value="3digitos" ${rifa.formato === "3digitos" ? "selected" : ""}>001 al 999</option>
            <option value="4digitos" ${rifa.formato === "4digitos" ? "selected" : ""}>0001 al 9999</option>
          </select>
          <input id="swal-fecha-sorteo" class="swal2-input" type="date" value="${rifa.fecha_sorteo || ""}">
          <input id="swal-hora-sorteo" class="swal2-input" type="time" value="${rifa.hora_sorteo || ""}">
          <input id="swal-fecha-cierre" class="swal2-input" type="date" value="${rifa.fecha_cierre || ""}">

          <label style="display:flex;align-items:center;gap:8px;color:#111;font-weight:700;">
            <input id="swal-publicada" type="checkbox" ${rifa.publicada ? "checked" : ""}>
            Publicada
          </label>

          <label style="display:flex;align-items:center;gap:8px;color:#111;font-weight:700;">
            <input id="swal-destacada" type="checkbox" ${rifa.destacada ? "checked" : ""}>
            Destacada
          </label>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
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

      const res = await fetch("/api/editar-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

    if (!file) return;

    try {
      Swal.fire({
        title: "Subiendo portada principal...",
        text: "Espera un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const portadaUrl = await subirImagenRifa(file);

      const res = await fetch("/api/actualizar-portadas-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

    if (!file) return;

    try {
      Swal.fire({
        title: "Subiendo portada scroll...",
        text: "Espera un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const portadaScrollUrl = await subirImagenRifa(file);

      const res = await fetch("/api/actualizar-portadas-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

      const res = await fetch("/api/activar-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

      const res = await fetch("/api/cerrar-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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
      inputPlaceholder: padLength === 3 ? "001 - 999" : "0001 - 9999",
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

      const res = await fetch("/api/finalizar-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

      const res = await fetch("/api/eliminar-rifa", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
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

  return (
    <div className="adminpro-card">
      <div className="adminpro-section-head">
        <div>
          <h2>Gestión de Rifas</h2>
          <p>Crea, activa, edita, cierra, finaliza o elimina rifas</p>
        </div>

        <button className="adminpro-primary-btn" onClick={onRecargarRifas} type="button">
          <RefreshCcw size={16} />
          Actualizar datos
        </button>
      </div>

      <form className="adminpro-form-card" onSubmit={crearRifa}>
        <h3>Crear nueva rifa</h3>

        <input
          type="text"
          placeholder="Nombre de la rifa"
          value={nombreRifa}
          onChange={(e) => setNombreRifa(e.target.value)}
          className="adminpro-input"
        />

        <textarea
          placeholder="Descripción (opcional)"
          value={descripcionRifa}
          onChange={(e) => setDescripcionRifa(e.target.value)}
          className="adminpro-input"
          style={{ minHeight: "100px", resize: "vertical", paddingTop: "12px" }}
        />

        <input
          type="text"
          placeholder="Premio principal"
          value={premioRifa}
          onChange={(e) => setPremioRifa(e.target.value)}
          className="adminpro-input"
        />

        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Precio por ticket"
          value={precioTicketRifa}
          onChange={(e) => setPrecioTicketRifa(e.target.value)}
          className="adminpro-input"
        />

        <select
          value={formatoRifa}
          onChange={(e) => setFormatoRifa(e.target.value)}
          className="adminpro-input"
        >
          <option value="3digitos">001 al 999</option>
          <option value="4digitos">0001 al 9999</option>
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <input
            type="date"
            value={fechaSorteoRifa}
            onChange={(e) => setFechaSorteoRifa(e.target.value)}
            className="adminpro-input"
          />

          <input
            type="time"
            value={horaSorteoRifa}
            onChange={(e) => setHoraSorteoRifa(e.target.value)}
            className="adminpro-input"
          />

          <input
            type="date"
            value={fechaCierreRifa}
            onChange={(e) => setFechaCierreRifa(e.target.value)}
            className="adminpro-input"
          />
        </div>

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#cbd5e1", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={publicadaRifa}
              onChange={(e) => setPublicadaRifa(e.target.checked)}
            />
            Publicada
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#cbd5e1", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={destacadaRifa}
              onChange={(e) => setDestacadaRifa(e.target.checked)}
            />
            Destacada
          </label>
        </div>

        <div style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontSize: "14px", fontWeight: 700, color: "#cbd5e1" }}>
              Portada principal
            </label>

            <input
              type="file"
              accept="image/*"
              className="adminpro-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPortadaFile(file);
                setPreviewPortada(URL.createObjectURL(file));
              }}
            />

            {previewPortada && (
              <img
                src={previewPortada}
                alt="Preview portada principal"
                style={{
                  width: "100%",
                  maxWidth: "280px",
                  borderRadius: "16px",
                  border: "1px solid rgba(148,163,184,0.25)",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontSize: "14px", fontWeight: 700, color: "#cbd5e1" }}>
              Portada scroll
            </label>

            <input
              type="file"
              accept="image/*"
              className="adminpro-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPortadaScrollFile(file);
                setPreviewPortadaScroll(URL.createObjectURL(file));
              }}
            />

            {previewPortadaScroll && (
              <img
                src={previewPortadaScroll}
                alt="Preview portada scroll"
                style={{
                  width: "100%",
                  maxWidth: "280px",
                  borderRadius: "16px",
                  border: "1px solid rgba(148,163,184,0.25)",
                }}
              />
            )}
          </div>
        </div>

        <button
          type="submit"
          className="adminpro-primary-btn"
          disabled={creandoRifa}
          style={{ width: "fit-content" }}
        >
          {creandoRifa ? "Creando..." : "Crear rifa"}
        </button>
      </form>

      {rifasOrdenadas.length === 0 ? (
        <div className="adminpro-empty-box">
          No hay rifas disponibles o siguen cargando.
        </div>
      ) : (
        <div className="adminpro-rifas-grid">
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

            return (
              <div key={rifa.id} className="adminpro-rifa-card">
                <div className="adminpro-rifa-top">
                  <div>
                    <h3>{rifa.nombre}</h3>
                    <p>{rifa.descripcion || "Sin descripción"}</p>
                  </div>
                  <EstadoBadge estado={rifa.estado} />
                </div>

                {rifa.portada_url && (
                  <img
                    src={rifa.portada_url}
                    alt={rifa.nombre}
                    style={{
                      width: "100%",
                      maxHeight: "220px",
                      objectFit: "cover",
                      borderRadius: "18px",
                      marginBottom: "16px",
                      border: "1px solid rgba(148,163,184,0.15)",
                    }}
                  />
                )}

                <div className="adminpro-rifa-body">
                  <p><strong>Premio:</strong> {rifa.premio || "No definido"}</p>
                  <p><strong>Precio ticket:</strong> ${Number(rifa.precio_ticket || 0).toFixed(2)}</p>
                  <p><strong>Formato:</strong> {rifa.formato}</p>
                  <p>
                    <strong>Rango:</strong>{" "}
                    {String(numeroInicio).padStart(padLength, "0")} al{" "}
                    {String(numeroFin).padStart(padLength, "0")}
                  </p>
                  <p>
                    <strong>Cantidad:</strong>{" "}
                    {rifa.cantidad_numeros ?? numeroFin - numeroInicio + 1}
                  </p>
                  <p><strong>Fecha sorteo:</strong> {rifa.fecha_sorteo || "Sin fecha"}</p>
                  <p><strong>Hora sorteo:</strong> {rifa.hora_sorteo || "Sin hora"}</p>
                  <p><strong>Fecha cierre:</strong> {rifa.fecha_cierre || "Sin fecha"}</p>
                  <p>
                    <strong>Creada:</strong>{" "}
                    {formatearFecha(rifa.created_at || rifa.fecha_creacion)}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                  <BoolBadge value={Boolean(rifa.publicada)} trueText="Publicada" falseText="No publicada" />
                  <BoolBadge value={Boolean(rifa.destacada)} trueText="Destacada" falseText="No destacada" />
                </div>

                <div className="adminpro-rifa-stats">
                  <div>
                    <span>Compras</span>
                    <strong>{stats.compras}</strong>
                  </div>
                  <div>
                    <span>Vendidos</span>
                    <strong>{stats.ticketsVendidos}</strong>
                  </div>
                  <div>
                    <span>Disponibles</span>
                    <strong>{stats.disponibles}</strong>
                  </div>
                  <div>
                    <span>Avance</span>
                    <strong>{stats.porcentajeVendido}%</strong>
                  </div>
                </div>

                <div className="adminpro-progress small">
                  <div
                    className="adminpro-progress-fill"
                    style={{ width: `${Math.min(Number(stats.porcentajeVendido || 0), 100)}%` }}
                  />
                </div>

                <div className="adminpro-actions-wrap">
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
            );
          })}
        </div>
      )}
    </div>
  );
}