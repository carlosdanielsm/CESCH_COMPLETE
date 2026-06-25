// app/(dashboard)/usuarios/page.tsx

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import UsuariosPageClient from "./UsuariosPageClient";

export default async function UsuariosPage() {
  const supabase = await getSupabaseServerClient();

  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol")
    .order("nombre");

  if (error) {
    throw new Error("Error cargando usuarios");
  }

  return <UsuariosPageClient usuarios={usuarios ?? []} />;
}
