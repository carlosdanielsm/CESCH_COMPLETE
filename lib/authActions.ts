// lib/authActions.ts

"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function logout() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
}
