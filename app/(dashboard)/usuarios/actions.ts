// app/(dashboard)/usuarios/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type RolUsuario =
  | "administrador"
  | "asesor"
  | "asistente"
  | "comex";

/* =========================
   AUTH GUARD (SERVER ONLY)
========================= */
async function assertAdministrador() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No autenticado");
  }

  const { data: usuario, error: rolError } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (rolError || !usuario) {
    throw new Error("Usuario no encontrado");
  }

  if (usuario.rol !== "administrador") {
    throw new Error("No autorizado");
  }

  return user;
}

/* =========================
   CREAR USUARIO
========================= */
export async function crearUsuario(formData: FormData) {
  await assertAdministrador();

  const nombre = String(formData.get("nombre") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const rol = formData.get("rol") as RolUsuario;

  if (!nombre || !email || !rol) {
    throw new Error("Datos incompletos");
  }

  let userId: string;

  /**
   * 1️⃣ INTENTAR CREAR EN AUTH
   */
  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { nombre, rol },
    });

  if (createError) {
    // Si falla porque ya existe → buscar el usuario existente
    const { data: usersData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      throw new Error(listError.message);
    }

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!existingUser) {
      throw new Error(createError.message);
    }

    userId = existingUser.id;

    // Actualizar metadata
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { nombre, rol },
    });
  } else {
    // Usuario creado correctamente
    if (!created?.user) {
      throw new Error("No se pudo crear el usuario");
    }
    userId = created.user.id;
  }

  /**
   * 2️⃣ UPSERT EN public.usuarios (CLAVE)
   */
  const { error: dbError } = await supabaseAdmin
    .from("usuarios")
    .upsert(
      {
        id: userId,
        nombre,
        email,
        rol,
      },
      { onConflict: "id" }
    );

  if (dbError) {
    throw new Error(dbError.message);
  }

  revalidatePath("/usuarios");
}



/* =========================
   EDITAR USUARIO
========================= */
export async function editarUsuario(formData: FormData) {
  await assertAdministrador();

  const id = String(formData.get("id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const rol = formData.get("rol") as RolUsuario;

  if (!id || !nombre || !rol) {
    throw new Error("Datos inválidos");
  }

  const { error: dbError } = await supabaseAdmin
    .from("usuarios")
    .update({ nombre, rol })
    .eq("id", id);

  if (dbError) {
    throw new Error(dbError.message);
  }

  await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { nombre, rol },
  });

  revalidatePath("/usuarios");
}

/* =========================
   ELIMINAR USUARIO
========================= */
export async function eliminarUsuario(formData: FormData) {
  await assertAdministrador();

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID inválido");

  await supabaseAdmin.from("usuarios").delete().eq("id", id);
  await supabaseAdmin.auth.admin.deleteUser(id);

  revalidatePath("/usuarios");
}

/* =========================
   RESET PASSWORD
========================= */
export async function generarLinkResetPassword(email: string) {
  await assertAdministrador();

  if (!email) throw new Error("Email inválido");

  const { data, error } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

  if (error) throw new Error(error.message);

  return data.properties?.action_link ?? null;
}
