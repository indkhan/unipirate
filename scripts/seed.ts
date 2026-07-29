// Idempotent bootstrap for reference data and draft rule candidates.
// Rules are inserted as draft and never overwrite admin-reviewed DB rows.

import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "../lib/db/database.types";
import { getServerEnv } from "../lib/env";
import { EngineRuleSchema } from "../lib/engine/evaluate";
import { ruleData } from "./rules.bootstrap";

const env = getServerEnv();
const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);

function check(label: string) {
  return ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(`${label}: ${error.message}`);
    console.log(`✓ ${label}`);
  };
}

async function main() {
  // Countries and school boards are static catalogs in
  // app/(public)/check/steps.ts — the seed only carries rule candidates.
  const { error: legacyError } = await db
    .from("rules")
    .delete()
    .is("slug", null)
    .like("notes", "Seeded from docs/%");
  if (legacyError) throw new Error(`legacy rules cleanup: ${legacyError.message}`);

  const rules = ruleData.map((candidate) => {
    const parsed = EngineRuleSchema.parse(candidate);
    return {
      slug: candidate.id,
      country_code: candidate.country,
      conditions: parsed.conditions as Json,
      outcomes: parsed.outcomes as Json,
      status: "draft" as const,
      source_url: parsed.source_url,
      source_quote: parsed.source_quote,
      last_verified_at: parsed.last_verified_at ?? null,
      notes: `Bootstrap candidate: ${candidate.id}. Review in /admin before publishing.`,
    } satisfies Database["public"]["Tables"]["rules"]["Insert"];
  });

  await db
    .from("rules")
    .upsert(rules, { onConflict: "slug", ignoreDuplicates: true })
    .then(check(`${rules.length} draft rule candidates`));

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
