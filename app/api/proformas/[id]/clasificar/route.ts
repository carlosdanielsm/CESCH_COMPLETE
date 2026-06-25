import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { obtenerPartidasCandidatas } from "@/lib/guru/guruAranceles";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const proformaId = Number(id);


  if (!proformaId) {
    return NextResponse.json({ error: "Proforma inválida" }, { status: 400 });
  }

  const { data: items, error } = await supabase
    .from("proforma_items")
    .select("*")
    .eq("proforma_id", proformaId)
    .neq("clasificacion_estado", "confirmado");

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  for (const item of items ?? []) {
    try {
      const texto = `${item.nombre_comercial ?? ""} ${item.descripcion ?? ""}`
        .toLowerCase()
        .trim();

      // 1️⃣ Catálogo
      const { data: sinonimo } = await supabase
        .from("producto_sinonimos")
        .select(`
          nombre_producto_id,
          nombres_producto (
            hs_sugerido_id,
            categorias
          )
        `)
        .ilike("sinonimo", `%${texto}%`)
        .limit(1)
        .maybeSingle();

      if (sinonimo && sinonimo.nombres_producto?.length) {
        const producto = sinonimo.nombres_producto[0];

        await supabase
          .from("proforma_items")
          .update({
            nombre_producto_id: sinonimo.nombre_producto_id,
            hs_catalogo_id: producto.hs_sugerido_id ?? null,
            categoria_ai: producto.categorias ?? null,
            clasificacion_fuente: "catalogo",
            clasificacion_estado: "sugerido",
            hs_ai_confidence: 0.9,
            clasificacion_version: "catalogo-v1",
          })
          .eq("id", item.id);

        continue;
      }

      // 2️⃣ GPT
      const prompt = `
Devuelve SOLO JSON válido:

{
  "categoria": "",
  "material": "",
  "genero": "",
  "tipo": "",
  "hs_6": "",
  "confidence": 0.0,
  "reason": ""
}

Producto:
Nombre: ${item.nombre_comercial}
Descripción: ${item.descripcion}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0].message.content;
      if (!raw) continue;

      const parsed = JSON.parse(raw);

      // 3️⃣ Guru Aranceles → obtener código de 10 dígitos
      let hs10: string | null = null;
      let hs10_descripcion: string | null = null;
      let hs10_arancel: number | null = null;
      let guru_fuente: "cache" | "api" | "no_encontrado" = "no_encontrado";

      if (parsed.hs_6 && parsed.hs_6.length >= 4) {
        try {
          const descripcionCompleta = `${parsed.categoria ?? ""} ${parsed.tipo ?? ""} ${item.nombre_comercial ?? ""} ${item.descripcion ?? ""}`.trim();
          const candidatas = await obtenerPartidasCandidatas(
            parsed.hs_6,
            descripcionCompleta
          );

          if (candidatas.length > 0) {
            // Tomar la primera candidata (la más específica de 10 dígitos)
            const mejor = candidatas[0];
            hs10 = mejor.codigo_normalizado;
            hs10_descripcion = mejor.descripcion;
            hs10_arancel = mejor.arancel_pct;
            guru_fuente = "api"; // se actualiza desde buscarPartidas
          }
        } catch (guruErr: any) {
          console.warn(`[clasificar] Guru Aranceles falló para item ${item.id}:`, guruErr?.message);
          // No es error fatal — el item queda con hs_6 y sin hs_10
        }
      }

      await supabase
        .from("proforma_items")
        .update({
          categoria_ai: parsed.categoria,
          material_ai: parsed.material,
          genero_ai: parsed.genero,
          tipo_ai: parsed.tipo,
          hs_ai_6: parsed.hs_6,
          hs_ai_10: hs10,                          // ← NUEVO: código 10 dígitos
          hs_ai_10_descripcion: hs10_descripcion,  // ← NUEVO: descripción oficial
          hs_ai_10_arancel: hs10_arancel,          // ← NUEVO: % de arancel
          hs_ai_confidence: parsed.confidence,
          hs_ai_reason: parsed.reason,
          clasificacion_fuente: "gpt",
          clasificacion_estado: "sugerido",
          clasificacion_version: "gpt-4o-mini-guru-v1",
        })
        .eq("id", item.id);
    } catch (err: any) {
      console.error(err);

      await supabase
        .from("proforma_items")
        .update({
          clasificacion_estado: "error",
          hs_ai_reason: err.message ?? "Error GPT",
        })
        .eq("id", item.id);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Clasificación completada",
  });
}