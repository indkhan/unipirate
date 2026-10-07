import {expect, it} from "vitest";
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
