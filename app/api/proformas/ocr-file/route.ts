export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google, drive_v3 } from "googleapis";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { Readable } from "stream";

const execAsync = promisify(exec);

/* =========================
   SUPABASE ADMIN
========================= */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* =========================
   GOOGLE DRIVE
========================= */
function getDriveClient(): drive_v3.Drive {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyFile) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_KEY_PATH");

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

/* =========================
   FOTOS FOLDER (GET OR CREATE)
========================= */
async function getOrCreateFotosFolder(
  drive: drive_v3.Drive,
  parentId: string
): Promise<string> {
  const q = `'${parentId}' in parents and name='FOTOS' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = res.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: {
      name: "FOTOS",
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const newId = created.data.id;
  if (!newId) throw new Error("No se pudo crear la carpeta FOTOS en Drive");

  return newId;
}

/* =========================
   GOOGLE VISION
========================= */
const visionClient = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
});

/* =========================
   POST /api/proformas/ocr-file
========================= */
export async function POST(req: Request) {
  let tmpDir: string | null = null;

  try {
    const body = (await req.json().catch(() => null)) as
      | { archivo_id?: number }
      | null;

    const archivo_id = body?.archivo_id;

    if (!archivo_id) {
      return NextResponse.json(
        { success: false, error: "archivo_id es requerido" },
        { status: 400 }
      );
    }

    console.log("🟢 [ocr-file] start", { archivo_id });

    /* ========= 1) ARCHIVO ========= */
    const { data: archivo, error: errArchivo } = await supabase
      .from("proforma_archivos")
      .select("id, ruta_archivo, proforma_id")
      .eq("id", archivo_id)
      .single();

    if (errArchivo || !archivo) {
      console.error("🔴 [ocr-file] archivo no encontrado", errArchivo);
      return NextResponse.json(
        { success: false, error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    if (!archivo.ruta_archivo) {
      return NextResponse.json(
        { success: false, error: "Archivo sin ruta_archivo en Drive" },
        { status: 422 }
      );
    }

    /* ========= 2) PROFORMA ========= */
    const { data: proforma, error: errProforma } = await supabase
      .from("proformas")
      .select("drive_folder_id")
      .eq("id", archivo.proforma_id)
      .single();

    if (errProforma || !proforma) {
      console.error("🔴 [ocr-file] proforma no encontrada", errProforma);
      return NextResponse.json(
        { success: false, error: "Proforma no encontrada" },
        { status: 404 }
      );
    }

    if (!proforma.drive_folder_id) {
      return NextResponse.json(
        { success: false, error: "Proforma sin carpeta en Drive" },
        { status: 422 }
      );
    }

    /* ========= 3) DRIVE ========= */
    const drive = getDriveClient();
    const fotosFolderId = await getOrCreateFotosFolder(
      drive,
      proforma.drive_folder_id
    );

    console.log("🟢 [ocr-file] FOTOS folder ready", fotosFolderId);

    /* ========= 4) DESCARGAR PDF ========= */
    const media = await drive.files.get(
      {
        fileId: archivo.ruta_archivo,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" }
    );

    const pdfBuffer = Buffer.from(media.data as ArrayBuffer);

    /* ========= 5) TEMP ========= */
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    await fs.writeFile(pdfPath, pdfBuffer);

    /* ========= 6) OCR TEXTO (PyMuPDF → Vision) ========= */
    const pagesDir = path.join(tmpDir, "pages");
    await fs.mkdir(pagesDir, { recursive: true });

    const pyPages = path.join(process.cwd(), "scripts", "pdf_to_images.py");
    const { stderr: pyPageErr } = await execAsync(
      `python "${pyPages}" --pdf "${pdfPath}" --out "${pagesDir}"`
    );
    if (pyPageErr?.trim()) {
      console.log("🟡 [ocr-file] pdf_to_images stderr:", pyPageErr.slice(0, 300));
    }

    const pages = (await fs.readdir(pagesDir))
      .filter((f) => /^page-\d+\.png$/.test(f))
      .sort((a, b) => {
        const na = Number(a.match(/\d+/)?.[0] ?? 0);
        const nb = Number(b.match(/\d+/)?.[0] ?? 0);
        return na - nb;
      });

    let textoOcr = "";
    for (const p of pages) {
      const buf = await fs.readFile(path.join(pagesDir, p));
      const [r] = await visionClient.textDetection(buf);
      textoOcr += r.fullTextAnnotation?.text ?? "";
      textoOcr += "\n";
    }
    textoOcr = textoOcr.trim();

    /* ========= 7) EXTRAER IMÁGENES (PYMUPDF) ========= */
    const imagesDir = path.join(tmpDir, "products");
    await fs.mkdir(imagesDir, { recursive: true });

    const py = path.join(process.cwd(), "scripts", "extract_product_images.py");

    const { stdout, stderr } = await execAsync(
      `python "${py}" --pdf "${pdfPath}" --out "${imagesDir}"`
    );

    if (stderr?.trim()) {
      console.log("🟡 [ocr-file] python stderr:", stderr.slice(0, 500));
    }

    const extracted = Number(String(stdout).trim()) || 0;

    /* ========= 8) SUBIR IMÁGENES A DRIVE/FOTOS ========= */
    const imgs = (await fs.readdir(imagesDir))
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .sort();

    for (const img of imgs) {
      const buf = await fs.readFile(path.join(imagesDir, img));

      await drive.files.create({
        requestBody: { name: img, parents: [fotosFolderId] },
        media: { mimeType: "image/png", body: Readable.from(buf) },
        supportsAllDrives: true,
      });
    }

    /* ========= 9) GUARDAR OCR EN BD ========= */
    const { error: errUpdate } = await supabase
      .from("proforma_archivos")
      .update({
        raw_ocr: textoOcr,
        estado: "procesado",
        procesado_en: new Date().toISOString(),
        error: null,
      })
      .eq("id", archivo_id);

    if (errUpdate) {
      console.error("🔴 [ocr-file] error saving OCR", errUpdate);
      return NextResponse.json(
        { success: false, error: errUpdate.message },
        { status: 500 }
      );
    }

    /* ========= 10) CLEAN ========= */
    await fs.rm(tmpDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      archivo_id,
      paginas: pages.length,
      imagenes_producto: extracted,
      ocr_length: textoOcr.length,
    });
  } catch (e: any) {
    console.error("🔥 [ocr-file] ERROR", e);

    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }

    return NextResponse.json(
      { success: false, error: e.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
