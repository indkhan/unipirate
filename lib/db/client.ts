import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/database.types";
import { getClientEnv } from "@/lib/env";

export function createClient() {
  const env = getClientEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
