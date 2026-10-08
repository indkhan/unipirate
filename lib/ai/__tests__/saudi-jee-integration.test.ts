import { expect, it } from "vitest";
import { projectVersionedKbMatches } from "../versioned-kb";
import { saudiCandidates } from "@/scripts/saudi.rules";
import { reviewedJeeRules } from "@/lib/engine/__tests__/jee.fixture";
import jeeLegacy from "@/lib/engine/__tests__/jee-legacy.fixture.json";
import { ruleData } from "@/scripts/rules.bootstrap";
import { raw, ruleId, version } from "@/lib/rules/__tests__/assessment-fixtures";
const context = { evaluatedAt: "2026-10-08T12:00:00Z", intake: { term: "winter", year: 2026 } };
const jeeId = "00000000-0000-4000-8000-000000000009";
const envelope = (candidate: { id: string; source_quote: string } & Record<string, unknown>, id = ruleId) => version(1, { rule_id: id, reviewed_at: context.evaluatedAt, published_at: context.evaluatedAt, raw_snapshot: { ...raw, ...candidate, id, slug: candidate.id, country_code: id === ruleId ? "sa" : "in", status: "verified" } });
it("renders both selected source-backed families while cached claims and snippets remain hints", () => {
  const saudi = envelope(saudiCandidates[2]);
  const jee = { ...envelope(reviewedJeeRules()[0], jeeId), id: "00000000-0000-4000-8000-000000000099" };
  const hints = [{ rule_id: ruleId, content: "Invented Saudi direct admission" }, { rule_id: jeeId, content: "Invented JEE global waiver" }, { rule_id: null, content: "Invented snippet" }];
  const result = projectVersionedKbMatches(hints, [saudi, jee], context);
  expect(result.chunks).toHaveLength(2);
  expect(JSON.stringify(result)).not.toContain("Invented");
  expect(result.chunks.find(c => c.ruleId === ruleId)?.content).toContain("Fachhochschule");
  expect(result.chunks.find(c => c.ruleId === jeeId)?.content).toContain("applicant-reported");
  expect(result.chunks.map(c => c.versionId)).toEqual([saudi.id, jee.id]);
});
it("quarantines both unsupported legacy families after immutable selection", () => {
  const saudi = ruleData.find(r => r.id === "sa-tawjihiyah-studienkolleg")!;
  const jee = jeeLegacy[0];
  const versions = [envelope(saudi), { ...envelope(jee, jeeId), id: "00000000-0000-4000-8000-000000000099" }];
  const result = projectVersionedKbMatches([], versions, context);
  expect(result.chunks).toHaveLength(2);
  for (const chunk of result.chunks) { expect(chunk.content).toContain("[[unknown]]"); expect(chunk.last_verified_at).toBeNull(); }
  expect(JSON.stringify(result)).not.toContain(saudi.source_quote);
  expect(JSON.stringify(result)).not.toContain(jee.source_quote);
});
