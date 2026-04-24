import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

function parseBoolean(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return false;
}

function limpiarTexto(valor) {
  const texto = String(valor ?? "").trim();
  return texto.length ? texto : null;
}

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();

    const {
      rifaId,
      nombre,
      descripcion,
      premio,
      precio_ticket,
      formato,
      fecha_sorteo,
      hora_sorteo,
      fecha_cierre,
      publicada,
      destacada,
    } = body;

    const rifaIdLimpio = String(rifaId ?? "").trim();

    if (!rifaIdLimpio) {
      return NextResponse.json(
        { error: "Falta el ID de la rifa" },
        { status: 400 }
      );
    }

    const nombreLimpio = String(nombre ?? "").trim();

    if (!nombreLimpio) {
      return NextResponse.json(
        { error: "El nombre de la rifa es obligatorio" },
        { status: 400 }
      );
    }

    const formatoLimpio = String(formato ?? "").trim();

    if (!formatoLimpio) {
      return NextResponse.json(
        { error: "El formato de la rifa es obligatorio" },
        { status: 400 }
      );
    }

    if (
      precio_ticket === undefined ||
      precio_ticket === null ||
      String(precio_ticket).trim() === ""
    ) {
      return NextResponse.json(
        { error: "El precio del ticket es obligatorio" },
        { status: 400 }
      );
    }

    const precioNormalizado = Number(precio_ticket);

    if (!Number.isFinite(precioNormalizado) || precioNormalizado <= 0) {
      return NextResponse.json(
        { error: "El precio del ticket debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // Rango corregido:
    // 3 digitos => 000 al 999
    // 4 digitos => 0000 al 9999
    let numero_inicio = 0;
    let numero_fin = 9999;

    if (formatoLimpio === "3digitos") {
      numero_inicio = 0;
      numero_fin = 999;
    } else if (formatoLimpio === "4digitos") {
      numero_inicio = 0;
      numero_fin = 9999;
    } else {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      );
    }

    // Verificar que la rifa exista antes de actualizar
    const { data: rifaExistente, error: rifaExistenteError } = await supabaseAdmin
      .from("rifas")
      .select("id")
      .eq("id", rifaIdLimpio)
      .maybeSingle();

    if (rifaExistenteError) {
      console.error("Error verificando rifa existente:", rifaExistenteError);
      return NextResponse.json(
        {
          error: "No se pudo validar la rifa",
          debug: {
            message: rifaExistenteError.message,
            code: rifaExistenteError.code,
            details: rifaExistenteError.details,
            hint: rifaExistenteError.hint,
          },
        },
        { status: 500 }
      );
    }

    if (!rifaExistente) {
      return NextResponse.json(
        { error: "La rifa no existe" },
        { status: 404 }
      );
    }

    const updateData = {
      nombre: nombreLimpio,
      descripcion: limpiarTexto(descripcion),
      premio: limpiarTexto(premio),
      precio_ticket: precioNormalizado,
      formato: formatoLimpio,
      numero_inicio,
      numero_fin,
      fecha_sorteo: limpiarTexto(fecha_sorteo),
      hora_sorteo: limpiarTexto(hora_sorteo),
      fecha_cierre: limpiarTexto(fecha_cierre),
      publicada: parseBoolean(publicada),
      destacada: parseBoolean(destacada),
    };

    const { data, error } = await supabaseAdmin
      .from("rifas")
      .update(updateData)
      .eq("id", rifaIdLimpio)
      .select("*")
      .single();

    if (error) {
      console.error("Error actualizando rifa:", error);
      return NextResponse.json(
        { error: error.message || "No se pudo actualizar la rifa" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Rifa actualizada correctamente",
      rifa: data,
    });
  } catch (error) {
    console.error("Error en editar-rifa:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}