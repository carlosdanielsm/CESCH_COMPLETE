// services/proformas.ts
"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export interface Proforma {
  id: number;
  cliente_nombre: string;
  asesor_nombre: string;
  estado: string;
  tipo_liquidacion: string;
  fecha_creacion: string;
}

export async function getProformas(): Promise<Proforma[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("proformas")
    .select(`
      id,
      estado,
      tipo_liquidacion,
      fecha_creacion,
      clientes ( nombre ),
      usuarios ( nombre )
    `)
    .order("id", { ascending: false });

  if (error) {
    console.error("Error getProformas:", error.message);
    throw new Error("No se pudieron obtener las proformas");
  }

  return (
    data?.map((p: any) => ({
      id: p.id,
      estado: p.estado,
      tipo_liquidacion: p.tipo_liquidacion,
      fecha_creacion: p.fecha_creacion,
      cliente_nombre: p.clientes?.nombre ?? "—",
      asesor_nombre: p.usuarios?.nombre ?? "—",
    })) ?? []
  );
}
