// Supabase client for server components, server actions, and route handlers.
// The session comes from request cookies; proxy.ts keeps it refreshed.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/db/database.types";
import { getClientEnv, getServerEnv } from "@/lib/env";

/** Only check creation bypasses RLS: the action validates and computes it.
 * Never use this client for user reads, profiles, tasks, or course writes. */
export function createCheckWriter() {
  const env = getServerEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Internal queue/reconciliation I/O only. Never pass this client to chat,
 * student request operations or rendered admin views. Callers must validate
 * worker credentials or an admin-scoped RPC before entering this shell. */
export function createBackgroundWorker() {
  const env=getServerEnv();
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
}

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
