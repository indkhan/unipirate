// Idempotent seed: reference data + 2 beta rules quoting
// docs/research_findings.md. Run: pnpm db:seed (needs .env.local).

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../lib/db/database.types";
import { getServerEnv } from "../lib/env";

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
  await db
    .from("countries")
    .upsert([
      { code: "in", name: "India" },
      { code: "pk", name: "Pakistan" },
      { code: "sa", name: "Saudi Arabia" },
      { code: "de", name: "Germany" },
    ])
    .then(check("countries"));

  await db
    .from("qualifications")
    .upsert(
      [
        { country_code: "in", level: "school", board_or_type: "CBSE" },
        { country_code: "in", level: "school", board_or_type: "CISCE" },
        { country_code: "in", level: "school", board_or_type: "State board" },
        { country_code: "in", level: "bachelor", board_or_type: "Bachelor (3-year)" },
        { country_code: "in", level: "bachelor", board_or_type: "Bachelor (4-year)" },
        { country_code: "pk", level: "school", board_or_type: "FSc/HSSC" },
        { country_code: "pk", level: "bachelor", board_or_type: "HEC 2-year BA/BSc" },
        { country_code: "pk", level: "bachelor", board_or_type: "HEC 4-year BS" },
        { country_code: "sa", level: "school", board_or_type: "Tawjihiyah" },
        { country_code: "sa", level: "bachelor", board_or_type: "Saudi bachelor" },
        // country_code null = international curricula, own rule tree
        { country_code: null, level: "school", board_or_type: "IB Diploma" },
        { country_code: null, level: "school", board_or_type: "GCE A-Levels" },
      ] satisfies Database["public"]["Tables"]["qualifications"]["Insert"][],
      { onConflict: "country_code,level,board_or_type" },
    )
    .then(check("qualifications"));

  // Both rules quote docs/research_findings.md (researched 2 July 2026).
  // status beta — a human flips to verified via the admin panel only.
  const rules: Database["public"]["Tables"]["rules"]["Insert"][] = [
    {
      conditions: {
        country: "in",
        curriculum: "national",
        qualification_level: "school",
        target_degree: "bachelor",
        jee_advanced: false,
      },
      outcomes: {
        path: "studienkolleg",
        studienkolleg: "yes",
        note: "Class 12 from Indian boards gives no direct admission without a valid JEE Advanced result; route is Studienkolleg + Feststellungsprüfung.",
      },
      status: "beta",
      source_url:
        "https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/",
      source_quote:
        "Class 12 from Indian boards → no direct admission; the sole exception is a valid JEE Advanced result (→ direct, subject-specific). Otherwise: Studienkolleg + FSP.",
      last_verified_at: "2026-07-02T00:00:00Z",
      notes: "Seeded from docs/research_findings.md → India → Bachelor access.",
    },
    {
      conditions: {
        country: "sa",
        curriculum: "national",
        qualification_level: "school",
        qualification: "tawjihiyah",
        target_degree: "bachelor",
      },
      outcomes: {
        path: "studienkolleg",
        studienkolleg: "yes",
        note: "Regular Saudi high-school diploma (Tawjihiyah) requires Studienkolleg before university.",
      },
      status: "beta",
      source_url:
        "https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436",
      source_quote:
        "Regular Saudi high-school diploma (Tawjihiyah) → Studienkolleg required before university; different regulations for SAT/IG-type certificates.",
      last_verified_at: "2026-07-02T00:00:00Z",
      notes:
        "Seeded from docs/research_findings.md → Saudi Arabia (German Embassy Riyadh).",
    },
  ];

  // ponytail: dedupe by source_url — good enough until rules get stable slugs
  for (const rule of rules) {
    const { data, error } = await db
      .from("rules")
      .select("id")
      .eq("source_url", rule.source_url)
      .limit(1);
    if (error) throw new Error(`rules lookup: ${error.message}`);
    if (data.length > 0) {
      console.log(`✓ rule exists: ${rule.source_url}`);
      continue;
    }
    await db.from("rules").insert(rule).then(check(`rule: ${rule.source_url}`));
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
