
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* =========================================================
   CAMPOS PÚBLICOS DE RIFAS
========================================================= */

const CAMPOS_PUBLICOS_RIFA = `
  id,
  nombre,
  descripcion,
  numero_inicio,
  numero_fin,
  cantidad_numeros,
  formato,
  estado,
  numero_ganador,
  portada_url,
  portada_scroll_url,
  premio,
  precio_ticket,
  fecha_sorteo,
  hora_sorteo,
  publicada,
  destacada
`;

/* =========================================================
   TOTAL DE NÚMEROS
========================================================= */

function obtenerTotalNumeros(rifa = {}) {
  const inicio = Number(rifa?.numero_inicio);
  const fin = Number(rifa?.numero_fin);

  if (
    Number.isFinite(inicio) &&
    Number.isFinite(fin) &&
    fin >= inicio
  ) {
    return fin - inicio + 1;
  }

  const cantidad = Number(rifa?.cantidad_numeros);

  return Number.isFinite(cantidad)
    ? cantidad
    : 0;
}

/* =========================================================
   NÚMERO SEGURO
========================================================= */

function numeroSeguro(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

/* =========================================================
   NORMALIZAR ESTADO
========================================================= */

function normalizarEstadoFree(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   BOOLEANO SEGURO
========================================================= */

function booleanoSeguro(valor) {
  return (
    valor === true ||
    valor === 1 ||
    valor === "1" ||
    normalizarEstadoFree(valor) === "true"
  );
}

/* =========================================================
   FECHA PROGRAMADA FUTURA
========================================================= */

function esFechaFuturaValida(valor, ahoraMs) {
  if (!valor) {
    return false;
  }

  const fechaMs = new Date(valor).getTime();

  return (
    Number.isFinite(fechaMs) &&
    fechaMs > ahoraMs
  );
}

/* =========================================================
   CUPOS DISPONIBLES DE UN FREE DROP
========================================================= */

function obtenerCuposDisponiblesDrop(drop) {
  const total = Math.max(
    numeroSeguro(drop?.cupos_total),
    0
  );

  const usados = Math.max(
    numeroSeguro(drop?.cupos_usados),
    0
  );

  return Math.max(total - usados, 0);
}

/* =========================================================
   ORDENAR FREE DROPS
   MISMO ORDEN PRINCIPAL QUE LA API EXISTENTE
========================================================= */

function ordenarFreeDrops(drops = []) {
  return [...drops].sort((a, b) => {
    const numeroA = numeroSeguro(a?.numero_drop);
    const numeroB = numeroSeguro(b?.numero_drop);

    if (numeroA !== numeroB) {
      return numeroB - numeroA;
    }

    const fechaA =
      new Date(a?.created_at || 0).getTime() || 0;

    const fechaB =
      new Date(b?.created_at || 0).getTime() || 0;

    return fechaB - fechaA;
  });
}

/* =========================================================
   CALCULAR ESTADO PÚBLICO DEL FREE DROP
========================================================= */

function calcularEstadoFreeDrop(
  rifa,
  settings,
  drops = [],
  ahoraMs = Date.now()
) {
  const estadoRifa = normalizarEstadoFree(
    rifa?.estado
  );

  const estadoBase = {
    estado: "sin_configurar",
    etiqueta: null,
    cupos_disponibles: 0,
    drop_id: null,
    fecha_inicio: null,
  };

  /* -------------------------------------------------------
     1. RIFA FINALIZADA
     TIENE PRIORIDAD SOBRE EL FREE DROP
  ------------------------------------------------------- */

  if (
    [
      "finalizada",
      "finalizado",
      "cerrada",
      "cerrado",
    ].includes(estadoRifa)
  ) {
    return {
      ...estadoBase,
      estado: "rifa_finalizada",
    };
  }

  /* -------------------------------------------------------
     2. RIFA AGOTADA
  ------------------------------------------------------- */

  if (
    ["agotada", "agotado"].includes(estadoRifa) ||
    booleanoSeguro(rifa?.sold_out)
  ) {
    return {
      ...estadoBase,
      estado: "rifa_agotada",
    };
  }

  /* -------------------------------------------------------
     3. RIFA NO DISPONIBLE
  ------------------------------------------------------- */

  if (
    ![
      "activa",
      "disponible",
      "publicada",
    ].includes(estadoRifa)
  ) {
    return {
      ...estadoBase,
      estado: "rifa_no_disponible",
    };
  }

  /* -------------------------------------------------------
     4. SIN CONFIGURACIÓN
  ------------------------------------------------------- */

  if (!settings) {
    return estadoBase;
  }

  /* -------------------------------------------------------
     5. FREE DROPS DESACTIVADOS
  ------------------------------------------------------- */

  if (!booleanoSeguro(settings.enabled)) {
    return {
      ...estadoBase,
      estado: "desactivado",
      etiqueta: "FREE DROP DESACTIVADO",
    };
  }

  /* -------------------------------------------------------
     6. CAPACIDAD GENERAL
  ------------------------------------------------------- */

  const totalPermitido = Math.max(
    numeroSeguro(settings.total_free_allowed),
    0
  );

  const totalLiberado = Math.max(
    numeroSeguro(settings.released_total),
    0
  );

  const capacidadGeneralDisponible = Math.max(
    totalPermitido - totalLiberado,
    0
  );

  /* -------------------------------------------------------
     7. ORDENAR FREE DROPS
  ------------------------------------------------------- */

  const lista = ordenarFreeDrops(drops);

  const buscarEstado = (estado) =>
    lista.find(
      (drop) =>
        normalizarEstadoFree(drop?.estado) === estado
    ) || null;

  const activo = buscarEstado("activo");
  const pausado = buscarEstado("pausado");
  const agotado = buscarEstado("agotado");

  /* -------------------------------------------------------
     8. PRÓXIMO FREE DROP PROGRAMADO
  ------------------------------------------------------- */

  const proximoProgramado =
    lista
      .filter(
        (drop) =>
          normalizarEstadoFree(drop?.estado) ===
            "programado" &&
          esFechaFuturaValida(
            drop?.fecha_inicio,
            ahoraMs
          )
      )
      .sort(
        (a, b) =>
          new Date(a.fecha_inicio).getTime() -
          new Date(b.fecha_inicio).getTime()
      )[0] || null;

  /* -------------------------------------------------------
     9. SELECCIONAR DROP VISIBLE

     PRIORIDAD:
     ACTIVO > PAUSADO > AGOTADO > PROGRAMADO
  ------------------------------------------------------- */

  const dropVisible =
    activo ||
    pausado ||
    agotado ||
    proximoProgramado ||
    null;

  /* -------------------------------------------------------
     10. SIN DROP VIGENTE
  ------------------------------------------------------- */

  if (!dropVisible) {
    return {
      ...estadoBase,
      estado: "sin_drop",
    };
  }

  const estadoDrop = normalizarEstadoFree(
    dropVisible.estado
  );

  const cuposDisponibles =
    obtenerCuposDisponiblesDrop(dropVisible);

  const datosDrop = {
    drop_id: dropVisible.id,
    cupos_disponibles: cuposDisponibles,
    fecha_inicio: dropVisible.fecha_inicio || null,
  };

  /* -------------------------------------------------------
     11. DROP ACTIVO
  ------------------------------------------------------- */

  if (estadoDrop === "activo") {
    if (
      cuposDisponibles > 0 &&
      capacidadGeneralDisponible > 0
    ) {
      return {
        ...datosDrop,
        estado: "activo",
        etiqueta: "🎁 FREE DROP ACTIVO",
      };
    }

    return {
      ...datosDrop,
      estado: "agotado",
      etiqueta: "🎟️ FREE DROP AGOTADO",
    };
  }

  /* -------------------------------------------------------
     12. DROP PAUSADO
  ------------------------------------------------------- */

  if (estadoDrop === "pausado") {
    return {
      ...datosDrop,
      estado: "pausado",
      etiqueta: "⏸️ FREE DROP PAUSADO",
    };
  }

  /* -------------------------------------------------------
     13. DROP AGOTADO
  ------------------------------------------------------- */

  if (estadoDrop === "agotado") {
    return {
      ...datosDrop,
      estado: "agotado",
      etiqueta: "🎟️ FREE DROP AGOTADO",
    };
  }

  /* -------------------------------------------------------
     14. DROP PROGRAMADO
  ------------------------------------------------------- */

  if (estadoDrop === "programado") {
    if (capacidadGeneralDisponible <= 0) {
      return {
        ...datosDrop,
        estado: "agotado",
        etiqueta: "🎟️ FREE DROP AGOTADO",
      };
    }

    return {
      ...datosDrop,
      estado: "programado",
      etiqueta: "🕒 PRÓXIMO FREE DROP",
    };
  }

  return estadoBase;
}

/* =========================================================
   OBTENER RIFAS PÚBLICAS
========================================================= */

export async function obtenerRifasPublicas() {
  /* =======================================================
     1. CARGAR ÚNICAMENTE RIFAS PÚBLICAS
  ======================================================= */

  const {
    data: rifasData,
    error: rifasError,
  } = await supabaseAdmin
    .from("rifas")
    .select(CAMPOS_PUBLICOS_RIFA)
    .in("estado", [
      "activa",
      "finalizada",
      "agotada",
      "publicada",
    ])
    .eq("publicada", true)
    .order("created_at", {
      ascending: false,
    });

  if (rifasError) {
    console.error(
      "Error cargando rifas públicas:",
      rifasError
    );

    throw new Error(
      "No se pudieron cargar las rifas públicas"
    );
  }

  const rifas = Array.isArray(rifasData)
    ? rifasData
    : [];

  /* =======================================================
     2. SI NO HAY RIFAS
  ======================================================= */

  if (!rifas.length) {
    return [];
  }

  /* =======================================================
     3. IDS DE RIFAS
  ======================================================= */

  const rifaIds = rifas.map(
    (rifa) => rifa.id
  );

  /* =======================================================
     4. CARGAR CONFIGURACIÓN FREE DROP
        Y DROPS EN CONSULTAS AGRUPADAS
  ======================================================= */

  const [
    {
      data: freeSettingsData,
      error: freeSettingsError,
    },
    {
      data: freeDropsData,
      error: freeDropsError,
    },
  ] = await Promise.all([
    supabaseAdmin
      .from("free_drop_settings")
      .select(`
        rifa_id,
        enabled,
        total_free_allowed,
        released_total
      `)
      .in("rifa_id", rifaIds),

    supabaseAdmin
      .from("free_drops")
      .select(`
        id,
        rifa_id,
        estado,
        numero_drop,
        cupos_total,
        cupos_usados,
        fecha_inicio,
        created_at
      `)
      .in("rifa_id", rifaIds)
      .in("estado", [
        "activo",
        "pausado",
        "agotado",
        "programado",
      ]),
  ]);

  if (freeSettingsError || freeDropsError) {
    console.error(
      "Error cargando estados públicos Free Drop:",
      freeSettingsError || freeDropsError
    );

    throw new Error(
      "No se pudieron cargar los estados Free Drop"
    );
  }

  /* =======================================================
     5. MAPA DE CONFIGURACIÓN POR RIFA
  ======================================================= */

  const freeSettingsPorRifa = {};

  for (const item of freeSettingsData || []) {
    if (item?.rifa_id == null) {
      continue;
    }

    freeSettingsPorRifa[
      String(item.rifa_id)
    ] = item;
  }

  /* =======================================================
     6. MAPA DE DROPS POR RIFA
  ======================================================= */

  const freeDropsPorRifa = {};

  for (const drop of freeDropsData || []) {
    if (drop?.rifa_id == null) {
      continue;
    }

    const key = String(drop.rifa_id);

    if (!freeDropsPorRifa[key]) {
      freeDropsPorRifa[key] = [];
    }

    freeDropsPorRifa[key].push(drop);
  }

  const ahoraFreeDropMs = Date.now();

  /* =======================================================
     7. RESUMEN DE TICKETS
        PAGADOS + FREE + OCUPADOS + INVENTARIO
  ======================================================= */

  const {
    data: resumenTicketsData,
    error: resumenTicketsError,
  } = await supabaseAdmin
    .from("resumen_publico_tickets_por_rifa")
    .select(`
      rifa_id,
      tickets_pagados,
      tickets_free,
      tickets_ocupados,
      disponibles_inventario
    `)
    .in("rifa_id", rifaIds);

  if (resumenTicketsError) {
    console.error(
      "Error cargando resumen público de tickets:",
      resumenTicketsError
    );

    throw new Error(
      "No se pudo cargar el resumen de tickets"
    );
  }

  /* =======================================================
     8. RESULTADOS DE SORTEOS
  ======================================================= */

  const {
    data: sorteosData,
    error: sorteosError,
  } = await supabaseAdmin
    .from("sorteos")
    .select(
      [
        "id",
        "rifa_id",
        "numero_ganador",
        "numero_oficial",
        "fecha_sorteo",
        "fuente",
      ].join(",")
    )
    .in("rifa_id", rifaIds)
    .order("fecha_sorteo", {
      ascending: false,
    });

  if (sorteosError) {
    console.error(
      "Error cargando sorteos:",
      sorteosError
    );

    throw new Error(
      "No se pudieron cargar los sorteos"
    );
  }

  /* =======================================================
     9. NORMALIZAR DATOS
  ======================================================= */

  const resumenTickets = Array.isArray(
    resumenTicketsData
  )
    ? resumenTicketsData
    : [];

  const sorteos = Array.isArray(sorteosData)
    ? sorteosData
    : [];

  /* =======================================================
     10. MAPA DE RESUMEN POR RIFA
  ======================================================= */

  const resumenPorRifa = resumenTickets.reduce(
    (acc, item) => {
      if (item?.rifa_id == null) {
        return acc;
      }

      acc[String(item.rifa_id)] = item;

      return acc;
    },
    {}
  );

  /* =======================================================
     11. SORTEO MÁS RECIENTE POR RIFA
  ======================================================= */

  const sorteoPorRifa = sorteos.reduce(
    (acc, sorteo) => {
      const rifaKey = String(sorteo.rifa_id);

      if (!acc[rifaKey]) {
        acc[rifaKey] = sorteo;
      }

      return acc;
    },
    {}
  );

  /* =======================================================
     12. CONSTRUIR RIFAS CON ESTADÍSTICAS
  ======================================================= */

  const rifasConStats = rifas.map((rifa) => {
    const rifaKey = String(rifa.id);

    const totalNumeros =
      obtenerTotalNumeros(rifa);

    const resumen =
      resumenPorRifa[rifaKey] || {};

    /* ---------------------------------------------------
       PAGADOS
    --------------------------------------------------- */

    const ticketsPagados = numeroSeguro(
      resumen.tickets_pagados
    );

    /* ---------------------------------------------------
       FREE
    --------------------------------------------------- */

    const ticketsFree = numeroSeguro(
      resumen.tickets_free
    );

    /* ---------------------------------------------------
       OCUPADOS
       Incluye pagados + free + otros ocupados
    --------------------------------------------------- */

    const ticketsOcupados = numeroSeguro(
      resumen.tickets_ocupados
    );

    /* ---------------------------------------------------
       DISPONIBLES DEL INVENTARIO
    --------------------------------------------------- */

    const disponiblesInventario =
      numeroSeguro(
        resumen.disponibles_inventario
      );

    /* ---------------------------------------------------
       DISPONIBLES PÚBLICOS
       TOTAL - OCUPADOS
    --------------------------------------------------- */

    const ticketsDisponibles = Math.max(
      totalNumeros - ticketsOcupados,
      0
    );

    /* ---------------------------------------------------
       PORCENTAJE
    --------------------------------------------------- */

    const porcentajeVendido =
      totalNumeros > 0
        ? Number(
            (
              (ticketsOcupados / totalNumeros) *
              100
            ).toFixed(2)
          )
        : 0;

    /* ---------------------------------------------------
       AGOTADA
    --------------------------------------------------- */

    const soldOut =
      totalNumeros > 0 &&
      ticketsOcupados >= totalNumeros;

    /* ---------------------------------------------------
       SORTEO
    --------------------------------------------------- */

    const sorteo =
      sorteoPorRifa[rifaKey] || null;

    /* ---------------------------------------------------
       ESTADO INTELIGENTE DEL FREE DROP
    --------------------------------------------------- */

    const freeDropEstado =
      calcularEstadoFreeDrop(
        {
          ...rifa,
          sold_out: soldOut,
        },
        freeSettingsPorRifa[rifaKey] || null,
        freeDropsPorRifa[rifaKey] || [],
        ahoraFreeDropMs
      );

    /* ---------------------------------------------------
       RESPUESTA
    --------------------------------------------------- */

    return {
      ...rifa,

      /* -----------------------------------------------
         NUEVO ESTADO PÚBLICO DEL FREE DROP
      ----------------------------------------------- */

      free_drop_estado: freeDropEstado,

      /* -----------------------------------------------
         RESULTADO DEL SORTEO
      ----------------------------------------------- */

      sorteo,

      numero_ganador:
        sorteo?.numero_ganador ??
        rifa.numero_ganador ??
        null,

      numero_oficial:
        sorteo?.numero_oficial ??
        null,

      /* -----------------------------------------------
         TOTAL DE NÚMEROS
      ----------------------------------------------- */

      total_numeros: totalNumeros,

      /*
       * IMPORTANTE:
       *
       * tickets_vendidos representa TODOS
       * los números ocupados.
       *
       * PAGADOS + FREE + OTROS OCUPADOS.
       */

      tickets_vendidos: ticketsOcupados,

      tickets_pagados: ticketsPagados,

      tickets_free: ticketsFree,

      tickets_ocupados: ticketsOcupados,

      tickets_disponibles: ticketsDisponibles,

      porcentaje_vendido: porcentajeVendido,

      sold_out: soldOut,

      /* -----------------------------------------------
         ESTADÍSTICAS ORIGINALES
      ----------------------------------------------- */

      stats: {
        total: totalNumeros,

        vendidos: ticketsOcupados,

        disponibles: ticketsDisponibles,

        porcentaje: porcentajeVendido,

        soldOut,

        ticketsVendidos: ticketsOcupados,

        porcentajeVendido,

        pagados: ticketsPagados,

        free: ticketsFree,

        ocupados: ticketsOcupados,

        ticketsPagados,

        ticketsFree,

        ticketsOcupados,

        disponiblesInventario,
      },
    };
  });

  return rifasConStats;
}
