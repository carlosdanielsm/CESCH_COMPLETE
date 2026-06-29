// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // En algunos contextos (por ejemplo, Server Components)
            // Next puede impedir setear cookies. En Server Actions sí funciona.
          }
        },
      },
    }
  );
}
