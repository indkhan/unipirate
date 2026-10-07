import {expect, it} from "vitest";
import {projectVersionedKbMatches, versionedEmbeddingChunks} from "../versioned-kb";
import {context, raw, ruleId, version} from "@/lib/rules/__tests__/assessment-fixtures";
const kbContext = {evaluatedAt: context.evaluatedAt, intake: {term: "winter", year: 2026}};
const hints = [{rule_id: ruleId, content: "STALE FACT", slug: "stale"}, {rule_id: null, content: "STALE SNIPPET"}];
it("replaces all stored facts with exact selected immutable sources and identities", () => {
 const selected = version(2, {raw_snapshot: {...raw, source_quote: " New literal quote ", outcomes: {path: "insufficient"}}});
 const result = projectVersionedKbMatches(hints, [version(1), selected], kbContext);
 expect(result.chunks).toHaveLength(1);
 expect(result.chunks[0]).toMatchObject({ruleId, versionId: selected.id, source_url: raw.source_url, last_verified_at: raw.last_verified_at});
 expect(result.chunks[0].content).toContain('" New literal quote "');
 expect(JSON.stringify(result)).not.toContain("STALE");
});
it.each([
 {published_at: "2026-10-07T12:00:00.000001Z"}, {effective_from: "2026-10-08"}, {effective_until: "2026-10-07"}, {intake_from: 4054},
])("selects predecessor outside unavailable/replacement scope %j", bounds => {
 expect(projectVersionedKbMatches(hints, [version(1), version(2, bounds)], kbContext).chunks[0].versionId).toBe(version(1).id);
});
it("missing intake blocks predecessor and never restores old stored prose", () => {
 const result = projectVersionedKbMatches(hints, [version(1), version(2, {intake_from: 4053})], {evaluatedAt: context.evaluatedAt});
 expect(result.chunks).toEqual([]); expect(result.diagnostics[0].reason).toBe("missing_intake");
});
it.each([{status: "draft"}, {raw_snapshot: {...raw, source_quote: ""}}, {reviewed_by: null}])("invalid replacement yields unavailable %j", extra => {
 expect(projectVersionedKbMatches(hints, [version(1), version(2, extra)], kbContext).chunks).toEqual([]);
});
it("newly selected scoped rules are discoverable with no embedding hints", () => {
 expect(projectVersionedKbMatches([], [version(1, {intake_from: 4053})], kbContext).chunks).toHaveLength(1);
});
it("embedding excludes future/missing-intake versions and preserves explicit version identity", () => {
 expect(versionedEmbeddingChunks([version(1), version(2, {published_at: "2026-10-08T00:00:00Z"})], context.evaluatedAt)[0].versionId).toBe(version(1).id);
 expect(versionedEmbeddingChunks([version(1, {intake_from: 4053})], context.evaluatedAt)).toEqual([]);
});
it("legacy certificate-only dMAT claims remain withheld after version selection", () => {
 const r = {...raw, conditions: {has_existing_aps: true}, outcomes: {dmat: "not_required", testas: "required"}};
 const content = projectVersionedKbMatches(hints, [version(1, {raw_snapshot: r})], kbContext).chunks[0].content;
 expect(content).toContain("dMAT: unknown"); expect(content).toContain("TestAS: required"); expect(content).not.toContain(raw.source_quote);
});
it("ambiguous citation slugs cannot supply authority", () => {
 const otherId = "00000000-0000-4000-8000-000000000009";
 expect(projectVersionedKbMatches([], [version(1), version(2, {rule_id: otherId, raw_snapshot: {...raw, id: otherId}})], kbContext).chunks).toEqual([]);
});
