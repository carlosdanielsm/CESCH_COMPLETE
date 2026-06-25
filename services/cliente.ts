"use server"

import { getSupabaseServerClient } from "@/lib/supabaseServer"

export async function getClientes() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, ruc, ciudad, telefono, email, creado_en")
    .order("creado_en", { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createCliente(form: any) {
  const supabase = await getSupabaseServerClient()

  const nombre = [
    form.primer_nombre,
    form.segundo_nombre,
    form.primer_apellido,
    form.segundo_apellido,
  ].filter(Boolean).join(" ")

  const { error } = await supabase.from("clientes").insert({
    primer_nombre: form.primer_nombre,
    segundo_nombre: form.segundo_nombre || null,
    primer_apellido: form.primer_apellido,
    segundo_apellido: form.segundo_apellido || null,
    nombre,
    ruc: form.ruc || null,
    ciudad: form.ciudad || null,
    telefono: form.telefono || null,
    email: form.email || null,
    direccion: form.direccion || null,
  })

  if (error) {
    console.error(error)
    throw new Error("No se pudo crear el cliente")
  }
}
