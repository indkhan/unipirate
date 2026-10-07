import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile, normalizeAnswers, visibleSteps, withAnswer } from "../steps";

const historicalSaudiBachelor = {
  targetDegree: "bachelor", nationality: "in", certificateCountry: "in",
  visaApplicationCountry: "sa", curriculumType: "national", board: "cbse",
  schoolGradePercent: 82, jeeAdvanced: false, targetField: "cs", intake: null,
} as const;

describe("historical Saudi APS answer compatibility", () => {
  it.each([undefined, 1] as const)("reads a pre-APS-scope bachelor with history version %s", version => {
    const saved = {...historicalSaudiBachelor, ...(version === 1 ? {qualificationHistoryVersion: 1 as const, hasPriorUniversityStudy: false} : {})};
    const snapshot = structuredClone(saved);
    const parsed = AnswersSchema.parse(saved);
    expect(buildProfile(parsed).hasExistingApsCertificate).toBeUndefined();
    expect(normalizeAnswers(saved)).toEqual(snapshot);
    expect(saved).toEqual(snapshot);
  });
  it("reads a prehistory Saudi master without synthesizing a certificate answer", () => {
    const saved = {targetDegree: "master", nationality: "in", certificateCountry: "in", visaApplicationCountry: "sa", curriculumType: "national", targetField: "cs", intake: null} as const;
    expect(buildProfile(AnswersSchema.parse(saved)).hasExistingApsCertificate).toBeUndefined();
  });
  it("reads a history-versioned Saudi master without synthesizing a certificate answer", () => {
    const saved = {qualificationHistoryVersion: 1, targetDegree: "master", nationality: "in", visaApplicationCountry: "sa", targetField: "cs", intake: null,
      hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Indian university", priorStudyCountry: "in", priorQualificationContext: "national", priorStudyField: "Computing", priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed"} as const;
    expect(buildProfile(AnswersSchema.parse(saved)).hasExistingApsCertificate).toBeUndefined();
  });
  it("requires the certificate answer when the same historical profile is edited/upgraded", () => {
    const edit = normalizeAnswers({...historicalSaudiBachelor, qualificationHistoryVersion: 1 as const, apsScopeVersion: 1 as const, hasPriorUniversityStudy: false,
      schoolQualificationCountry: "in" as const, schoolQualificationContext: "national" as const, apsApplicationContext: "uni_assist" as const, visaMissionContext: "saudi_study" as const});
    expect(visibleSteps(edit)).toContain("hasExistingApsCertificate");
    const missing = AnswersSchema.safeParse(edit);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues.map(i => i.path)).toContainEqual(["hasExistingApsCertificate"]);
    const completed = withAnswer({...edit, jeeVersion: 1, jeeMainStatus: "no_result", jeeAdvancedStatus: "no_result"}, "hasExistingApsCertificate", false);
    expect(AnswersSchema.safeParse(completed).success).toBe(true);
    expect(buildProfile(AnswersSchema.parse(completed)).hasExistingApsCertificate).toBe(false);
  });
  it("does not relax older India filing or invalid historical certificate values", () => {
    expect(AnswersSchema.safeParse({...historicalSaudiBachelor, visaApplicationCountry: "in"}).success).toBe(false);
    expect(AnswersSchema.safeParse({...historicalSaudiBachelor, hasExistingApsCertificate: "guessed"}).success).toBe(false);
  });
});
