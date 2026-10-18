"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FILTROS_COMPRAS_INICIALES } from "../../lib/admin/adminConstants";

const normalizarTexto = (valor) =>
  String(valor ?? "").trim().toLowerCase();

const obtenerMontoCompra = (compra = {}) =>
  Number(compra.monto_total ?? compra.total ?? 0);

const obtenerEstadoCompra = (compra = {}) =>
  normalizarTexto(compra.estado_pago);

const obtenerMetodoPago = (compra = {}) =>
  String(compra.metodo_pago || "").trim();

export function useAdminCompras(comprasFiltradasPorRifa) {
  const [filtrosCompras, setFiltrosCompras] = useState({
    ...FILTROS_COMPRAS_INICIALES,
  });

  const [ordenCompras, setOrdenCompras] = useState("fecha_desc");
  const [paginaCompras, setPaginaCompras] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(12);

  // =========================================================
  // COMPRAS VISIBLES
  // =========================================================

  const comprasVisibles = useMemo(() => {
    return comprasFiltradasPorRifa.filter((c) => {
      const estado = obtenerEstadoCompra(c);

      return !["rechazado", "rechazada"].includes(estado);
    });
  }, [comprasFiltradasPorRifa]);

  // =========================================================
  // MÉTODOS DE PAGO DISPONIBLES
  // =========================================================

  const metodosPagoDisponibles = useMemo(() => {
    const unicos = Array.from(
      new Set(
        comprasFiltradasPorRifa
          .map((c) => obtenerMetodoPago(c))
          .filter(Boolean)
      )
    );

    return unicos.sort((a, b) => a.localeCompare(b));
  }, [comprasFiltradasPorRifa]);

  // =========================================================
  // FILTROS AVANZADOS
  // =========================================================

  const comprasFiltradasAvanzadas = useMemo(() => {
    return comprasVisibles.filter((compra) => {
      const termino = normalizarTexto(filtrosCompras.busqueda);

      // =====================================================
      // DATOS DEL CLIENTE DE ESTA COMPRA
      // =====================================================
      // Las compras nuevas utilizan el snapshot guardado
      // directamente en compras.
      //
      // Las compras antiguas utilizan usuarios como respaldo.
      // =====================================================

      const id = normalizarTexto(compra.id);

      const nombre = normalizarTexto(
        compra.nombre_cliente ||
          compra.usuarios?.nombre
      );

      const email = normalizarTexto(
        compra.email_cliente ||
          compra.usuarios?.email
      );

      const telefono = normalizarTexto(
        compra.telefono_cliente ||
          compra.usuarios?.telefono
      );

      const referencia = normalizarTexto(compra.referencia);
      const metodo = normalizarTexto(compra.metodo_pago);
      const estado = obtenerEstadoCompra(compra);

      // =====================================================
      // BÚSQUEDA GENERAL
      // =====================================================

      const coincideBusqueda =
        !termino ||
        id.includes(termino) ||
        nombre.includes(termino) ||
        email.includes(termino) ||
        telefono.includes(termino) ||
        referencia.includes(termino) ||
        metodo.includes(termino) ||
        estado.includes(termino);

      // =====================================================
      // FILTRO POR ESTADO
      // =====================================================

      const coincideEstado =
        !filtrosCompras.estado ||
        normalizarTexto(compra.estado_pago) ===
          normalizarTexto(filtrosCompras.estado);

      // =====================================================
      // FILTRO POR MÉTODO DE PAGO
      // =====================================================

      const coincideMetodo =
        !filtrosCompras.metodoPago ||
        normalizarTexto(compra.metodo_pago) ===
          normalizarTexto(filtrosCompras.metodoPago);

      // =====================================================
      // FILTRO POR FECHA
      // =====================================================

      const fechaCompra = new Date(
        compra.fecha_compra ||
          compra.created_at ||
          0
      );

      const coincideFechaDesde =
        !filtrosCompras.fechaDesde ||
        fechaCompra >=
          new Date(
            `${filtrosCompras.fechaDesde}T00:00:00`
          );

      const coincideFechaHasta =
        !filtrosCompras.fechaHasta ||
        fechaCompra <=
          new Date(
            `${filtrosCompras.fechaHasta}T23:59:59`
          );

      // =====================================================
      // FILTRO POR CANTIDAD DE TICKETS
      // =====================================================

      const cantidadTickets = Number(
        compra.cantidad_tickets || 0
      );

      const coincideMinTickets =
        !filtrosCompras.minTickets ||
        cantidadTickets >=
          Number(filtrosCompras.minTickets);

      const coincideMaxTickets =
        !filtrosCompras.maxTickets ||
        cantidadTickets <=
          Number(filtrosCompras.maxTickets);

      // =====================================================
      // FILTRO POR MONTO
      // =====================================================

      const total = obtenerMontoCompra(compra);

      const coincideMinMonto =
        !filtrosCompras.minMonto ||
        total >= Number(filtrosCompras.minMonto);

      const coincideMaxMonto =
        !filtrosCompras.maxMonto ||
        total <= Number(filtrosCompras.maxMonto);

      // =====================================================
      // FILTRO POR COMPROBANTE
      // =====================================================

      const tieneComprobante =
        Boolean(compra.comprobante_url) ||
        Boolean(compra.comprobante) ||
        Boolean(compra.capture_url) ||
        Boolean(compra.soporte_pago);

      const coincideComprobante =
        !filtrosCompras.conComprobante ||
        (filtrosCompras.conComprobante === "si"
          ? tieneComprobante
          : !tieneComprobante);

      // =====================================================
      // RESULTADO FINAL
      // =====================================================

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

  // =========================================================
  // ORDENAMIENTO
  // =========================================================

  const comprasFiltradasYOrdenadas = useMemo(() => {
    const lista = [...comprasFiltradasAvanzadas];

    lista.sort((a, b) => {
      const fechaA = new Date(
        a.fecha_compra ||
          a.created_at ||
          0
      ).getTime();

      const fechaB = new Date(
        b.fecha_compra ||
          b.created_at ||
          0
      ).getTime();

      const montoA = obtenerMontoCompra(a);
      const montoB = obtenerMontoCompra(b);

      const ticketsA = Number(
        a.cantidad_tickets || 0
      );

      const ticketsB = Number(
        b.cantidad_tickets || 0
      );

      // =====================================================
      // NOMBRE HISTÓRICO PARA ORDENAMIENTO
      // =====================================================

      const nombreA = String(
        a.nombre_cliente ||
          a.usuarios?.nombre ||
          a.email_cliente ||
          a.usuarios?.email ||
          a.usuario_id ||
          ""
      )
        .trim()
        .toLowerCase();

      const nombreB = String(
        b.nombre_cliente ||
          b.usuarios?.nombre ||
          b.email_cliente ||
          b.usuarios?.email ||
          b.usuario_id ||
          ""
      )
        .trim()
        .toLowerCase();

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
  }, [
    comprasFiltradasAvanzadas,
    ordenCompras,
  ]);

  // =========================================================
  // TOTAL DE PÁGINAS
  // =========================================================

  const totalPaginasCompras = useMemo(() => {
    return Math.max(
      Math.ceil(
        comprasFiltradasYOrdenadas.length /
          itemsPorPagina
      ),
      1
    );
  }, [
    comprasFiltradasYOrdenadas.length,
    itemsPorPagina,
  ]);

  // =========================================================
  // COMPRAS PAGINADAS
  // =========================================================

  const comprasPaginadas = useMemo(() => {
    const inicio =
      (paginaCompras - 1) *
      itemsPorPagina;

    const fin =
      inicio + itemsPorPagina;

    return comprasFiltradasYOrdenadas.slice(
      inicio,
      fin
    );
  }, [
    comprasFiltradasYOrdenadas,
    paginaCompras,
    itemsPorPagina,
  ]);

  // =========================================================
  // RESUMEN DE PAGINACIÓN
  // =========================================================

  const resumenPaginacionCompras = useMemo(() => {
    if (
      !comprasFiltradasYOrdenadas.length
    ) {
      return {
        desde: 0,
        hasta: 0,
        total: 0,
      };
    }

    const desde =
      (paginaCompras - 1) *
        itemsPorPagina +
      1;

    const hasta = Math.min(
      paginaCompras * itemsPorPagina,
      comprasFiltradasYOrdenadas.length
    );

    return {
      desde,
      hasta,
      total:
        comprasFiltradasYOrdenadas.length,
    };
  }, [
    comprasFiltradasYOrdenadas.length,
    paginaCompras,
    itemsPorPagina,
  ]);

  // =========================================================
  // CANTIDAD DE FILTROS ACTIVOS
  // =========================================================

  const cantidadFiltrosActivos = useMemo(() => {
    return Object.values(
      filtrosCompras
    ).filter(
      (value) =>
        String(value).trim() !== ""
    ).length;
  }, [filtrosCompras]);

  // =========================================================
  // REINICIAR PÁGINA CUANDO CAMBIAN FILTROS
  // =========================================================

  useEffect(() => {
    setPaginaCompras(1);
  }, [
    filtrosCompras,
    ordenCompras,
    itemsPorPagina,
  ]);

  // =========================================================
  // ELIMINAR UN FILTRO
  // =========================================================

  const eliminarFiltroIndividual =
    useCallback((campo) => {
      setFiltrosCompras((prev) => ({
        ...prev,
        [campo]: "",
      }));
    }, []);

  // =========================================================
  // RESET
  // =========================================================

  const resetComprasState =
    useCallback(() => {
      setFiltrosCompras({
        ...FILTROS_COMPRAS_INICIALES,
      });

      setOrdenCompras(
        "fecha_desc"
      );

      setPaginaCompras(1);
    }, []);

  // =========================================================
  // RETURN
  // =========================================================

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