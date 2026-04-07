"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export function useAdminRanking(comprasFiltradasPorRifa) {
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

  useEffect(() => {
    setPaginaRanking(1);
  }, [busquedaRanking, ordenRanking, itemsPorPaginaRanking]);

  useEffect(() => {
    if (!modalRankingOpen) {
      setParticipanteSeleccionado(null);
    }
  }, [modalRankingOpen]);

  const resetRankingState = useCallback(() => {
    setBusquedaRanking("");
    setOrdenRanking("tickets_desc");
    setPaginaRanking(1);
    setParticipanteSeleccionado(null);
    setModalRankingOpen(false);
  }, []);

  return {
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
  };
}