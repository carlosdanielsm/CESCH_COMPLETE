// app/api/proformas/revisión/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

async function getFotosFolderId(drive: any, proformaFolderId: string) {
  const res = await drive.files.list({
    q: `'${proformaFolderId}' in parents and name='FOTOS' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const proforma_id = Number(url.searchParams.get("proforma_id"));

    if (!proforma_id || Number.isNaN(proforma_id)) {
      return NextResponse.json(
        { success: false, error: "proforma_id requerido" },
        { status: 400 }
      );
    }

    // 1) items
    const { data: items, error: errItems } = await supabase
      .from("proforma_items")
      .select(`
        id,
        archivo_id,
        modelo,
        nombre_comercial,
        descripcion,
        unidad_medida,
        cantidad_caja,
        cajas,
        total_unidades,
        valor_unitario_usd,
        valor_total_usd,
        cbm,
        peso_kg,
        raw_json
      `)
      .eq("proforma_id", proforma_id)
      .order("id", { ascending: true });

    if (errItems) {
      return NextResponse.json(
        { success: false, error: errItems.message },
        { status: 500 }
      );
    }

    // 2) folder drive de proforma
    const { data: proforma, error: errProf } = await supabase
      .from("proformas")
      .select("id, drive_folder_id")
      .eq("id", proforma_id)
      .single();

    if (errProf || !proforma?.drive_folder_id) {
      return NextResponse.json(
        { success: false, error: "Proforma sin carpeta en Drive" },
        { status: 500 }
      );
    }

    const drive = getDriveClient();
    const fotosFolderId = await getFotosFolderId(drive, proforma.drive_folder_id);

    // 3) imágenes dentro de FOTOS (si existe)
    let images: Array<{ id: string; name: string; thumbnailLink?: string | null; webViewLink?: string | null }> = [];

    if (fotosFolderId) {
      const resImgs = await drive.files.list({
        q: `'${fotosFolderId}' in parents and trashed=false and (mimeType contains 'image/')`,
        fields: "files(id,name,thumbnailLink,webViewLink)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 200,
      });

      images =
        resImgs.data.files?.map((f: any) => ({
          id: f.id,
          name: f.name,
          thumbnailLink: f.thumbnailLink ?? null,
          webViewLink: f.webViewLink ?? null,
        })) ?? [];

      // ordenar image_001.png, image_002.png...
      images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }

    return NextResponse.json({
      success: true,
      proforma_id,
      total_items: items?.length ?? 0,
      total_images: images.length,
      items: items ?? [],
      images,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
