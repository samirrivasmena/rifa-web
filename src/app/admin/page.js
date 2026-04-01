"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { supabase } from "../../lib/supabase";
import { getAdminAuthHeaders } from "../../lib/getAdminAuthHeaders";

import Sidebar from "../../components/admin/Sidebar";
import HeaderPanel from "../../components/admin/HeaderPanel";
import HeroRifa from "../../components/admin/HeroRifa";
import KpiGrid from "../../components/admin/KpiGrid";
import StatsGrid from "../../components/admin/StatsGrid";
import PurchaseCard from "../../components/admin/PurchaseCard";
import ManualApprovalModal from "../../components/admin/ManualApprovalModal";
import RaffleProgressPanel from "../../components/admin/RaffleProgressPanel";
import RifasSection from "../../components/admin/RifasSection";
import WinnerCard from "../../components/admin/WinnerCard";
import PurchaseFiltersPanel from "../../components/admin/PurchaseFiltersPanel";
import FilterChips from "../../components/admin/FilterChips";
import "./admin.css";

const ADMIN_EMAIL = "samirrivasmena@gmail.com";

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin fecha";
  try {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;

    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const anio = date.getFullYear();

    let horas = date.getHours();
    const minutos = String(date.getMinutes()).padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";
    horas = horas % 12 || 12;

    return `${dia}/${mes}/${anio} - ${String(horas).padStart(2, "0")}:${minutos} ${ampm}`;
  } catch {
    return fecha;
  }
};

function escaparCSV(valor) {
  const texto = String(valor ?? "");
  if (texto.includes('"') || texto.includes(",") || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export default function Admin() {
  const router = useRouter();
  const topRef = useRef(null);
  const dashboardFilterRef = useRef(null);
  const comprasSectionRef = useRef(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [accesoPermitido, setAccesoPermitido] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [showSecondImage, setShowSecondImage] = useState(false);

  const [compras, setCompras] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [rifas, setRifas] = useState([]);

  const [rifaSeleccionadaId, setRifaSeleccionadaId] = useState("");
  const [seccionActiva, setSeccionActiva] = useState("dashboard");
  const [filtroDashboard, setFiltroDashboard] = useState(null);
  const [ordenCompras, setOrdenCompras] = useState("fecha_desc");

  const [paginaCompras, setPaginaCompras] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(12);
  const [rifaActiva, setRifaActiva] = useState(null);
  const [loadingRifa, setLoadingRifa] = useState(true);

  const [filtrosCompras, setFiltrosCompras] = useState({
    busqueda: "",
    estado: "",
    metodoPago: "",
    fechaDesde: "",
    fechaHasta: "",
    minTickets: "",
    maxTickets: "",
    minMonto: "",
    maxMonto: "",
    conComprobante: "",
  });

  const [loadingAprobacion, setLoadingAprobacion] = useState(null);
  const [loadingRechazo, setLoadingRechazo] = useState(null);
  const [loadingEliminacion, setLoadingEliminacion] = useState(null);

  const [modalManualOpen, setModalManualOpen] = useState(false);
  const [compraManualSeleccionada, setCompraManualSeleccionada] = useState(null);
  const [ticketsManualSeleccionados, setTicketsManualSeleccionados] = useState([]);
  const [preselectedManualNumber, setPreselectedManualNumber] = useState(null);

  const [numeroGanador, setNumeroGanador] = useState("");
  const [resultadoGanador, setResultadoGanador] = useState(null);
  const [mensajeBusqueda, setMensajeBusqueda] = useState("");
  const [esNumeroGanador, setEsNumeroGanador] = useState(false);
  const [guardandoGanador, setGuardandoGanador] = useState(false);

  const [busquedaRanking, setBusquedaRanking] = useState("");
  const [ordenRanking, setOrdenRanking] = useState("tickets_desc");
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState(null);
  const [modalRankingOpen, setModalRankingOpen] = useState(false);
  const [paginaRanking, setPaginaRanking] = useState(1);
  const [itemsPorPaginaRanking, setItemsPorPaginaRanking] = useState(8);

  const abrirDetalleParticipante = (persona) => {
    if (!persona) return;
    setParticipanteSeleccionado(persona);
    setModalRankingOpen(true);
  };

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

        const activa = rifasConStats.find((r) => r.estado === "activa");
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
    const verificarAcceso = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace("/admin-login");
          return;
        }

        const email = user.email?.toLowerCase();

        if (email !== ADMIN_EMAIL.toLowerCase()) {
          await supabase.auth.signOut();

          await Swal.fire({
            icon: "error",
            title: "Acceso denegado",
            text: "No tienes permiso para entrar al panel de administración",
          });

          router.replace("/admin-login");
          return;
        }

        setAdminEmail(user.email || "");
        setAccesoPermitido(true);
      } catch (error) {
        console.error("Error verificando acceso:", error);
        router.replace("/admin-login");
      } finally {
        setAuthLoading(false);
      }
    };

    verificarAcceso();
  }, [router]);

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

  return () => {
    window.removeEventListener("scroll", handleScroll);
  };
}, []);

  useEffect(() => {
    setFiltroDashboard(null);
    setFiltrosCompras({
      busqueda: "",
      estado: "",
      metodoPago: "",
      fechaDesde: "",
      fechaHasta: "",
      minTickets: "",
      maxTickets: "",
      minMonto: "",
      maxMonto: "",
      conComprobante: "",
    });
    setOrdenCompras("fecha_desc");
    setModalManualOpen(false);
    setCompraManualSeleccionada(null);
    setTicketsManualSeleccionados([]);
    setPreselectedManualNumber(null);
    setNumeroGanador("");
    setResultadoGanador(null);
    setMensajeBusqueda("");
    setEsNumeroGanador(false);
    setBusquedaRanking("");
    setOrdenRanking("tickets_desc");
    setPaginaCompras(1);
    setPaginaRanking(1);
    setParticipanteSeleccionado(null);
    setModalRankingOpen(false);
  }, [rifaSeleccionadaId]);

  useEffect(() => {
    setPaginaCompras(1);
  }, [filtrosCompras, ordenCompras, itemsPorPagina]);

  useEffect(() => {
    setPaginaRanking(1);
  }, [busquedaRanking, ordenRanking, itemsPorPaginaRanking]);

  useEffect(() => {
    if (!modalRankingOpen) {
      setParticipanteSeleccionado(null);
    }
  }, [modalRankingOpen]);

  const cerrarSesion = async () => {
    const confirmar = await Swal.fire({
      title: "¿Cerrar sesión?",
      text: "Se cerrará tu sesión de administrador",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7f1d1d",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    await supabase.auth.signOut();
    router.replace("/admin-login");
  };

  const rifaSeleccionada = useMemo(() => {
    return rifas.find((r) => String(r.id) === String(rifaSeleccionadaId)) || null;
  }, [rifas, rifaSeleccionadaId]);

  const padLength = rifaSeleccionada?.formato === "3digitos" ? 3 : 4;

  const comprasFiltradasPorRifa = useMemo(() => {
    if (!rifaSeleccionadaId) return compras;
    return compras.filter((compra) => String(compra.rifa_id) === String(rifaSeleccionadaId));
  }, [compras, rifaSeleccionadaId]);

  const ticketsFiltradosPorRifa = useMemo(() => {
    if (!rifaSeleccionadaId) return tickets;
    return tickets.filter((ticket) => String(ticket.rifa_id) === String(rifaSeleccionadaId));
  }, [tickets, rifaSeleccionadaId]);

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

  const comprasVisibles = useMemo(
    () => comprasFiltradasPorRifa.filter((c) => c.estado_pago !== "rechazado"),
    [comprasFiltradasPorRifa]
  );

  const metodosPagoDisponibles = useMemo(() => {
    const unicos = Array.from(
      new Set(
        comprasFiltradasPorRifa
          .map((c) => String(c.metodo_pago || "").trim())
          .filter(Boolean)
      )
    );

    return unicos.sort((a, b) => a.localeCompare(b));
  }, [comprasFiltradasPorRifa]);

  const comprasFiltradasAvanzadas = useMemo(() => {
    return comprasVisibles.filter((compra) => {
      const termino = filtrosCompras.busqueda.trim().toLowerCase();

      const id = String(compra.id || "").toLowerCase();
      const nombre = String(compra.usuarios?.nombre || "").toLowerCase();
      const email = String(compra.usuarios?.email || "").toLowerCase();
      const telefono = String(compra.usuarios?.telefono || "").toLowerCase();
      const referencia = String(compra.referencia || "").toLowerCase();
      const metodo = String(compra.metodo_pago || "").toLowerCase();
      const estado = String(compra.estado_pago || "").toLowerCase();

      const coincideBusqueda =
        !termino ||
        id.includes(termino) ||
        nombre.includes(termino) ||
        email.includes(termino) ||
        telefono.includes(termino) ||
        referencia.includes(termino) ||
        metodo.includes(termino) ||
        estado.includes(termino);

      const coincideEstado =
        !filtrosCompras.estado || compra.estado_pago === filtrosCompras.estado;

      const coincideMetodo =
        !filtrosCompras.metodoPago || compra.metodo_pago === filtrosCompras.metodoPago;

      const fechaCompra = new Date(compra.fecha_compra || compra.created_at || 0);

      const coincideFechaDesde =
        !filtrosCompras.fechaDesde ||
        (fechaCompra && fechaCompra >= new Date(`${filtrosCompras.fechaDesde}T00:00:00`));

      const coincideFechaHasta =
        !filtrosCompras.fechaHasta ||
        (fechaCompra && fechaCompra <= new Date(`${filtrosCompras.fechaHasta}T23:59:59`));

      const cantidadTickets = Number(compra.cantidad_tickets || 0);

      const coincideMinTickets =
        !filtrosCompras.minTickets ||
        cantidadTickets >= Number(filtrosCompras.minTickets);

      const coincideMaxTickets =
        !filtrosCompras.maxTickets ||
        cantidadTickets <= Number(filtrosCompras.maxTickets);

      const total = Number(compra.total ?? compra.monto_total ?? 0);

      const coincideMinMonto =
        !filtrosCompras.minMonto || total >= Number(filtrosCompras.minMonto);

      const coincideMaxMonto =
        !filtrosCompras.maxMonto || total <= Number(filtrosCompras.maxMonto);

      const tieneComprobante =
        Boolean(compra.comprobante_url) ||
        Boolean(compra.comprobante) ||
        Boolean(compra.capture_url) ||
        Boolean(compra.soporte_pago);

      const coincideComprobante =
        !filtrosCompras.conComprobante ||
        (filtrosCompras.conComprobante === "si" ? tieneComprobante : !tieneComprobante);

      return (
        coincideBusqueda &&
        coincideEstado &&
        coincideMetodo &&
        coincideFechaDesde &&
        coincideFechaHasta &&
        coincideMinTickets &&
        coincideMaxTickets &&
        coincideMinMonto &&
        coincideMaxMonto &&
        coincideComprobante
      );
    });
  }, [comprasVisibles, filtrosCompras]);

  const comprasFiltradasYOrdenadas = useMemo(() => {
    const lista = [...comprasFiltradasAvanzadas];

    lista.sort((a, b) => {
      const fechaA = new Date(a.fecha_compra || a.created_at || 0).getTime();
      const fechaB = new Date(b.fecha_compra || b.created_at || 0).getTime();

      const montoA = Number(a.monto_total ?? a.total ?? 0);
      const montoB = Number(b.monto_total ?? b.total ?? 0);

      const ticketsA = Number(a.cantidad_tickets || 0);
      const ticketsB = Number(b.cantidad_tickets || 0);

      const nombreA = String(
        a.usuarios?.nombre || a.usuarios?.email || a.usuario_id || ""
      ).toLowerCase();

      const nombreB = String(
        b.usuarios?.nombre || b.usuarios?.email || b.usuario_id || ""
      ).toLowerCase();

      switch (ordenCompras) {
        case "fecha_asc":
          return fechaA - fechaB;
        case "fecha_desc":
          return fechaB - fechaA;
        case "monto_asc":
          return montoA - montoB;
        case "monto_desc":
          return montoB - montoA;
        case "tickets_asc":
          return ticketsA - ticketsB;
        case "tickets_desc":
          return ticketsB - ticketsA;
        case "nombre_asc":
          return nombreA.localeCompare(nombreB);
        case "nombre_desc":
          return nombreB.localeCompare(nombreA);
        default:
          return fechaB - fechaA;
      }
    });

    return lista;
  }, [comprasFiltradasAvanzadas, ordenCompras]);

  const totalPaginasCompras = useMemo(() => {
    return Math.max(Math.ceil(comprasFiltradasYOrdenadas.length / itemsPorPagina), 1);
  }, [comprasFiltradasYOrdenadas.length, itemsPorPagina]);

  const comprasPaginadas = useMemo(() => {
    const inicio = (paginaCompras - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return comprasFiltradasYOrdenadas.slice(inicio, fin);
  }, [comprasFiltradasYOrdenadas, paginaCompras, itemsPorPagina]);

  const resumenPaginacionCompras = useMemo(() => {
    if (!comprasFiltradasYOrdenadas.length) {
      return { desde: 0, hasta: 0, total: 0 };
    }

    const desde = (paginaCompras - 1) * itemsPorPagina + 1;
    const hasta = Math.min(paginaCompras * itemsPorPagina, comprasFiltradasYOrdenadas.length);

    return {
      desde,
      hasta,
      total: comprasFiltradasYOrdenadas.length,
    };
  }, [comprasFiltradasYOrdenadas.length, paginaCompras, itemsPorPagina]);

  const cantidadFiltrosActivos = useMemo(() => {
    return Object.values(filtrosCompras).filter(
      (value) => String(value).trim() !== ""
    ).length;
  }, [filtrosCompras]);

  const rankingBase = useMemo(() => {
    const acumulado = {};

    comprasFiltradasPorRifa
      .filter((compra) => compra.estado_pago === "aprobado")
      .forEach((compra) => {
        const nombre =
          compra.usuarios?.nombre ||
          compra.usuarios?.email ||
          compra.usuario_id ||
          "Sin nombre";

        const email = compra.usuarios?.email || "";
        const telefono = compra.usuarios?.telefono || "";

        if (!acumulado[nombre]) {
          acumulado[nombre] = {
            nombre,
            email,
            telefono,
            cantidad: 0,
            compras: 0,
            montoTotal: 0,
            comprasDetalle: [],
          };
        }

        acumulado[nombre].cantidad += Number(compra.cantidad_tickets || 0);
        acumulado[nombre].compras += 1;
        acumulado[nombre].montoTotal += Number(compra.monto_total ?? compra.total ?? 0);
        acumulado[nombre].comprasDetalle.push(compra);
      });

    return Object.values(acumulado);
  }, [comprasFiltradasPorRifa]);

  const rankingFiltradoYOrdenado = useMemo(() => {
    const termino = busquedaRanking.trim().toLowerCase();
    let lista = [...rankingBase];

    if (termino) {
      lista = lista.filter((persona) => {
        return (
          String(persona.nombre || "").toLowerCase().includes(termino) ||
          String(persona.email || "").toLowerCase().includes(termino) ||
          String(persona.telefono || "").toLowerCase().includes(termino)
        );
      });
    }

    lista.sort((a, b) => {
      switch (ordenRanking) {
        case "tickets_asc":
          return a.cantidad - b.cantidad;
        case "tickets_desc":
          return b.cantidad - a.cantidad;
        case "nombre_asc":
          return a.nombre.localeCompare(b.nombre);
        case "nombre_desc":
          return b.nombre.localeCompare(a.nombre);
        case "compras_desc":
          return b.compras - a.compras;
        case "compras_asc":
          return a.compras - b.compras;
        case "monto_desc":
          return b.montoTotal - a.montoTotal;
        case "monto_asc":
          return a.montoTotal - b.montoTotal;
        default:
          return b.cantidad - a.cantidad;
      }
    });

    return lista;
  }, [rankingBase, busquedaRanking, ordenRanking]);

  const totalPaginasRanking = useMemo(() => {
    return Math.max(
      Math.ceil(rankingFiltradoYOrdenado.length / itemsPorPaginaRanking),
      1
    );
  }, [rankingFiltradoYOrdenado.length, itemsPorPaginaRanking]);

  const rankingPaginado = useMemo(() => {
    const inicio = (paginaRanking - 1) * itemsPorPaginaRanking;
    const fin = inicio + itemsPorPaginaRanking;
    return rankingFiltradoYOrdenado.slice(inicio, fin);
  }, [rankingFiltradoYOrdenado, paginaRanking, itemsPorPaginaRanking]);

  const resumenPaginacionRanking = useMemo(() => {
    if (!rankingFiltradoYOrdenado.length) {
      return { desde: 0, hasta: 0, total: 0 };
    }

    const desde = (paginaRanking - 1) * itemsPorPaginaRanking + 1;
    const hasta = Math.min(
      paginaRanking * itemsPorPaginaRanking,
      rankingFiltradoYOrdenado.length
    );

    return {
      desde,
      hasta,
      total: rankingFiltradoYOrdenado.length,
    };
  }, [rankingFiltradoYOrdenado.length, paginaRanking, itemsPorPaginaRanking]);

  const ranking = useMemo(() => {
    return rankingFiltradoYOrdenado.slice(0, 10);
  }, [rankingFiltradoYOrdenado]);

  const resumenRanking = useMemo(() => {
    const totalTicketsAprobados = rankingBase.reduce(
      (acc, persona) => acc + Number(persona.cantidad || 0),
      0
    );

    const totalParticipantes = rankingBase.length;
    const topParticipante = rankingFiltradoYOrdenado[0] || null;
    const segundoParticipante = rankingFiltradoYOrdenado[1] || null;

    const promedioTicketsPorParticipante =
      totalParticipantes > 0
        ? (totalTicketsAprobados / totalParticipantes).toFixed(2)
        : "0.00";

    const porcentajeLider =
      topParticipante && totalTicketsAprobados > 0
        ? ((topParticipante.cantidad / totalTicketsAprobados) * 100).toFixed(2)
        : "0.00";

    const diferenciaTop2 =
      topParticipante && segundoParticipante
        ? topParticipante.cantidad - segundoParticipante.cantidad
        : topParticipante
        ? topParticipante.cantidad
        : 0;

    return {
      totalTicketsAprobados,
      totalParticipantes,
      topParticipante,
      segundoParticipante,
      promedioTicketsPorParticipante,
      porcentajeLider,
      diferenciaTop2,
    };
  }, [rankingBase, rankingFiltradoYOrdenado]);

  const abrirFiltroDashboard = (key) => {
    setSeccionActiva("dashboard");
    setFiltroDashboard(key);

    setTimeout(() => {
      dashboardFilterRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 180);
  };

  const eliminarFiltroIndividual = (campo) => {
    setFiltrosCompras((prev) => ({
      ...prev,
      [campo]: "",
    }));
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

    const contenidoCSV = [encabezados.map(escaparCSV).join(","), ...filas.map((f) => f.join(","))].join("\n");

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
        headers: await getAdminAuthHeaders(),
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
        headers: await getAdminAuthHeaders(),
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
      setTimeout(() => {
        comprasSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 180);
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
        headers: await getAdminAuthHeaders(),
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
        headers: await getAdminAuthHeaders(),
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

  const buscarGanador = async () => {
    setResultadoGanador(null);
    setMensajeBusqueda("");
    setEsNumeroGanador(false);

    if (!rifaSeleccionada?.id) {
      setMensajeBusqueda("⚠️ Debes seleccionar una rifa");
      return;
    }

    const limpio = numeroGanador.replace(/\D/g, "").slice(0, padLength);

    if (!limpio) {
      setMensajeBusqueda("⚠️ Debes ingresar un número válido");
      return;
    }

    const numero = Number(limpio);

    if (Number.isNaN(numero)) {
      setMensajeBusqueda("⚠️ Debes ingresar un número válido");
      return;
    }

    try {
      const res = await fetch("/api/verificar-ganador", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
        body: JSON.stringify({
          rifaId: rifaSeleccionada.id,
          numero,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error verificar ganador:", data.error);
        setMensajeBusqueda("❌ Error al buscar el número");
        return;
      }

      setResultadoGanador({
        existe: data.existe,
        numero_ticket: data.numero_ticket,
        compra_id: data.compra_id,
        usuario: data.usuario,
        sorteo: data.sorteo,
      });

      setEsNumeroGanador(Boolean(data.esGanador));

      if (!data.existe) {
        setMensajeBusqueda(
          `❌ El número ${String(numero).padStart(padLength, "0")} no fue vendido en esta rifa`
        );
        return;
      }

      if (data.esGanador) {
        setMensajeBusqueda(
          `🏆 El número ${String(numero).padStart(padLength, "0")} es el ganador oficial de esta rifa`
        );
      } else {
        setMensajeBusqueda(
          `✅ El número ${String(numero).padStart(padLength, "0")} sí fue vendido en esta rifa`
        );
      }
    } catch (error) {
      console.error("Error buscando ganador:", error);
      setMensajeBusqueda("❌ Error inesperado al buscar el número");
    }
  };

  const guardarGanadorOficial = async () => {
    if (!rifaSeleccionada?.id) {
      await Swal.fire({
        icon: "error",
        title: "No permitido",
        text: "Debes seleccionar una rifa válida",
      });
      return;
    }

    if (!resultadoGanador?.existe) {
      await Swal.fire({
        icon: "error",
        title: "No permitido",
        text: "Ese número no fue vendido, no se puede registrar como ganador",
      });
      return;
    }

    const confirmar = await Swal.fire({
      title: "¿Registrar ganador oficial?",
      text: `Se registrará el número ${String(resultadoGanador.numero_ticket).padStart(
        padLength,
        "0"
      )} como ganador oficial de esta rifa.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, registrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1d4ed8",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    try {
      setGuardandoGanador(true);

      const res = await fetch("/api/guardar-ganador", {
        method: "POST",
        headers: await getAdminAuthHeaders(),
        body: JSON.stringify({
          numero_ticket: resultadoGanador.numero_ticket,
          rifaId: rifaSeleccionada.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Error al registrar el ganador oficial",
        });
        return;
      }

      await recargarTodo();
      await buscarGanador();

      await Swal.fire({
        icon: "success",
        title: "Ganador registrado",
        text: `El número ${String(resultadoGanador.numero_ticket).padStart(
          padLength,
          "0"
        )} fue registrado como ganador oficial`,
      });
    } catch (error) {
      console.error(error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al registrar el ganador oficial",
      });
    } finally {
      setGuardandoGanador(false);
    }
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
            setSeccionActiva(id);
            setFiltroDashboard(null);
            setTimeout(() => {
              topRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 80);
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

          {rifaSeleccionada && (
            <>
<HeroRifa
  rifaSeleccionada={rifaSeleccionada}
  padLength={padLength}
  formatearFecha={formatearFecha}
  totalCompras={comprasFiltradasPorRifa.length}
  totalTicketsVendidos={ticketsFiltradosPorRifa.length}
  totalComprasAprobadas={
    comprasFiltradasPorRifa.filter((c) => c.estado_pago === "aprobado").length
  }
  showSecondImage={showSecondImage}
  onIrCompras={() => {
    setSeccionActiva("compras");
    setTimeout(() => {
      comprasSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 180);
  }}
  onIrGanador={() => {
    setSeccionActiva("ganador");
    setTimeout(() => {
      topRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }}
  onIrRanking={() => {
    setSeccionActiva("ranking");
    setTimeout(() => {
      topRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }}
/>


              <KpiGrid
                compras={comprasFiltradasPorRifa}
                tickets={ticketsFiltradosPorRifa}
                onCardClick={abrirFiltroDashboard}
              />
            </>
          )}

          {seccionActiva === "dashboard" && (
            <div className="adminpro-page-stack">
              <div className="adminpro-card">
                <div className="adminpro-section-head">
                  <div>
                    <h2>Resumen del dashboard</h2>
                    <p>Haz clic en una tarjeta para ver el detalle filtrado</p>
                  </div>
                </div>

                <StatsGrid
                  compras={comprasFiltradasPorRifa}
                  tickets={ticketsFiltradosPorRifa}
                  onFilterClick={setFiltroDashboard}
                  scrollTargetRef={dashboardFilterRef}
                />
              </div>

              <div ref={dashboardFilterRef}>
                {filtroDashboard && (
                  <div className="adminpro-card">
                    <div className="adminpro-section-head">
                      <div>
                        <h2>
                          {{
                            total: "Todas las compras de la rifa",
                            pendientes: "Compras pendientes de la rifa",
                            aprobadas: "Compras aprobadas de la rifa",
                            rechazadas: "Compras rechazadas de la rifa",
                            tickets: "Tickets vendidos de la rifa",
                          }[filtroDashboard]}
                        </h2>
                        <p>Detalle filtrado de la rifa seleccionada</p>
                      </div>

                      <button
                        className="adminpro-soft-btn dark"
                        onClick={() => setFiltroDashboard(null)}
                        type="button"
                      >
                        Cerrar
                      </button>
                    </div>

                    {filtroDashboard !== "tickets" ? (
                      {
                        total: comprasFiltradasPorRifa,
                        pendientes: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "pendiente"),
                        aprobadas: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "aprobado"),
                        rechazadas: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "rechazado"),
                      }[filtroDashboard]?.length > 0 ? (
                        <div className="adminpro-compras-grid">
                          {{
                            total: comprasFiltradasPorRifa,
                            pendientes: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "pendiente"),
                            aprobadas: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "aprobado"),
                            rechazadas: comprasFiltradasPorRifa.filter((c) => c.estado_pago === "rechazado"),
                          }[filtroDashboard].map((compra) => (
                            <PurchaseCard
                              key={compra.id}
                              compra={compra}
                              ticketsAsignados={ticketsPorCompra[String(compra.id)] || []}
                              onAprobar={aprobarCompra}
                              onAprobarManual={abrirAprobacionManual}
                              onRechazar={rechazarCompra}
                              onEliminar={eliminarCompra}
                              loadingAprobacion={loadingAprobacion}
                              loadingRechazo={loadingRechazo}
                              loadingEliminacion={loadingEliminacion}
                              mostrarEliminar={filtroDashboard === "rechazadas"}
                              formatearFecha={formatearFecha}
                            />
                          ))}
                        </div>
                      ) : (
                        <p>No hay registros para mostrar.</p>
                      )
                    ) : ticketsFiltradosPorRifa.length > 0 ? (
                      <div className="adminpro-compras-grid">
                        {ticketsFiltradosPorRifa.map((ticket) => (
                          <div key={ticket.id} className="adminpro-purchase-card">
                            <div className="adminpro-purchase-head">
                              <div>
                                <h3>Ticket #{ticket.id}</h3>
                                <p>Registrado en la rifa actual</p>
                              </div>
                            </div>
                            <div className="adminpro-purchase-body">
                              <p><strong>Número:</strong> {String(ticket.numero_ticket).padStart(padLength, "0")}</p>
                              <p><strong>Compra ID:</strong> {ticket.compra_id}</p>
                              <p><strong>Rifa ID:</strong> {ticket.rifa_id}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No hay tickets vendidos todavía.</p>
                    )}
                  </div>
                )}
              </div>

<RaffleProgressPanel
  tickets={ticketsFiltradosPorRifa}
  compras={comprasFiltradasPorRifa}
  rifaSeleccionada={rifaSeleccionada}
  tieneComprasPendientes={comprasPendientes.length > 0}
  onOpenManualFromGrid={abrirAprobacionManualDesdeCuadricula}
  onOpenCompra={(compraId) => {
    setSeccionActiva("compras");

    setTimeout(() => {
      comprasSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 180);
  }}
/>
            </div>
          )}

          {seccionActiva === "rifas" && (
            <div className="adminpro-page-stack">
              <RifasSection
                rifas={rifas}
                onRecargarRifas={recargarTodo}
                onSeleccionarRifa={(rifaId) => {
                  setRifaSeleccionadaId(rifaId);
                  setSeccionActiva("dashboard");
                  setFiltroDashboard(null);

                  setTimeout(() => {
                    topRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 120);
                }}
                formatearFecha={formatearFecha}
              />
            </div>
          )}

          {seccionActiva === "ganador" && (
            <div className="adminpro-page-stack">
              <div className="adminpro-card">
                <div className="adminpro-section-head">
                  <div>
                    <h2>Validar número por rifa</h2>
                    <p>Consulta si un número fue vendido y regístralo como ganador oficial</p>
                  </div>
                </div>

                <div className="adminpro-search-row">
                  <div className="adminpro-search-input">
                    <input
                      type="text"
                      placeholder={padLength === 3 ? "001 - 999" : "0001 - 9999"}
                      value={numeroGanador}
                      maxLength={padLength}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, padLength);
                        setNumeroGanador(value);
                        setResultadoGanador(null);
                        setMensajeBusqueda("");
                        setEsNumeroGanador(false);
                      }}
                    />
                  </div>

                  <button className="adminpro-primary-btn" onClick={buscarGanador} type="button">
                    Buscar
                  </button>
                </div>

                <WinnerCard
                  resultado={resultadoGanador}
                  esGanador={esNumeroGanador}
                  mensaje={mensajeBusqueda}
                  onGuardar={guardarGanadorOficial}
                  guardando={guardandoGanador}
                  padLength={padLength}
                  formatearFecha={formatearFecha}
                />
              </div>
            </div>
          )}

          {seccionActiva === "ranking" && (
            <div className="adminpro-page-stack">
<div className="adminpro-ranking-kpis">
  <button
    type="button"
    className="adminpro-ranking-kpi adminpro-ranking-kpi-purple clickable"
    onClick={() => {
      if (rankingFiltradoYOrdenado.length > 0) {
        abrirDetalleParticipante(rankingFiltradoYOrdenado[0]);
      }
    }}
  >
    <span className="adminpro-ranking-kpi-arrow">↗</span>
    <span>Participantes en ranking</span>
    <strong>{resumenRanking.totalParticipantes}</strong>
  </button>

  <button
    type="button"
    className="adminpro-ranking-kpi adminpro-ranking-kpi-green clickable"
    onClick={() => {
      if (rankingFiltradoYOrdenado.length > 0) {
        abrirDetalleParticipante(rankingFiltradoYOrdenado[0]);
      }
    }}
  >
    <span className="adminpro-ranking-kpi-arrow">↗</span>
    <span>Tickets aprobados</span>
    <strong>{resumenRanking.totalTicketsAprobados}</strong>
  </button>

  <button
    type="button"
    className="adminpro-ranking-kpi adminpro-ranking-kpi-orange clickable"
    onClick={() =>
      resumenRanking.topParticipante &&
      abrirDetalleParticipante(resumenRanking.topParticipante)
    }
  >
    <span className="adminpro-ranking-kpi-arrow">↗</span>
    <span>Líder actual</span>
    <strong title={resumenRanking.topParticipante?.nombre || "Sin datos"}>
      {resumenRanking.topParticipante?.nombre || "Sin datos"}
    </strong>
  </button>

  <button
    type="button"
    className="adminpro-ranking-kpi adminpro-ranking-kpi-indigo clickable"
    onClick={() => {
      if (rankingFiltradoYOrdenado.length > 0) {
        abrirDetalleParticipante(rankingFiltradoYOrdenado[0]);
      }
    }}
  >
    <span className="adminpro-ranking-kpi-arrow">↗</span>
    <span>Promedio por participante</span>
    <strong>{resumenRanking.promedioTicketsPorParticipante}</strong>
  </button>

  <button
    type="button"
    className="adminpro-ranking-kpi adminpro-ranking-kpi-red clickable"
    onClick={() =>
      resumenRanking.topParticipante &&
      abrirDetalleParticipante(resumenRanking.topParticipante)
    }
  >
    <span className="adminpro-ranking-kpi-arrow">↗</span>
    <span>% del líder</span>
    <strong>{resumenRanking.porcentajeLider}%</strong>
  </button>

  <button
    type="button"
    className="adminpro-ranking-kpi adminpro-ranking-kpi-slate clickable"
    onClick={() => {
      if (rankingFiltradoYOrdenado.length > 1) {
        abrirDetalleParticipante(rankingFiltradoYOrdenado[1]);
      } else if (rankingFiltradoYOrdenado.length > 0) {
        abrirDetalleParticipante(rankingFiltradoYOrdenado[0]);
      }
    }}
  >
    <span className="adminpro-ranking-kpi-arrow">↗</span>
    <span>Diferencia Top 1 vs Top 2</span>
    <strong>{resumenRanking.diferenciaTop2}</strong>
  </button>
</div>

              <div className="adminpro-card adminpro-ranking-panel">
                <div className="adminpro-section-head">
                  <div>
                    <h2>Filtro y control del ranking</h2>
                    <p>Busca participantes, cambia el orden y exporta resultados</p>
                  </div>

                  <button
                    type="button"
                    className="adminpro-soft-btn blue"
                    onClick={exportarRankingCSV}
                  >
                    Exportar ranking CSV
                  </button>
                </div>

                <div className="adminpro-ranking-toolbar">
                  <div className="adminpro-ranking-field">
                    <label>Buscar participante</label>
                    <input
                      type="text"
                      className="adminpro-input"
                      placeholder="Nombre, email o teléfono"
                      value={busquedaRanking}
                      onChange={(e) => setBusquedaRanking(e.target.value)}
                    />
                  </div>

                  <div className="adminpro-ranking-field">
                    <label>Ordenar ranking</label>
                    <select
                      className="adminpro-input"
                      value={ordenRanking}
                      onChange={(e) => setOrdenRanking(e.target.value)}
                    >
                      <option value="tickets_desc">Más tickets</option>
                      <option value="tickets_asc">Menos tickets</option>
                      <option value="compras_desc">Más compras</option>
                      <option value="compras_asc">Menos compras</option>
                      <option value="monto_desc">Mayor monto</option>
                      <option value="monto_asc">Menor monto</option>
                      <option value="nombre_asc">Nombre A-Z</option>
                      <option value="nombre_desc">Nombre Z-A</option>
                    </select>
                  </div>

                  <div className="adminpro-ranking-field">
                    <label>Items por página</label>
                    <select
                      className="adminpro-input"
                      value={itemsPorPaginaRanking}
                      onChange={(e) => {
                        setItemsPorPaginaRanking(Number(e.target.value));
                        setPaginaRanking(1);
                      }}
                    >
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="adminpro-card adminpro-ranking-panel">
                <div className="adminpro-section-head">
                  <div>
                    <h2>Participantes con más tickets aprobados</h2>
                    <p>Top 10 de la rifa seleccionada</p>
                  </div>
                </div>

                {ranking.length === 0 ? (
                  <p>No hay datos todavía.</p>
                ) : (
                  <div className="adminpro-ranking-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={ranking}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis
                          type="category"
                          dataKey="nombre"
                          width={180}
                          tick={{ fontSize: 13, fill: "#cbd5e1" }}
                          stroke="#94a3b8"
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid rgba(148,163,184,0.18)",
                            borderRadius: "14px",
                            color: "#fff",
                          }}
                          formatter={(value) => [value, "Tickets"]}
                          labelFormatter={(label) => `Participante: ${label}`}
                        />
                        <Bar
                          dataKey="cantidad"
                          fill="#6366f1"
                          radius={[0, 8, 8, 0]}
                          onClick={(data) => abrirDetalleParticipante(data)}
                          style={{ cursor: "pointer" }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

<div className="adminpro-card adminpro-ranking-panel">
  <div className="adminpro-section-head">
    <div>
      <h2>Top 3 destacados</h2>
      <p>Participantes con mejor desempeño</p>
    </div>
  </div>

  {rankingFiltradoYOrdenado.length === 0 ? (
    <p>No hay datos todavía.</p>
  ) : (
    <div className="adminpro-ranking-top3-premium">
      {rankingFiltradoYOrdenado.slice(0, 3).map((persona, index) => {
        const porcentaje =
          resumenRanking.totalTicketsAprobados > 0
            ? ((persona.cantidad / resumenRanking.totalTicketsAprobados) * 100).toFixed(2)
            : "0.00";

        return (
          <button
            type="button"
            key={`${persona.nombre}-${index}`}
            className={`adminpro-ranking-top3-premium-card pos-${index + 1}`}
            onClick={() => abrirDetalleParticipante(persona)}
          >
            <span className="adminpro-ranking-top3-arrow">↗</span>

            <div className="adminpro-ranking-top3-head">
              <div className="adminpro-ranking-top3-badge">#{index + 1}</div>
              <div className="adminpro-ranking-top3-avatar">
                {String(persona.nombre || "?").charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="adminpro-ranking-top3-content">
              <h3 title={persona.nombre}>{persona.nombre}</h3>
              <strong>{persona.cantidad} tickets aprobados</strong>
              <p>{porcentaje}% del total aprobado</p>

              <div className="adminpro-ranking-top3-meta">
                <span>{persona.compras} compras</span>
                <span>${Number(persona.montoTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  )}
</div>

              <div className="adminpro-card adminpro-ranking-panel">
                <div className="adminpro-section-head">
                  <div>
                    <h2>Ranking detallado</h2>
                    <p>
                      Mostrando {resumenPaginacionRanking.desde} a {resumenPaginacionRanking.hasta} de{" "}
                      {resumenPaginacionRanking.total} participante
                      {resumenPaginacionRanking.total !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {rankingPaginado.length === 0 ? (
                  <p>No hay datos todavía.</p>
                ) : (
                  <>
                    <div className="adminpro-ranking-header-v3">
                      <span>Posición</span>
                      <span>Participante</span>
                      <span>Participación</span>
                      <span>Resumen</span>
                    </div>

                    <div className="adminpro-ranking-list-v3">
                      {rankingPaginado.map((persona, index) => {
                        const posicionReal = (paginaRanking - 1) * itemsPorPaginaRanking + index + 1;
                        const porcentajeNumerico =
                          resumenRanking.totalTicketsAprobados > 0
                            ? (persona.cantidad / resumenRanking.totalTicketsAprobados) * 100
                            : 0;

                        const porcentaje = porcentajeNumerico.toFixed(2);

                        return (
                          <button
                            type="button"
                            key={`${persona.nombre}-${index}`}
                            className="adminpro-ranking-row-v3 clickable"
                            onClick={() => abrirDetalleParticipante(persona)}
                          >
                            <div className="adminpro-ranking-rank-v3">#{posicionReal}</div>

                            <div className="adminpro-ranking-user-v3">
                              <div className="adminpro-ranking-avatar-v3">
                                {String(persona.nombre || "?").charAt(0).toUpperCase()}
                              </div>

                              <div className="adminpro-ranking-user-info-v3">
                                <strong title={persona.nombre}>{persona.nombre}</strong>
                                {persona.email ? <small>{persona.email}</small> : null}
                              </div>
                            </div>

                            <div className="adminpro-ranking-progress-v3">
                              <div className="adminpro-ranking-progress-top-v3">
                                <span>Participación</span>
                                <strong>{porcentaje}%</strong>
                              </div>

                              <div className="adminpro-ranking-progress-bar-v3">
                                <div
                                  className="adminpro-ranking-progress-fill-v3"
                                  style={{ width: `${Math.min(porcentajeNumerico, 100)}%` }}
                                />
                              </div>
                            </div>

                            <div className="adminpro-ranking-metrics-v3">
                              <div className="adminpro-ranking-metric-v3">
                                <span>Tickets</span>
                                <strong>{persona.cantidad}</strong>
                              </div>

                              <div className="adminpro-ranking-metric-v3">
                                <span>Compras</span>
                                <strong>{persona.compras}</strong>
                              </div>

                              <div className="adminpro-ranking-metric-v3">
                                <span>Monto</span>
                                <strong>${Number(persona.montoTotal || 0).toFixed(2)}</strong>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="adminpro-pagination-wrap">
                      <div className="adminpro-pagination-info">
                        <label>Items por página</label>
                        <select
                          className="adminpro-input"
                          value={itemsPorPaginaRanking}
                          onChange={(e) => {
                            setItemsPorPaginaRanking(Number(e.target.value));
                            setPaginaRanking(1);
                          }}
                        >
                          <option value={8}>8</option>
                          <option value={12}>12</option>
                          <option value={20}>20</option>
                        </select>
                      </div>

                      <div className="adminpro-pagination-controls">
                        <button
                          type="button"
                          className="adminpro-soft-btn dark"
                          onClick={() => setPaginaRanking((prev) => Math.max(prev - 1, 1))}
                          disabled={paginaRanking === 1}
                        >
                          Anterior
                        </button>

                        <div className="adminpro-pagination-page">
                          Página {paginaRanking} de {totalPaginasRanking}
                        </div>

                        <button
                          type="button"
                          className="adminpro-soft-btn dark"
                          onClick={() =>
                            setPaginaRanking((prev) => Math.min(prev + 1, totalPaginasRanking))
                          }
                          disabled={paginaRanking === totalPaginasRanking}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {seccionActiva === "compras" && (
            <div className="adminpro-page-stack" ref={comprasSectionRef}>
              <div className="adminpro-card">
                <div className="adminpro-section-head">
                  <div>
                    <h2>Compras de la rifa seleccionada</h2>
                    <p>Filtra, ordena y exporta compras por múltiples criterios</p>
                  </div>

                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                    {cantidadFiltrosActivos > 0 && (
                      <div className="adminpro-badge-box">
                        🔍 {cantidadFiltrosActivos} filtro{cantidadFiltrosActivos !== 1 ? "s" : ""} activo{cantidadFiltrosActivos !== 1 ? "s" : ""}
                      </div>
                    )}

                    <button
                      type="button"
                      className="adminpro-soft-btn blue"
                      onClick={exportarComprasCSV}
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                <PurchaseFiltersPanel
                  filtros={filtrosCompras}
                  setFiltros={setFiltrosCompras}
                  metodosPago={metodosPagoDisponibles}
                />

                <FilterChips
                  filtros={filtrosCompras}
                  onRemove={eliminarFiltroIndividual}
                />

                <div className="adminpro-sort-row">
                  <div className="adminpro-sort-box">
                    <label>Ordenar por</label>
                    <select
                      className="adminpro-input"
                      value={ordenCompras}
                      onChange={(e) => setOrdenCompras(e.target.value)}
                    >
                      <option value="fecha_desc">Más recientes</option>
                      <option value="fecha_asc">Más antiguas</option>
                      <option value="monto_desc">Mayor monto</option>
                      <option value="monto_asc">Menor monto</option>
                      <option value="tickets_desc">Más tickets</option>
                      <option value="tickets_asc">Menos tickets</option>
                      <option value="nombre_asc">Nombre A-Z</option>
                      <option value="nombre_desc">Nombre Z-A</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "18px" }}>
                  {comprasVisibles.length === 0 ? (
                    <div className="adminpro-empty-box">
                      <p>📋 No hay compras registradas para esta rifa todavía.</p>
                    </div>
                  ) : comprasFiltradasYOrdenadas.length === 0 ? (
                    <div className="adminpro-empty-box">
                      <p>🔍 No se encontraron compras que coincidan con los filtros aplicados.</p>
                      <p style={{ marginTop: "8px", fontSize: "14px" }}>
                        Intenta ajustar los filtros o cambiar el orden.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          marginBottom: "14px",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          Mostrando {resumenPaginacionCompras.desde} a {resumenPaginacionCompras.hasta} de{" "}
                          {resumenPaginacionCompras.total} compra
                          {resumenPaginacionCompras.total !== 1 ? "s" : ""}
                        </span>

                        <span>
                          Orden actual:{" "}
                          {{
                            fecha_desc: "Más recientes",
                            fecha_asc: "Más antiguas",
                            monto_desc: "Mayor monto",
                            monto_asc: "Menor monto",
                            tickets_desc: "Más tickets",
                            tickets_asc: "Menos tickets",
                            nombre_asc: "Nombre A-Z",
                            nombre_desc: "Nombre Z-A",
                          }[ordenCompras]}
                        </span>
                      </div>

                      <div className="adminpro-compras-grid">
                        {comprasPaginadas.map((compra) => (
                          <PurchaseCard
                            key={compra.id}
                            compra={compra}
                            ticketsAsignados={ticketsPorCompra[String(compra.id)] || []}
                            onAprobar={aprobarCompra}
                            onAprobarManual={abrirAprobacionManual}
                            onRechazar={rechazarCompra}
                            onEliminar={eliminarCompra}
                            loadingAprobacion={loadingAprobacion}
                            loadingRechazo={loadingRechazo}
                            loadingEliminacion={loadingEliminacion}
                            mostrarEliminar={false}
                            formatearFecha={formatearFecha}
                          />
                        ))}
                      </div>

                      <div className="adminpro-pagination-wrap">
                        <div className="adminpro-pagination-info">
                          <label>Items por página</label>
                          <select
                            className="adminpro-input"
                            value={itemsPorPagina}
                            onChange={(e) => {
                              setItemsPorPagina(Number(e.target.value));
                              setPaginaCompras(1);
                            }}
                          >
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                            <option value={48}>48</option>
                          </select>
                        </div>

                        <div className="adminpro-pagination-controls">
                          <button
                            type="button"
                            className="adminpro-soft-btn dark"
                            onClick={() => setPaginaCompras((prev) => Math.max(prev - 1, 1))}
                            disabled={paginaCompras === 1}
                          >
                            Anterior
                          </button>

                          <div className="adminpro-pagination-page">
                            Página {paginaCompras} de {totalPaginasCompras}
                          </div>

                          <button
                            type="button"
                            className="adminpro-soft-btn dark"
                            onClick={() =>
                              setPaginaCompras((prev) => Math.min(prev + 1, totalPaginasCompras))
                            }
                            disabled={paginaCompras === totalPaginasCompras}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
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