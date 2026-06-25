import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("proformas")
    .select("id, estado, tipo_liquidacion, clientes(nombre), usuarios(nombre)")
    .eq("id", Number(id))
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Proforma no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    estado: (data as any).estado,
    tipo_liquidacion: (data as any).tipo_liquidacion,
    cliente_nombre: ((data as any).clientes as any)?.nombre ?? "",
    asesor_nombre: ((data as any).usuarios as any)?.nombre ?? "",
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  if (body.estado !== undefined)          allowed.estado = body.estado;
  if (body.tipo_liquidacion !== undefined) allowed.tipo_liquidacion = body.tipo_liquidacion;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("proformas")
    .update(allowed)
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
