import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export async function POST(req) {
  const auth = await requireAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    const extension = file.name?.split(".").pop()?.toLowerCase() || "jpg";
    const nombreArchivo = `portadas/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("rifas")
      .upload(nombreArchivo, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "No se pudo subir la imagen" },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage
      .from("rifas")
      .getPublicUrl(nombreArchivo);

    return NextResponse.json({
      ok: true,
      url: data?.publicUrl || "",
      path: nombreArchivo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}