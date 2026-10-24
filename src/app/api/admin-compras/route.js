import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// =========================================================
// TRAER TODOS LOS TICKETS
// =========================================================

async function traerTodosLosTickets(rifaId = null) {
  const pageSize = 1000;
  let from = 0;
  let allTickets = [];

  while (true) {
    let query = supabaseAdmin
      .from("tickets")
      .select(`
        id,
        rifa_id,
        numero_ticket,
        compra_id,
        estado,
        tipo,
        free_drop_id,
        free_drop_participation_id,
        asignado_at,
        fecha_asignacion,
        asignado_a_nombre,
        asignado_a_email,
        asignado_a_telefono
      `)
      .neq("estado", "disponible")
      .order("numero_ticket", { ascending: true })
      .range(from, from + pageSize - 1);

    if (rifaId) {
      query = query.eq("rifa_id", rifaId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    allTickets = [
      ...allTickets,
      ...(data || []),
    ];

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allTickets;
}

// =========================================================
// NORMALIZAR COMPRA
// =========================================================

function normalizarCompra(compra = {}) {
  return {
    ...compra,
    total:
      compra.monto_total ??
      compra.total ??
      0,
  };
}

// =========================================================
// PREPARAR COMPROBANTE PARA EL ADMIN
//
// SOPORTA:
//
// 1. COMPROBANTES ANTIGUOS
//    Guardados como URL pública completa.
//
// 2. COMPROBANTES NUEVOS
//    Guardados solamente como:
//    2026/10/uuid.png
//
// Para los nuevos generamos una URL firmada temporal.
// =========================================================

async function prepararComprobanteParaAdmin(compra = {}) {
  const valor = String(
    compra?.comprobante_url || ""
  ).trim();

  // ---------------------------------------------------------
  // SIN COMPROBANTE
  // ---------------------------------------------------------

  if (!valor) {
    return {
      ...compra,
      comprobante_url: null,
    };
  }

  // ---------------------------------------------------------
  // COMPROBANTE ANTIGUO
  //
  // Mantenerlo como está para no romper compras anteriores.
  // ---------------------------------------------------------

  if (
    valor.startsWith("https://") ||
    valor.startsWith("http://")
  ) {
    return {
      ...compra,
      comprobante_url: valor,
    };
  }

  // ---------------------------------------------------------
  // COMPROBANTE NUEVO
  //
  // La base de datos contiene únicamente el path.
  // Generamos una URL firmada válida durante 10 minutos.
  // ---------------------------------------------------------

  const { data, error } =
    await supabaseAdmin.storage
      .from("comprobantes")
      .createSignedUrl(
        valor,
        600
      );

  if (error) {
    console.error(
      "Error generando URL firmada del comprobante:",
      compra?.id,
      error
    );

    return {
      ...compra,
      comprobante_url: null,
    };
  }

  const signedUrl = String(
    data?.signedUrl || ""
  ).trim();

  if (!signedUrl) {
    console.error(
      "Supabase no devolvió URL firmada para el comprobante:",
      compra?.id
    );

    return {
      ...compra,
      comprobante_url: null,
    };
  }

  return {
    ...compra,
    comprobante_url: signedUrl,
  };
}

// =========================================================
// GET
// =========================================================

export async function GET(req) {
  // =========================================================
  // 1. VERIFICAR ADMIN
  // =========================================================

  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  // =========================================================
  // 2. OBTENER FILTRO DE RIFA
  // =========================================================

  const { searchParams } =
    new URL(req.url);

  const rifaId =
    searchParams.get("rifaId");

  try {
    // =========================================================
    // 3. CARGAR COMPRAS Y TICKETS
    // =========================================================

    const [
      comprasResult,
      tickets,
    ] = await Promise.all([
      supabaseAdmin
        .from("compras")
        .select(`
          id,
          rifa_id,
          usuario_id,
          nombre_cliente,
          email_cliente,
          telefono_cliente,
          cantidad_tickets,
          monto_total,
          referencia,
          metodo_pago,
          estado_pago,
          comprobante_url,
          fecha_compra,
          created_at,
          usuarios (
            id,
            nombre,
            email,
            telefono
          ),
          rifas (
            id,
            nombre,
            premio,
            descripcion,
            portada_url,
            portada_scroll_url,
            fecha_sorteo,
            hora_sorteo,
            formato,
            estado
          )
        `)
        .order(
          "fecha_compra",
          {
            ascending: false,
          }
        ),

      traerTodosLosTickets(
        rifaId
      ),
    ]);

    // =========================================================
    // 4. VALIDAR CONSULTA DE COMPRAS
    // =========================================================

    const {
      data: comprasBase,
      error: comprasError,
    } = comprasResult;

    if (comprasError) {
      return NextResponse.json(
        {
          error:
            comprasError.message ||
            "Error al cargar compras",
        },
        {
          status: 500,
        }
      );
    }

    // =========================================================
    // 5. NORMALIZAR COMPRAS
    // =========================================================

    const comprasNormalizadas =
      Array.isArray(comprasBase)
        ? comprasBase.map(
            normalizarCompra
          )
        : [];

    // =========================================================
    // 6. PREPARAR COMPROBANTES
    //
    // Los nuevos reciben URL firmada.
    // Los antiguos mantienen su URL actual.
    // =========================================================

    const compras =
      await Promise.all(
        comprasNormalizadas.map(
          prepararComprobanteParaAdmin
        )
      );

    // =========================================================
    // 7. RESPUESTA
    // =========================================================

    return NextResponse.json(
      {
        ok: true,
        compras,
        tickets:
          tickets || [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "admin-compras error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error interno del servidor",
      },
      {
        status: 500,
      }
    );
  }
}