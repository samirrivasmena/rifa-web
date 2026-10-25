import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMPROBANTES_BUCKET = "comprobantes";
const SIGNED_URL_SECONDS = 600;

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
// VALIDAR PATH DE STORAGE
// =========================================================

function esPathSeguro(path = "") {
  const valor = String(path || "").trim();

  if (!valor) return false;

  if (valor.length > 500) {
    return false;
  }

  if (
    valor.startsWith("/") ||
    valor.includes("..") ||
    valor.includes("\\")
  ) {
    return false;
  }

  return true;
}

// =========================================================
// EXTRAER PATH DE COMPROBANTE
//
// SOPORTA:
//
// NUEVO:
// 2026/10/uuid.png
//
// ANTIGUO:
// https://PROYECTO.supabase.co/storage/v1/object/public/
// comprobantes/archivo.png
// =========================================================

function obtenerPathComprobante(valorOriginal = "") {
  const valor = String(valorOriginal || "").trim();

  if (!valor) {
    return null;
  }

  // ---------------------------------------------------------
  // FORMATO NUEVO:
  // Ya tenemos solamente el path.
  // ---------------------------------------------------------

  if (
    !valor.startsWith("http://") &&
    !valor.startsWith("https://")
  ) {
    return esPathSeguro(valor)
      ? valor
      : null;
  }

  // ---------------------------------------------------------
  // FORMATO ANTIGUO:
  // URL pública completa de Supabase.
  // ---------------------------------------------------------

  try {
    const url = new URL(valor);

    const supabaseUrl = String(
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    ).trim();

    // Si tenemos la URL del proyecto configurada,
    // comprobamos que el host sea realmente nuestro Supabase.
    if (supabaseUrl) {
      try {
        const urlProyecto = new URL(supabaseUrl);

        if (url.host !== urlProyecto.host) {
          return null;
        }
      } catch {
        console.error(
          "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL no es válida."
        );

        return null;
      }
    }

    const prefijo =
      `/storage/v1/object/public/${COMPROBANTES_BUCKET}/`;

    if (!url.pathname.startsWith(prefijo)) {
      return null;
    }

    const pathCodificado =
      url.pathname.slice(prefijo.length);

    if (!pathCodificado) {
      return null;
    }

    let path;

    try {
      path = decodeURIComponent(pathCodificado);
    } catch {
      return null;
    }

    return esPathSeguro(path)
      ? path
      : null;
  } catch {
    return null;
  }
}

// =========================================================
// GENERAR URL FIRMADA PARA EL ADMIN
//
// IMPORTANTE:
// NO modifica comprobante_url en Supabase.
//
// Solamente transforma el valor que enviamos al navegador
// del administrador.
// =========================================================

async function prepararComprobanteParaAdmin(compra = {}) {
  const valorOriginal = String(
    compra?.comprobante_url || ""
  ).trim();

  if (!valorOriginal) {
    return {
      ...compra,
      comprobante_url: null,
    };
  }

  const path =
    obtenerPathComprobante(valorOriginal);

  if (!path) {
    console.error(
      "Comprobante con formato no permitido:",
      compra?.id
    );

    return {
      ...compra,
      comprobante_url: null,
    };
  }

  const { data, error } =
    await supabaseAdmin.storage
      .from(COMPROBANTES_BUCKET)
      .createSignedUrl(
        path,
        SIGNED_URL_SECONDS
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
      "Supabase no devolvió URL firmada:",
      compra?.id
    );

    return {
      ...compra,
      comprobante_url: null,
    };
  }

  return {
    ...compra,

    // El admin recibe la URL temporal.
    comprobante_url: signedUrl,
  };
}

// =========================================================
// GET
// =========================================================

export async function GET(req) {
  // =========================================================
  // 1. VERIFICAR ADMIN + MFA
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
  // 2. OBTENER RIFA
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
    // 4. VALIDAR CONSULTA
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
    // 6. GENERAR URLs FIRMADAS
    //
    // Esto funciona para:
    //
    // - comprobantes nuevos guardados como path
    // - comprobantes antiguos guardados como URL pública
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