import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAdminRole } from "@/lib/auth/roles";
import { getClientEnv } from "@/lib/env";

// Refreshes the Supabase auth session on the protected routes in `config.matcher`
// and redirects unauthenticated users to /login. Convenience only — the security
// boundary is requireUser()/requireAdmin() plus RLS.
export default async function proxy(request: NextRequest) {
  const env = getClientEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and the auth call — it can cause
  // random logouts (see Supabase SSR docs). getClaims verifies the JWT locally
  // against the project's asymmetric signing keys, so this costs no round trip;
  // it still refreshes an about-to-expire session through the cookie handlers.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !isAdminRole(claims.app_metadata)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

// Only the signed-in surfaces. /courses is exact — /courses/[id] is public.
export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/courses", "/admin/:path*"],
};
