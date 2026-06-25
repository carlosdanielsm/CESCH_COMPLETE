export const runtime = "nodejs";

/**
 * POST /api/proformas/match-images
 * Usa GPT-4o Vision para emparejar imágenes extraídas del PDF con los items
 * de la proforma. Actualiza proforma_items.raw_json con el Drive ID de la imagen.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getDriveClient() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyFile) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_KEY_PATH");
  const auth = new google.auth.GoogleAuth({
    keyFile: path.isAbsolute(keyFile) ? keyFile : path.join(process.cwd(), keyFile),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

async function downloadAsBase64(drive: any, fileId: string): Promise<string> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer).toString("base64");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const proforma_id = Number(body.proforma_id);

    if (!proforma_id) {
      return NextResponse.json({ error: "proforma_id requerido" }, { status: 400 });
    }

    /* 1) Items de la proforma */
    const { data: items, error: errItems } = await supabaseAdmin
      .from("proforma_items")
      .select("id, nombre_comercial, descripcion, raw_json")
      .eq("proforma_id", proforma_id)
      .order("id", { ascending: true });

    if (errItems || !items?.length) {
      return NextResponse.json({ error: "No hay items en esta proforma" }, { status: 404 });
    }

    /* 2) Carpeta FOTOS en Drive */
    const { data: proforma } = await supabaseAdmin
      .from("proformas")
      .select("drive_folder_id")
      .eq("id", proforma_id)
      .single();

    if (!proforma?.drive_folder_id) {
      return NextResponse.json({ error: "Proforma sin carpeta en Drive" }, { status: 404 });
    }

    const drive = getDriveClient();

    const fotosRes = await drive.files.list({
      q: `'${proforma.drive_folder_id}' in parents and name='FOTOS' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const fotosFolderId = fotosRes.data.files?.[0]?.id;
    if (!fotosFolderId) {
      return NextResponse.json({ error: "Carpeta FOTOS no encontrada. Primero procesa el archivo." }, { status: 404 });
    }

    const imgsRes = await drive.files.list({
      q: `'${fotosFolderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: "files(id,name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "name",
      pageSize: 50,
    });

    const driveImages = (imgsRes.data.files ?? []) as { id: string; name: string }[];

    if (!driveImages.length) {
      return NextResponse.json({ error: "No hay imágenes en Drive/FOTOS" }, { status: 404 });
    }

    /* 3) Descargar imágenes como base64 (máx 20 para no pasarnos) */
    const MAX_IMAGES = 20;
    const imagesToProcess = driveImages.slice(0, MAX_IMAGES);

    console.log(`[match-images] ${imagesToProcess.length} imágenes, ${items.length} items`);

    const base64Images: { name: string; id: string; b64: string }[] = [];
    for (const img of imagesToProcess) {
      try {
        const b64 = await downloadAsBase64(drive, img.id);
        base64Images.push({ name: img.name, id: img.id, b64 });
      } catch (e) {
        console.log(`[match-images] no se pudo bajar ${img.name}:`, e);
      }
    }

    if (!base64Images.length) {
      return NextResponse.json({ error: "No se pudieron descargar las imágenes" }, { status: 500 });
    }

    /* 4) Llamar a GPT-4o Vision */
    const itemList = items
      .map((it, i) => `${i}: ${it.nombre_comercial ?? ""} ${it.descripcion ?? ""}`.trim())
      .join("\n");

    const systemPrompt = `Eres un experto en análisis de proformas de proveedores chinos.
Se te mostrarán imágenes extraídas de un PDF de proforma. Cada imagen puede ser:
- Logo de la empresa (esquina superior, rectangular horizontal)
- Cabecera o decoración
- Foto de un producto del listado

Los productos en esta proforma son:
${itemList}

Para cada imagen que recibas, responde con el índice del producto que muestra (0, 1, 2...) o null si es un logo/cabecera/decoración.

Responde SOLO con JSON: {"matches": [{"image": "nombre_imagen", "item_index": 0}, ...]}
Si es logo/cabecera: {"image": "nombre_imagen", "item_index": null}`;

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: `Analiza estas ${base64Images.length} imágenes y empareja cada una con el producto correcto de la lista, o marca como null si es logo/cabecera/decoración.`,
      },
      ...base64Images.map((img) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${img.b64}`,
          detail: "low" as const, // low = rápido y barato, suficiente para identificar producto
        },
      })),
      {
        type: "text",
        text: `Las imágenes son en orden: ${base64Images.map((i) => i.name).join(", ")}. Responde con el JSON de matches.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    console.log("[match-images] GPT response:", raw.slice(0, 500));

    let parsed: { matches?: { image: string; item_index: number | null }[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "GPT devolvió JSON inválido", raw }, { status: 500 });
    }

    const matches = parsed.matches ?? [];

    /* 5) Construir mapping item_index → drive_image_id */
    const itemImageMap: Record<number, string> = {};
    for (const m of matches) {
      if (m.item_index == null) continue;
      const img = base64Images.find((i) => i.name === m.image);
      if (!img) continue;
      // Si un item ya tiene imagen asignada, no pisar (primera imagen gana)
      if (!(m.item_index in itemImageMap)) {
        itemImageMap[m.item_index] = img.id;
      }
    }

    console.log("[match-images] mapping:", itemImageMap);

    /* 6) Actualizar proforma_items con imagen_drive_id en raw_json */
    const updatePromises: PromiseLike<any>[] = [];
    for (const [idxStr, driveId] of Object.entries(itemImageMap)) {
      const idx = Number(idxStr);
      const item = items[idx];
      if (!item) continue;

      const newRawJson = { ...(item.raw_json ?? {}), imagen_drive_id: driveId };
      updatePromises.push(
        supabaseAdmin
          .from("proforma_items")
          .update({ raw_json: newRawJson })
          .eq("id", item.id)
      );
    }

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      total_images: driveImages.length,
      processed: base64Images.length,
      matched: Object.keys(itemImageMap).length,
      mapping: itemImageMap,
    });
  } catch (e: any) {
    console.error("[match-images] ERROR:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado" }, { status: 500 });
  }
}
