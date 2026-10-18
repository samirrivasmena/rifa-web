"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export function useAdminRanking(comprasFiltradasPorRifa) {
  const [busquedaRanking, setBusquedaRanking] = useState("");
  const [ordenRanking, setOrdenRanking] = useState("tickets_desc");
  const [participanteSeleccionado, setParticipanteSeleccionado] =
    useState(null);
  const [modalRankingOpen, setModalRankingOpen] = useState(false);
  const [paginaRanking, setPaginaRanking] = useState(1);
  const [itemsPorPaginaRanking, setItemsPorPaginaRanking] =
    useState(8);

  const abrirDetalleParticipante = (persona) => {
    if (!persona) return;

    setParticipanteSeleccionado(persona);
    setModalRankingOpen(true);
  };

  // =========================================================
  // RANKING BASE
  // =========================================================

  const rankingBase = useMemo(() => {
    const acumulado = {};

    // ---------------------------------------------------------
    // Estados considerados como compra aprobada
    // ---------------------------------------------------------

    const esCompraAprobada = (estado) => {
      const valor = String(estado || "")
        .trim()
        .toLowerCase();

      return [
        "aprobado",
        "aprobada",
        "approved",
        "pagado",
        "pagada",
        "activo",
        "activa",
      ].includes(valor);
    };

    // ---------------------------------------------------------
    // Obtener fecha comparable de una compra
    // ---------------------------------------------------------

    const obtenerFechaCompra = (compra) => {
      const fecha =
        compra?.fecha_compra ||
        compra?.created_at ||
        "";

      const timestamp = new Date(fecha).getTime();

      return Number.isFinite(timestamp)
        ? timestamp
        : 0;
    };

    // ---------------------------------------------------------
    // Solo procesamos compras aprobadas
    // ---------------------------------------------------------

    comprasFiltradasPorRifa
      .filter((compra) =>
        esCompraAprobada(compra?.estado_pago)
      )
      .forEach((compra) => {
        // =====================================================
        // DATOS DEL CLIENTE DE ESTA COMPRA
        // =====================================================
        //
        // Compras nuevas:
        // nombre_cliente
        // email_cliente
        // telefono_cliente
        //
        // Compras antiguas:
        // usuarios.nombre
        // usuarios.email
        // usuarios.telefono
        //
        // De esta forma mantenemos compatibilidad con las
        // compras realizadas antes de agregar los snapshots.
        // =====================================================

        const email = String(
          compra?.email_cliente ||
            compra?.usuarios?.email ||
            ""
        )
          .trim()
          .toLowerCase();

        const nombre = String(
          compra?.nombre_cliente ||
            compra?.usuarios?.nombre ||
            compra?.email_cliente ||
            compra?.usuarios?.email ||
            compra?.usuario_id ||
            "Sin nombre"
        ).trim();

        const telefono = String(
          compra?.telefono_cliente ||
            compra?.usuarios?.telefono ||
            ""
        ).trim();

        const fechaCompraTimestamp =
          obtenerFechaCompra(compra);

        // =====================================================
        // IDENTIDAD REAL DEL PARTICIPANTE
        // =====================================================
        //
        // PRIORIDAD:
        //
        // 1. EMAIL
        // 2. usuario_id
        // 3. nombre
        //
        // Varias compras con el mismo email pertenecen
        // al mismo participante dentro del ranking.
        // =====================================================

        const claveParticipante = email
          ? `email:${email}`
          : compra?.usuario_id
          ? `usuario:${String(compra.usuario_id)}`
          : `nombre:${nombre.toLowerCase()}`;

        // =====================================================
        // CREAR PARTICIPANTE
        // =====================================================

        if (!acumulado[claveParticipante]) {
          acumulado[claveParticipante] = {
            nombre,
            email,
            telefono,

            cantidad: 0,
            compras: 0,
            montoTotal: 0,

            comprasDetalle: [],

            // Fecha utilizada únicamente para saber cuáles
            // datos personales son los más recientes.
            ultimaFechaDatos: fechaCompraTimestamp,
          };
        }

        const participante =
          acumulado[claveParticipante];

        // =====================================================
        // USAR LOS DATOS DE LA COMPRA MÁS RECIENTE
        // =====================================================
        //
        // Esto NO cambia la identidad del participante.
        // El email sigue siendo la clave principal.
        //
        // Solo determina qué nombre y teléfono se muestran
        // como datos representativos en el ranking.
        // =====================================================

        if (
          fechaCompraTimestamp >
          Number(participante.ultimaFechaDatos || 0)
        ) {
          participante.nombre = nombre;

          if (email) {
            participante.email = email;
          }

          participante.telefono = telefono;

          participante.ultimaFechaDatos =
            fechaCompraTimestamp;
        }

        // =====================================================
        // ACUMULAR TICKETS
        // =====================================================

        participante.cantidad += Number(
          compra?.cantidad_tickets || 0
        );

        // =====================================================
        // ACUMULAR CANTIDAD DE COMPRAS
        // =====================================================

        participante.compras += 1;

        // =====================================================
        // ACUMULAR MONTO
        // =====================================================

        participante.montoTotal += Number(
          compra?.monto_total ??
            compra?.total ??
            0
        );

        // =====================================================
        // GUARDAR COMPRA INDIVIDUAL
        // =====================================================
        //
        // Conservamos la compra completa.
        //
        // Gestión y detalle pueden seguir diferenciando:
        //
        // Compra 1 -> Juan
        // Compra 2 -> Pedro
        // Compra 3 -> jugador77
        //
        // aunque pertenezcan al mismo participante.
        // =====================================================

        participante.comprasDetalle.push(compra);

        // =====================================================
        // COMPLETAR DATOS SI FALTAN
        // =====================================================

        if (!participante.email && email) {
          participante.email = email;
        }

        if (!participante.telefono && telefono) {
          participante.telefono = telefono;
        }

        if (
          (!participante.nombre ||
            participante.nombre === "Sin nombre") &&
          nombre
        ) {
          participante.nombre = nombre;
        }
      });

    // Quitamos el campo interno antes de entregar el ranking.
    return Object.values(acumulado).map(
      ({ ultimaFechaDatos, ...participante }) =>
        participante
    );
  }, [comprasFiltradasPorRifa]);

  // =========================================================
  // BÚSQUEDA + ORDENAMIENTO
  // =========================================================

  const rankingFiltradoYOrdenado = useMemo(() => {
    const termino = busquedaRanking
      .trim()
      .toLowerCase();

    let lista = [...rankingBase];

    // ---------------------------------------------------------
    // Búsqueda
    // ---------------------------------------------------------

    if (termino) {
      lista = lista.filter((persona) => {
        return (
          String(persona.nombre || "")
            .toLowerCase()
            .includes(termino) ||
          String(persona.email || "")
            .toLowerCase()
            .includes(termino) ||
          String(persona.telefono || "")
            .toLowerCase()
            .includes(termino)
        );
      });
    }

    // ---------------------------------------------------------
    // Ordenamiento
    // ---------------------------------------------------------

    lista.sort((a, b) => {
      switch (ordenRanking) {
        case "tickets_asc":
          return a.cantidad - b.cantidad;

        case "tickets_desc":
          return b.cantidad - a.cantidad;

        case "nombre_asc":
          return String(a.nombre || "").localeCompare(
            String(b.nombre || "")
          );

        case "nombre_desc":
          return String(b.nombre || "").localeCompare(
            String(a.nombre || "")
          );

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
  }, [
    rankingBase,
    busquedaRanking,
    ordenRanking,
  ]);

  // =========================================================
  // TOTAL DE PÁGINAS
  // =========================================================

  const totalPaginasRanking = useMemo(() => {
    return Math.max(
      Math.ceil(
        rankingFiltradoYOrdenado.length /
          itemsPorPaginaRanking
      ),
      1
    );
  }, [
    rankingFiltradoYOrdenado.length,
    itemsPorPaginaRanking,
  ]);

  // =========================================================
  // RANKING PAGINADO
  // =========================================================

  const rankingPaginado = useMemo(() => {
    const inicio =
      (paginaRanking - 1) *
      itemsPorPaginaRanking;

    const fin =
      inicio + itemsPorPaginaRanking;

    return rankingFiltradoYOrdenado.slice(
      inicio,
      fin
    );
  }, [
    rankingFiltradoYOrdenado,
    paginaRanking,
    itemsPorPaginaRanking,
  ]);

  // =========================================================
  // RESUMEN DE PAGINACIÓN
  // =========================================================

  const resumenPaginacionRanking = useMemo(() => {
    if (!rankingFiltradoYOrdenado.length) {
      return {
        desde: 0,
        hasta: 0,
        total: 0,
      };
    }

    const desde =
      (paginaRanking - 1) *
        itemsPorPaginaRanking +
      1;

    const hasta = Math.min(
      paginaRanking *
        itemsPorPaginaRanking,
      rankingFiltradoYOrdenado.length
    );

    return {
      desde,
      hasta,
      total:
        rankingFiltradoYOrdenado.length,
    };
  }, [
    rankingFiltradoYOrdenado.length,
    paginaRanking,
    itemsPorPaginaRanking,
  ]);

  // =========================================================
  // TOP 10
  // =========================================================

  const ranking = useMemo(() => {
    return rankingFiltradoYOrdenado.slice(
      0,
      10
    );
  }, [rankingFiltradoYOrdenado]);

  // =========================================================
  // ESTADÍSTICAS DEL RANKING
  // =========================================================

  const resumenRanking = useMemo(() => {
    const totalTicketsAprobados =
      rankingBase.reduce(
        (acc, persona) =>
          acc +
          Number(
            persona.cantidad || 0
          ),
        0
      );

    const totalParticipantes =
      rankingBase.length;

    const topParticipante =
      rankingFiltradoYOrdenado[0] ||
      null;

    const segundoParticipante =
      rankingFiltradoYOrdenado[1] ||
      null;

    const promedioTicketsPorParticipante =
      totalParticipantes > 0
        ? (
            totalTicketsAprobados /
            totalParticipantes
          ).toFixed(2)
        : "0.00";

    const porcentajeLider =
      topParticipante &&
      totalTicketsAprobados > 0
        ? (
            (topParticipante.cantidad /
              totalTicketsAprobados) *
            100
          ).toFixed(2)
        : "0.00";

    const diferenciaTop2 =
      topParticipante &&
      segundoParticipante
        ? topParticipante.cantidad -
          segundoParticipante.cantidad
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
  }, [
    rankingBase,
    rankingFiltradoYOrdenado,
  ]);

  // =========================================================
  // REINICIAR PÁGINA CUANDO CAMBIAN FILTROS
  // =========================================================

  useEffect(() => {
    setPaginaRanking(1);
  }, [
    busquedaRanking,
    ordenRanking,
    itemsPorPaginaRanking,
  ]);

  // =========================================================
  // LIMPIAR PARTICIPANTE AL CERRAR MODAL
  // =========================================================

  useEffect(() => {
    if (!modalRankingOpen) {
      setParticipanteSeleccionado(
        null
      );
    }
  }, [modalRankingOpen]);

  // =========================================================
  // RESET
  // =========================================================

  const resetRankingState =
    useCallback(() => {
      setBusquedaRanking("");
      setOrdenRanking(
        "tickets_desc"
      );
      setPaginaRanking(1);
      setParticipanteSeleccionado(
        null
      );
      setModalRankingOpen(
        false
      );
    }, []);

  // =========================================================
  // RETURN
  // =========================================================

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