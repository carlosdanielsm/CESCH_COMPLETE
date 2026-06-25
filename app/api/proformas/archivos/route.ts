export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proforma_id = Number(searchParams.get("proforma_id"));

  if (!proforma_id) {
    return NextResponse.json({ error: "proforma_id requerido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("proforma_archivos")
    .select("id, nombre_original, tipo_archivo, estado, procesado_en, ruta_archivo")
    .eq("proforma_id", proforma_id)
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archivos: data ?? [] });
}
