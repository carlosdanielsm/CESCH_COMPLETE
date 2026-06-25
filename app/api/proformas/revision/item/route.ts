import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const item_id = Number(body?.id ?? body?.item_id);

    if (!item_id || Number.isNaN(item_id)) {
      return NextResponse.json(
        { success: false, error: "item_id requerido" },
        { status: 400 }
      );
    }

    const payload = {
      nombre_comercial: body?.nombre_comercial ?? null,
      descripcion: body?.descripcion ?? null,
      unidad_medida: body?.unidad_medida ?? null,
      total_unidades: body?.total_unidades != null ? Number(body.total_unidades) : null,
      valor_unitario_usd: body?.valor_unitario_usd != null ? Number(body.valor_unitario_usd) : null,
      valor_total_usd: body?.valor_total_usd != null ? Number(body.valor_total_usd) : null,
      raw_json: body?.raw_json ?? null,
    };

    const { error } = await supabase.from("proforma_items").update(payload).eq("id", item_id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item_id });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
