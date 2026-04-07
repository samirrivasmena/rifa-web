"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Swal from "sweetalert2";

import { getAdminAuthHeaders } from "../../lib/getAdminAuthHeaders";
import { formatearFecha } from "../../lib/admin/formatearFecha";
import { escaparCSV } from "../../lib/admin/escaparCSV";

import Sidebar from "../../components/admin/Sidebar";
import HeaderPanel from "../../components/admin/HeaderPanel";
import ManualApprovalModal from "../../components/admin/ManualApprovalModal";

import AdminDashboardSection from "../../components/admin/sections/AdminDashboardSection";
import AdminComprasSection from "../../components/admin/sections/AdminComprasSection";
import AdminGanadorSection from "../../components/admin/sections/AdminGanadorSection";
import AdminRankingSection from "../../components/admin/sections/AdminRankingSection";
import AdminRifasSection from "../../components/admin/sections/AdminRifasSection";

import { useAdminAuth } from "../../hooks/admin/useAdminAuth";
import { useAdminNavigation } from "../../hooks/admin/useAdminNavigation";
import { useAdminRanking } from "../../hooks/admin/useAdminRanking";
import { useAdminGanador } from "../../hooks/admin/useAdminGanador";
import { useAdminCompras } from "../../hooks/admin/useAdminCompras";

import "./admin.css";

export default function Admin() {
  const { authLoading, accesoPermitido, adminEmail, cerrarSesion } = useAdminAuth();

  const {
    refs: {
      topRef,
      dashboardRef,
      mapaTicketsRef,
      dashboardFilterRef,
      comprasSectionRef,
      ganadorRef,
      rankingRef,
      rankingDetalleRef,
    },
    seccionActiva,
    setSeccionActiva,
    filtroDashboard,
    setFiltroDashboard,
    scrollToRef,
  } = useAdminNavigation();

  const [dataLoading, setDataLoading] = useState(false);
  const [showSecondImage, setShowSecondImage] = useState(false);

  const [compras, setCompras] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [rifas, setRifas] = useState([]);

  const [rifaSeleccionadaId, setRifaSeleccionadaId] = useState("");
  const [rifaActiva, setRifaActiva] = useState(null);
  const [loadingRifa, setLoadingRifa] = useState(true);

  const [loadingAprobacion, setLoadingAprobacion] = useState(null);
  const [loadingRechazo, setLoadingRechazo] = useState(null);
  const [loadingEliminacion, setLoadingEliminacion] = useState(null);

  const [modalManualOpen, setModalManualOpen] = useState(false);
  const [compraManualSeleccionada, setCompraManualSeleccionada] = useState(null);
  const [ticketsManualSeleccionados, setTicketsManualSeleccionados] = useState([]);
  const [preselectedManualNumber, setPreselectedManualNumber] = useState(null);

  const cargarDashboard = useCallback(async () => {
    if (!accesoPermitido) return { compras: [], tickets: [] };

    try {
      const headers = await getAdminAuthHeaders();

      if (!headers.Authorization) {
        console.warn("No hay token admin listo todavía para cargar dashboard");
        return { compras: [], tickets: [] };
      }

      const res = await fetch("/api/admin-compras", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const rawText = await res.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("Respuesta inválida en /api/admin-compras");
        return { compras: [], tickets: [] };
      }

      if (!res.ok) {
        console.error("Error admin compras:", data.error);
        return { compras: [], tickets: [] };
      }

      const comprasData = Array.isArray(data.compras) ? data.compras : [];
      const ticketsData = Array.isArray(data.tickets) ? data.tickets : [];

      setCompras(comprasData);
      setTickets(ticketsData);

      return { compras: comprasData, tickets: ticketsData };
    } catch (err) {
      console.error("Error cargando dashboard:", err);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar el dashboard",
      });
      return { compras: [], tickets: [] };
    }
  }, [accesoPermitido]);

  const cargarRifasGlobal = useCallback(async (comprasData = [], ticketsData = []) => {
    try {
      const headers = await getAdminAuthHeaders();

      if (!headers.Authorization) {
        console.warn("No hay token admin listo todavía para listar rifas");
        return;
      }

      const resRifas = await fetch("/api/listar-rifas", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const rawTextRifas = await resRifas.text();

      let dataRifas;
      try {
        dataRifas = JSON.parse(rawTextRifas);
      } catch {
        console.error("Respuesta inválida en /api/listar-rifas");
        return;
      }

      if (!resRifas.ok) {
        console.error("Error en /api/listar-rifas:", dataRifas.error);
        return;
      }

      const listaRifas = Array.isArray(dataRifas.rifas) ? dataRifas.rifas : [];

      const rifasConStats = listaRifas.map((rifa) => {
        const comprasDeRifa = comprasData.filter(
          (compra) => String(compra.rifa_id) === String(rifa.id)
        );

        const ticketsDeRifa = ticketsData.filter(
          (ticket) => String(ticket.rifa_id) === String(rifa.id)
        );

        const totalTickets = Number(rifa.cantidad_numeros) || 0;
        const ticketsVendidos = ticketsDeRifa.length;
        const comprasTotales = comprasDeRifa.length;
        const disponibles = Math.max(totalTickets - ticketsVendidos, 0);
        const porcentajeVendido =
          totalTickets > 0
            ? Number(((ticketsVendidos / totalTickets) * 100).toFixed(2))
            : 0;

        return {
          ...rifa,
          stats: {
            compras: comprasTotales,
            ticketsVendidos,
            disponibles,
            porcentajeVendido,
          },
        };
      });

      setRifas(rifasConStats);

      setRifaSeleccionadaId((prev) => {
        if (prev && rifasConStats.find((r) => String(r.id) === String(prev))) {
          return prev;
        }

        const activa = rifasConStats.find(
          (r) => String(r.estado || "").toLowerCase() === "activa"
        );
        if (activa) return activa.id;

        return rifasConStats[0]?.id || "";
      });
    } catch (error) {
      console.error("Error cargando rifas globales:", error);
    }
  }, []);

  const recargarTodo = useCallback(async () => {
    try {
      setDataLoading(true);

      const headers = await getAdminAuthHeaders();

      if (!headers.Authorization) {
        console.warn("Aún no hay sesión admin lista para recargar datos");
        return { compras: [], tickets: [] };
      }

      const { compras: comprasData, tickets: ticketsData } = await cargarDashboard();
      await cargarRifasGlobal(comprasData, ticketsData);

      return { compras: comprasData, tickets: ticketsData };
    } catch (error) {
      console.error("Error recargando datos:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron actualizar los datos",
      });
      return { compras: [], tickets: [] };
    } finally {
      setDataLoading(false);
    }
  }, [cargarDashboard, cargarRifasGlobal]);

  useEffect(() => {
    const cargarRifaActiva = async () => {
      try {
        setLoadingRifa(true);

        const res = await fetch("/api/rifa-activa", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "No se pudo cargar la rifa activa");
          setRifaActiva(null);
          return;
        }

        setRifaActiva(data.rifa || null);
      } catch (error) {
        console.error("Error cargando rifa activa:", error);
        setRifaActiva(null);
      } finally {
        setLoadingRifa(false);
      }
    };

    cargarRifaActiva();
  }, []);

  useEffect(() => {
    if (!accesoPermitido) return;
    recargarTodo();
  }, [accesoPermitido, recargarTodo]);

  useEffect(() => {
    const handleScroll = () => {
      setShowSecondImage(window.scrollY > 180);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const rifaSeleccionada = useMemo(() => {
    return rifas.find((r) => String(r.id) === String(rifaSeleccionadaId)) || null;
  }, [rifas, rifaSeleccionadaId]);

  const padLength = rifaSeleccionada?.formato === "3digitos" ? 3 : 4;

  const {
    numeroGanador,
    setNumeroGanador,
    resultadoGanador,
    setResultadoGanador,
    mensajeBusqueda,
    setMensajeBusqueda,
    esNumeroGanador,
    setEsNumeroGanador,
    guardandoGanador,
    buscarGanador,
    guardarGanadorOficial,
    resetGanadorState,
  } = useAdminGanador({
    rifaSeleccionada,
    padLength,
    recargarTodo,
  });

  const comprasFiltradasPorRifa = useMemo(() => {
    if (!rifaSeleccionadaId) return compras;
    return compras.filter((compra) => String(compra.rifa_id) === String(rifaSeleccionadaId));
  }, [compras, rifaSeleccionadaId]);

  const ticketsFiltradosPorRifa = useMemo(() => {
    if (!rifaSeleccionadaId) return tickets;
    return tickets.filter((ticket) => String(ticket.rifa_id) === String(rifaSeleccionadaId));
  }, [tickets, rifaSeleccionadaId]);

  const {
    filtrosCompras,
    setFiltrosCompras,
    ordenCompras,
    setOrdenCompras,
    paginaCompras,
    setPaginaCompras,
    itemsPorPagina,
    setItemsPorPagina,
    comprasVisibles,
    metodosPagoDisponibles,
    comprasFiltradasAvanzadas,
    comprasFiltradasYOrdenadas,
    totalPaginasCompras,
    comprasPaginadas,
    resumenPaginacionCompras,
    cantidadFiltrosActivos,
    eliminarFiltroIndividual,
    resetComprasState,
  } = useAdminCompras(comprasFiltradasPorRifa);

  const {
    busquedaRanking,
    setBusquedaRanking,
    ordenRanking,
    setOrdenRanking,
    participanteSeleccionado,
    setParticipanteSeleccionado,
    modalRankingOpen,
    setModalRankingOpen,
    paginaRanking,
    setPaginaRanking,
    itemsPorPaginaRanking,
    setItemsPorPaginaRanking,
    abrirDetalleParticipante,
    rankingBase,
    rankingFiltradoYOrdenado,
    totalPaginasRanking,
    rankingPaginado,
    resumenPaginacionRanking,
    ranking,
    resumenRanking,
    resetRankingState,
  } = useAdminRanking(comprasFiltradasPorRifa);

  const comprasPendientes = useMemo(() => {
    return comprasFiltradasPorRifa.filter((compra) => compra.estado_pago === "pendiente");
  }, [comprasFiltradasPorRifa]);

  const ticketsPorCompra = useMemo(() => {
    const map = {};

    ticketsFiltradosPorRifa.forEach((ticket) => {
      const key = String(ticket.compra_id);
      if (!map[key]) map[key] = [];
      map[key].push(String(ticket.numero_ticket).padStart(padLength, "0"));
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => Number(a) - Number(b));
    });

    return map;
  }, [ticketsFiltradosPorRifa, padLength]);

  const dashboardCompactSummary = useMemo(() => {
    const totalCompras = comprasFiltradasPorRifa.length;
    const comprasPendientesCount = comprasFiltradasPorRifa.filter(
      (c) => c.estado_pago === "pendiente"
    ).length;
    const comprasAprobadas = comprasFiltradasPorRifa.filter(
      (c) => c.estado_pago === "aprobado"
    ).length;
    const comprasRechazadas = comprasFiltradasPorRifa.filter(
      (c) => c.estado_pago === "rechazado"
    ).length;

    const ticketsVendidos = ticketsFiltradosPorRifa.length;

    return {
      totalCompras,
      comprasPendientesCount,
      comprasAprobadas,
      comprasRechazadas,
      ticketsVendidos,
    };
  }, [comprasFiltradasPorRifa, ticketsFiltradosPorRifa]);

  useEffect(() => {
    setFiltroDashboard(null);
    setModalManualOpen(false);
    setCompraManualSeleccionada(null);
    setTicketsManualSeleccionados([]);
    setPreselectedManualNumber(null);
    resetComprasState();
    resetGanadorState();
    resetRankingState();
  }, [
    rifaSeleccionadaId,
    setFiltroDashboard,
    resetComprasState,
    resetGanadorState,
    resetRankingState,
  ]);

  const irARankingDetallado = () => {
    setSeccionActiva("ranking");
    scrollToRef(rankingDetalleRef, 180);
  };

  const abrirFiltroDashboard = (key) => {
    setSeccionActiva("dashboard");
    setFiltroDashboard(key);
    scrollToRef(dashboardFilterRef, 180);
  };

  const exportarComprasCSV = () => {
    if (!comprasFiltradasYOrdenadas.length) {
      Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay compras para exportar con los filtros actuales",
      });
      return;
    }

    const encabezados = [
      "Compra ID",
      "Estado",
      "Nombre",
      "Email",
      "Telefono",
      "Tickets Comprados",
      "Tickets Asignados",
      "Monto",
      "Referencia",
      "Metodo Pago",
      "Fecha",
      "Comprobante",
      "Rifa ID",
    ];

    const filas = comprasFiltradasYOrdenadas.map((compra) => {
      const monto = Number(compra.monto_total ?? compra.total ?? 0).toFixed(2);
      const fecha = formatearFecha(compra.fecha_compra || compra.created_at || "");
      const ticketsAsignadosTexto = (ticketsPorCompra[String(compra.id)] || []).join(" | ");
      const comprobante =
        compra.comprobante_url ||
        compra.comprobante ||
        compra.capture_url ||
        compra.soporte_pago ||
        "";

      return [
        compra.id,
        compra.estado_pago || "",
        compra.usuarios?.nombre || "",
        compra.usuarios?.email || "",
        compra.usuarios?.telefono || "",
        compra.cantidad_tickets || 0,
        ticketsAsignadosTexto,
        monto,
        compra.referencia || "",
        compra.metodo_pago || "",
        fecha,
        comprobante,
        compra.rifa_id || "",
      ].map(escaparCSV);
    });

    const contenidoCSV = [
      encabezados.map(escaparCSV).join(","),
      ...filas.map((f) => f.join(",")),
    ].join("\n");

    const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const nombreRifa = rifaSeleccionada?.nombre
      ? rifaSeleccionada.nombre.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
      : "rifa";

    link.href = url;
    link.setAttribute("download", `compras_${nombreRifa}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportarRankingCSV = () => {
    if (!rankingFiltradoYOrdenado.length) {
      Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay participantes en el ranking para exportar",
      });
      return;
    }

    const encabezados = [
      "Posición",
      "Nombre",
      "Email",
      "Teléfono",
      "Tickets aprobados",
      "Compras aprobadas",
      "Monto total",
      "Porcentaje del total",
    ];

    const filas = rankingFiltradoYOrdenado.map((persona, index) => {
      const porcentaje =
        resumenRanking.totalTicketsAprobados > 0
          ? ((persona.cantidad / resumenRanking.totalTicketsAprobados) * 100).toFixed(2)
          : "0.00";

      return [
        index + 1,
        persona.nombre,
        persona.email || "",
        persona.telefono || "",
        persona.cantidad,
        persona.compras,
        Number(persona.montoTotal || 0).toFixed(2),
        `${porcentaje}%`,
      ].map(escaparCSV);
    });

    const contenidoCSV = [
      encabezados.map(escaparCSV).join(","),
      ...filas.map((fila) => fila.join(",")),
    ].join("\n");

    const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const nombreRifa = rifaSeleccionada?.nombre
      ? rifaSeleccionada.nombre.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
      : "rifa";

    link.href = url;
    link.setAttribute("download", `ranking_${nombreRifa}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const aprobarCompra = async (compra) => {
    if (!compra?.id) {
      await Swal.fire({
        icon: "error",
        title: "Datos inválidos",
        text: "La compra no tiene datos válidos para aprobar",
      });
      return;
    }

    if (loadingAprobacion === compra.id) return;

    const confirmar = await Swal.fire({
      title: "¿Aprobar compra?",
      text: "Se asignarán los tickets automáticamente a esta compra.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, aprobar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setLoadingAprobacion(compra.id);

      const res = await fetch("/api/aprobar-compra", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          compraId: compra.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al aprobar compra",
        });
        return;
      }

      const numerosFormateados = (data.tickets || [])
        .map((t) => String(t.numero_ticket).padStart(padLength, "0"))
        .join(", ");

      await Swal.fire({
        icon: "success",
        title: "Compra aprobada",
        html: `
          <p>La compra fue aprobada correctamente.</p>
          <p><strong>Tickets asignados:</strong></p>
          <p>${numerosFormateados || "Sin tickets"}</p>
        `,
      });

      await recargarTodo();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al aprobar compra",
      });
    } finally {
      setLoadingAprobacion(null);
    }
  };

  const abrirAprobacionManual = (compra, numeroPreseleccionado = null) => {
    if (!compra) return;

    if (compra.estado_pago !== "pendiente") {
      Swal.fire({
        icon: "warning",
        title: "Compra no válida",
        text: "Solo puedes hacer aprobación manual en compras pendientes",
      });
      return;
    }

    setCompraManualSeleccionada(compra);
    setTicketsManualSeleccionados([]);
    setPreselectedManualNumber(numeroPreseleccionado);
    setModalManualOpen(true);
  };

  const abrirAprobacionManualDesdeCuadricula = async (numero) => {
    if (!comprasPendientes.length) {
      await Swal.fire({
        icon: "info",
        title: "Sin compras pendientes",
        text: "No hay compras pendientes para asignar manualmente",
      });
      return;
    }

    if (comprasPendientes.length === 1) {
      abrirAprobacionManual(comprasPendientes[0], numero);
      return;
    }

    const opciones = comprasPendientes.reduce((acc, compra) => {
      const nombre =
        compra.usuarios?.nombre ||
        compra.usuarios?.email ||
        compra.usuario_id ||
        "Sin nombre";

      acc[compra.id] = `${nombre} - ${compra.cantidad_tickets} ticket(s) - Ref: ${compra.referencia}`;
      return acc;
    }, {});

    const { value: compraIdElegida } = await Swal.fire({
      title: "Selecciona la compra pendiente",
      input: "select",
      inputOptions: opciones,
      inputPlaceholder: "Selecciona una compra",
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      inputValidator: (value) => {
        if (!value) return "Debes seleccionar una compra";
        return null;
      },
    });

    if (!compraIdElegida) return;

    const compraElegida = comprasPendientes.find(
      (c) => String(c.id) === String(compraIdElegida)
    );

    if (!compraElegida) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se encontró la compra seleccionada",
      });
      return;
    }

    abrirAprobacionManual(compraElegida, numero);
  };

  const aprobarCompraManual = async () => {
    if (!compraManualSeleccionada?.id || !rifaSeleccionada?.id) return;

    const cantidadEsperada = Number(compraManualSeleccionada.cantidad_tickets) || 0;

    if (ticketsManualSeleccionados.length !== cantidadEsperada) {
      await Swal.fire({
        icon: "warning",
        title: "Selección incompleta",
        text: `Debes seleccionar exactamente ${cantidadEsperada} tickets`,
      });
      return;
    }

    const confirmar = await Swal.fire({
      title: "¿Confirmar aprobación manual?",
      html: `
        <p>Se aprobará la compra con tickets elegidos manualmente.</p>
        <p><strong>Tickets:</strong> ${ticketsManualSeleccionados
          .map((n) => String(n).padStart(padLength, "0"))
          .join(", ")}</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setLoadingAprobacion(compraManualSeleccionada.id);

      const res = await fetch("/api/aprobar-compra-manual", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          compraId: compraManualSeleccionada.id,
          rifaId: rifaSeleccionada.id,
          ticketsSeleccionados: ticketsManualSeleccionados,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo aprobar manualmente",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Compra aprobada",
        html: `
          <p>La compra fue aprobada manualmente.</p>
          <p><strong>Tickets asignados:</strong></p>
          <p>${ticketsManualSeleccionados
            .map((n) => String(n).padStart(padLength, "0"))
            .join(", ")}</p>
        `,
      });

      setModalManualOpen(false);
      setCompraManualSeleccionada(null);
      setTicketsManualSeleccionados([]);
      setPreselectedManualNumber(null);

      await recargarTodo();

      setSeccionActiva("compras");
      scrollToRef(comprasSectionRef, 180);
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al aprobar manualmente",
      });
    } finally {
      setLoadingAprobacion(null);
    }
  };

  const rechazarCompra = async (compra) => {
    if (!compra?.id) {
      await Swal.fire({
        icon: "error",
        title: "Datos inválidos",
        text: "La compra no es válida",
      });
      return;
    }

    if (loadingRechazo === compra.id) return;

    const confirmar = await Swal.fire({
      title: "¿Rechazar compra?",
      text: "Esta acción marcará la compra como rechazada.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, rechazar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setLoadingRechazo(compra.id);

      const res = await fetch("/api/rechazar-compra", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          compraId: compra.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al rechazar compra",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Compra rechazada",
        text: "La compra fue rechazada correctamente",
      });

      await recargarTodo();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al rechazar compra",
      });
    } finally {
      setLoadingRechazo(null);
    }
  };

  const eliminarCompra = async (compra) => {
    if (!compra?.id) {
      await Swal.fire({
        icon: "error",
        title: "Datos inválidos",
        text: "La compra no es válida",
      });
      return;
    }

    if (loadingEliminacion === compra.id) return;

    const confirmar = await Swal.fire({
      title: "¿Eliminar compra rechazada?",
      text: "Esta acción eliminará la compra definitivamente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#b91c1c",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setLoadingEliminacion(compra.id);

      const res = await fetch("/api/eliminar-compra", {
        method: "POST",
        headers: {
          ...(await getAdminAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          compraId: compra.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al eliminar compra",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Compra eliminada",
        text: "La compra fue eliminada correctamente",
      });

      await recargarTodo();
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al eliminar compra",
      });
    } finally {
      setLoadingEliminacion(null);
    }
  };

  const irADashboardTotal = () => {
    setSeccionActiva("dashboard");
    setFiltroDashboard("total");
    scrollToRef(dashboardFilterRef, 180);
  };

  const irAPendientes = () => {
    setSeccionActiva("dashboard");
    setFiltroDashboard("pendientes");
    scrollToRef(dashboardFilterRef, 180);
  };

  const irAAprobadas = () => {
    setSeccionActiva("dashboard");
    setFiltroDashboard("aprobadas");
    scrollToRef(dashboardFilterRef, 180);
  };

  const irARechazadas = () => {
    setSeccionActiva("dashboard");
    setFiltroDashboard("rechazadas");
    scrollToRef(dashboardFilterRef, 180);
  };

  const irAMapaTickets = () => {
    setSeccionActiva("dashboard");
    scrollToRef(mapaTicketsRef, 180);
  };

  if (authLoading) {
    return <div className="adminpro-loading">Verificando acceso al panel...</div>;
  }

  if (!accesoPermitido) return null;

  return (
    <>
      <div className="adminpro-layout" ref={topRef}>
        <Sidebar
          activa={seccionActiva}
          onNavigate={(id) => {
            setFiltroDashboard(null);

            if (id === "dashboard") {
              setSeccionActiva("dashboard");
              scrollToRef(dashboardRef, 120);
              return;
            }

            if (id === "mapa-tickets") {
              setSeccionActiva("dashboard");
              scrollToRef(mapaTicketsRef, 180);
              return;
            }

            if (id === "compras") {
              setSeccionActiva("compras");
              scrollToRef(comprasSectionRef, 180);
              return;
            }

            if (id === "ganador") {
              setSeccionActiva("ganador");
              scrollToRef(ganadorRef, 180);
              return;
            }

            if (id === "ranking") {
              setSeccionActiva("ranking");
              scrollToRef(rankingRef, 180);
              return;
            }

            if (id === "rifas") {
              setSeccionActiva("rifas");
              scrollToRef(topRef, 120);
            }
          }}
          onLogout={cerrarSesion}
          adminEmail={adminEmail}
        />

        <main className="adminpro-main">
          <HeaderPanel
            rifas={rifas}
            rifaSeleccionadaId={rifaSeleccionadaId}
            setRifaSeleccionadaId={setRifaSeleccionadaId}
            onRecargar={recargarTodo}
            dataLoading={dataLoading}
          />

          {dataLoading && (
            <div className="adminpro-top-info">
              Cargando datos del panel...
            </div>
          )}

          {seccionActiva === "dashboard" && (
            <AdminDashboardSection
              dashboardRef={dashboardRef}
              dashboardFilterRef={dashboardFilterRef}
              mapaTicketsRef={mapaTicketsRef}
              comprasSectionRef={comprasSectionRef}
              ganadorRef={ganadorRef}
              rankingRef={rankingRef}
              rifaSeleccionada={rifaSeleccionada}
              padLength={padLength}
              formatearFecha={formatearFecha}
              comprasFiltradasPorRifa={comprasFiltradasPorRifa}
              ticketsFiltradosPorRifa={ticketsFiltradosPorRifa}
              showSecondImage={showSecondImage}
              setSeccionActiva={setSeccionActiva}
              scrollToRef={scrollToRef}
              abrirFiltroDashboard={abrirFiltroDashboard}
              dashboardCompactSummary={dashboardCompactSummary}
              irADashboardTotal={irADashboardTotal}
              irAPendientes={irAPendientes}
              irAAprobadas={irAAprobadas}
              irARechazadas={irARechazadas}
              irAMapaTickets={irAMapaTickets}
              filtroDashboard={filtroDashboard}
              setFiltroDashboard={setFiltroDashboard}
              ticketsPorCompra={ticketsPorCompra}
              aprobarCompra={aprobarCompra}
              abrirAprobacionManual={abrirAprobacionManual}
              rechazarCompra={rechazarCompra}
              eliminarCompra={eliminarCompra}
              loadingAprobacion={loadingAprobacion}
              loadingRechazo={loadingRechazo}
              loadingEliminacion={loadingEliminacion}
              comprasPendientes={comprasPendientes}
              abrirAprobacionManualDesdeCuadricula={abrirAprobacionManualDesdeCuadricula}
            />
          )}

          {seccionActiva === "rifas" && (
            <AdminRifasSection
              rifas={rifas}
              recargarTodo={recargarTodo}
              setRifaSeleccionadaId={setRifaSeleccionadaId}
              setSeccionActiva={setSeccionActiva}
              setFiltroDashboard={setFiltroDashboard}
              topRef={topRef}
              scrollToRef={scrollToRef}
              formatearFecha={formatearFecha}
              rifaActiva={rifaActiva}
              loadingRifa={loadingRifa}
            />
          )}

          {seccionActiva === "ganador" && (
            <div id="admin-ganador-anchor">
              <AdminGanadorSection
                ganadorRef={ganadorRef}
                rifaSeleccionada={rifaSeleccionada}
                dashboardCompactSummary={dashboardCompactSummary}
                irADashboardTotal={irADashboardTotal}
                irAPendientes={irAPendientes}
                irAAprobadas={irAAprobadas}
                irARechazadas={irARechazadas}
                irAMapaTickets={irAMapaTickets}
                padLength={padLength}
                numeroGanador={numeroGanador}
                setNumeroGanador={setNumeroGanador}
                setResultadoGanador={setResultadoGanador}
                setMensajeBusqueda={setMensajeBusqueda}
                setEsNumeroGanador={setEsNumeroGanador}
                buscarGanador={buscarGanador}
                resultadoGanador={resultadoGanador}
                esNumeroGanador={esNumeroGanador}
                mensajeBusqueda={mensajeBusqueda}
                guardarGanadorOficial={guardarGanadorOficial}
                guardandoGanador={guardandoGanador}
                formatearFecha={formatearFecha}
              />
            </div>
          )}

          {seccionActiva === "ranking" && (
            <div id="admin-ranking-anchor">
              <AdminRankingSection
                rankingRef={rankingRef}
                rankingDetalleRef={rankingDetalleRef}
                rifaSeleccionada={rifaSeleccionada}
                dashboardCompactSummary={dashboardCompactSummary}
                irADashboardTotal={irADashboardTotal}
                irAPendientes={irAPendientes}
                irAAprobadas={irAAprobadas}
                irARechazadas={irARechazadas}
                irAMapaTickets={irAMapaTickets}
                resumenRanking={resumenRanking}
                irARankingDetallado={irARankingDetallado}
                abrirDetalleParticipante={abrirDetalleParticipante}
                rankingFiltradoYOrdenado={rankingFiltradoYOrdenado}
                busquedaRanking={busquedaRanking}
                setBusquedaRanking={setBusquedaRanking}
                ordenRanking={ordenRanking}
                setOrdenRanking={setOrdenRanking}
                itemsPorPaginaRanking={itemsPorPaginaRanking}
                setItemsPorPaginaRanking={setItemsPorPaginaRanking}
                setPaginaRanking={setPaginaRanking}
                exportarRankingCSV={exportarRankingCSV}
                ranking={ranking}
                rankingPaginado={rankingPaginado}
                paginaRanking={paginaRanking}
                totalPaginasRanking={totalPaginasRanking}
                resumenPaginacionRanking={resumenPaginacionRanking}
              />
            </div>
          )}

          {seccionActiva === "compras" && (
            <AdminComprasSection
              comprasSectionRef={comprasSectionRef}
              rifaSeleccionada={rifaSeleccionada}
              dashboardCompactSummary={dashboardCompactSummary}
              irADashboardTotal={irADashboardTotal}
              irAPendientes={irAPendientes}
              irAAprobadas={irAAprobadas}
              irARechazadas={irARechazadas}
              irAMapaTickets={irAMapaTickets}
              cantidadFiltrosActivos={cantidadFiltrosActivos}
              exportarComprasCSV={exportarComprasCSV}
              filtrosCompras={filtrosCompras}
              setFiltrosCompras={setFiltrosCompras}
              metodosPagoDisponibles={metodosPagoDisponibles}
              eliminarFiltroIndividual={eliminarFiltroIndividual}
              ordenCompras={ordenCompras}
              setOrdenCompras={setOrdenCompras}
              comprasVisibles={comprasVisibles}
              comprasFiltradasYOrdenadas={comprasFiltradasYOrdenadas}
              resumenPaginacionCompras={resumenPaginacionCompras}
              comprasPaginadas={comprasPaginadas}
              ticketsPorCompra={ticketsPorCompra}
              aprobarCompra={aprobarCompra}
              abrirAprobacionManual={abrirAprobacionManual}
              rechazarCompra={rechazarCompra}
              eliminarCompra={eliminarCompra}
              loadingAprobacion={loadingAprobacion}
              loadingRechazo={loadingRechazo}
              loadingEliminacion={loadingEliminacion}
              formatearFecha={formatearFecha}
              itemsPorPagina={itemsPorPagina}
              setItemsPorPagina={setItemsPorPagina}
              setPaginaCompras={setPaginaCompras}
              paginaCompras={paginaCompras}
              totalPaginasCompras={totalPaginasCompras}
            />
          )}
        </main>
      </div>

      <ManualApprovalModal
        open={modalManualOpen}
        onClose={() => {
          setModalManualOpen(false);
          setCompraManualSeleccionada(null);
          setTicketsManualSeleccionados([]);
          setPreselectedManualNumber(null);
        }}
        compra={compraManualSeleccionada}
        rifaSeleccionada={rifaSeleccionada}
        ticketsVendidos={ticketsFiltradosPorRifa}
        seleccionados={ticketsManualSeleccionados}
        setSeleccionados={setTicketsManualSeleccionados}
        onConfirmar={aprobarCompraManual}
        loading={loadingAprobacion === compraManualSeleccionada?.id}
        preselectedNumber={preselectedManualNumber}
        formatearFecha={formatearFecha}
      />

      {modalRankingOpen && participanteSeleccionado && (
        <div className="adminpro-modal-backdrop" onClick={() => setModalRankingOpen(false)}>
          <div
            className="adminpro-modal adminpro-ranking-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adminpro-section-head">
              <div>
                <h2>Detalle del participante</h2>
                <p>Resumen completo dentro de la rifa seleccionada</p>
              </div>

              <button
                type="button"
                className="adminpro-soft-btn dark"
                onClick={() => setModalRankingOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="adminpro-ranking-modal-user">
              <div className="adminpro-ranking-modal-avatar">
                {String(participanteSeleccionado.nombre || "?").charAt(0).toUpperCase()}
              </div>

              <div>
                <h3>{participanteSeleccionado.nombre}</h3>
                <p>{participanteSeleccionado.email || "Sin email"}</p>
                <p>{participanteSeleccionado.telefono || "Sin teléfono"}</p>
              </div>
            </div>

            <div className="adminpro-ranking-modal-kpis">
              <div className="adminpro-ranking-modal-kpi">
                <span>Tickets aprobados</span>
                <strong>{participanteSeleccionado.cantidad}</strong>
              </div>

              <div className="adminpro-ranking-modal-kpi">
                <span>Compras aprobadas</span>
                <strong>{participanteSeleccionado.compras}</strong>
              </div>

              <div className="adminpro-ranking-modal-kpi">
                <span>Monto total</span>
                <strong>${Number(participanteSeleccionado.montoTotal || 0).toFixed(2)}</strong>
              </div>

              <div className="adminpro-ranking-modal-kpi">
                <span>Participación</span>
                <strong>
                  {resumenRanking.totalTicketsAprobados > 0
                    ? (
                        (participanteSeleccionado.cantidad / resumenRanking.totalTicketsAprobados) *
                        100
                      ).toFixed(2)
                    : "0.00"}
                  %
                </strong>
              </div>
            </div>

            <div className="adminpro-ranking-modal-compras">
              <h4>Compras aprobadas del participante</h4>

              {participanteSeleccionado.comprasDetalle?.length ? (
                <div className="adminpro-ranking-modal-compras-list">
                  {participanteSeleccionado.comprasDetalle.map((compra) => (
                    <div key={compra.id} className="adminpro-ranking-modal-compra-item">
                      <div>
                        <strong>Compra #{compra.id}</strong>
                        <p>{formatearFecha(compra.fecha_compra || compra.created_at)}</p>
                      </div>

                      <div>
                        <strong>{compra.cantidad_tickets} tickets</strong>
                        <p>${Number(compra.monto_total ?? compra.total ?? 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No hay compras para mostrar.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}