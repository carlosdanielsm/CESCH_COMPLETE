export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Readable } from "stream";
import { drive } from "@/lib/google/drive";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const proformaId = Number(formData.get("proforma_id"));
    const file = formData.get("file") as File | null;

    if (!proformaId || Number.isNaN(proformaId)) {
      return NextResponse.json({ error: "ID de proforma inválido" }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 });
    }

    const { data: proforma, error } = await supabaseAdmin
      .from("proformas")
      .select("id, drive_folder_id")
      .eq("id", proformaId)
      .single();

    if (error || !proforma?.drive_folder_id) {
      return NextResponse.json({ error: "Proforma no encontrada o sin carpeta en Drive" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const uploaded = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [proforma.drive_folder_id],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    if (!uploaded.data.id) {
      return NextResponse.json({ error: "Error al subir archivo a Drive" }, { status: 500 });
    }

    const mime = file.type ?? "";
    const tipoArchivo = mime.includes("pdf")
      ? "pdf"
      : mime.includes("excel") || mime.includes("spreadsheet")
      ? "excel"
      : mime.includes("image")
      ? "imagen"
      : "otro";

    const { error: insertError } = await supabaseAdmin.from("proforma_archivos").insert({
      proforma_id: proformaId,
      ruta_archivo: uploaded.data.id,
      nombre_original: file.name,
      tipo_archivo: tipoArchivo,
    });

    if (insertError) {
      return NextResponse.json({ error: "No se pudo guardar el archivo en la BD" }, { status: 500 });
    }

    return NextResponse.json({ success: true, nombre: file.name });
  } catch (e: any) {
    console.error("[/api/proformas/upload]", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado" }, { status: 500 });
  }
}
