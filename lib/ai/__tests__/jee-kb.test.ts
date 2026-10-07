import { expect, it } from "vitest";
import legacy from "@/lib/engine/__tests__/jee-legacy.fixture.json";
import { evaluate, EngineRuleSchema } from "@/lib/engine/evaluate";
import { jeeProfile } from "@/lib/engine/__tests__/jee.fixture";
import { JEE_SOURCE, JEE_FIELD_SOURCE } from "@/lib/engine/jee";
import { ruleToChunk } from "../kb";
import { projectDmatKbMatches } from "../kb-retrieval";

const row = { ...legacy[0], conditions: EngineRuleSchema.parse(legacy[0]).conditions };
// Exact pre-quarantine persisted payload; this is unsafe metadata, not evidence.
const stored = { slug: row.slug, source_type: "rule", title: row.outcomes.note,
  content: 'Admission path: direct admission restricted to related subjects.\nNote: ' + row.outcomes.note + '\nOfficial source says: "' + row.source_quote + '"',
  source_url: row.source_url, last_verified_at: row.last_verified_at, country_code: row.country_code };
function safeLegacy(chunk: ReturnType<typeof ruleToChunk>) {
  expect(chunk.content).toContain("[[unknown]]");
  expect(chunk.content).not.toContain("Admission path: direct");
  expect(chunk.content).not.toContain(row.outcomes.note);
  expect(chunk.content).not.toContain(row.source_quote);
  expect(chunk.content).not.toContain("Official source says");
  expect(chunk.content).toMatch(/historical.*quote.*unverified/i);
  expect(chunk.content).toContain(JEE_SOURCE);
  expect(chunk.content).toContain(JEE_FIELD_SOURCE);
  expect(chunk.content).toContain(row.last_verified_at);
  expect(chunk.last_verified_at).toBeNull();
  expect(chunk.source_url).toBe(row.source_url);
}
it("withholds the exact published legacy admission claim and fabricated quote from future embeddings", () => {
  safeLegacy(ruleToChunk(row));
  expect(row.source_quote).toBe(legacy[0].source_quote);
});
it("projects the reviewer's generated-chunk reproduction through the same quarantine", () => {
  safeLegacy(projectDmatKbMatches([{ ...ruleToChunk(row), source_type: "rule" }], [row])[0]);
});
it("replaces already persisted JEE path, note, quote, title and verification authority", () => {
  const chunk = projectDmatKbMatches([stored], [row])[0];
  safeLegacy(chunk);
  expect(chunk.title).not.toBe(stored.title);
});
it("finds quarantine from structured conditions under a different slug/source", () => {
  const renamed = { ...row, slug: "renamed-academic-rule", source_url: "https://www.uni-assist.de/" };
  const chunk = projectDmatKbMatches([{ ...stored, slug: renamed.slug, source_url: renamed.source_url }], [renamed])[0];
  expect(chunk.content).toContain("[[unknown]]");
  expect(chunk.content).not.toContain(row.source_quote);
});

// Artificial UNPUBLISHED specification data, NOT official publication or admission proof.
// Disposable published copies exercise current-metadata projection only.
const specification = { ...row, id: "UNPUBLISHED-SPECIFICATION-JEE-KB", slug: "specification-jee-kb", status: "draft",
  source_url: "https://example.org/unpublished-specification", source_quote: "Artificial specification; not official admission evidence.",
  last_verified_at: "2026-10-07T00:00:00Z",
  conditions: { target_degree: "bachelor", curriculum: "national", aps_issuer_country: "in", aps_qualification_context: "national",
    board: "cbse", jee_main_status: "passed", jee_advanced_status: "passed", jee_evidence_context: "ordinary",
    target_field: { op: "in" as const, value: ["mechanical_engineering"] }, intake_index: { op: "in" as const, value: [4053] } },
  outcomes: { path: "subject_restricted", note: "Artificial scoped specification; programme admission remains separate." } };
const current = { ...specification, status: "verified" };
it("uses a complete current scoped specification instead of old persisted evidence", () => {
  const chunk = projectDmatKbMatches([{ ...stored, slug: current.slug }], [current])[0];
  expect(chunk).toEqual(ruleToChunk(current));
  expect(chunk.content).toContain(current.source_quote);
  expect(chunk.content).toContain("reported JEE Main qualifying passage status is passed");
  expect(chunk.content).toContain("winter 2026/27");
  expect(chunk.content).not.toContain(row.source_quote);
  expect(evaluate(jeeProfile, [current]).path).toBe("subject_restricted");
});
it("a formerly complete specification cannot authorize stale positive text after scope is removed", () => {
  const { intake_index: removed, ...conditions } = current.conditions;
  expect(removed).toBeDefined();
  const revised = { ...current, conditions };
  const chunk = projectDmatKbMatches([{ ...stored, slug: current.slug, source_url: current.source_url }], [revised])[0];
  expect(chunk.content).toContain("[[unknown]]");
  expect(chunk.content).not.toContain("Admission path: direct");
  expect(evaluate(jeeProfile, [revised]).path).toBe("unknown");
});
it("a current note-only JEE review replaces stale positive text", () => {
  const revised = { ...current, outcomes: { note: "JEE applicability is unresolved pending review." } };
  const chunk = projectDmatKbMatches([{ ...stored, slug: current.slug, source_url: current.source_url }], [revised])[0];
  expect(chunk.content).toContain(revised.outcomes.note);
  expect(chunk.content).not.toContain("Admission path: direct");
  expect(chunk.content).not.toContain(row.source_quote);
});
it.each([null, [], [specification], [{ ...current, source_quote: "" }], [current, current]])(
  "does not authorize a persisted specification with unavailable/draft/invalid/ambiguous current metadata %j", rows => {
    const chunk = projectDmatKbMatches([{ ...stored, slug: current.slug }], rows)[0];
    expect(chunk.content).toContain("[[unknown]]");
    expect(chunk.content).not.toContain(stored.content);
    expect(chunk.last_verified_at).toBeNull();
  });
it("quarantines a persisted JEE-source snippet without trusted structured snippet applicability", () => {
  const chunk = projectDmatKbMatches([{ ...stored, slug: "old-jee-snippet", source_type: "snippet" }], [current])[0];
  expect(chunk.content).toContain("[[unknown]]");
  expect(chunk.content).toContain(JEE_SOURCE);
  expect(chunk.content).not.toContain(stored.content);
  expect(chunk.last_verified_at).toBeNull();
});
it("does not resurrect old JEE text if the current legacy slug now carries an independent outcome", () => {
  const revised = { ...row, conditions: { target_degree: "bachelor" }, outcomes: { testas: "required" } };
  const chunk = projectDmatKbMatches([stored], [revised])[0];
  expect(chunk.content).not.toContain(stored.content);
  expect(chunk.content).toContain("TestAS: required");
  expect(chunk.content).not.toContain(row.source_quote);
  expect(ruleToChunk(revised).content).not.toContain(row.source_quote);
});
it("preserves independent process outcomes while withholding quarantined JEE tasks and claims", () => {
  const mixed = { ...row, outcomes: { ...row.outcomes, testas: "required", dmat: "not_required",
    documents: ["Unsupported direct admission document"], steps: [{ order: 1, text: "Apply using the JEE shortcut" }] } };
  const chunk = projectDmatKbMatches([stored], [mixed])[0];
  safeLegacy(chunk);
  expect(chunk.content).toContain("TestAS: required");
  expect(chunk.content).toContain("dMAT: not required");
  expect(chunk.content).not.toContain(mixed.outcomes.steps[0].text);
  expect(chunk.content).not.toContain(mixed.outcomes.documents[0]);
});
it("preserves current-bound unrelated-country rule/snippet text and does not infer JEE from legacy false", () => {
  const other = { ...row, slug: "sa-independent", country_code: "sa", conditions: { jee_advanced: false },
    source_url: "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/" };
  const match = { ...ruleToChunk(other), source_type: "rule" };
  expect(projectDmatKbMatches([match], [other])[0].content).toBe(match.content);
  expect(projectDmatKbMatches([{ ...match, source_type: "snippet" }], [other])[0].content).toBe(match.content);
});

it("a persisted snippet cannot inherit a current structured JEE rule's publication authority", () => {
  const chunk = projectDmatKbMatches([{ ...stored, slug: current.slug, source_url: current.source_url, source_type: "snippet" }], [current])[0];
  expect(chunk.content).toContain("[[unknown]]");
  expect(chunk.content).not.toContain(row.source_quote);
  expect(chunk.last_verified_at).toBeNull();
});


it("rejects positive persisted content after a generic current rule loses every JEE condition", () => {
  const revised = { ...row, slug: "renamed-academic-rule", source_url: "https://www.uni-assist.de/",
    conditions: { target_degree: "bachelor" }, outcomes: { testas: "required" } };
  const chunk = projectDmatKbMatches([{ ...stored, slug: revised.slug, source_url: revised.source_url }], [revised])[0];
  expect(chunk.content).toContain("[[unknown]]");
  expect(chunk.content).not.toContain("Admission path: direct");
  expect(chunk.content).not.toContain(row.outcomes.note);
  expect(chunk.content).not.toContain(row.source_quote);
  expect(chunk.source_url).toBe(revised.source_url);
  expect(chunk.last_verified_at).toBeNull();
});


const independent = { ...row, slug: "independent-generic-control", country_code: "sa",
  conditions: { target_degree: "bachelor" }, outcomes: { testas: "required" },
  source_url: "https://www.uni-assist.de/", source_quote: "Artificial independent control; not admission proof." };
it.each([
  { title: "Old title" }, { content: "Old policy" }, { source_url: "https://example.org/stale" }, { source_url: JEE_FIELD_SOURCE },
  { last_verified_at: "2025-01-01T00:00:00Z" }, { country_code: "in" },
])("fails closed for an unclassified rule cache whose rendered evidence changed: %j", change => {
  const cached = { ...ruleToChunk(independent), source_type: "rule", ...change };
  const result = projectDmatKbMatches([cached], [independent])[0];
  expect(result.content).toContain("[[unknown]]");
  expect(result.content).not.toContain(independent.source_quote);
  expect(result.last_verified_at).toBeNull();
  expect(result.source_url).toBe(independent.source_url);
});
it("retains a valid independent rule's exact current rendering and source metadata", () => {
  const canonical = ruleToChunk(independent);
  expect(projectDmatKbMatches([{ ...canonical, source_type: "rule" }], [independent])[0]).toEqual(canonical);
});
