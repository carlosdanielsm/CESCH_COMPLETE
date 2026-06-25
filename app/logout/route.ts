// app/(dashboard)/logout/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL("/login", "http://localhost:3000"),
    { status: 302 }
  );
}
