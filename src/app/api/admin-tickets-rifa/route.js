import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function errorResponse(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function validarId(valor) {
  const id = limpiarTexto(valor);
  return Boolean(id) && /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rifaId = limpiarTexto(searchParams.get("rifaId"));

    if (!validarId(rifaId)) {
      return errorResponse("Falta rifaId", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select("id, rifa_id, compra_id, numero_ticket")
      .eq("rifa_id", rifaId)
      .order("numero_ticket", { ascending: true });

    if (error) {
      return errorResponse(
        error.message || "No se pudieron cargar los tickets",
        500
      );
    }

    const tickets = Array.isArray(data)
      ? data
          .map((ticket) => ({
            ...ticket,
            numero_ticket: Number(ticket.numero_ticket),
            vendido:
              ticket?.compra_id !== null && ticket?.compra_id !== undefined,
            disponible:
              ticket?.compra_id === null || ticket?.compra_id === undefined,
          }))
          .filter((ticket) => Number.isFinite(ticket.numero_ticket))
      : [];

    return NextResponse.json(
      {
        ok: true,
        tickets,
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
    console.error("admin-tickets-rifa error:", error);

    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}