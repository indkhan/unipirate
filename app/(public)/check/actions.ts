"use server";

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
  const id = await insertCheck(db, {
    profile: profile as unknown as Json,
    result: result as unknown as Json,
  });
  return { id };
}
