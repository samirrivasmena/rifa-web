"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import { getAdminAuthHeaders } from "@/lib/getAdminAuthHeaders";

function normalizarEstado(estado) {
  return String(estado ?? "").trim().toLowerCase();
}

function estadoLabel(estado) {
  const value = normalizarEstado(estado);

  const labels = {
    valida: "Válida",
    válido: "Válida",
    valido: "Válida",
    activo: "Válida",
    activa: "Válida",
    approved: "Válida",
    aprobado: "Válida",
    aprobada: "Válida",
    pendiente: "Pendiente",
    reserved: "Reservada",
    reservado: "Reservada",
    rechazada: "Rechazada",
    rechazado: "Rechazada",
    rejected: "Rechazada",
    anulada: "Anulada",
    anulado: "Anulada",
    cancelada: "Anulada",
    cancelado: "Anulada",
  };

  return labels[value] || estado || "Sin estado";
}

function getEstadoMeta(estado) {
  const value = normalizarEstado(estado);

  if (["valida", "activo", "activa", "approved", "aprobado", "aprobada"].includes(value)) {
    return {
      bg: "rgba(22,163,74,.14)",
      border: "rgba(22,163,74,.28)",
      text: "#86efac",
    };
  }

  if (["pendiente", "pending", "reservado", "reserved"].includes(value)) {
    return {
      bg: "rgba(245,158,11,.14)",
      border: "rgba(245,158,11,.28)",
      text: "#fde68a",
    };
  }

  if (["rechazada", "rechazado", "rejected"].includes(value)) {
    return {
      bg: "rgba(220,38,38,.14)",
      border: "rgba(220,38,38,.28)",
      text: "#fecaca",
    };
  }

  if (["anulada", "anulado", "cancelada", "cancelado"].includes(value)) {
    return {
      bg: "rgba(100,116,139,.18)",
      border: "rgba(100,116,139,.30)",
      text: "#cbd5e1",
    };
  }

  return {
    bg: "rgba(59,130,246,.14)",
    border: "rgba(59,130,246,.28)",
    text: "#bfdbfe",
  };
}

function formatearFechaSeguro(valor, formatearFecha) {
  if (!valor) return "Sin fecha";
  if (typeof formatearFecha === "function") return formatearFecha(valor);

  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? String(valor) : date.toLocaleString();
}

function escaparCSV(valor) {
  const texto = String(valor ?? "");
  return `"${texto.replaceAll('"', '""')}"`;
}

function getFullName(item) {
  const nombre = String(item?.nombre || "").trim();
  const apellido = String(item?.apellido || "").trim();

  if (item?.nombreCompleto) return String(item.nombreCompleto).trim();
  return `${nombre} ${apellido}`.trim();
}

function getTicketNumber(item, padLength) {
  const ticket = item?.tickets;
  const numero =
    item?.numeroTicket ??
    ticket?.numero_ticket ??
    ticket?.numero_ticket?.toString?.();

  if (numero === null || numero === undefined || numero === "") return "Sin número";

  const n = String(numero).replace(/\D/g, "");
  if (!n) return "Sin número";

  return `#${String(Number(n)).padStart(padLength, "0")}`;
}

function getDropLabel(item) {
  return (
    item?.freeDropLabel ||
    item?.free_drops?.nombre ||
    `FREE DROP #${item?.free_drops?.numero_drop || ""}`.trim()
  );
}

function getRiskScore(item) {
  const score = Number(item?.risk_score ?? 0);
  return Number.isFinite(score) ? Math.max(0, score) : 0;
}

function getRiskReasons(item) {
  const reasons = item?.risk_reasons;
  return Array.isArray(reasons) ? reasons.filter(Boolean) : [];
}

function getReviewSourceLabel(source) {
  const value = String(source ?? "").trim().toLowerCase();

  if (value === "risk_engine") return "Motor antifraude";
  if (value === "manual_global") return "Revisión manual global";
  if (!value) return "Automática";
  return String(source);
}

function getRiskMeta(item) {
  const score = getRiskScore(item);
  const reasons = getRiskReasons(item);
  const source = String(item?.review_source ?? "").trim().toLowerCase();
  const requiresReview = item?.requires_manual_review === true;
  const hasRisk = score > 0 || reasons.length > 0 || source === "risk_engine";
  const manualGlobal = source === "manual_global";

  if (hasRisk) {
    return {
      show: true,
      score,
      reasons,
      requiresReview,
      source,
      label: requiresReview ? `⚠ Antifraude · Riesgo ${score}` : `Antifraude · Riesgo ${score}`,
      bg: requiresReview ? "rgba(220,38,38,.15)" : "rgba(245,158,11,.12)",
      border: requiresReview ? "rgba(248,113,113,.38)" : "rgba(245,158,11,.28)",
      text: requiresReview ? "#fecaca" : "#fde68a",
    };
  }

  if (manualGlobal) {
    return {
      show: true,
      score,
      reasons,
      requiresReview,
      source,
      label: requiresReview ? "Sin Revisión🔎 " : "Revisión Manual ✅",
      bg: "rgba(59,130,246,.12)",
      border: "rgba(96,165,250,.28)",
      text: "#bfdbfe",
    };
  }

  return {
    show: false,
    score,
    reasons,
    requiresReview,
    source,
    label: "Sin señales de riesgo",
    bg: "rgba(22,163,74,.10)",
    border: "rgba(22,163,74,.24)",
    text: "#86efac",
  };
}

function getRiskReasonsText(item) {
  const reasons = getRiskReasons(item);
  if (!reasons.length) return "";

  return reasons
    .map((reason) => {
      if (typeof reason === "string") return reason;
      const code = String(reason?.code || "SEÑAL").trim();
      const score = Number(reason?.score ?? 0);
      const description = String(reason?.description || "").trim();
      return `${code}${Number.isFinite(score) && score ? ` (+${score})` : ""}${description ? `: ${description}` : ""}`;
    })
    .join(" | ");
}

function getAcciones(estado) {
  const value = normalizarEstado(estado);

  if (["pendiente", "reserved", "reservado"].includes(value)) {
    return [
      { action: "aprobar", label: "Aprobar", variant: "success" },
      { action: "rechazar", label: "Rechazar", variant: "danger" },
      { action: "anular", label: "Anular", variant: "dark" },
    ];
  }

  if (["valida", "activo", "activa", "approved", "aprobado", "aprobada"].includes(value)) {
    return [{ action: "anular", label: "Anular", variant: "dark" }];
  }

  return [];
}

function buttonStyle(variant = "dark") {
  const base = {
    border: "none",
    borderRadius: "12px",
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform .15s ease, opacity .15s ease",
    color: "#fff",
    minHeight: "42px",
  };

  const variants = {
    dark: { background: "#334155" },
    success: { background: "#16a34a" },
    danger: { background: "#dc2626" },
    warning: { background: "#d97706" },
    primary: { background: "#2563eb" },
  };

  return { ...base, ...(variants[variant] || variants.dark) };
}

export default function AdminFreeDropParticipationsSection({
  rifaSeleccionada,
  formatearFecha,
  recargarTodo,
}) {
  const rifaId = rifaSeleccionada?.id || null;
  const padLength = rifaSeleccionada?.formato === "3digitos" ? 3 : 4;

  const [participaciones, setParticipaciones] = useState([]);
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accionandoId, setAccionandoId] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroDropId, setFiltroDropId] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [sortBy, setSortBy] = useState("fecha_desc");

  const [pagina, setPagina] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);

  const [isMobile, setIsMobile] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [participacionSeleccionada, setParticipacionSeleccionada] =
    useState(null);

  const cargarParticipaciones = useCallback(async () => {
    if (!rifaId) {
      setParticipaciones([]);
      setDrops([]);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const headers = await getAdminAuthHeaders();

      const res = await fetch(
        `/api/admin-free-drop-participations?rifaId=${encodeURIComponent(rifaId)}`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar las participaciones");
      }

      setParticipaciones(Array.isArray(data.participaciones) ? data.participaciones : []);
      setDrops(Array.isArray(data.drops) ? data.drops : []);
      setPagina(1);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando participaciones");
    } finally {
      setLoading(false);
    }
  }, [rifaId]);

  useEffect(() => {
    cargarParticipaciones();
  }, [cargarParticipaciones]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 920);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const participacionesFiltradas = useMemo(() => {
    let list = [...participaciones];

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();

      list = list.filter((item) => {
        const nombreCompleto = getFullName(item).toLowerCase();
        const email = String(item.email || item.emailCliente || "").toLowerCase();
        const telefono = String(item.telefono || item.telefonoCliente || "").toLowerCase();
        const codigo = String(item.codigo_unico || item.codigoFree || "").toLowerCase();
        const numero = String(item.numeroTicket || item.tickets?.numero_ticket || "").toLowerCase();
        const dropLabel = String(getDropLabel(item)).toLowerCase();

        return (
          nombreCompleto.includes(q) ||
          email.includes(q) ||
          telefono.includes(q) ||
          codigo.includes(q) ||
          numero.includes(q) ||
          dropLabel.includes(q)
        );
      });
    }

    if (filtroDropId) {
      list = list.filter((item) => String(item.free_drop_id) === String(filtroDropId));
    }

    if (filtroEstado) {
      list = list.filter(
        (item) => normalizarEstado(item.estado) === normalizarEstado(filtroEstado)
      );
    }

    list.sort((a, b) => {
      const fechaA = new Date(a.created_at || 0).getTime();
      const fechaB = new Date(b.created_at || 0).getTime();

      if (sortBy === "fecha_desc") return fechaB - fechaA;
      if (sortBy === "fecha_asc") return fechaA - fechaB;

      if (sortBy === "nombre_asc") {
        return getFullName(a).localeCompare(getFullName(b), "es", {
          sensitivity: "base",
        });
      }

      if (sortBy === "nombre_desc") {
        return getFullName(b).localeCompare(getFullName(a), "es", {
          sensitivity: "base",
        });
      }

      if (sortBy === "numero_asc") {
        return Number(a.numeroTicket || a.tickets?.numero_ticket || 0) -
          Number(b.numeroTicket || b.tickets?.numero_ticket || 0);
      }

      if (sortBy === "numero_desc") {
        return Number(b.numeroTicket || b.tickets?.numero_ticket || 0) -
          Number(a.numeroTicket || a.tickets?.numero_ticket || 0);
      }

      if (sortBy === "estado") {
        const order = {
          pendiente: 0,
          reserved: 0,
          reservado: 0,
          valida: 1,
          activo: 1,
          aprobad: 1,
          rechazada: 2,
          anulada: 3,
        };

        const estadoA = normalizarEstado(a.estado);
        const estadoB = normalizarEstado(b.estado);

        const oa = order[estadoA] ?? 99;
        const ob = order[estadoB] ?? 99;

        if (oa !== ob) return oa - ob;
        return fechaB - fechaA;
      }

      return 0;
    });

    return list;
  }, [participaciones, busqueda, filtroDropId, filtroEstado, sortBy]);

  const resumen = useMemo(() => {
    return participacionesFiltradas.reduce(
      (acc, item) => {
        const estado = normalizarEstado(item.estado);

        acc.total += 1;
        if (["valida", "activo", "activa", "approved", "aprobado", "aprobada"].includes(estado)) acc.valida += 1;
        if (["pendiente", "reserved", "reservado"].includes(estado)) acc.pendiente += 1;
        if (["rechazada", "rechazado", "rejected"].includes(estado)) acc.rechazada += 1;
        if (["anulada", "anulado", "cancelado", "cancelada"].includes(estado)) acc.anulada += 1;

        return acc;
      },
      {
        total: 0,
        valida: 0,
        pendiente: 0,
        rechazada: 0,
        anulada: 0,
      }
    );
  }, [participacionesFiltradas]);

  const participacionesPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return participacionesFiltradas.slice(inicio, fin);
  }, [participacionesFiltradas, pagina, itemsPorPagina]);

  const totalPaginas = useMemo(() => {
    return Math.max(Math.ceil(participacionesFiltradas.length / itemsPorPagina), 1);
  }, [participacionesFiltradas.length, itemsPorPagina]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroDropId, filtroEstado, sortBy, itemsPorPagina]);

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(String(texto || ""));
      await Swal.fire({
        icon: "success",
        title: "Copiado",
        text: "Texto copiado al portapapeles",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo copiar",
      });
    }
  };

  const copiarTodo = async () => {
    if (!participacionesFiltradas.length) {
      await Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay participaciones para copiar",
      });
      return;
    }

    const texto = participacionesFiltradas
      .map((item, index) => {
        const ticket = item.tickets;

        return [
          `#${index + 1}`,
          `${getFullName(item) || "Sin nombre"}`,
          `Email: ${item.email || item.emailCliente || "Sin email"}`,
          `Teléfono: ${item.telefono || item.telefonoCliente || "Sin teléfono"}`,
          `Drop: ${getDropLabel(item)}`,
          `Número: ${getTicketNumber(item, padLength)}`,
          `Código: ${item.codigo_unico || item.codigoFree || "Sin código"}`,
          `Estado: ${estadoLabel(item.estado)}`,
          `Antifraude: ${getRiskMeta(item).show ? getRiskMeta(item).label : "Normal"}`,
          `Fecha: ${formatearFechaSeguro(item.created_at, formatearFecha)}`,
        ].join(" | ");
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(texto);
      await Swal.fire({
        icon: "success",
        title: "Copiado",
        text: "Se copió toda la lista filtrada",
      });
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo copiar toda la lista",
      });
    }
  };

  const exportarCSV = async () => {
    if (!participacionesFiltradas.length) {
      await Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay participaciones para exportar",
      });
      return;
    }

    const encabezados = [
      "Participante",
      "Apellido",
      "Email",
      "Teléfono",
      "Estado",
      "Drop",
      "Número",
      "Código FREE",
      "Aceptó reglas",
      "Cumple requisitos",
      "Estado residencia",
      "Riesgo score",
      "Razones antifraude",
      "Requiere revisión manual",
      "Origen revisión",
      "Revisado por",
      "Fecha revisión",
      "Fecha creación",
      "Fecha actualización",
    ];

    const filas = participacionesFiltradas.map((item) => {
      const ticket = item.tickets;

      return [
        item.nombre || "",
        item.apellido || "",
        item.email || item.emailCliente || "",
        item.telefono || item.telefonoCliente || "",
        estadoLabel(item.estado),
        getDropLabel(item),
        ticket?.numero_ticket != null
          ? String(ticket.numero_ticket).padStart(padLength, "0")
          : item.numeroTicket != null
          ? String(item.numeroTicket).padStart(padLength, "0")
          : "",
        item.codigo_unico || item.codigoFree || "",
        item.acepta_reglas ? "Sí" : "No",
        item.cumple_requisitos ? "Sí" : "No",
        item.estado_residencia || "",
        getRiskScore(item),
        getRiskReasonsText(item),
        item.requires_manual_review ? "Sí" : "No",
        getReviewSourceLabel(item.review_source),
        item.reviewed_by || "",
        item.reviewed_at ? formatearFechaSeguro(item.reviewed_at, formatearFecha) : "",
        formatearFechaSeguro(item.created_at, formatearFecha),
        formatearFechaSeguro(item.updated_at, formatearFecha),
      ].map(escaparCSV);
    });

    const csv = [
      encabezados.map(escaparCSV).join(","),
      ...filas.map((fila) => fila.join(",")),
    ].join("\n");

    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      const nombreRifa = rifaSeleccionada?.nombre
        ? rifaSeleccionada.nombre.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
        : "rifa";

      a.href = url;
      a.setAttribute("download", `participaciones_free_${nombreRifa}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await Swal.fire({
        icon: "success",
        title: "Exportado",
        text: "CSV descargado correctamente",
      });
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo exportar el CSV",
      });
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroDropId("");
    setFiltroEstado("");
    setSortBy("fecha_desc");
    setPagina(1);
  };

  const abrirDetalle = (item) => {
    setParticipacionSeleccionada(item);
    setModalOpen(true);
  };

  const cerrarDetalle = () => {
    setModalOpen(false);
    setParticipacionSeleccionada(null);
  };

  const ejecutarAccion = async (participationId, action) => {
    const textos = {
      aprobar: {
        title: "¿Aprobar participación?",
        text: "La participación pasará a estado válida y el ticket quedará confirmado.",
        confirmButtonText: "Sí, aprobar",
        confirmButtonColor: "#16a34a",
      },
      rechazar: {
        title: "¿Rechazar participación?",
        text: "El ticket se liberará y la participación quedará rechazada.",
        confirmButtonText: "Sí, rechazar",
        confirmButtonColor: "#dc2626",
      },
      anular: {
        title: "¿Anular participación?",
        text: "El ticket se liberará y la participación quedará anulada.",
        confirmButtonText: "Sí, anular",
        confirmButtonColor: "#64748b",
      },
    };

    const info = textos[action];
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
      setAccionandoId(participationId);

      const headers = await getAdminAuthHeaders();

      const res = await fetch("/api/admin-free-drop-participations", {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participationId,
          rifaId,
          action,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar la participación");
      }

      await Swal.fire({
        icon: "success",
        title: "Listo",
        text: data.message || "Participación actualizada correctamente",
      });

      cerrarDetalle();
      await cargarParticipaciones();

      if (typeof recargarTodo === "function") {
        await recargarTodo();
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo actualizar la participación",
      });
    } finally {
      setAccionandoId(null);
    }
  };

  if (!rifaId) {
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
        <h2 style={{ margin: 0 }}>Participaciones FREE</h2>
        <p style={{ marginTop: "10px", opacity: 0.8 }}>
          Selecciona una rifa para ver las participaciones gratis.
        </p>
      </section>
    );
  }

  const modalParticipacion = participacionSeleccionada;
  const modalDrop = modalParticipacion?.free_drops || null;
  const modalTicket = modalParticipacion?.tickets || null;
  const modalEstado = normalizarEstado(modalParticipacion?.estado);
  const modalEstadoMeta = getEstadoMeta(modalEstado);
  const modalAcciones = getAcciones(modalParticipacion?.estado);
  const modalRiskMeta = getRiskMeta(modalParticipacion);
  const modalRiskReasons = getRiskReasons(modalParticipacion);

  const cardStyle = {
    background: "rgba(17,24,39,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "16px",
    padding: "14px",
    boxShadow: "0 10px 28px rgba(0,0,0,.18)",
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

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: ".02em",
    textTransform: "uppercase",
    opacity: 0.78,
    marginBottom: "8px",
  };

  const valueStyle = {
    display: "block",
    fontSize: "14px",
    lineHeight: 1.5,
  };

  const detailBoxStyle = {
    background: "rgba(17,24,39,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "14px",
    padding: "14px",
  };

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
          <h2 style={{ margin: 0 }}>Participaciones FREE</h2>
          <p style={{ marginTop: "8px", opacity: 0.75 }}>
            Revisa todas las participaciones gratis registradas en este evento.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={copiarTodo}
            disabled={loading || !participacionesFiltradas.length}
          >
            Copiar todo
          </button>

          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={exportarCSV}
            disabled={loading || !participacionesFiltradas.length}
          >
            Exportar CSV
          </button>

          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={cargarParticipaciones}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        {[
          { label: "Total", value: resumen.total },
          { label: "Válidas", value: resumen.valida },
          { label: "Pendientes", value: resumen.pendiente },
          { label: "Rechazadas", value: resumen.rechazada },
          { label: "Anuladas", value: resumen.anulada },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
              {item.label}
            </p>
            <strong style={{ fontSize: "22px", display: "block", marginTop: "8px" }}>
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr auto auto",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <input
          type="text"
          placeholder="Buscar por nombre, email, teléfono, código o número"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={inputStyle}
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={selectStyle}
        >
          <option value="fecha_desc">Más recientes</option>
          <option value="fecha_asc">Más antiguas</option>
          <option value="estado">Por estado</option>
          <option value="nombre_asc">Nombre A-Z</option>
          <option value="nombre_desc">Nombre Z-A</option>
          <option value="numero_asc">Número ascendente</option>
          <option value="numero_desc">Número descendente</option>
        </select>

        <select
          value={itemsPorPagina}
          onChange={(e) => setItemsPorPagina(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={5}>5 por página</option>
          <option value={10}>10 por página</option>
          <option value={20}>20 por página</option>
          <option value={50}>50 por página</option>
        </select>

        <button
          type="button"
          className="adminpro-red-btn"
          onClick={() => cargarParticipaciones()}
          disabled={loading}
        >
          Filtrar
        </button>

        <button
          type="button"
          className="adminpro-soft-btn dark"
          onClick={limpiarFiltros}
          disabled={loading}
        >
          Limpiar
        </button>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12px",
            opacity: 0.75,
            textTransform: "uppercase",
            letterSpacing: ".03em",
          }}
        >
          Filtrar por drop
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            paddingBottom: "6px",
          }}
        >
          <button
            type="button"
            onClick={() => setFiltroDropId("")}
            style={{
              ...cardStyle,
              minWidth: "170px",
              textAlign: "left",
              cursor: "pointer",
              border:
                filtroDropId === ""
                  ? "1px solid rgba(34,197,94,.45)"
                  : "1px solid rgba(255,255,255,.08)",
              background:
                filtroDropId === ""
                  ? "linear-gradient(180deg, rgba(22,163,74,.22), rgba(17,24,39,.92))"
                  : "rgba(17,24,39,.92)",
            }}
          >
            <strong style={{ display: "block", fontSize: "14px" }}>
              Todos los drops
            </strong>
            <span style={{ opacity: 0.75, fontSize: "12px" }}>
              {participaciones.length} participación(es)
            </span>
          </button>

          {drops.map((drop) => {
            const selected = String(filtroDropId) === String(drop.id);
            const meta = getEstadoMeta(drop.estado);

            return (
              <button
                key={drop.id}
                type="button"
                onClick={() => setFiltroDropId(String(drop.id))}
                style={{
                  ...cardStyle,
                  minWidth: "220px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: selected
                    ? `1px solid ${meta.border}`
                    : "1px solid rgba(255,255,255,.08)",
                  background: selected
                    ? `linear-gradient(180deg, ${meta.bg}, rgba(17,24,39,.92))`
                    : "rgba(17,24,39,.92)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "14px" }}>
                      {drop.nombre || `FREE DROP #${drop.numero_drop}`}
                    </strong>
                    <span style={{ opacity: 0.75, fontSize: "12px" }}>
                      Drop #{drop.numero_drop}
                    </span>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      padding: "5px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: meta.bg,
                      border: `1px solid ${meta.border}`,
                      color: meta.text,
                    }}
                  >
                    {estadoLabel(drop.estado)}
                  </span>
                </div>

                <div style={{ marginTop: "10px", fontSize: "12px", opacity: 0.8 }}>
                  {drop.participaciones_count || 0} participación(es)
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12px",
            opacity: 0.75,
            textTransform: "uppercase",
            letterSpacing: ".03em",
          }}
        >
          Filtrar por estado
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "", label: "Todos" },
            { value: "valida", label: "Válidas" },
            { value: "pendiente", label: "Pendientes" },
            { value: "rechazada", label: "Rechazadas" },
            { value: "anulada", label: "Anuladas" },
          ].map((item) => {
            const active = String(filtroEstado) === String(item.value);
            return (
              <button
                key={item.value || "todos"}
                type="button"
                onClick={() => setFiltroEstado(item.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  border: active
                    ? "1px solid rgba(34,197,94,.5)"
                    : "1px solid rgba(255,255,255,.10)",
                  background: active
                    ? "linear-gradient(180deg, rgba(34,197,94,.18), rgba(17,24,39,.92))"
                    : "rgba(17,24,39,.92)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "13px",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div style={{ opacity: 0.8, fontSize: "14px" }}>
          Mostrando {participacionesFiltradas.length} participación(es)
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ opacity: 0.8, fontSize: "14px" }}>
            Página {pagina} de {totalPaginas}
          </span>
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

      {loading && (
        <div style={{ marginBottom: "14px", color: "rgba(255,255,255,.75)" }}>
          Cargando participaciones...
        </div>
      )}

      {isMobile ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {participacionesPaginadas.length === 0 && !loading ? (
            <div style={cardStyle}>No hay participaciones para mostrar.</div>
          ) : (
            participacionesPaginadas.map((item) => {
              const estado = normalizarEstado(item.estado);
              const meta = getEstadoMeta(estado);
              const riskMeta = getRiskMeta(item);
              const acciones = getAcciones(item.estado);

              return (
                <article key={item.id} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px" }}>
                        {getFullName(item) || "Sin nombre"}
                      </h3>
                      <p style={{ margin: "4px 0 0", opacity: 0.75, fontSize: "13px" }}>
                        {item.email || item.emailCliente || "Sin email"}
                      </p>
                    </div>

                    <span
                      style={{
                        display: "inline-flex",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                        color: meta.text,
                      }}
                    >
                      {estadoLabel(item.estado)}
                    </span>
                  </div>

                  {riskMeta.show && (
                    <div style={{ marginTop: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 800,
                          background: riskMeta.bg,
                          border: `1px solid ${riskMeta.border}`,
                          color: riskMeta.text,
                        }}
                      >
                        {riskMeta.label}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginTop: "12px",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "12px", opacity: 0.65 }}>
                        Teléfono
                      </p>
                      <strong style={valueStyle}>
                        {item.telefono || item.telefonoCliente || "Sin teléfono"}
                      </strong>
                    </div>

                    <div>
                      <p style={{ margin: 0, fontSize: "12px", opacity: 0.65 }}>
                        Drop
                      </p>
                      <strong style={valueStyle}>{getDropLabel(item)}</strong>
                    </div>

                    <div>
                      <p style={{ margin: 0, fontSize: "12px", opacity: 0.65 }}>
                        Número
                      </p>
                      <strong style={valueStyle}>
                        {getTicketNumber(item, padLength)}
                      </strong>
                    </div>

                    <div>
                      <p style={{ margin: 0, fontSize: "12px", opacity: 0.65 }}>
                        Código FREE
                      </p>
                      <strong style={valueStyle}>
                        {item.codigo_unico || item.codigoFree || "Sin código"}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginTop: "14px",
                    }}
                  >
                    <button
                      type="button"
                      className="adminpro-soft-btn dark"
                      onClick={() => abrirDetalle(item)}
                    >
                      Ver detalle
                    </button>

                    <button
                      type="button"
                      className="adminpro-soft-btn dark"
                      onClick={() => copiarTexto(item.codigo_unico || item.codigoFree)}
                    >
                      Copiar código
                    </button>

                    {acciones.map((accion) => (
                      <button
                        key={accion.action}
                        type="button"
                        style={buttonStyle(accion.variant)}
                        onClick={() => ejecutarAccion(item.id, accion.action)}
                        disabled={accionandoId === item.id}
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
      ) : (
        <div
          style={{
            overflowX: "auto",
            width: "100%",
            borderRadius: "14px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1120px",
              tableLayout: "fixed",
              fontSize: "13px",
              background: "rgba(17,24,39,.92)",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: "rgba(255,255,255,.04)" }}>
                {[
                  { label: "Participante", width: "9%", align: "left" },
                  { label: "Email", width: "16%", align: "left" },
                  { label: "Teléfono", width: "9%", align: "left" },
                  { label: "Drop", width: "9%", align: "left" },
                  { label: "Número", width: "6%", align: "center" },
                  { label: "Código FREE", width: "11%", align: "center" },
                  { label: "Estado", width: "8%", align: "center" },
                  { label: "Antifraude", width: "12%", align: "center" },
                  { label: "Fecha", width: "10%", align: "center" },
                  { label: "Acciones", width: "10%", align: "center" },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      width: col.width,
                      padding: "11px 6px",
                      fontSize: "11px",
                      letterSpacing: ".02em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,.7)",
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      textAlign: col.align,
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {participacionesPaginadas.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan="10"
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "rgba(255,255,255,.72)",
                    }}
                  >
                    No hay participaciones para mostrar.
                  </td>
                </tr>
              ) : (
                participacionesPaginadas.map((item) => {
                  const estado = normalizarEstado(item.estado);
                  const meta = getEstadoMeta(estado);
                  const riskMeta = getRiskMeta(item);
                  const acciones = getAcciones(item.estado);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,.045)",
                      }}
                    >
                      <td style={{ padding: "13px 6px", verticalAlign: "middle" }}>
                        <strong
                          style={{
                            display: "block",
                            lineHeight: 1.45,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {getFullName(item) || "Sin nombre"}
                        </strong>
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          overflowWrap: "anywhere",
                          lineHeight: 1.45,
                        }}
                      >
                        {item.email || item.emailCliente || "Sin email"}
                      </td>

                      <td style={{ padding: "13px 6px", verticalAlign: "middle" }}>
                        {item.telefono || item.telefonoCliente || "Sin teléfono"}
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          lineHeight: 1.45,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {getDropLabel(item)}
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          textAlign: "center",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getTicketNumber(item, padLength)}
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              maxWidth: "112px",
                              overflowWrap: "anywhere",
                              lineHeight: 1.4,
                            }}
                          >
                            {item.codigo_unico || item.codigoFree || "Sin código"}
                          </span>
                          <button
                            type="button"
                            className="adminpro-soft-btn dark"
                            onClick={() => copiarTexto(item.codigo_unico || item.codigoFree)}
                          >
                            Copiar
                          </button>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: meta.bg,
                            border: `1px solid ${meta.border}`,
                            color: meta.text,
                          }}
                        >
                          {estadoLabel(item.estado)}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        {riskMeta.show ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              padding: "6px 9px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              background: riskMeta.bg,
                              border: `1px solid ${riskMeta.border}`,
                              color: riskMeta.text,
                            }}
                          >
                            {riskMeta.label}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.5, fontSize: "11px" }}>Normal</span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          textAlign: "center",
                          lineHeight: 1.45,
                        }}
                      >
                        {formatearFechaSeguro(item.created_at, formatearFecha)}
                      </td>

                      <td
                        style={{
                          padding: "13px 6px",
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            type="button"
                            className="adminpro-soft-btn dark"
                            onClick={() => abrirDetalle(item)}
                          >
                            Detalle
                          </button>

                          <button
                            type="button"
                            className="adminpro-soft-btn dark"
                            onClick={() => copiarTexto(item.codigo_unico || item.codigoFree)}
                          >
                            Código
                          </button>

                          {acciones.map((accion) => (
                            <button
                              key={accion.action}
                              type="button"
                              style={buttonStyle(accion.variant)}
                              onClick={() => ejecutarAccion(item.id, accion.action)}
                              disabled={accionandoId === item.id}
                            >
                              {accion.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "16px",
        }}
      >
        <div style={{ opacity: 0.8, fontSize: "14px" }}>
          Mostrando {participacionesFiltradas.length} participación(es)
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={() => setPagina((p) => Math.max(p - 1, 1))}
            disabled={pagina <= 1}
          >
            Anterior
          </button>

          <button
            type="button"
            className="adminpro-soft-btn dark"
            onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))}
            disabled={pagina >= totalPaginas}
          >
            Siguiente
          </button>
        </div>
      </div>

      {modalOpen && modalParticipacion && (
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
          onClick={cerrarDetalle}
        >
          <div
            style={{
              width: "min(1040px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
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
                alignItems: "flex-start",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Detalle de participación</h2>
                <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
                  Revisión completa de la participación FREE
                </p>
              </div>

              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={detailBoxStyle}>
                <span style={labelStyle}>Participante</span>
                <strong style={valueStyle}>
                  {getFullName(modalParticipacion) || "Sin nombre"}
                </strong>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>Estado</span>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: modalEstadoMeta.bg,
                    border: `1px solid ${modalEstadoMeta.border}`,
                    color: modalEstadoMeta.text,
                    fontWeight: 700,
                    fontSize: "11px",
                    width: "fit-content",
                  }}
                >
                  {estadoLabel(modalParticipacion.estado)}
                </span>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>Drop</span>
                <strong style={valueStyle}>{getDropLabel(modalParticipacion)}</strong>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>Número</span>
                <strong style={valueStyle}>
                  {getTicketNumber(modalParticipacion, padLength)}
                </strong>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "12px",
              }}
            >
              <div style={detailBoxStyle}>
                <span style={labelStyle}>Email</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={valueStyle}>
                    {modalParticipacion.email || modalParticipacion.emailCliente || "Sin email"}
                  </strong>
                  <button
                    type="button"
                    className="adminpro-soft-btn dark"
                    onClick={() =>
                      copiarTexto(modalParticipacion.email || modalParticipacion.emailCliente)
                    }
                  >
                    Copiar
                  </button>
                </div>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Teléfono</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={valueStyle}>
                    {modalParticipacion.telefono || modalParticipacion.telefonoCliente || "Sin teléfono"}
                  </strong>
                  <button
                    type="button"
                    className="adminpro-soft-btn dark"
                    onClick={() =>
                      copiarTexto(modalParticipacion.telefono || modalParticipacion.telefonoCliente)
                    }
                  >
                    Copiar
                  </button>
                </div>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Estado residencia</span>
                <strong style={valueStyle}>
                  {modalParticipacion.estado_residencia || "Sin dato"}
                </strong>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>Código FREE</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ ...valueStyle, fontSize: "16px" }}>
                    {modalParticipacion.codigo_unico || modalParticipacion.codigoFree || "Sin código"}
                  </strong>
                  <button
                    type="button"
                    className="adminpro-red-btn"
                    onClick={() =>
                      copiarTexto(modalParticipacion.codigo_unico || modalParticipacion.codigoFree)
                    }
                  >
                    Copiar código
                  </button>
                </div>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Aceptó reglas</span>
                <strong style={valueStyle}>
                  {modalParticipacion.acepta_reglas ? "Sí" : "No"}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Cumple requisitos</span>
                <strong style={valueStyle}>
                  {modalParticipacion.cumple_requisitos ? "Sí" : "No"}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Usuario social</span>
                <strong style={valueStyle}>
                  {modalParticipacion.social_username || "Sin usuario"}
                </strong>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>Ticket vinculado</span>
                <strong style={valueStyle}>
                  {modalTicket?.numero_ticket != null
                    ? `#${String(modalTicket.numero_ticket).padStart(padLength, "0")}`
                    : "Sin número"}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Ticket estado</span>
                <strong style={valueStyle}>
                  {modalTicket?.estado || "Sin estado"}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Fecha creación</span>
                <strong style={valueStyle}>
                  {formatearFechaSeguro(modalParticipacion.created_at, formatearFecha)}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Fecha actualización</span>
                <strong style={valueStyle}>
                  {formatearFechaSeguro(modalParticipacion.updated_at, formatearFecha)}
                </strong>
              </div>

              <div
                style={{
                  ...detailBoxStyle,
                  border: `1px solid ${modalRiskMeta.border}`,
                  background: modalRiskMeta.show
                    ? modalRiskMeta.bg
                    : "rgba(22,163,74,.07)",
                }}
              >
                <span style={labelStyle}>Antifraude</span>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "6px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      background: modalRiskMeta.bg,
                      border: `1px solid ${modalRiskMeta.border}`,
                      color: modalRiskMeta.text,
                    }}
                  >
                    {modalRiskMeta.show ? modalRiskMeta.label : "✓ Sin señales de riesgo"}
                  </span>

                  {modalParticipacion.requires_manual_review && (
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 800,
                        background: "rgba(245,158,11,.14)",
                        border: "1px solid rgba(245,158,11,.30)",
                        color: "#fde68a",
                      }}
                    >
                      Requiere revisión
                    </span>
                  )}
                </div>

                <div style={{ height: "12px" }} />

                <span style={labelStyle}>Score de riesgo</span>
                <strong style={valueStyle}>{getRiskScore(modalParticipacion)}</strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Origen</span>
                <strong style={valueStyle}>
                  {getReviewSourceLabel(modalParticipacion.review_source)}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Señales detectadas</span>
                {modalRiskReasons.length ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {modalRiskReasons.map((reason, index) => {
                      const reasonObj = typeof reason === "object" && reason ? reason : {};
                      const code =
                        typeof reason === "string"
                          ? reason
                          : reasonObj.code || `SEÑAL_${index + 1}`;
                      const score = Number(reasonObj.score ?? 0);
                      const description = reasonObj.description || "Sin descripción adicional";

                      return (
                        <div
                          key={`${code}-${index}`}
                          style={{
                            padding: "10px",
                            borderRadius: "10px",
                            background: "rgba(3,7,18,.45)",
                            border: "1px solid rgba(255,255,255,.08)",
                          }}
                        >
                          <strong style={{ ...valueStyle, fontSize: "13px" }}>
                            {code}
                            {Number.isFinite(score) && score > 0 ? ` · +${score}` : ""}
                          </strong>
                          <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.82, lineHeight: 1.5 }}>
                            {description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <strong style={valueStyle}>Sin señales registradas</strong>
                )}

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>Revisión administrativa</span>
                <strong style={valueStyle}>
                  {modalParticipacion.reviewed_at
                    ? `${modalParticipacion.reviewed_by || "admin"} · ${formatearFechaSeguro(
                        modalParticipacion.reviewed_at,
                        formatearFecha
                      )}`
                    : modalParticipacion.requires_manual_review
                    ? "Pendiente de revisión"
                    : "No requerida / sin revisión manual"}
                </strong>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>IP</span>
                <strong style={valueStyle}>
                  {modalParticipacion.ip_address || "Sin IP"}
                </strong>

                <div style={{ height: "10px" }} />

                <span style={labelStyle}>User Agent</span>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "13px",
                    opacity: 0.85,
                    lineHeight: 1.6,
                    wordBreak: "break-word",
                  }}
                >
                  {modalParticipacion.user_agent || "Sin user agent"}
                </p>
              </div>

              <div style={detailBoxStyle}>
                <span style={labelStyle}>Evidencia</span>
                {modalParticipacion.evidence_url ? (
                  <a
                    href={modalParticipacion.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#60a5fa",
                      fontWeight: 700,
                      wordBreak: "break-word",
                    }}
                  >
                    Abrir evidencia
                  </a>
                ) : (
                  <strong style={valueStyle}>Sin evidencia</strong>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "18px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={() =>
                  copiarTexto(modalParticipacion.email || modalParticipacion.emailCliente)
                }
              >
                Copiar email
              </button>

              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={() =>
                  copiarTexto(modalParticipacion.codigo_unico || modalParticipacion.codigoFree)
                }
              >
                Copiar código
              </button>

              {modalAcciones.map((accion) => (
                <button
                  key={accion.action}
                  type="button"
                  style={buttonStyle(accion.variant)}
                  onClick={() => ejecutarAccion(modalParticipacion.id, accion.action)}
                  disabled={accionandoId === modalParticipacion.id}
                >
                  {accion.label}
                </button>
              ))}

              <button
                type="button"
                className="adminpro-red-btn"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}