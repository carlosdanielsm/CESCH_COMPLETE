// app/(dashboard)/logout/actions.ts
"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function logoutAction() {
  const supabase = await getSupabaseServerClient();

  await supabase.auth.signOut();

  redirect("/login");
}
