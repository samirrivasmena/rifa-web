import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizarNumero(valor) {
  if (valor === undefined || valor === null || valor === "") return null;

  const texto = String(valor).trim();
  const soloNumeros = texto.replace(/\D/g, "");
  if (!soloNumeros) return null;

  return Number(soloNumeros);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { rifaId, numero } = body;

    const rifaIdLimpio = String(rifaId ?? "").trim();
    const numeroBuscado = normalizarNumero(numero);

    if (!rifaIdLimpio) {
      return Response.json({ error: "Falta rifaId" }, { status: 400 });
    }

    if (numeroBuscado === null || Number.isNaN(numeroBuscado)) {
      return Response.json({ error: "Número inválido" }, { status: 400 });
    }

    // Buscar si el número fue vendido
    const { data: ticketData, error: ticketError } = await supabase
      .from("tickets")
      .select("id, numero_ticket, compra_id, rifa_id")
      .eq("rifa_id", rifaIdLimpio)
      .eq("numero_ticket", numeroBuscado)
      .maybeSingle();

    if (ticketError) {
      return Response.json({ error: ticketError.message }, { status: 500 });
    }

    // Si no fue vendido
    if (!ticketData) {
      return Response.json({
        existe: false,
        vendido: false,
        numero_ticket: numeroBuscado,
        compra_id: null,
        usuario: null,
        sorteo: null,
        esGanador: false,
      });
    }

    // Buscar compra
    const { data: compraData, error: compraError } = await supabase
      .from("compras")
      .select("id, rifa_id, usuario_id")
      .eq("id", ticketData.compra_id)
      .maybeSingle();

    if (compraError) {
      return Response.json({ error: compraError.message }, { status: 500 });
    }

    // Buscar usuario
    let usuario = null;

    if (compraData?.usuario_id) {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from("usuarios")
        .select("id, nombre, email, telefono")
        .eq("id", compraData.usuario_id)
        .maybeSingle();

      if (usuarioError) {
        return Response.json({ error: usuarioError.message }, { status: 500 });
      }

      usuario = usuarioData || null;
    }

    // Importante:
    // Aquí NO marcamos ganador.
    // Solo decimos que fue vendido.
    return Response.json({
      existe: true,
      vendido: true,
      numero_ticket: ticketData.numero_ticket,
      compra_id: ticketData.compra_id,
      usuario,
      sorteo: null,
      esGanador: false,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}