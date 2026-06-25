// lib/google/drive.ts
import { google } from "googleapis";
import path from "path";

/**
 * Normaliza nombres para evitar problemas en Google Drive
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\/\\?%*:|"<>]/g, "");
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!),
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

export const drive = google.drive({ version: "v3", auth });
export const sheets = google.sheets({ version: "v4", auth });

/**
 * Obtiene o crea la carpeta del cliente dentro de la carpeta raíz configurada
 */
export async function getOrCreateClientFolder(
  clientName: string
): Promise<string> {
  const parentId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  const safeName = normalizeName(clientName);

  // 1. Buscar carpeta existente
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // 2. Crear carpeta si no existe
  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return folder.data.id!;
}
