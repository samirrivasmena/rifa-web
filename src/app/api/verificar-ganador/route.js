import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { rifaId, numero } = body;

    if (!rifaId) {
      return Response.json({ error: "Falta rifaId" }, { status: 400 });
    }

    if (numero === undefined || numero === null) {
      return Response.json({ error: "Falta número" }, { status: 400 });
    }

    const numeroBuscado = Number(numero);

    if (Number.isNaN(numeroBuscado)) {
      return Response.json({ error: "Número inválido" }, { status: 400 });
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("rifa_id", rifaId)
      .eq("numero_ticket", numeroBuscado)
      .maybeSingle();

    if (ticketError) {
      return Response.json({ error: ticketError.message }, { status: 500 });
    }

    if (!ticketData) {
      return Response.json({
        existe: false,
        numero_ticket: numeroBuscado,
        compra_id: null,
        usuario: null,
        sorteo: null,
        esGanador: false,
      });
    }

    const { data: compraData, error: compraError } = await supabase
      .from("compras")
      .select(`
        id,
        rifa_id,
        usuario_id,
        usuarios (
          id,
          nombre,
          email,
          telefono
        )
      `)
      .eq("id", ticketData.compra_id)
      .maybeSingle();

    if (compraError) {
      return Response.json({ error: compraError.message }, { status: 500 });
    }

    const { data: sorteoData, error: sorteoError } = await supabase
      .from("sorteos")
      .select("id, numero_ganador, numero_oficial, rifa_id, fecha_sorteo, fuente")
      .eq("rifa_id", rifaId)
      .or(`numero_ganador.eq.${numeroBuscado},numero_oficial.eq.${numeroBuscado}`)
      .maybeSingle();

    if (sorteoError) {
      return Response.json({ error: sorteoError.message }, { status: 500 });
    }

    return Response.json({
      existe: true,
      numero_ticket: ticketData.numero_ticket,
      compra_id: ticketData.compra_id,
      usuario: compraData?.usuarios || null,
      sorteo: sorteoData || null,
      esGanador: Boolean(sorteoData),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}