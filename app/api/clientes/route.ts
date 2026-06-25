export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const allowed: Record<string, unknown> = {};
    const keys = ["nombre", "primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido",
                  "ruc", "ciudad", "telefono", "email", "direccion"];
    for (const k of keys) {
      if (k in fields) allowed[k] = fields[k] || null;
    }

    const { error } = await supabaseAdmin.from("clientes").update(allowed).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { nombre, ruc } = await req.json();
    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    const parts = nombre.trim().split(/\s+/);
    const primer_nombre   = parts[0] ?? "";
    const segundo_nombre  = parts.length > 2 ? parts[1] : null;
    const primer_apellido = parts.length > 2 ? parts[2] : (parts[1] ?? "");
    const segundo_apellido = parts.length > 3 ? parts.slice(3).join(" ") : null;

    const { data, error } = await supabaseAdmin
      .from("clientes")
      .insert({
        nombre: nombre.trim(),
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        ruc: ruc?.trim() || null,
      })
      .select("id, nombre, ruc")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cliente: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
