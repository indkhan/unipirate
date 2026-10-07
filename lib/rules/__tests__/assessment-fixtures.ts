export const ruleId = "00000000-0000-4000-8000-000000000001";
export const actor = "00000000-0000-4000-8000-000000000002";
export const raw = { id: ruleId, slug: "synthetic", country_code: null, conditions: {}, outcomes: { path: "direct" }, status: "verified", source_url: "https://example.invalid/source", source_quote: " Synthetic quote ", last_verified_at: "2026-01-01T00:00:00Z", notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
export function version(n: number, extra = {}) { return { id: "00000000-0000-4000-8000-" + String(n + 10).padStart(12,"0"), rule_id: ruleId, version_number: n, supersedes_version_id: null, raw_snapshot: raw, status: "verified", effective_from: null, effective_until: null, intake_from: null, intake_until: null, reviewed_by: actor, reviewed_at: "2026-01-02T00:00:00Z", published_at: "2026-01-02T00:00:00Z", captured_at: null, draft_revision: 1, provenance: "human_publication", ...extra }; }

export const profile = {targetDegree:'bachelor' as const,curriculumType:'other' as const,intake:{term:'winter' as const,year:2026}};
export const answers = {targetDegree:'bachelor',curriculumType:'other',certificateCountry:'in',nationality:'in',visaApplicationCountry:'sa',targetField:'cs',intake:{term:'winter',year:2026}};
export const context={evaluatedAt:'2026-10-07T12:00:00Z',engineRevision:'unipirate/evaluate+dmat+gce@d2367b9'};
