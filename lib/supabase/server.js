import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server client for Server Components, Route Handlers, Server Actions.
// Next 15: cookies() is async, so this factory is async — callers do `await createClient()`.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore.
            // Session refresh is handled by middleware.
          }
        },
      },
    }
  );
}
