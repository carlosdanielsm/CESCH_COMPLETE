export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findSheetInFolder, fillProformaSheet } from "@/lib/google/sheets-fill";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const proformaId = Number(id);

  const [{ data: proforma }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("proformas")
      .select("drive_folder_id")
      .eq("id", proformaId)
      .single(),
    supabaseAdmin
      .from("proforma_items")
      .select("*")
      .eq("proforma_id", proformaId)
      .order("id", { ascending: true }),
  ]);

  const folderId = (proforma as any)?.drive_folder_id;
  if (!folderId) {
    return NextResponse.json({ error: "La proforma no tiene carpeta en Drive" }, { status: 404 });
  }

  const sheetId = await findSheetInFolder(folderId);
  if (!sheetId) {
    return NextResponse.json({ error: "No se encontró el Google Sheet en la carpeta de Drive" }, { status: 404 });
  }

  const proformaUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/proformas/${proformaId}`;
  const mappedItems = ((items as any[]) ?? []).map((item: any) => ({
    ...item,
    imagen_drive_id: item.raw_json?.imagen_drive_id ?? null,
  }));

  await fillProformaSheet(sheetId, mappedItems, proformaUrl);

  return NextResponse.json({
    url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
  });
}
