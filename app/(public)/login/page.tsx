import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/db/server";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (user) redirect(nextPath.startsWith("/login") ? "/dashboard" : nextPath);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Log in</h1>
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
