// services/proformaArchivos.ts
"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export interface ProformaArchivo {
  id: number;
  nombre_original: string;
  tipo_archivo: string;
  ruta_archivo: string;
  created_at: string;
}

export async function getArchivosByProformaId(
  proformaId: number
): Promise<ProformaArchivo[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("proforma_archivos")
    .select(`
      id,
      nombre_original,
      tipo_archivo,
      ruta_archivo,
      created_at
    `)
    .eq("proforma_id", proformaId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando archivos:", error);
    return [];
  }

  return data ?? [];
}
