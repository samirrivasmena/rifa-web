import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   OCULTAR NOMBRE

   IMPORTANTE:
   El nombre se anonimiza EN EL SERVIDOR.

   Ejemplos:
   "Samir Rivas" -> "Samir ***"
   "Carlos"      -> "Carlos ***"

   De esta manera el navegador nunca recibe
   el nombre completo del comprador.
========================================================= */

function ocultarNombre(nombre = "Cliente") {
  const limpio = String(nombre || "Cliente").trim();

  if (!limpio) {
    return "Cliente ***";
  }

  const primerNombre =
    limpio.split(/\s+/).filter(Boolean)[0] || "Cliente";

  return `${primerNombre} ***`;
}

/* =========================================================
   CREAR ID PÚBLICO

   No enviamos al navegador el ID real de la compra.

   El componente solamente necesita un identificador para
   saber si ya mostró esa notificación.

   El ID público se genera usando el momento REAL
   en que la compra fue aprobada.

   Esto también permite distinguir una nueva aprobación
   sin exponer el ID real de Supabase.
========================================================= */

function crearIdPublico(compra) {
  const base = [
    String(compra?.id || ""),
    String(compra?.aprobado_at || ""),
    String(compra?.cantidad_tickets || ""),
  ].join(":");

  return createHash("sha256")
    .update(base)
    .digest("hex")
    .slice(0, 20);
}

/* =========================================================
   GET /api/notificaciones-compras

   ESTA RUTA ES PÚBLICA POR DISEÑO.

   Se utiliza para mostrar las notificaciones públicas
   de compras recientemente APROBADAS.

   Por seguridad:
   - NO devuelve email.
   - NO devuelve teléfono.
   - NO devuelve comprobante.
   - NO devuelve monto.
   - NO devuelve el ID real de la compra.
   - NO devuelve el nombre completo.

   IMPORTANTE:
   Las compras se ordenan por aprobado_at.

   Esto significa que "ÚLTIMA COMPRA" representa
   la compra aprobada más recientemente en el admin,
   no simplemente la compra creada más recientemente.
========================================================= */

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("compras")
      .select(`
        id,
        cantidad_tickets,
        fecha_compra,
        aprobado_at,
        usuarios!compras_usuario_id_fkey (
          nombre
        ),
        rifas!compras_rifa_id_fkey (
          nombre
        )
      `)
      .eq("estado_pago", "aprobado")
      .not("aprobado_at", "is", null)
      .order("aprobado_at", {
        ascending: false,
      })
      .limit(20);

    /* =====================================================
       ERROR DE SUPABASE
    ===================================================== */

    if (error) {
      console.error(
        "Error cargando notificaciones de compras:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudieron cargar las notificaciones",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    /* =====================================================
       PREPARAR INFORMACIÓN PÚBLICA

       La información sensible se elimina ANTES de enviarla
       al navegador.
    ===================================================== */

    const compras = (data || []).map((compra) => {
      const nombreOriginal =
        compra?.usuarios?.nombre || "Cliente";

      const nombrePublico =
        ocultarNombre(nombreOriginal);

      const cantidadTickets =
        Number(compra?.cantidad_tickets) > 0
          ? Number(compra.cantidad_tickets)
          : 1;

      const nombreRifa =
        String(
          compra?.rifas?.nombre || "Rifa"
        ).trim() || "Rifa";

      return {
        /*
         * Este NO es el ID real de Supabase.
         *
         * FloatingPurchaseNotifications lo utiliza
         * solamente para detectar si ya mostró
         * esta aprobación.
         */
        id: crearIdPublico(compra),

        /*
         * El nombre ya sale protegido desde
         * el servidor.
         */
        nombre: nombrePublico,

        cantidad_tickets: cantidadTickets,

        rifa: nombreRifa,

        /*
         * Conservamos fecha_compra por compatibilidad
         * con el frontend existente.
         */
        fecha_compra:
          compra?.fecha_compra || null,

        /*
         * Momento real en que la compra fue aprobada.
         *
         * Este es el dato utilizado para ordenar
         * correctamente las notificaciones.
         */
        aprobado_at:
          compra?.aprobado_at || null,
      };
    });

    /* =====================================================
       RESPUESTA
    ===================================================== */

    return NextResponse.json(
      {
        ok: true,
        compras,
      },
      {
        status: 200,
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
      "Error inesperado en notificaciones-compras:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudieron cargar las notificaciones",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}