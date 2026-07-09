"use server";

import { cookies } from "next/headers";

import {
  createOwnerToken,
  hashOwnerToken,
  ownerCookieName,
} from "@/lib/checks/ownership";
import type { Json } from "@/lib/db/database.types";
import { getPublishedRules, insertCheck, upsertProfile } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { evaluate } from "@/lib/engine/evaluate";
import { materializeAllTasksForUser } from "@/lib/tasks/materialize";

import { AnswersSchema, buildProfile } from "./steps";

export async function submitCheck(
  input: unknown,
): Promise<{ id: string } | { error: string }> {
  const parsed = AnswersSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Some answers are missing or invalid. Please go back and check them." };
  }
  const profile = buildProfile(parsed.data);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const rules = await getPublishedRules(db);
  const result = evaluate(profile, rules);
  const ownerToken = user ? null : createOwnerToken();
  const id = await insertCheck(db, {
    answers: parsed.data as unknown as Json,
    owner_token_hash: ownerToken ? hashOwnerToken(ownerToken) : null,
    claimed_by: user?.id,
    claimed_at: user ? new Date().toISOString() : null,
    profile: profile as unknown as Json,
    result: result as unknown as Json,
  });
  if (user) {
    await upsertProfile(db, {
      user_id: user.id,
      country_code: profile.certificateCountry ?? profile.nationality ?? null,
      answers: parsed.data as unknown as Json,
    });
    await materializeAllTasksForUser(db, user.id);
  } else {
    if (!ownerToken) {
      return { error: "Could not create a secure owner token. Please try again." };
    }
    const cookieStore = await cookies();
    cookieStore.set(ownerCookieName(id), ownerToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return { id };
}
