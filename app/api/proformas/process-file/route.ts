// app/api/proformas/process-file/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import path from "path";

export const runtime = "nodejs";

/* =========================
   SUPABASE ADMIN
========================= */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* =========================
   GOOGLE DRIVE (solo lectura)
========================= */
function getDriveClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_KEY_PATH");

  const auth = new google.auth.GoogleAuth({
    keyFile: path.isAbsolute(keyPath)
      ? keyPath
      : path.join(process.cwd(), keyPath),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

/* =========================
   HELPERS INTERNOS
========================= */
async function callInternal(url: string, archivo_id: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archivo_id }),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* noop */
  }

  if (!res.ok) {
    const msg = data?.error || data?.detail || `Llamada interna falló (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/* =========================
   POST /api/proformas/process-file
========================= */
export async function POST(req: Request) {
  let archivoId: number | null = null;

  try {
    const body = await req.json();
    archivoId = body?.archivo_id;

    if (!archivoId) {
      return NextResponse.json(
        { error: "archivo_id es requerido" },
        { status: 400 }
      );
    }

    /* ========= ARCHIVO DB ========= */
    const { data: archivo, error: errArchivo } = await supabase
      .from("proforma_archivos")
      .select("id, proforma_id, ruta_archivo, estado")
      .eq("id", archivoId)
      .single();

    if (errArchivo || !archivo) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    if (archivo.estado !== "pendiente") {
      return NextResponse.json(
        { error: `Estado inválido: ${archivo.estado}` },
        { status: 409 }
      );
    }

    /* ========= MARCAR PROCESANDO ========= */
    await supabase
      .from("proforma_archivos")
      .update({
        estado: "procesando",
        procesado_en: null,
        error: null,
      })
      .eq("id", archivoId);

    /* ========= METADATA DRIVE ========= */
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId: archivo.ruta_archivo,
      supportsAllDrives: true,
      fields: "id,name,mimeType,size",
    });

    const mime = meta.data.mimeType ?? "";
    let tipoDocumento: "imagen" | "pdf" | "excel" | "otro" = "otro";

    if (mime.startsWith("image/")) tipoDocumento = "imagen";
    else if (mime === "application/pdf") tipoDocumento = "pdf";
    else if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel"
    ) tipoDocumento = "excel";

    console.log("[process-file]", {
      archivoId,
      nombre: meta.data.name,
      mime,
      tipoDocumento,
    });

    const origin = new URL(req.url).origin;

    /* ========= 1) OCR ========= */
    const ocrResult = await callInternal(
      `${origin}/api/proformas/ocr-file`,
      archivoId
    );

    /* ========= 2) PARSE GPT ========= */
    const parseResult = await callInternal(
      `${origin}/api/proformas/parse-gpt`,
      archivoId
    );

    /* ========= 3) MATCH IMÁGENES (GPT-4o Vision) ========= */
    let matchResult: any = null;
    try {
      const matchRes = await fetch(`${origin}/api/proformas/match-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proforma_id: archivo.proforma_id }),
      });
      matchResult = await matchRes.json();
      console.log("[process-file] match-images:", matchResult);
    } catch (e) {
      console.log("[process-file] match-images falló (no crítico):", e);
    }

    return NextResponse.json({
      success: true,
      message: "Procesamiento completado",
      tipoDocumento,
      ocrResult,
      parseResult,
      matchResult,
    });
  } catch (err: any) {
    console.error("[process-file] Error:", err);

    if (archivoId) {
      await supabase
        .from("proforma_archivos")
        .update({
          estado: "error",
          error: err.message ?? "Error desconocido",
        })
        .eq("id", archivoId);
    }

    return NextResponse.json(
      { error: "Error procesando archivo", detail: err.message },
      { status: 500 }
    );
  }
}
