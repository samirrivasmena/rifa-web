
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   CLIENTE SUPABASE - SOLO SERVIDOR
============================================================ */

function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase"
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/* ============================================================
   NORMALIZAR ESTADO
============================================================ */

function normalizarEstado(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

/* ============================================================
   ENRIQUECER FREE DROP

   Conserva:
   - Estado normalizado
   - Cupos totales
   - Cupos utilizados
   - Cupos disponibles
============================================================ */

function enriquecerDrop(drop) {
  if (!drop) {
    return null;
  }

  const cuposTotal = Math.max(
    Number(drop.cupos_total || 0),
    0
  );

  const cuposUsados = Math.max(
    Number(drop.cupos_usados || 0),
    0
  );

  const cuposDisponibles = Math.max(
    cuposTotal - cuposUsados,
    0
  );

  return {
    ...drop,

    estado: normalizarEstado(drop.estado),

    cupos_total: cuposTotal,
    cupos_usados: cuposUsados,
    cupos_disponibles: cuposDisponibles,
  };
}

/* ============================================================
   FECHA PROGRAMADA VÁLIDA

   Solo anunciamos como próximo un Free Drop
   con estado "programado" y fecha válida.

   No utilizamos created_at como fecha de inicio.
============================================================ */

function obtenerFechaProgramada(drop) {
  if (!drop?.fecha_inicio) {
    return null;
  }

  const fecha = new Date(drop.fecha_inicio);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha;
}

function esProgramadoValido(drop) {
  if (
    normalizarEstado(drop?.estado) !==
    "programado"
  ) {
    return false;
  }

  return Boolean(obtenerFechaProgramada(drop));
}

/* ============================================================
   GET - FREE DROP PÚBLICO

   OPTIMIZACIÓN:

   ANTES:
   1. Consulta free_drops
   2. Consulta rifas

   AHORA:
   1. Consulta free_drops

   La información principal de la rifa ya se
   obtiene mediante /api/rifa-resumen.

   No modificamos ninguna operación de escritura.
============================================================ */

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const rifaId = searchParams.get("rifaId");

    if (!rifaId) {
      return NextResponse.json(
        {
          error: "Falta rifaId",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const supabase = getSupabaseServerClient();

    /* ========================================================
       1. CONSULTAR FREE DROPS

       Conservamos todos los estados necesarios:

       - activo
       - pausado
       - agotado
       - programado

       También conservamos la consulta original para
       no cambiar inesperadamente el comportamiento.

       Los borradores, pendientes, cerrados y archivados
       no se seleccionarán como Drops públicos vigentes.
    ======================================================== */

    const {
      data: drops,
      error: errorDrops,
    } = await supabase
      .from("free_drops")
      .select(`
        id,
        rifa_id,
        nombre,
        numero_drop,
        cupos_total,
        cupos_usados,
        estado,
        fecha_inicio,
        created_at
      `)
      .eq("rifa_id", rifaId)
      .neq("estado", "archivado")
      .order("numero_drop", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (errorDrops) {
      console.error(
        "Error buscando free drops públicos:",
        errorDrops
      );

      return NextResponse.json(
        {
          error: "No se pudo buscar el free drop",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const lista = Array.isArray(drops)
      ? drops
      : [];

    /* ========================================================
       2. BUSCAR DROP ACTIVO
    ======================================================== */

    const activo =
      lista.find(
        (drop) =>
          normalizarEstado(drop.estado) ===
          "activo"
      ) || null;

    /* ========================================================
       3. BUSCAR DROP PAUSADO

       El frontend puede mostrarlo como pausado,
       pero no debe permitir participar.
    ======================================================== */

    const pausado =
      lista.find(
        (drop) =>
          normalizarEstado(drop.estado) ===
          "pausado"
      ) || null;

    /* ========================================================
       4. BUSCAR DROP AGOTADO
    ======================================================== */

    const agotado =
      lista.find(
        (drop) =>
          normalizarEstado(drop.estado) ===
          "agotado"
      ) || null;

    /* ========================================================
       5. BUSCAR DROPS PROGRAMADOS

       Conservamos el orden por fecha de inicio.
       No anunciamos borradores ni pendientes.
    ======================================================== */

    const programados = lista
      .filter(esProgramadoValido)
      .sort((a, b) => {
        const fechaA = obtenerFechaProgramada(a);
        const fechaB = obtenerFechaProgramada(b);

        return (
          fechaA.getTime() -
          fechaB.getTime()
        );
      });

    /* ========================================================
       6. SELECCIONAR EL PRÓXIMO DROP

       Solo consideramos fechas futuras.
    ======================================================== */

    const ahoraMs = Date.now();

    const proximoProgramado =
      programados.find((drop) => {
        const fecha = obtenerFechaProgramada(drop);

        return (
          fecha &&
          fecha.getTime() > ahoraMs
        );
      }) || null;

    /* ========================================================
       7. SELECCIONAR DROP VISIBLE

       PRIORIDAD ORIGINAL:

       1. ACTIVO
       2. PAUSADO
       3. AGOTADO
       4. PROGRAMADO FUTURO
    ======================================================== */

    const dropVisible =
      activo ||
      pausado ||
      agotado ||
      proximoProgramado ||
      null;

    /* ========================================================
       8. PRÓXIMO DROP

       Si existe un activo y uno programado,
       devolvemos ambos.

       Nunca repetimos el mismo Drop.
    ======================================================== */

    const proximoDrop =
      proximoProgramado &&
      proximoProgramado.id !== dropVisible?.id
        ? proximoProgramado
        : null;

    /* ========================================================
       9. RESPUESTA PÚBLICA OPTIMIZADA

       Conservamos:
       - ok
       - drop
       - proximo_drop
       - rifa

       rifa queda en null para mantener la propiedad
       sin realizar una segunda consulta a Supabase.

       La página del evento ya obtiene los datos de
       la rifa desde /api/rifa-resumen.
    ======================================================== */

    return NextResponse.json(
      {
        ok: true,

        drop: enriquecerDrop(dropVisible),

        proximo_drop: enriquecerDrop(proximoDrop),

        rifa: null,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=5, stale-while-revalidate=5",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error en GET /api/free-drops/activo:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error inesperado al cargar el free drop",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
