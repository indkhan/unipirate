import { expect, it } from "vitest";
import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import { indiaStudyCandidates } from "@/scripts/india-study.rules";
import { processCandidates } from "@/scripts/process.rules";
import { evaluateAssessment, parseStoredAssessment, compareAssessments, AssessmentResultSchema } from "../assessment";
import { answers, raw, ruleId, version } from "./assessment-fixtures";
const now = "2026-10-08T12:00:00Z";
const context = { evaluatedAt: now, engineRevision: "test/diagnostic-process-union" };
const processId = "89985eb6-d3a6-41ce-879d-fc4bf4e206c9";
const processVersion = () => version(2, { rule_id: processId, published_at: now, reviewed_at: now, raw_snapshot: { ...raw, ...processCandidates[0], id: processId, slug: processCandidates[0].id, country_code: "in", status: "verified" } });
const saved = AnswersSchema.parse({ ...answers, curriculumType: "national", board: "cbse", schoolGradePercent: 70, jeeAdvanced: false, schoolQualificationCountry: "in", schoolQualificationContext: "national", hasExistingApsCertificate: false, visaApplicationCountry: "in", processContext: { version: 1, purpose: "study", mission: "new_delhi", missionConfirmed: true, fundingMethod: "blocked_account", exception: "none" } });
const academicVersion = () => version(1, { reviewed_at: now, published_at: now, raw_snapshot: { ...raw, ...indiaStudyCandidates[0], id: ruleId, slug: indiaStudyCandidates[0].id, country_code: "in", status: "verified" } });
// Actual draft candidates in disposable canonical immutable UUID envelopes, not publication.
it("process-only missing intake does not create an academic follow-up or explanation change", () => {
  const profile = buildProfile(AnswersSchema.parse({ ...saved, intake: null }));
  const before = evaluateAssessment(profile, [], context);
  const after = evaluateAssessment(profile, [{ ...processVersion(), intake_from: 4053 }], context);
  expect(after.metadata.selectionIssues).toEqual([expect.objectContaining({ ruleId: processId, reason: "missing_intake" })]);
  expect(after.result).toEqual(before.result);
  expect(compareAssessments(before, after)).toMatchObject({ policyChanged: false, explanationChanged: false, newCoverage: false, processExplanationChanged: true });
});
it("current process guidance preserves generated academic candidate diagnostics and exact historical sources", () => {
  const academic = academicVersion(); const process = processVersion(); const profile = buildProfile(saved);
  const before = evaluateAssessment(profile, [academic], context);
  const after = evaluateAssessment(profile, [academic, process], context);
  expect(after.result).toEqual(before.result);
  expect(after.result.diagnostics).toContainEqual(expect.objectContaining({ status: "targeted_missing_fact", ruleIds: [ruleId] }));
  expect(after.result.candidateCitations).toContainEqual(expect.objectContaining({ ruleId, sourceUrl: indiaStudyCandidates[0].source_url }));
  expect(after.process?.guidance.some(g => g.status === "current")).toBe(true);
  expect(compareAssessments(before, after)).toMatchObject({ policyChanged: false, explanationChanged: false, newCoverage: false });
  const row = { answers: saved, result: after.result, assessment_metadata: after.metadata }; const literal = JSON.stringify(row);
  const historical = parseStoredAssessment(row, [academic, process]);
  expect(historical.kind).toBe("authoritative");
  if (historical.kind === "authoritative") {
    expect(historical.original.result).toEqual(after.result);
    expect(historical.original).not.toHaveProperty("process");
    expect(historical.original.selectedVersions).toEqual([academic, process]);
  }
  expect(JSON.stringify(row)).toBe(literal);
  expect(parseStoredAssessment(row, [{ ...academic, id: version(3).id }, process]).kind).toBe("invalid");
  const citation = after.result.candidateCitations![0];
  expect(parseStoredAssessment({ ...row, result: { ...after.result, candidateCitations: [{ ...citation, sourceUrl: "https://example.invalid/forged" }] } }, [academic, process]).kind).toBe("invalid");
});
it("new diagnostic explanations and process fee policy stay separate from academic policy and saved tokens", () => {
  const academic = academicVersion(); const process = processVersion(); const current = evaluateAssessment(buildProfile(saved), [academic, process], context);
  const { diagnostics, candidateCitations, ...oldResult } = current.result; void diagnostics; void candidateCitations;
  const row = { answers: saved, result: oldResult, assessment_metadata: { ...current.metadata, engineRevision: "historical/process-without-diagnostics" } };
  const literal = JSON.stringify(row); const old = parseStoredAssessment(row, [academic, process]);
  expect(old.kind).toBe("authoritative");
  if (old.kind !== "authoritative") throw new Error("Expected immutable historical result");
  expect(compareAssessments(old.original, current)).toMatchObject({ policyChanged: false, explanationChanged: true, newCoverage: false, processDecisionComparisonAvailable: false });
  const changedProcess = { ...process, id: version(4).id, raw_snapshot: { ...process.raw_snapshot, source_quote: "Changed literal source evidence" } };
  const next = evaluateAssessment(buildProfile(saved), [academic, changedProcess], context);
  expect(compareAssessments(current, next)).toMatchObject({ policyChanged: false, explanationChanged: false, newCoverage: false, processExplanationChanged: true });
  expect(AssessmentResultSchema.safeParse({ ...current.result, diagnostics: [{ ...current.result.diagnostics![0], forged: true }] }).success).toBe(false);
  expect(JSON.stringify(row)).toBe(literal);
});

it("a process-only draft preview preserves an academic missing-intake explanation", async () => {
  const { previewDraftImpact } = await import("../consumer-impact");
  const academic = { ...academicVersion(), intake_from: 4053 }; const process = processVersion();
  const draft = { rule_id: processId, raw_snapshot: { ...process.raw_snapshot, status: "draft", source_quote: "Changed draft process source" }, revision: 1, edited_by: null, edited_at: now, effective_from: null, effective_until: null, intake_from: null, intake_until: null };
  const preview = previewDraftImpact([{ answers: { ...saved, intake: null } }], [academic, process], draft, "verified", context);
  expect(preview).toMatchObject({ invalidProposal: false, assessed: 1, policyChanged: 0, explanationChanged: 0, sourceOnly: 0, newCoverage: 0, processExplanationChanged: 1 });
});
