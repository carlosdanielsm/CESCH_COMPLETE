import { sheets, drive } from "./drive";

export async function findSheetInFolder(folderId: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function fillProformaSheet(
  sheetId: string,
  items: any[],
  proformaUrl: string
) {
  // Limpiar filas de datos previas
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: "A3:AE500",
  });

  if (items.length === 0) return;

  const rows = items.map((item) => {
    const imgLink = item.imagen_drive_id
      ? `https://drive.google.com/uc?export=view&id=${item.imagen_drive_id}`
      : "";

    // 31 columnas A–AE (índice 0–30)
    const row: (string | number) [] = new Array(31).fill("");
    row[0]  = proformaUrl;                                       // A link cotizador
    row[1]  = 1;                                                 // B proveedores
    row[3]  = item.modelo ?? "";                                 // D modelo
    row[5]  = imgLink;                                           // F link imagen
    row[6]  = item.descripcion ?? item.nombre_comercial ?? "";   // G descripción
    row[7]  = item.nombre_comercial ?? "";                       // H nombre comercial
    row[8]  = item.unidad_medida ?? "PZA";                       // I unidad
    row[9]  = item.cantidad_x_caja ?? 1;                         // J cant x caja
    row[10] = item.cajas ?? 1;                                   // K cajas
    row[11] = item.total_unidades ?? "";                         // L total unidades
    row[13] = item.valor_unitario_usd ?? "";                     // N precio unit USD
    row[14] = item.valor_total_usd ?? "";                        // O total USD
    row[20] = item.partida ?? "";                                // U partida
    row[21] = item.tnan ?? "0000";                               // V TNAN
    row[22] = 0.3;                                               // W arancel
    row[23] = 0.3;                                               // X arancel TLC
    row[24] = "NO";                                              // Y permisos
    row[29] = "NO";                                              // AD permisos 2
    row[30] = item.nombre_comercial ?? "";                       // AE nombre comercial
    return row;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `A3:AE${2 + items.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}
