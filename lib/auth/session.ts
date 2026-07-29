// Server-side session guards for authenticated pages and server actions.
// API routes keep their own checks (they answer 401 JSON, not a redirect),
// and flows that welcome anonymous users (checker, shared results, login)
// call `db.auth.getUser()` directly.
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/db/server";

export type Session = {
  db: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

/**
 * Supabase client + signed-in user, or a redirect to /login.
 * Pass `nextPath` to return the user here after signing in.
 */
export async function requireUser(nextPath?: string): Promise<Session> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    redirect(
      nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login",
    );
  }
  return { db, user };
}

/**
 * `requireUser` plus the admin-role check — the same claim proxy.ts gates
 * /admin on and `public.is_admin()` reads. Non-admins land on /dashboard.
 *
 * Deliberately built on `getUser()`, not `getClaims()`: this guard fronts every
 * admin server action, and a locally-verified JWT stays valid until `exp`, so a
 * banned or deleted user would keep access for the rest of the token lifetime.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!isAdminRole(session.user.app_metadata)) redirect("/dashboard");
  return session;
}
