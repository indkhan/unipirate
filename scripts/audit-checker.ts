// Checker audit: replays typical-student personas through the real step logic
// and the live published rule versions, and counts what the result page shows.
// Read-only: the anonymous key reads published rule versions; no check is written.
// Usage: pnpm tsx --env-file=.env.local scripts/audit-checker.ts [--json] [--assume-republished]
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { listRuleVersions } from "@/lib/db/queries";
import { evaluateAssessment } from "@/lib/rules/assessment";
import { currentAssessmentContext } from "@/lib/rules/current";
import { buildVerdicts } from "@/app/(public)/result/[id]/result-model";
import { AUDIT_PERSONAS, simulate } from "./audit-checker.personas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY required");
const db = createClient<Database>(url, key, { auth: { persistSession: false } });

async function main() {
  const loaded = await listRuleVersions(db);
  // What-if only: every legacy-captured version re-published unchanged by a reviewer.
  const versions = process.argv.includes("--assume-republished")
    ? loaded.map(v => v.provenance === "legacy_capture" ? { ...v, provenance: "human_publication" as const,
        reviewed_by: v.reviewed_by ?? "00000000-0000-4000-8000-000000000000", reviewed_at: v.reviewed_at ?? "2026-10-01T00:00:00Z",
        published_at: v.published_at ?? "2026-10-01T00:00:00Z", draft_revision: v.draft_revision ?? 1, captured_at: null } : v)
    : loaded;
  const rows: Record<string, unknown>[] = [];
  for (const persona of AUDIT_PERSONAS) {
    let run;
    try { run = simulate(persona.answers); } catch (error) { rows.push({ id: persona.id, error: String(error).slice(0, 300) }); continue; }
    const { result } = evaluateAssessment(run.profile, versions, currentAssessmentContext());
    const verdicts = buildVerdicts(result, run.profile);
    rows.push({
      id: persona.id, questions: run.asked.length, inputs: run.inputs,
      headline: verdicts.find(v => v.key === "path")?.label.slice(0, 90),
      notConfirmed: verdicts.filter(v => v.unknown).map(v => v.key),
      asked: run.asked, unknownReasons: result.unknowns,
    });
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
  else {
    for (const row of rows) {
      if (row.error) { console.log(`${row.id}: ERROR ${row.error}`); continue; }
      console.log(`${row.id}: ${row.questions} questions (${row.inputs} inputs); not confirmed: ${(row.notConfirmed as string[]).join(", ") || "none"}\n  ${row.headline}`);
    }
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
