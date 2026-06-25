"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type RolUsuario =
  | "administrador"
  | "asesor"
  | "asistente"
  | "comex";

/* ======================================================
   AUTH / AUTORIZACIÓN (FUNCIONA DE VERDAD)
====================================================== */

async function assertAdministrador() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No autenticado");
  }

  const { data: usuario, error: dbError } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (dbError || !usuario) {
    throw new Error("Usuario no encontrado");
  }

  if (usuario.rol !== "administrador") {
    throw new Error("No autorizado");
  }
}

/* ======================================================
   LISTAR
====================================================== */

export async function getUsuarios() {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, creado_en")
    .order("creado_en", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ======================================================
   CREAR
====================================================== */

export async function crearUsuario(formData: FormData) {
  await assertAdministrador();

  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rol = formData.get("rol") as RolUsuario;

  const { data: authData, error } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol },
    });

  if (error) throw new Error(error.message);

  await supabaseAdmin.from("usuarios").insert({
    id: authData.user.id,
    nombre,
    email,
    rol,
  });

  revalidatePath("/usuarios");
}

/* ======================================================
   EDITAR
====================================================== */

export async function editarUsuario(formData: FormData) {
  await assertAdministrador();

  const id = formData.get("id") as string;
  const nombre = formData.get("nombre") as string;
  const rol = formData.get("rol") as RolUsuario;

  await supabaseAdmin
    .from("usuarios")
    .update({ nombre, rol })
    .eq("id", id);

  await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { nombre, rol },
  });

  revalidatePath("/usuarios");
}

/* ======================================================
   ELIMINAR
====================================================== */

export async function eliminarUsuario(formData: FormData) {
  await assertAdministrador();

  const id = formData.get("id") as string;

  await supabaseAdmin.from("usuarios").delete().eq("id", id);
  await supabaseAdmin.auth.admin.deleteUser(id);

  revalidatePath("/usuarios");
}
/* ======================================================
   RESET PASSWORD (SERVER ACTION SIN RETURN)
====================================================== */

import { cookies } from "next/headers";

export async function generarLinkResetPassword(formData: FormData) {
  await assertAdministrador();

  const email = formData.get("email") as string;
  if (!email) throw new Error("Email inválido");

  const { data, error } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

  if (error) throw new Error(error.message);

  const link = data.properties?.action_link ?? "";

  // ✅ EN NEXT 15/16 cookies() ES ASYNC
  const cookieStore = await cookies();

  cookieStore.set("reset_link", link, {
    path: "/usuarios",
    httpOnly: false,
    sameSite: "lax",
  });
}

