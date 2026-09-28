"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";

const FORM_DEFAULT = {
  nombre: "",
  cupos_total: "25",
  estado: "pendiente",
  fecha_inicio: "",
};

const ESTADOS_CREAR = [
  { value: "borrador", label: "Borrador" },
  { value: "pendiente", label: "Pendiente" },
  { value: "programado", label: "Programado" },
  { value: "activo", label: "Activo" },
];

function normalizarEstado(estado) {
  return String(estado ?? "").trim().toLowerCase();
}

function estadoLabel(estado) {
  const value = normalizarEstado(estado);

  const labels = {
    borrador: "Borrador",
    programado: "Programado",
    pendiente: "Pendiente",
    activo: "Activo",
    pausado: "Pausado",
    agotado: "Agotado",
    cerrado: "Cerrado",
    archivado: "Archivado",
  };

  return labels[value] || estado || "Sin estado";
}

function formatoFechaSeguro(valor, formatearFecha) {
  if (!valor) return "Sin fecha";
  if (typeof formatearFecha === "function") return formatearFecha(valor);

  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? String(valor) : date.toLocaleString();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getEstadoMeta(estado) {
  const value = normalizarEstado(estado);

  if (value === "activo") {
    return {
      bg: "rgba(22,163,74,.14)",
      border: "rgba(22,163,74,.28)",
      text: "#86efac",
    };
  }

  if (value === "pausado") {
    return {
      bg: "rgba(245,158,11,.14)",
      border: "rgba(245,158,11,.28)",
      text: "#fde68a",
    };
  }

  if (value === "agotado") {
    return {
      bg: "rgba(220,38,38,.14)",
      border: "rgba(220,38,38,.28)",
      text: "#fecaca",
    };
  }

  if (value === "cerrado") {
    return {
      bg: "rgba(100,116,139,.18)",
      border: "rgba(100,116,139,.30)",
      text: "#cbd5e1",
    };
  }

  if (value === "archivado") {
    return {
      bg: "rgba(246, 159, 59, 0.16)",
      border: "rgba(246, 156, 59, 0.28)",
      text: "#fee2bf",
    };
  }

  return {
    bg: "rgba(245,158,11,.14)",
    border: "rgba(245,158,11,.28)",
    text: "#fde68a",
  };
}

function actionButtonStyle(variant = "dark") {
  const base = {
    border: "none",
    borderRadius: "12px",
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform .15s ease, opacity .15s ease, background .15s ease",
    color: "#fff",
    minHeight: "42px",
  };

  const variants = {
    dark: { background: "#334155" },
    primary: { background: "#dc2626" },
    success: { background: "#16a34a" },
    warning: { background: "#d97706" },
    danger: { background: "#b91c1c" },
    slate: { background: "#475569" },
  };

  return { ...base, ...(variants[variant] || variants.dark) };
}

function getAccionesPorEstado(drop) {
  const estado = normalizarEstado(drop?.estado);
  const participaciones = Number(drop?.participaciones_count || 0);

  // Un Drop puede eliminarse físicamente únicamente si nunca ha tenido
  // participaciones. El backend vuelve a validar esta condición antes
  // de realizar el DELETE.
  //
  // No permitimos eliminar directamente un Drop ACTIVO o PAUSADO:
  // primero debe cerrarse/archivarse para mantener un flujo administrativo
  // claro y evitar borrar accidentalmente un Drop operativo.
  const puedeEliminar =
    participaciones === 0 &&
    !["activo", "pausado", "archivado"].includes(estado);

  const accionEliminar = puedeEliminar
    ? [{ action: "eliminar", label: "Eliminar", variant: "danger" }]
    : [];

  const accionesComunes = [
    { action: "duplicar", label: "Duplicar", variant: "dark" },
    { action: "archivar", label: "Archivar", variant: "slate" },
  ];

  if (estado === "borrador") {
    return [
      { action: "editar", label: "Editar", variant: "dark" },
      { action: "activar", label: "Activar", variant: "success" },
      { action: "pausar", label: "Pausar", variant: "warning" },
      ...accionesComunes,
      ...accionEliminar,
    ];
  }

  if (estado === "programado" || estado === "pendiente") {
    return [
      { action: "editar", label: "Editar", variant: "dark" },
      { action: "activar", label: "Activar ahora", variant: "success" },
      { action: "pausar", label: "Pausar", variant: "warning" },
      ...accionesComunes,
      ...accionEliminar,
    ];
  }

  if (estado === "activo") {
    return [
      { action: "pausar", label: "Pausar", variant: "warning" },
      { action: "cerrar", label: "Cerrar", variant: "slate" },
      { action: "agotado", label: "Agotado", variant: "danger" },
      ...accionesComunes,
    ];
  }

  if (estado === "pausado") {
    return [
      { action: "activar", label: "Reactivar", variant: "success" },
      { action: "cerrar", label: "Cerrar", variant: "slate" },
      ...accionesComunes,
    ];
  }

  if (estado === "agotado") {
    return [
      { action: "cerrar", label: "Cerrar", variant: "slate" },
      ...accionesComunes,
      ...accionEliminar,
    ];
  }

  if (estado === "cerrado") {
    return [
      ...accionesComunes,
      ...accionEliminar,
    ];
  }

  if (estado === "archivado") {
    return [{ action: "duplicar", label: "Duplicar", variant: "dark" }];
  }

  return [
    { action: "editar", label: "Editar", variant: "dark" },
    { action: "activar", label: "Activar", variant: "success" },
    ...accionesComunes,
    ...accionEliminar,
  ];
}

function getResumenDesdeDrops(drops = []) {
  return drops.reduce(
    (acc, drop) => {
      const estado = normalizarEstado(drop.estado);

      acc.totalDrops += 1;
      acc.totalReservado += toNumber(drop.cupos_total, 0);
      acc.totalUsados += toNumber(drop.cupos_usados, 0);
      acc.totalDisponibles += toNumber(drop.cupos_disponibles, 0);
      acc.participaciones += toNumber(drop.participaciones_count, 0);

      if (estado === "borrador") acc.borradores += 1;
      if (estado === "programado") acc.programados += 1;
      if (estado === "pendiente") acc.pendientes += 1;
      if (estado === "activo") acc.activos += 1;
      if (estado === "pausado") acc.pausados += 1;
      if (estado === "agotado") acc.agotados += 1;
      if (estado === "cerrado") acc.cerrados += 1;
      if (estado === "archivado") acc.archivados += 1;

      return acc;
    },
    {
      totalDrops: 0,
      totalReservado: 0,
      totalUsados: 0,
      totalDisponibles: 0,
      participaciones: 0,
      borradores: 0,
      programados: 0,
      pendientes: 0,
      activos: 0,
      pausados: 0,
      agotados: 0,
      cerrados: 0,
      archivados: 0,
    }
  );
}

export default function AdminFreeDropsSection({
  rifaSeleccionada,
  recargarTodo,
  formatearFecha,
}) {
  const rifaId = rifaSeleccionada?.id || null;

  const [drops, setDrops] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creando, setCreando] = useState(false);
  const [accionandoId, setAccionandoId] = useState(null);
  const [accionGlobal, setAccionGlobal] = useState(false);
  const [error, setError] = useState("");
  const [nombreTouched, setNombreTouched] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULT);

  const [modalEdicionOpen, setModalEdicionOpen] = useState(false);
  const [dropEditando, setDropEditando] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCupos, setEditCupos] = useState("25");

  const siguienteNumero = useMemo(() => {
    const maximo = drops.reduce((acc, drop) => {
      return Math.max(acc, Number(drop.numero_drop || 0));
    }, 0);

    return maximo + 1;
  }, [drops]);

  const siguientePendiente = useMemo(() => {
    return (
      drops
        .filter((d) =>
          ["borrador", "programado", "pendiente"].includes(
            normalizarEstado(d.estado)
          )
        )
        .sort((a, b) => Number(a.numero_drop || 0) - Number(b.numero_drop || 0))[0] ||
      null
    );
  }, [drops]);

  useEffect(() => {
    if (!rifaId) return;

    setForm((prev) => {
      if (nombreTouched && String(prev.nombre || "").trim()) return prev;

      return {
        ...prev,
        nombre: `FREE DROP #${siguienteNumero}`,
      };
    });
  }, [rifaId, siguienteNumero, nombreTouched]);

  const cargarDrops = useCallback(async () => {
    if (!rifaId) {
      setDrops([]);
      setSummary(null);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const headers = await getAdminAuthHeaders();

      const res = await fetch(
        `/api/admin-free-drops?rifaId=${encodeURIComponent(rifaId)}`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar los free drops");
      }

      setDrops(Array.isArray(data.drops) ? data.drops : []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando free drops");
    } finally {
      setLoading(false);
    }
  }, [rifaId]);

  useEffect(() => {
    cargarDrops();
  }, [cargarDrops]);

  const resumen = useMemo(() => {
    return summary || getResumenDesdeDrops(drops);
  }, [summary, drops]);

  const abrirEdicion = (drop) => {
    setDropEditando(drop);
    setEditNombre(drop?.nombre || `FREE DROP #${drop?.numero_drop || ""}`);
    setEditCupos(String(drop?.cupos_total || 25));
    setModalEdicionOpen(true);
  };

  const cerrarEdicion = () => {
    setModalEdicionOpen(false);
    setDropEditando(null);
    setEditNombre("");
    setEditCupos("25");
  };

  const guardarEdicion = async () => {
    if (!dropEditando?.id) return;

    const cuposTotal = Number(editCupos || 0);
    const nombreFinal = String(editNombre || "").trim();

    if (!cuposTotal || cuposTotal < 1) {
      await Swal.fire({
        icon: "warning",
        title: "Cupos inválidos",
        text: "Debes colocar una cantidad mayor a 0.",
      });
      return;
    }

    try {
      setAccionandoId(dropEditando.id);

      const confirmacion = await Swal.fire({
        icon: "question",
        title: "¿Guardar cambios?",
        text: "Se actualizará el nombre y los cupos del free drop.",
        showCancelButton: true,
        confirmButtonText: "Sí, guardar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#16a34a",
        cancelButtonColor: "#6b7280",
      });

      if (!confirmacion.isConfirmed) return;

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/admin-free-drops", {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId,
          dropId: dropEditando.id,
          action: "editar",
          nombre: nombreFinal,
          cuposTotal,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudo editar el free drop");
      }

      await Swal.fire({
        icon: "success",
        title: "Guardado",
        text: data.message || "Free drop actualizado correctamente",
      });

      cerrarEdicion();
      await cargarDrops();

      if (typeof recargarTodo === "function") {
        await recargarTodo();
      }
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo editar el free drop",
      });
    } finally {
      setAccionandoId(null);
    }
  };

  const ejecutarAccion = async (dropId, action, extraBody = {}) => {
    const info = {
      activar: {
        title: "¿Activar free drop?",
        text: "El drop quedará activo inmediatamente.",
        confirmButtonText: "Sí, activar",
        confirmButtonColor: "#16a34a",
      },
      agotado: {
        title: "¿Marcar como agotado?",
        text: "El free drop quedará marcado como agotado.",
        confirmButtonText: "Sí, marcar agotado",
        confirmButtonColor: "#dc2626",
      },
      cerrar: {
        title: "¿Cerrar free drop?",
        text: "El free drop quedará cerrado manualmente.",
        confirmButtonText: "Sí, cerrar",
        confirmButtonColor: "#64748b",
      },
      pendiente: {
        title: "¿Pasar a pendiente?",
        text: "El free drop quedará listo para activarse más adelante.",
        confirmButtonText: "Sí, poner en pendiente",
        confirmButtonColor: "#f59e0b",
      },
      pausar: {
        title: "¿Pausar free drop?",
        text: "El free drop quedará temporalmente pausado.",
        confirmButtonText: "Sí, pausar",
        confirmButtonColor: "#d97706",
      },
      archivar: {
        title: "¿Archivar free drop?",
        text: "El free drop se conservará para historial.",
        confirmButtonText: "Sí, archivar",
        confirmButtonColor: "#2563eb",
      },
      eliminar: {
        title: "¿Eliminar free drop?",
        text: "Solo se puede eliminar si no tiene participantes.",
        confirmButtonText: "Sí, eliminar",
        confirmButtonColor: "#dc2626",
      },
      duplicar: {
        title: "¿Duplicar free drop?",
        text: "Se creará una copia del free drop en estado borrador.",
        confirmButtonText: "Sí, duplicar",
        confirmButtonColor: "#16a34a",
      },
    }[action];

    if (!info) return;

    const confirmacion = await Swal.fire({
      icon: "question",
      title: info.title,
      text: info.text,
      showCancelButton: true,
      confirmButtonText: info.confirmButtonText,
      cancelButtonText: "Cancelar",
      confirmButtonColor: info.confirmButtonColor,
      cancelButtonColor: "#6b7280",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setAccionandoId(dropId);

      const headers = await getAdminAuthHeaders();

const esEliminar = action === "eliminar";

const endpoint = esEliminar
  ? `/api/admin-free-drops?rifaId=${encodeURIComponent(
      rifaId
    )}&dropId=${encodeURIComponent(dropId)}`
  : "/api/admin-free-drops";

const res = await fetch(endpoint, {
  method: esEliminar ? "DELETE" : "PATCH",
  headers: {
    ...headers,
    "Content-Type": "application/json",
  },
  ...(esEliminar
    ? {}
    : {
        body: JSON.stringify({
          rifaId,
          dropId,
          action,
          ...extraBody,
        }),
      }),
});

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el free drop");
      }

      await Swal.fire({
        icon: "success",
        title: "Listo",
        text: data.message || "El free drop fue actualizado correctamente.",
      });

      await cargarDrops();

      if (typeof recargarTodo === "function") {
        await recargarTodo();
      }
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo actualizar el free drop",
      });
    } finally {
      setAccionandoId(null);
    }
  };

  const activarSiguienteDrop = async () => {
    if (!rifaId) return;

    if (!siguientePendiente) {
      await Swal.fire({
        icon: "info",
        title: "Sin drops pendientes",
        text: "No hay un siguiente drop pendiente para activar.",
      });
      return;
    }

    const confirmacion = await Swal.fire({
      icon: "question",
      title: "¿Activar el siguiente drop?",
      text: `Se activará ${
        siguientePendiente.nombre ||
        `FREE DROP #${siguientePendiente.numero_drop}`
      }.`,
      showCancelButton: true,
      confirmButtonText: "Sí, activar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setAccionGlobal(true);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/admin-free-drops", {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId,
          action: "activar_siguiente",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudo activar el siguiente drop");
      }

      await Swal.fire({
        icon: "success",
        title: "Listo",
        text: data.message || "Siguiente free drop activado correctamente.",
      });

      await cargarDrops();

      if (typeof recargarTodo === "function") {
        await recargarTodo();
      }
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo activar el siguiente drop",
      });
    } finally {
      setAccionGlobal(false);
    }
  };

  const crearDrop = async (e) => {
    e.preventDefault();

    if (!rifaId) {
      await Swal.fire({
        icon: "warning",
        title: "Selecciona una rifa",
        text: "Debes seleccionar una rifa antes de crear free drops.",
      });
      return;
    }

    const cuposTotal = Number(form.cupos_total || 0);

    if (!cuposTotal || cuposTotal < 1) {
      await Swal.fire({
        icon: "warning",
        title: "Cupos inválidos",
        text: "Debes colocar una cantidad mayor a 0.",
      });
      return;
    }

    try {
      setCreando(true);

      const headers = await getAdminAuthHeaders();

      const nombreFinal =
        String(form.nombre || "").trim() || `FREE DROP #${siguienteNumero}`;

      const res = await fetch("/api/admin-free-drops", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rifaId,
          nombre: nombreFinal,
          cuposTotal,
          estado: form.estado,
          fechaInicio:
            form.estado === "programado" && form.fecha_inicio
              ? new Date(form.fecha_inicio).toISOString()
              : null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.raw || "No se pudo crear el free drop");
      }

      await Swal.fire({
        icon: "success",
        title: "Free drop creado",
        text: data.message || "El free drop fue creado correctamente.",
      });

      setForm(FORM_DEFAULT);
      setNombreTouched(false);

      await cargarDrops();

      if (typeof recargarTodo === "function") {
        await recargarTodo();
      }
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo crear el free drop",
      });
    } finally {
      setCreando(false);
    }
  };

  if (!rifaId) {
    return (
      <section
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: "18px",
          padding: "24px",
          color: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,.20)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "22px" }}>Free Drops</h2>
        <p style={{ marginTop: "10px", opacity: 0.8 }}>
          Selecciona una rifa para gestionar los drops gratis.
        </p>
      </section>
    );
  }

  const cardStyle = {
    background: "rgba(17,24,39,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,.18)",
  };

  const inputStyle = {
    width: "100%",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(3,7,18,.92)",
    color: "#fff",
    padding: "0 12px",
    outline: "none",
  };

  const selectStyle = {
    width: "100%",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(3,7,18,.92)",
    color: "#fff",
    padding: "0 12px",
    outline: "none",
  };

  const textareaStyle = {
    width: "100%",
    minHeight: "100px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(3,7,18,.92)",
    color: "#fff",
    padding: "12px",
    outline: "none",
    resize: "vertical",
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

  const nextMetaDrop = siguientePendiente;

  return (
    <section
      style={{
        marginTop: "18px",
        background:
          "linear-gradient(180deg, rgba(15,23,42,.97), rgba(15,23,42,.92))",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "20px",
        padding: "18px",
        color: "#fff",
      }}
    >
      <div
        className="adminpro-section-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Free Drops</h2>
          <p style={{ marginTop: "8px", opacity: 0.75 }}>
            Administra los cupos gratis del evento{" "}
            <strong>{rifaSeleccionada?.nombre || "seleccionado"}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={cargarDrops}
            disabled={loading}
          >
            {loading ? "Recargando..." : "Recargar"}
          </button>

          <button
            type="button"
            className="adminpro-red-btn"
            onClick={activarSiguienteDrop}
            disabled={accionGlobal || loading || creando || !siguientePendiente}
          >
            {accionGlobal
              ? "Activando..."
              : siguientePendiente
              ? `Activar siguiente (#${siguientePendiente.numero_drop})`
              : "No hay siguiente drop"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        {[
          { label: "Drops totales", value: resumen.totalDrops },
          { label: "Reservados", value: resumen.totalReservado },
          { label: "Usados", value: resumen.totalUsados },
          { label: "Disponibles", value: resumen.totalDisponibles },
          { label: "Participaciones", value: resumen.participaciones },
          { label: "Borradores", value: resumen.borradores },
          { label: "Programados", value: resumen.programados },
          { label: "Pendientes", value: resumen.pendientes },
          { label: "Activos", value: resumen.activos },
          { label: "Pausados", value: resumen.pausados },
          { label: "Agotados", value: resumen.agotados },
          { label: "Cerrados", value: resumen.cerrados },
          { label: "Archivados", value: resumen.archivados },
        ].map((item) => (
          <div key={item.label} style={summaryCardStyle}>
            <span style={{ fontSize: "12px", opacity: 0.7 }}>{item.label}</span>
            <strong style={{ fontSize: "20px", lineHeight: 1.2 }}>
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Crear nuevo free drop</h3>

          <form onSubmit={crearDrop} style={{ display: "grid", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={labelStyle}>Nombre del drop</span>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => {
                  setNombreTouched(true);
                  setForm((prev) => ({ ...prev, nombre: e.target.value }));
                }}
                placeholder={`FREE DROP #${siguienteNumero}`}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={labelStyle}>Cupos gratis</span>
              <input
                type="number"
                min="1"
                value={form.cupos_total}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cupos_total: e.target.value }))
                }
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={labelStyle}>Estado inicial</span>
              <select
                value={form.estado}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, estado: e.target.value }))
                }
                style={selectStyle}
              >
                {ESTADOS_CREAR.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </label>

            {form.estado === "programado" && (
              <label style={{ display: "grid", gap: "6px" }}>
                <span style={labelStyle}>Fecha y hora de activación</span>
                <input
                  type="datetime-local"
                  value={form.fecha_inicio}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fecha_inicio: e.target.value }))
                  }
                  style={inputStyle}
                  required
                />
                <small style={{ opacity: 0.72, lineHeight: 1.5 }}>
                  Se usará la fecha y hora local de este dispositivo.
                </small>
              </label>
            )}

            <small style={{ opacity: 0.72, lineHeight: 1.5 }}>
              Si el nombre queda vacío se generará automáticamente. El backend
              validará que no superes el total reservado del evento.
            </small>

            <button
              type="submit"
              className="adminpro-red-btn"
              disabled={creando}
            >
              {creando ? "Creando..." : "SOLTAR DROP"}
            </button>
          </form>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Próximo drop listo</h3>

          {nextMetaDrop ? (
            <>
              <div style={{ marginBottom: "10px" }}>
                <strong style={{ fontSize: "18px" }}>
                  {nextMetaDrop.nombre ||
                    `FREE DROP #${nextMetaDrop.numero_drop}`}
                </strong>
                <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
                  Drop #{nextMetaDrop.numero_drop} • Creado{" "}
                  {formatoFechaSeguro(nextMetaDrop.created_at, formatearFecha)}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={cardStyle}>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    Cupos total
                  </div>
                  <strong style={{ fontSize: "18px" }}>
                    {nextMetaDrop.cupos_total || 0}
                  </strong>
                </div>

                <div style={cardStyle}>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    Cupos usados
                  </div>
                  <strong style={{ fontSize: "18px" }}>
                    {nextMetaDrop.cupos_usados || 0}
                  </strong>
                </div>

                <div style={cardStyle}>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    Disponibles
                  </div>
                  <strong style={{ fontSize: "18px" }}>
                    {nextMetaDrop.cupos_disponibles || 0}
                  </strong>
                </div>

                <div style={cardStyle}>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    Participaciones
                  </div>
                  <strong style={{ fontSize: "18px" }}>
                    {nextMetaDrop.participaciones_count || 0}
                  </strong>
                </div>
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
                  className="adminpro-red-btn"
                  onClick={activarSiguienteDrop}
                  disabled={accionGlobal || loading || creando}
                >
                  ACTIVAR SIGUIENTE DROP
                </button>

                <button
                  type="button"
                  className="adminpro-soft-btn dark"
                  onClick={() => abrirEdicion(nextMetaDrop)}
                  disabled={accionGlobal || loading || creando}
                >
                  Editar siguiente
                </button>
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
              No hay drops pendientes, programados o borrador.
              <br />
              Crea un nuevo drop para dejarlo listo.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "14px",
            background: "rgba(220,38,38,.12)",
            border: "1px solid rgba(220,38,38,.3)",
            color: "#fecaca",
            borderRadius: "12px",
            padding: "12px 14px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: "14px" }}>
        {drops.length === 0 && !loading ? (
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Aún no hay drops creados</h3>
            <p style={{ marginBottom: 0, opacity: 0.8 }}>
              Crea el primer Free Drop para comenzar a liberar participaciones
              gratis.
            </p>
          </div>
        ) : (
          drops.map((drop) => {
            const estado = normalizarEstado(drop.estado);
            const acciones = getAccionesPorEstado(drop);

            const total = Number(drop.cupos_total || 0);
            const usados = Number(drop.cupos_usados || 0);
            const disponibles = Number(drop.cupos_disponibles || 0);
            const porcentaje =
              total > 0
                ? Math.min((usados / total) * 100, 100).toFixed(1)
                : "0.0";
            const meta = getEstadoMeta(estado);

            return (
              <article key={drop.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px" }}>
                      {drop.nombre || `FREE DROP #${drop.numero_drop}`}
                    </h3>

                    <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
                      Drop #{drop.numero_drop} • Creado{" "}
                      {formatoFechaSeguro(drop.created_at, formatearFecha)}
                    </p>

                    {estado === "programado" && drop.fecha_inicio && (
                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#bfdbfe",
                          fontWeight: 700,
                        }}
                      >
                        Activación programada: {" "}
                        {formatoFechaSeguro(drop.fecha_inicio, formatearFecha)}
                      </p>
                    )}
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      padding: "7px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: meta.bg,
                      border: `1px solid ${meta.border}`,
                      color: meta.text,
                    }}
                  >
                    {estadoLabel(drop.estado)}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div style={cardStyle}>
                    <span style={{ fontSize: "12px", opacity: 0.7 }}>
                      Cupos total
                    </span>
                    <strong style={{ display: "block", marginTop: "6px" }}>
                      {total}
                    </strong>
                  </div>

                  <div style={cardStyle}>
                    <span style={{ fontSize: "12px", opacity: 0.7 }}>
                      Cupos usados
                    </span>
                    <strong style={{ display: "block", marginTop: "6px" }}>
                      {usados}
                    </strong>
                  </div>

                  <div style={cardStyle}>
                    <span style={{ fontSize: "12px", opacity: 0.7 }}>
                      Disponibles
                    </span>
                    <strong style={{ display: "block", marginTop: "6px" }}>
                      {disponibles}
                    </strong>
                  </div>

                  <div style={cardStyle}>
                    <span style={{ fontSize: "12px", opacity: 0.7 }}>
                      Participaciones
                    </span>
                    <strong style={{ display: "block", marginTop: "6px" }}>
                      {drop.participaciones_count || 0}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    height: "10px",
                    background: "rgba(255,255,255,.08)",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${porcentaje}%`,
                      height: "100%",
                      background:
                        estado === "activo"
                          ? "linear-gradient(90deg, #16a34a, #22c55e)"
                          : estado === "agotado"
                          ? "linear-gradient(90deg, #dc2626, #ef4444)"
                          : estado === "cerrado"
                          ? "linear-gradient(90deg, #64748b, #94a3b8)"
                          : estado === "archivado"
                          ? "linear-gradient(90deg, #2563eb, #60a5fa)"
                          : "linear-gradient(90deg, #f59e0b, #fbbf24)",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginTop: "14px",
                  }}
                >
                  {acciones.map((accion) => (
                    <button
                      key={accion.action}
                      type="button"
                      style={actionButtonStyle(accion.variant)}
                      onClick={() => {
                        if (accion.action === "editar") {
                          abrirEdicion(drop);
                          return;
                        }

                        if (accion.action === "duplicar") {
                          ejecutarAccion(drop.id, accion.action, {
                            sourceDropId: drop.id,
                          });
                          return;
                        }

                        ejecutarAccion(drop.id, accion.action);
                      }}
                      disabled={
                        accionandoId === drop.id ||
                        accionGlobal ||
                        loading ||
                        creando
                      }
                    >
                      {accion.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>

      {modalEdicionOpen && dropEditando && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
          }}
          onClick={cerrarEdicion}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: "20px",
              padding: "18px",
              boxShadow: "0 20px 60px rgba(0,0,0,.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Editar free drop</h2>
                <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
                  Solo puedes editar drops sin participantes.
                </p>
              </div>

              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={cerrarEdicion}
              >
                Cerrar
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              <label style={{ display: "grid", gap: "6px" }}>
                <span style={labelStyle}>Nombre del drop</span>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: "6px" }}>
                <span style={labelStyle}>Cupos gratis</span>
                <input
                  type="number"
                  min="1"
                  value={editCupos}
                  onChange={(e) => setEditCupos(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "16px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={cerrarEdicion}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="adminpro-red-btn"
                onClick={guardarEdicion}
                disabled={accionandoId === dropEditando.id}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}