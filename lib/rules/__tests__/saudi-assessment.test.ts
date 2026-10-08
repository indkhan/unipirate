import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import { saudiAnswers } from "@/app/(public)/check/__tests__/saudi.fixture";
import { completedSaudiProfile, nationalProfile } from "@/lib/engine/__tests__/saudi.fixture";
import { jeeProfile, reviewedJeeRules } from "@/lib/engine/__tests__/jee.fixture";
import { saudiCandidates } from "@/scripts/saudi.rules";
import { AssessmentResultSchema, evaluateAssessment, parseStoredAssessment } from "../assessment";
import { ENGINE_REVISION, currentAssessmentContext } from "../current";
import { raw, ruleId, version } from "./assessment-fixtures";

const oldRevision = "unipirate/qualification+aps+dmat+india-study+ib+gce@bd836cc/assessment-v1";
const priorSaudiRevision = "unipirate/jee-ordinary+saudi+assessment-v1@sha256:9ece1216013df345618b899bb6852ca00e44f1cc03fdbcdbbc7c6eedaaeddc5e";
const newRevision = "unipirate/jee-ordinary+saudi+pakistan-current-v2+process+diagnostics+assessment-v1@sha256:885e3aa8b25f79345df48c8aab33269815ea133f836c440f85451e5aa5b72178";

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
  it.each(["sa-reviewed-private-two", "sa-reviewed-industrial-year"])("accepts the source-specific Bachelor institution scope for %s with no invented restriction", slug => {
    const answers = slug.includes("private") ? { ...saudiAnswers, yearsOfUniversityStudy: 2 } : { ...industrialAnswers, yearsOfUniversityStudy: 1 };
    const v = publishedVersion(slug);
    const a = evaluateAssessment(buildProfile(AnswersSchema.parse(answers)), [v], context);
    expect(a.result.path).toBe("subject_restricted");
    if (slug.includes("industrial")) expect(a.result.institutionRestriction).toBe("fachhochschule");
    else expect(a.result).not.toHaveProperty("institutionRestriction");
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
    const national = { ...saudiAnswers, saudiCertificateSubtype: "national", saudiNationalStream: "Reported science stream", saudiNationalCategory: "unknown", saudiSecondaryCompletion: "unknown", saudiTargetFamily: "unknown" } as const;
    expect(evaluateAssessment(buildProfile(AnswersSchema.parse(national)), [enrollmentVersion()], context).result.path).toBe("unknown");
  });
  it("captures the explicit combined Saudi/JEE revision while old stored metadata stays exact", () => {
    expect(ENGINE_REVISION).toBe(newRevision);
    expect(currentAssessmentContext().engineRevision).toBe(newRevision);
    expect(evaluateAssessment(buildProfile(AnswersSchema.parse(saudiAnswers)), [], context).metadata.engineRevision).toBe(newRevision);
    const legacy = { answers: saudiAnswers, result: evaluateAssessment(buildProfile(AnswersSchema.parse(saudiAnswers)), [], { ...context, engineRevision: priorSaudiRevision }).result,
      assessment_metadata: { formatVersion: 1, evaluatedAt: context.evaluatedAt, engineRevision: priorSaudiRevision, selectedVersionIds: [], selectionIssues: [] } };
    const before = JSON.stringify(legacy);
    const read = parseStoredAssessment(legacy, []);
    expect(read.kind).toBe("authoritative");
    if (read.kind === "authoritative") expect(read.original.metadata).toEqual(legacy.assessment_metadata);
    expect(JSON.stringify(legacy)).toBe(before);
  });
});

it("the combined authoritative selection isolates ordinary JEE and Saudi FH outcomes", () => {
  const saudi = enrollmentVersion();
  const jeeId = "00000000-0000-4000-8000-000000000009";
  const candidate = reviewedJeeRules()[0];
  const jee = version(2, { rule_id: jeeId, reviewed_at: context.evaluatedAt, published_at: context.evaluatedAt,
    raw_snapshot: { ...raw, ...candidate, id: jeeId, slug: candidate.id, country_code: "in" } });
  const versions = [saudi, jee];
  const india = evaluateAssessment(jeeProfile, versions, context);
  expect(india.result.path).toBe("subject_restricted");
  expect(india.result).not.toHaveProperty("institutionRestriction");
  expect(india.result.citations.filter(c => c.supports.includes("path")).map(c => c.ruleId)).toEqual([jeeId]);
  expect(india.metadata.engineRevision).toBe(newRevision);
  const fh = evaluateAssessment(buildProfile(AnswersSchema.parse(industrialAnswers)), versions, context);
  expect(fh.result).toMatchObject({ path: "studienkolleg", institutionRestriction: "fachhochschule" });
  expect(fh.result.citations.filter(c => c.supports.includes("path")).map(c => c.ruleId)).toEqual([ruleId]);
  expect(fh.metadata.selectedVersionIds).toEqual([saudi.id, jee.id]);
});

it.each(["literary","science","commercial"])("authoritative national %s preparation and year envelopes",stream=>{
 const label={literary:"Literary Section",science:"Science Section",commercial:"Commercial Section"}[stream]!;
 for(const years of [0,1]){const v=publishedVersion("sa-reviewed-national-"+stream+(years?"-year":"-prep"));const a=evaluateAssessment(nationalProfile(label,years),[v],context);expect(a.result.path).toBe(years?"subject_restricted":"studienkolleg");expect(a.result.institutionRestriction).toBeUndefined();expect(a.metadata.selectedVersionIds).toEqual([v.id]);expect(AssessmentResultSchema.safeParse({...a.result,unexpected:true}).success).toBe(false);}
});
it("authoritative independent completed Bachelor uses separate tertiary basis",()=>{const v=publishedVersion("sa-reviewed-completed-bachelor");const a=evaluateAssessment(completedSaudiProfile,[v],context);expect(a.result.path).toBe("direct");expect(a.result.institutionRestriction).toBeUndefined();expect(a.metadata.selectedVersionIds).toEqual([v.id]);expect(a.metadata.engineRevision).toBe(ENGINE_REVISION);});

it("stored general undergraduate metadata/answers and raw source are immutable",()=>{
 const answers={...saudiAnswers,saudiCertificateSubtype:"unknown",priorStudyCompletion:"completed",yearsOfUniversityStudy:4,priorQualificationContext:"national",saudiBachelorAssessment:"reported_official_norms_full_time",saudiBachelorAssessmentReference:"Synthetic applicable exact completed Bachelor prescribed-norms/full-time assessment"} as const;
 const v=publishedVersion("sa-reviewed-completed-bachelor");const a=evaluateAssessment(buildProfile(AnswersSchema.parse(answers)),[v],context);expect(a.result.path).toBe("direct");const row={answers,result:a.result,assessment_metadata:{...a.metadata,engineRevision:oldRevision}};const literal=JSON.stringify(row);const stored=parseStoredAssessment(row,[v]);expect(stored.kind).toBe("authoritative");if(stored.kind==="authoritative")expect(stored.original.metadata.engineRevision).toBe(oldRevision);expect(JSON.stringify(row)).toBe(literal);
});
