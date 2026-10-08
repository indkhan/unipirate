import {expect, it, vi} from "vitest";
import * as engine from "@/lib/engine/evaluate";
import {previewDraftImpact} from "../consumer-impact";
import {answers, context, raw, ruleId, version} from "./assessment-fixtures";
const draft = {rule_id: ruleId, raw_snapshot: {...raw, status: "draft"}, revision: 1, edited_by: null, edited_at: context.evaluatedAt, effective_from: null, effective_until: null, intake_from: null, intake_until: null};
it("counts newly covered previously unmatched profiles and invalid answers in the full population", () => {
 const result = previewDraftImpact([{answers}, {answers: {}}, {answers: null}], [], draft, "verified", context);
 expect(result).toMatchObject({total: 3, assessed: 1, invalidProfiles: 2, policyChanged: 1, newCoverage: 1});
});
it("distinguishes source-only change and does not write/mutate population or draft", () => {
 const proposal = {...draft, raw_snapshot: {...raw, status: "draft", source_quote: " New literal quote "}};
 const input = [{answers}]; const before = JSON.stringify({input, proposal});
 expect(previewDraftImpact(input, [version(1)], proposal, "verified", context)).toMatchObject({policyChanged: 0, explanationChanged: 1, sourceOnly: 1});
 expect(JSON.stringify({input, proposal})).toBe(before);
});
it.each(["2026-10-08", "2026-10-07"])("scope bound %s is evaluated without fabricated publication metadata", effective_from => {
 expect(previewDraftImpact([{answers}], [], {...draft, effective_from}, "beta", context).newCoverage).toBe(effective_from === "2026-10-07" ? 1 : 0);
});
it("missing intake is counted honestly, not treated as unbounded", () => {
 expect(previewDraftImpact([{answers: {...answers, intake: null}}], [], {...draft, intake_from: 4053}, "beta", context)).toMatchObject({newCoverage: 0, unresolvedAfter: 1});
});
it("invalid proposed policy is unavailable for every profile", () => {
 expect(previewDraftImpact([{answers}, {answers: {}}], [], {...draft, raw_snapshot: {...raw, conditions: {invented: true}}}, "verified", context)).toMatchObject({total: 2, invalidProfiles: 1, invalidProposal: true, assessed: 0});
});

const secondRuleId = "00000000-0000-4000-8000-000000000099";
const orderedRaw = { ...raw, outcomes: { path: "direct", documents: ["Document A"], steps: [{ order: 1, text: "Shared step" }] } };
const secondRaw = { ...raw, id: secondRuleId, slug: "second", outcomes: { path: "direct", documents: ["Document B"], steps: [{ order: 1, text: "Shared step" }] } };
const orderedVersions = [version(1, { raw_snapshot: orderedRaw }), version(2, { rule_id: secondRuleId, raw_snapshot: secondRaw })];
it("two matching rules keep canonical document/citation/shared-step identity for a source-only edit", () => {
 const evaluate = vi.spyOn(engine, "evaluate");
 const proposal = { ...draft, raw_snapshot: { ...orderedRaw, status: "draft", source_quote: "Changed literal source" } };
 expect(previewDraftImpact([{ answers }], orderedVersions, proposal, "verified", context)).toMatchObject({ policyChanged: 0, explanationChanged: 1, sourceOnly: 1, newCoverage: 0 });
 const after = evaluate.mock.results.at(-1)!.value;
 expect(after.documents).toEqual(["Document A", "Document B"]);
 expect(after.stepsDetailed).toEqual([{ order: 1, text: "Shared step", ruleId }]);
 expect(after.citations.map((citation: { ruleId: string }) => citation.ruleId)).toEqual([ruleId, secondRuleId]);
 evaluate.mockRestore();
});
it("two matching rules report no policy or explanation change for a no-op", () => {
 const proposal = { ...draft, raw_snapshot: { ...orderedRaw, status: "draft" } };
 expect(previewDraftImpact([{ answers }], orderedVersions, proposal, "verified", context)).toMatchObject({ policyChanged: 0, explanationChanged: 0, sourceOnly: 0, newCoverage: 0 });
});
it("canonical ordering still detects a genuine policy change", () => {
 const proposal = { ...draft, raw_snapshot: { ...orderedRaw, status: "draft", outcomes: { ...orderedRaw.outcomes, documents: ["Changed document A"] } } };
 expect(previewDraftImpact([{ answers }], orderedVersions, proposal, "verified", context).policyChanged).toBe(1);
});
