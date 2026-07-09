"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { hashOwnerToken, ownerCookieName } from "@/lib/checks/ownership";
import { createClient } from "@/lib/db/server";
import { materializeAllTasksForUser } from "@/lib/tasks/materialize";

export async function claimResult(
  checkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsedId = z.string().uuid().safeParse(checkId);
  if (!parsedId.success) return { ok: false, error: "Invalid result." };

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to save this path." };

  const cookieStore = await cookies();
  const cookieName = ownerCookieName(parsedId.data);
  const token = cookieStore.get(cookieName)?.value;
  if (!token) {
    return { ok: false, error: "This browser does not own that result." };
  }

  const { data, error } = await db.rpc("claim_check", {
    p_check_id: parsedId.data,
    p_token_hash: hashOwnerToken(token),
  } as never);
  if (error || !data) {
    return { ok: false, error: "That result could not be claimed." };
  }

  await materializeAllTasksForUser(db, user.id);
  cookieStore.delete(cookieName);
  return { ok: true };
}
