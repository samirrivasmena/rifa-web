"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FILTROS_COMPRAS_INICIALES } from "../../lib/admin/adminConstants";

export function useAdminCompras(comprasFiltradasPorRifa) {
  const [filtrosCompras, setFiltrosCompras] = useState({
    ...FILTROS_COMPRAS_INICIALES,
  });

  const [ordenCompras, setOrdenCompras] = useState("fecha_desc");
  const [paginaCompras, setPaginaCompras] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(12);

  const comprasVisibles = useMemo(() => {
    return comprasFiltradasPorRifa.filter((c) => c.estado_pago !== "rechazado");
  }, [comprasFiltradasPorRifa]);

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
        fechaCompra >= new Date(`${filtrosCompras.fechaDesde}T00:00:00`);

      const coincideFechaHasta =
        !filtrosCompras.fechaHasta ||
        fechaCompra <= new Date(`${filtrosCompras.fechaHasta}T23:59:59`);

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

  useEffect(() => {
    setPaginaCompras(1);
  }, [filtrosCompras, ordenCompras, itemsPorPagina]);

  const eliminarFiltroIndividual = useCallback((campo) => {
    setFiltrosCompras((prev) => ({
      ...prev,
      [campo]: "",
    }));
  }, []);

  const resetComprasState = useCallback(() => {
    setFiltrosCompras({
      ...FILTROS_COMPRAS_INICIALES,
    });
    setOrdenCompras("fecha_desc");
    setPaginaCompras(1);
  }, []);

  return {
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
  };
}