import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import { saudiAnswers } from "@/app/(public)/check/__tests__/saudi.fixture";
import { saudiCandidates } from "@/scripts/saudi.rules";
import { AssessmentResultSchema, evaluateAssessment, parseStoredAssessment } from "../assessment";
import { ENGINE_REVISION, currentAssessmentContext } from "../current";
import { raw, ruleId, version } from "./assessment-fixtures";

const oldRevision = "unipirate/qualification+aps+dmat+india-study+ib+gce@bd836cc/assessment-v1";
const newRevision = "unipirate/qualification+aps+dmat+india-study+ib+gce+saudi@01dc1f1/assessment-v1";
const context = { evaluatedAt: "2026-10-08T12:00:00Z", engineRevision: ENGINE_REVISION };
const industrialAnswers = { ...saudiAnswers, saudiCertificateSubtype: "industrial_certificate", yearsOfUniversityStudy: 0,
  saudiEnrollment: "reported_document", saudiEnrollmentField: "Computing", saudiEnrollmentReference: "Synthetic enrollment document",
  saudiEnrollmentTargetRelation: "reported_official_previous", saudiEnrollmentTargetRelationReference: "Synthetic university target assessment" } as const;
// Source-backed candidates copied into synthetic immutable UUID envelopes only; never published.
function publishedVersion(slug: string) {
  const candidate = saudiCandidates.find(r => r.id === slug)!;
  return version(1, { reviewed_at: context.evaluatedAt, published_at: context.evaluatedAt,
    raw_snapshot: { ...raw, ...candidate, id: ruleId, slug, country_code: "sa", status: "verified" } });
}
const enrollmentVersion = () => publishedVersion("sa-reviewed-industrial-enrollment");
const assess = (answers = industrialAnswers) => evaluateAssessment(buildProfile(AnswersSchema.parse(answers)), [enrollmentVersion()], context);

describe("Saudi authoritative assessments", () => {
  it("accepts the real evaluated FH result through the strict assessment envelope", () => {
    const a = assess();
    expect(a.result).toMatchObject({ path: "studienkolleg", institutionRestriction: "fachhochschule" });
    expect(a.result.citations.find(c => c.supports.includes("path"))).toMatchObject({ ruleId, sourceUrl: saudiCandidates[2].source_url });
    expect(a.metadata.selectedVersionIds).toEqual([enrollmentVersion().id]);
  });
  it("reads immutable stored FH results without rewriting payload or provenance", () => {
    const a = assess();
    const row = { answers: industrialAnswers, result: a.result, assessment_metadata: { ...a.metadata, engineRevision: oldRevision } };
    const before = JSON.stringify(row);
    const read = parseStoredAssessment(row, [enrollmentVersion()]);
    expect(read.kind).toBe("authoritative");
    if (read.kind === "authoritative") {
      expect(read.original.result).toEqual(row.result);
      expect(read.original.metadata.engineRevision).toBe(oldRevision);
      expect(read.original.answers).toEqual(industrialAnswers);
      expect(read.original.selectedVersions[0].raw_snapshot).toEqual(enrollmentVersion().raw_snapshot);
    }
    expect(JSON.stringify(row)).toBe(before);
  });
  it.each(["sa-reviewed-private-two", "sa-reviewed-industrial-year"])("accepts non-FH Bachelor success for %s with no invented restriction", slug => {
    const answers = slug.includes("private") ? { ...saudiAnswers, yearsOfUniversityStudy: 2 } : { ...industrialAnswers, yearsOfUniversityStudy: 1 };
    const v = publishedVersion(slug);
    const a = evaluateAssessment(buildProfile(AnswersSchema.parse(answers)), [v], context);
    expect(a.result.path).toBe("subject_restricted");
    expect(a.result).not.toHaveProperty("institutionRestriction");
    expect(parseStoredAssessment({ answers, result: a.result, assessment_metadata: a.metadata }, [v]).kind).toBe("authoritative");
  });
  it.each(["university", "all", null, 7])("rejects malformed restriction %j and keeps unknown-key validation strict", institutionRestriction => {
    const a = evaluateAssessment(buildProfile(AnswersSchema.parse(saudiAnswers)), [], context);
    expect(AssessmentResultSchema.safeParse({ ...a.result, institutionRestriction }).success).toBe(false);
    expect(AssessmentResultSchema.safeParse({ ...a.result, inventedField: true }).success).toBe(false);
    expect(parseStoredAssessment({ answers: saudiAnswers, result: { ...a.result, institutionRestriction }, assessment_metadata: a.metadata }, []).kind).toBe("invalid");
  });
  it("preserves missing-intake and source-held national results at the authoritative boundary", () => {
    const missing = { ...industrialAnswers, intake: null };
    const a = evaluateAssessment(buildProfile(AnswersSchema.parse(missing)), [enrollmentVersion()], context);
    expect(a.result.path).toBe("unknown"); expect(a.result).not.toHaveProperty("institutionRestriction");
    expect(a.result.unknowns.join(" ")).toMatch(/intake/i);
    const national = { ...saudiAnswers, saudiCertificateSubtype: "national", saudiNationalStream: "Reported science stream" } as const;
    expect(evaluateAssessment(buildProfile(AnswersSchema.parse(national)), [enrollmentVersion()], context).result.path).toBe("unknown");
  });
  it("captures the explicit Saudi revision while old stored metadata stays exact", () => {
    expect(ENGINE_REVISION).toBe(newRevision);
    expect(currentAssessmentContext().engineRevision).toBe(newRevision);
    expect(evaluateAssessment(buildProfile(AnswersSchema.parse(saudiAnswers)), [], context).metadata.engineRevision).toBe(newRevision);
    const legacy = { answers: saudiAnswers, result: evaluateAssessment(buildProfile(AnswersSchema.parse(saudiAnswers)), [], { ...context, engineRevision: oldRevision }).result,
      assessment_metadata: { formatVersion: 1, evaluatedAt: context.evaluatedAt, engineRevision: oldRevision, selectedVersionIds: [], selectionIssues: [] } };
    const before = JSON.stringify(legacy);
    const read = parseStoredAssessment(legacy, []);
    expect(read.kind).toBe("authoritative");
    if (read.kind === "authoritative") expect(read.original.metadata).toEqual(legacy.assessment_metadata);
    expect(JSON.stringify(legacy)).toBe(before);
  });
});
