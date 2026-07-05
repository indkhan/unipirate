"use server";

import { cookies } from "next/headers";

import {
  createOwnerToken,
  hashOwnerToken,
  ownerCookieName,
} from "@/lib/checks/ownership";
import type { Json } from "@/lib/db/database.types";
import { getPublishedRules, insertCheck } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { evaluate } from "@/lib/engine/evaluate";

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
  const rules = await getPublishedRules(db);
  const result = evaluate(profile, rules);
  const ownerToken = createOwnerToken();
  const id = await insertCheck(db, {
    answers: parsed.data as unknown as Json,
    owner_token_hash: hashOwnerToken(ownerToken),
    profile: profile as unknown as Json,
    result: result as unknown as Json,
  });
  const cookieStore = await cookies();
  cookieStore.set(ownerCookieName(id), ownerToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return { id };
}
