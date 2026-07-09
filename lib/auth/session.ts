// Server-side session guards for authenticated pages and server actions.
// API routes keep their own checks (they answer 401 JSON, not a redirect),
// and flows that welcome anonymous users (checker, shared results, login)
// call `db.auth.getUser()` directly.
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

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
 * `requireUser` plus the admin-role check (`app_metadata.role === 'admin'`,
 * the same claim proxy.ts gates /admin on). Non-admins land on /dashboard.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.user.app_metadata?.role !== "admin") redirect("/dashboard");
  return session;
}
