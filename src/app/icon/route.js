import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("configuracion_sitio")
      .select("logo_url")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error obteniendo logo para icono:", error);

      return NextResponse.redirect(
        new URL(
          "/favicon.ico",
          process.env.NEXT_PUBLIC_SITE_URL ||
            "https://rifaslsd.vercel.app"
        )
      );
    }

    if (!data?.logo_url) {
      return NextResponse.redirect(
        new URL(
          "/favicon.ico",
          process.env.NEXT_PUBLIC_SITE_URL ||
            "https://rifaslsd.vercel.app"
        )
      );
    }

    const imagen = await fetch(data.logo_url, {
      cache: "no-store",
    });

    if (!imagen.ok) {
      throw new Error("No se pudo descargar el logo actual.");
    }

    const buffer = await imagen.arrayBuffer();

    const contentType =
      imagen.headers.get("content-type") || "image/png";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error generando icono dinámico:", error);

    return NextResponse.redirect(
      new URL(
        "/favicon.ico",
        process.env.NEXT_PUBLIC_SITE_URL ||
          "https://rifaslsd.vercel.app"
      )
    );
  }
}