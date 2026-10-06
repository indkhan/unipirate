// ROOT ONLY: requires separate authorization for real Tavily/OpenRouter calls.
// No env files loaded here, no database access and no content publication.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { researchCourse, COURSE_EXTRACTION_MODEL } from "../lib/ai/research-course";
import { ResearchSeedSchema } from "../lib/courses/research";

async function main() {
  const [input, output] = z.tuple([z.string().min(1), z.string().min(1)]).parse(process.argv.slice(2));
  if ((await stat(input)).size > 850_000) throw new Error("Smoke input exceeds the import request bound");
  const seed = ResearchSeedSchema.parse(JSON.parse(await readFile(input, "utf8")));
  const draft = await researchCourse(seed);
  const facts = [...draft.offerings.flatMap(o => o.facts), ...(draft.unscoped ?? [])];
  const sourceUrls = [...new Set(facts.flatMap(f => f.evidence.map(e => e.source_url)))];
  const summary = { model: COURSE_EXTRACTION_MODEL, status: draft.status, sources: sourceUrls, scopedOfferings: draft.offerings.length,
    pendingFacts: facts.filter(f => f.status === "pending").length, conflicts: draft.conflicts.length, issues: draft.issues,
    operationalAcceptance: "Requires root's primary-source/identity/intake review, disposable RLS and browser gates; this script never publishes." };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ summary, draft }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (sourceUrls.length < 2 || !summary.pendingFacts) process.exitCode = 1;
}
main().catch(() => {
  // Do not print provider bodies or input values; the draft artifact holds safe
  // stage diagnostics when research itself completes with partial failure.
  console.error("Course research smoke failed before producing a usable multi-source draft. Check input/schema/configuration and the output artifact. No provider/model substitution was attempted.");
  process.exitCode = 1;
});
