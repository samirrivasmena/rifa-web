import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function normalizarEstado(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

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

    estado: normalizarEstado(
      drop.estado
    ),

    cupos_total: cuposTotal,
    cupos_usados: cuposUsados,
    cupos_disponibles: cuposDisponibles,
  };
}

/*
 * ============================================================
 * FECHA PROGRAMADA VÁLIDA
 * ============================================================
 *
 * Un Drop solamente puede anunciarse públicamente como
 * "próximo" cuando:
 *
 * 1. Su estado real es PROGRAMADO.
 * 2. Tiene fecha_inicio.
 * 3. fecha_inicio contiene una fecha válida.
 *
 * No utilizamos created_at como fecha del lanzamiento.
 * No inventamos horarios.
 * ============================================================
 */
function obtenerFechaProgramada(drop) {
  if (!drop?.fecha_inicio) {
    return null;
  }

  const fecha = new Date(
    drop.fecha_inicio
  );

  if (
    Number.isNaN(fecha.getTime())
  ) {
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

  return Boolean(
    obtenerFechaProgramada(drop)
  );
}

export async function GET(req) {
  try {
    const supabase =
      getSupabaseServerClient();

    const { searchParams } =
      new URL(req.url);

    const rifaId =
      searchParams.get("rifaId");

    if (!rifaId) {
      return NextResponse.json(
        {
          error: "Falta rifaId",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================================
     * CARGAMOS LOS FREE DROPS DEL EVENTO
     * ========================================================
     *
     * No filtramos únicamente por "activo" porque necesitamos
     * poder representar correctamente:
     *
     * - ACTIVO
     * - PAUSADO
     * - AGOTADO
     * - PROGRAMADO
     *
     * CERRADO no se presenta como Drop vigente.
     * ARCHIVADO tampoco.
     *
     * PENDIENTE y BORRADOR pueden existir en administración,
     * pero NO se anuncian públicamente como próximos Drops.
     * ========================================================
     */

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
          error:
            "No se pudo buscar el free drop",
        },
        {
          status: 500,
        }
      );
    }

    const lista = Array.isArray(
      drops
    )
      ? drops
      : [];

    /*
     * ========================================================
     * DROP ACTIVO
     * ========================================================
     */

    const activo =
      lista.find(
        (drop) =>
          normalizarEstado(
            drop.estado
          ) === "activo"
      ) || null;

    /*
     * ========================================================
     * DROP PAUSADO
     * ========================================================
     *
     * Conservamos este comportamiento porque ya lo habíamos
     * corregido anteriormente:
     *
     * un Drop pausado puede seguir mostrándose públicamente,
     * pero el frontend NO debe permitir participar.
     * ========================================================
     */

    const pausado =
      lista.find(
        (drop) =>
          normalizarEstado(
            drop.estado
          ) === "pausado"
      ) || null;

    /*
     * ========================================================
     * DROP AGOTADO
     * ========================================================
     */

    const agotado =
      lista.find(
        (drop) =>
          normalizarEstado(
            drop.estado
          ) === "agotado"
      ) || null;

    /*
     * ========================================================
     * DROPS PROGRAMADOS
     * ========================================================
     *
     * Solamente PROGRAMADO puede anunciarse públicamente como
     * próximo Drop.
     *
     * PENDIENTE:
     *   administración interna.
     *
     * BORRADOR:
     *   administración interna.
     *
     * Ninguno de esos dos estados se expone como
     * "Próximo FREE DROP".
     * ========================================================
     */

    const programados =
      lista
        .filter(
          esProgramadoValido
        )
        .sort(
          (a, b) => {
            const fechaA =
              obtenerFechaProgramada(
                a
              );

            const fechaB =
              obtenerFechaProgramada(
                b
              );

            return (
              fechaA.getTime() -
              fechaB.getTime()
            );
          }
        );

    /*
     * ========================================================
     * PRÓXIMO DROP PROGRAMADO
     * ========================================================
     *
     * Buscamos la fecha futura más cercana.
     *
     * Normalmente pg_cron convierte rápidamente cualquier
     * programado vencido en ACTIVO.
     *
     * Aun así, esta API no anuncia como "próximo" un horario
     * que ya pasó.
     * ========================================================
     */

    const ahoraMs = Date.now();

    const proximoProgramado =
      programados.find(
        (drop) => {
          const fecha =
            obtenerFechaProgramada(
              drop
            );

          return (
            fecha &&
            fecha.getTime() >
              ahoraMs
          );
        }
      ) || null;

    /*
     * ========================================================
     * DROP PRINCIPAL QUE SE MOSTRARÁ
     * ========================================================
     *
     * Prioridad:
     *
     * 1. ACTIVO
     * 2. PAUSADO
     * 3. AGOTADO
     * 4. PROGRAMADO FUTURO
     *
     * Si existe un ACTIVO y también un PROGRAMADO:
     *
     *   drop         = ACTIVO
     *   proximo_drop = PROGRAMADO
     *
     * Si todavía no existe un Drop vigente pero sí hay uno
     * programado:
     *
     *   drop = PROGRAMADO
     *
     * De esa forma el frontend puede mostrar:
     *
     *   "Próximo FREE DROP"
     *   + fecha/hora real
     *
     * sin inventar información.
     * ========================================================
     */

    const dropVisible =
      activo ||
      pausado ||
      agotado ||
      proximoProgramado ||
      null;

    /*
     * ========================================================
     * PROXIMO_DROP
     * ========================================================
     *
     * Nunca devolvemos:
     *
     * - pendiente
     * - borrador
     * - cerrado
     * - archivado
     *
     * Tampoco devolvemos el mismo Drop dos veces.
     * ========================================================
     */

    const proximoDrop =
      proximoProgramado &&
      proximoProgramado.id !==
        dropVisible?.id
        ? proximoProgramado
        : null;

    /*
     * ========================================================
     * CARGAMOS LA RIFA
     * ========================================================
     */

    const {
      data: rifa,
      error: errorRifa,
    } = await supabase
      .from("rifas")
      .select(
        [
          "id",
          "nombre",
          "estado",
          "precio_ticket",
          "portada_url",
          "portada_scroll_url",
        ].join(", ")
      )
      .eq("id", rifaId)
      .maybeSingle();

    if (errorRifa) {
      console.warn(
        "No se pudo cargar la rifa asociada al free drop:",
        errorRifa
      );
    }

    /*
     * ========================================================
     * RESPUESTA PÚBLICA
     * ========================================================
     */

    return NextResponse.json({
      ok: true,

      /*
       * Drop principal.
       *
       * Puede ser:
       *
       * activo
       * pausado
       * agotado
       * programado
       * null
       */
      drop:
        enriquecerDrop(
          dropVisible
        ),

      /*
       * Exclusivamente un PROGRAMADO futuro real.
       *
       * Nunca PENDIENTE.
       * Nunca BORRADOR.
       */
      proximo_drop:
        enriquecerDrop(
          proximoDrop
        ),

      /*
       * Información básica de la rifa.
       */
      rifa: rifa || null,
    });
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
      }
    );
  }
}