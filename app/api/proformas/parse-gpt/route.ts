import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { PARSE_PROFORMA_PROMPT } from "../_prompts/parseProforma.prompt";

/* =========================
   LOG 0 – MODULE LOAD
========================= */
console.log("🟢 [parse-gpt] module loaded");

/* =========================
   ENV CHECK
========================= */
console.log("🟢 [parse-gpt] env check", {
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});

/* =========================
   INIT OPENAI (MODELO CORRECTO)
========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   POST /api/proformas/parse-gpt
========================= */
export async function POST(req: Request) {
  console.log("🟢 [parse-gpt] POST entered");

  try {
    /* =========================
       1) BODY
    ========================= */
    const body = await req.json().catch(() => null);

    if (!body || !body.archivo_id) {
      return NextResponse.json(
        { success: false, error: "archivo_id requerido" },
        { status: 400 }
      );
    }

    const archivo_id = Number(body.archivo_id);

    /* =========================
       2) SUPABASE
    ========================= */
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /* =========================
       3) FETCH OCR
    ========================= */
    const { data: archivo, error } = await supabase
      .from("proforma_archivos")
      .select("id, proforma_id, raw_ocr")
      .eq("id", archivo_id)
      .single();

    if (error || !archivo) {
      console.error("🔴 [parse-gpt] archivo no encontrado", error);
      return NextResponse.json(
        { success: false, error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    if (
      !archivo.raw_ocr ||
      typeof archivo.raw_ocr !== "string" ||
      archivo.raw_ocr.trim().length < 50
    ) {
      return NextResponse.json(
        { success: false, error: "OCR vacío o insuficiente" },
        { status: 400 }
      );
    }

    console.log("🟢 [parse-gpt] OCR length", archivo.raw_ocr.length);

    /* =========================
       4) GPT CALL
    ========================= */
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // ✅ modelo correcto para JSON estructurado
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 6000,
      messages: [
        {
          role: "system",
          content: PARSE_PROFORMA_PROMPT,
        },
        {
          role: "user",
          content: `TEXTO OCR DE LA PROFORMA:\n\n${archivo.raw_ocr}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;

    if (!raw) {
      return NextResponse.json(
        { success: false, error: "GPT no devolvió contenido" },
        { status: 500 }
      );
    }

    console.log("🟢 [parse-gpt] GPT raw preview:", raw.slice(0, 300));

    /* =========================
       5) PARSE JSON
    ========================= */
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("🔴 [parse-gpt] JSON inválido de GPT");
      return NextResponse.json(
        { success: false, error: "JSON inválido devuelto por GPT", raw },
        { status: 500 }
      );
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "GPT no devolvió items válidos" },
        { status: 422 }
      );
    }

    console.log("🟢 [parse-gpt] items count", parsed.items.length);

    /* =========================
       6) CLEAN + INSERT
    ========================= */
    await supabase
      .from("proforma_items")
      .delete()
      .eq("archivo_id", archivo_id);

    const rows = parsed.items.map((item: any) => ({
      proforma_id: archivo.proforma_id,
      archivo_id,
      modelo: item.modelo ?? null,
      nombre_comercial: item.nombre_comercial ?? null,
      descripcion: item.descripcion ?? null,
      unidad_medida: item.unidad_medida ?? null,
      total_unidades:
        item.total_unidades != null ? Number(item.total_unidades) : null,
      valor_unitario_usd:
        item.valor_unitario_usd != null
          ? Number(item.valor_unitario_usd)
          : null,
      valor_total_usd:
        item.valor_total_usd != null
          ? Number(item.valor_total_usd)
          : null,
      raw_json: item,
    }));

    const { error: errInsert } = await supabase
      .from("proforma_items")
      .insert(rows);

    if (errInsert) {
      console.error("🔴 [parse-gpt] insert error", errInsert);
      return NextResponse.json(
        { success: false, error: errInsert.message },
        { status: 500 }
      );
    }

    /* =========================
       7) SAVE PARSED DATA (AUDITORÍA)
    ========================= */
    await supabase
      .from("proforma_archivos")
      .update({
        parsed_data: parsed,
      })
      .eq("id", archivo_id);

    console.log("🟢 [parse-gpt] DONE");

    return NextResponse.json({
      success: true,
      archivo_id,
      proforma_id: archivo.proforma_id,
      total_items: rows.length,
    });
  } catch (err: any) {
    console.error("🔥 [parse-gpt] UNCAUGHT ERROR", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
