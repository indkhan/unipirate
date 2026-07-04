import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/db/database.types";
import { getClientEnv } from "@/lib/env";

export async function createClient() {
  const env = getClientEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — session refresh is handled by
            // the proxy, so this can be safely ignored.
          }
        },
      },
    },
  );
}
