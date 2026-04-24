import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export async function GET(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const [
      { data: rifasData, error: rifasError },
      { data: sorteosData, error: sorteosError },
    ] = await Promise.all([
      supabaseAdmin
        .from("rifas")
        .select("*")
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("sorteos")
        .select("id, rifa_id, numero_ganador, numero_oficial, fecha_sorteo, fuente")
        .order("fecha_sorteo", { ascending: false }),
    ]);

    if (rifasError) {
      return NextResponse.json(
        { error: rifasError.message || "No se pudieron listar las rifas" },
        { status: 500 }
      );
    }

    if (sorteosError) {
      return NextResponse.json(
        { error: sorteosError.message || "No se pudieron listar los sorteos" },
        { status: 500 }
      );
    }

    const sorteoPorRifa = {};

    (sorteosData || []).forEach((sorteo) => {
      const key = String(sorteo.rifa_id);

      if (!sorteoPorRifa[key]) {
        sorteoPorRifa[key] = sorteo;
      }
    });

    const rifas = (rifasData || []).map((rifa) => {
      const sorteo = sorteoPorRifa[String(rifa.id)] || null;

      const numeroGanador =
        rifa.numero_ganador ??
        rifa.numero_oficial ??
        sorteo?.numero_ganador ??
        sorteo?.numero_oficial ??
        null;

      const numeroGanadorFormateado =
        numeroGanador !== null && numeroGanador !== undefined && numeroGanador !== ""
          ? String(numeroGanador)
          : null;

      return {
        ...rifa,
        numero_ganador: numeroGanador,
        numero_oficial: numeroGanadorFormateado,
        sorteo,
      };
    });

    return NextResponse.json({
      ok: true,
      rifas,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}