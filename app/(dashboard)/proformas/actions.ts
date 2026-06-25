"use server";

import { revalidatePath } from "next/cache";
import { Readable } from "stream";
import { readFileSync } from "fs";
import path from "path";
import { drive } from "@/lib/google/drive";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ======================================================
   CREAR PROFORMA
====================================================== */
export async function createProformaAction(formData: FormData) {
  const cliente_id = Number(formData.get("cliente_id"));
  const asesor_id = String(formData.get("asesor_id") ?? "").trim();
  const tipo_liquidacion = String(formData.get("tipo_liquidacion") ?? "").trim();

  if (!cliente_id || !asesor_id || !tipo_liquidacion) {
    throw new Error("Datos incompletos");
  }

  /* ===== Obtener cliente ===== */
  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from("clientes")
    .select(
      `
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido
    `
    )
    .eq("id", cliente_id)
    .single();

  if (clienteError || !cliente) {
    console.error("Error cliente:", clienteError);
    throw new Error("No se pudo obtener el cliente");
  }

  const nombreCliente = [
    cliente.primer_nombre,
    cliente.segundo_nombre,
    cliente.primer_apellido,
    cliente.segundo_apellido,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/[^\w\s-]/g, "")
    .trim();

  /* ===== Crear proforma ===== */
  const { data: proforma, error: proformaError } = await supabaseAdmin
    .from("proformas")
    .insert({
      cliente_id,
      asesor_id,
      estado: "borrador",
      tipo_liquidacion,
      fecha_creacion: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (proformaError || !proforma) {
    console.error("Error proforma:", proformaError);
    throw new Error("No se pudo crear la proforma");
  }

  /* ===== Crear carpeta en Drive ===== */
  const folder = await drive.files.create({
    requestBody: {
      name: `${nombreCliente} - Proforma ${proforma.id}`,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  if (!folder.data.id) {
    throw new Error("No se pudo crear la carpeta en Drive");
  }

  /* ===== Crear Google Sheet desde plantilla ===== */
  const templatePath = path.join(process.cwd(), "scripts", "templates", "MARITIMA_TEMPLATE.xlsx");
  let sheetId: string | null = null;
  try {
    const templateBuffer = readFileSync(templatePath);
    const sheetName = `${nombreCliente} - Proforma ${proforma.id}`;
    const uploaded = await drive.files.create({
      requestBody: {
        name: sheetName,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [folder.data.id!],
      },
      media: {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Readable.from(templateBuffer),
      },
      fields: "id",
      supportsAllDrives: true,
    });
    sheetId = uploaded.data.id ?? null;
  } catch (e) {
    console.error("[createProforma] No se pudo crear el Google Sheet:", e);
  }

  /* ===== Guardar carpeta y sheet ===== */
  await supabaseAdmin
    .from("proformas")
    .update({ drive_folder_id: folder.data.id })
    .eq("id", proforma.id);

  revalidatePath("/proformas");

  return { proformaId: proforma.id, sheetId };
}

/* ======================================================
   SUBIR ARCHIVO A PROFORMA
====================================================== */
export async function uploadProformaFileAction(formData: FormData): Promise<void> {
  const proformaId = Number(formData.get("proforma_id"));
  const file = formData.get("file") as File;

  if (!proformaId || Number.isNaN(proformaId)) {
    throw new Error("ID de proforma inválido");
  }

  if (!file) {
    throw new Error("Archivo no recibido");
  }

  const { data: proforma, error } = await supabaseAdmin
    .from("proformas")
    .select("id, drive_folder_id")
    .eq("id", proformaId)
    .single();

  if (error || !proforma?.drive_folder_id) {
    throw new Error("Proforma no encontrada o sin carpeta en Drive");
  }

  const stream = Readable.from(Buffer.from(await file.arrayBuffer()));

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
    throw new Error("Error al subir archivo a Drive");
  }

  const mime = file.type ?? "";
  const tipoArchivo =
    mime.includes("pdf")
      ? "pdf"
      : mime.includes("excel") || mime.includes("spreadsheet")
      ? "excel"
      : mime.includes("image")
      ? "imagen"
      : "otro";

  const { error: insertError } = await supabaseAdmin
    .from("proforma_archivos")
    .insert({
      proforma_id: proformaId,
      ruta_archivo: uploaded.data.id,
      nombre_original: file.name,
      tipo_archivo: tipoArchivo,
    });

  if (insertError) {
    throw new Error("No se pudo guardar el archivo en la base de datos");
  }

  revalidatePath(`/proformas/${proformaId}`);
}


/* ======================================================
   ELIMINAR PROFORMA
====================================================== */
export async function deleteProformaAction(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("ID inválido");
  }

  await supabaseAdmin.from("proformas").delete().eq("id", id);

  revalidatePath("/proformas");
}

