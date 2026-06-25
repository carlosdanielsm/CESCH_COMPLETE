export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EDITABLE_FIELDS = [
  "modelo",
  "nombre_comercial",
  "descripcion",
  "total_unidades",
  "valor_unitario_usd",
  "valor_total_usd",
  "raw_json",
] as const;

/* PATCH /api/proformas/items — editar campo de un item */
export async function PATCH(req: Request) {
  try {
    const { id, field, value } = await req.json();

    if (!id || !field) {
      return NextResponse.json({ error: "id y field requeridos" }, { status: 400 });
    }

    if (!EDITABLE_FIELDS.includes(field)) {
      return NextResponse.json({ error: "Campo no editable" }, { status: 400 });
    }

    const numericFields = ["total_unidades", "valor_unitario_usd", "valor_total_usd"];
    const parsed = numericFields.includes(field)
      ? value === "" || value === null ? null : Number(value)
      : value;

    const { error } = await supabaseAdmin
      .from("proforma_items")
      .update({ [field]: parsed })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* DELETE /api/proformas/items?id=X — eliminar item */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("proforma_items")
      .delete()
      .eq("id", Number(id));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
