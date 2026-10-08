import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile, isAnswered, normalizeAnswers, visibleSteps, withAnswer, type Answers, type PartialAnswers, type StepId } from "../steps";
import { saudiAnswers } from "./saudi.fixture";
import { indiaAnswers } from "./india-study.fixture";
const core: StepId[] = ["hasPriorUniversityStudy", "priorQualificationType", "priorStudyInstitution", "priorStudyCountry", "priorStudyField", "priorDegreeYears", "yearsOfUniversityStudy", "priorStudyCompletion"];
const issuer: StepId[] = ["schoolQualificationCountry", "schoolQualificationContext"];
const indianSchool: StepId[] = ["board", "schoolGradePercent", "jeeAdvanced"];
const actualIndia = { ...indiaAnswers, certificateCountry: "sa", saudiCertificateVersion: 1, visaApplicationCountry: "sa", visaMissionContext: "unknown" } as const;
function once(a: PartialAnswers, keys: StepId[]) {
  const steps = visibleSteps(a);
  for (const key of keys) expect(steps.filter(s => s === key), key).toHaveLength(1);
}
describe("Saudi landing / actual qualification transitions", () => {
  it("makes actual Indian core history reachable once after a Saudi issuer edit", () => {
    const edited = withAnswer(withAnswer(saudiAnswers, "schoolQualificationCountry", "in"), "schoolQualificationContext", "national");
    once(edited, [...core, ...issuer, ...indianSchool]);
    expect(visibleSteps(edited)).toContain("priorStudyRecognition");
    expect(edited.priorStudyRecognitionReference).toBeUndefined();
    expect(edited.saudiCertificateSubtype).toBeUndefined();
    expect(saudiAnswers.priorStudyRecognitionReference).toBeDefined();
  });
  it("asks for fresh Indian history rather than skipping it under a Saudi landing", () => {
    const a = { ...actualIndia, hasPriorUniversityStudy: undefined, priorQualificationType: undefined };
    expect(visibleSteps(a)).toContain("hasPriorUniversityStudy");
    expect(AnswersSchema.safeParse(a).success).toBe(false);
    const named = withAnswer(withAnswer(a, "hasPriorUniversityStudy", true), "priorQualificationType", "bachelor");
    once(named, [...core, ...issuer, ...indianSchool]);
  });
  it("completes fresh actual-India history with unchanged board/percentage questions", () => {
    let a: PartialAnswers = { qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, indiaStudyRouteVersion: 1, saudiCertificateVersion: 1 };
    for (let index = 0; index < visibleSteps(a).length; index++) {
      const step = visibleSteps(a)[index];
      if (!isAnswered(a, step)) a = withAnswer(a, step, actualIndia[step as keyof typeof actualIndia] as Answers[typeof step]);
      expect(isAnswered(a, step), step).toBe(true);
    }
    once(a, [...core, ...issuer, ...indianSchool]);
    const parsed = AnswersSchema.parse(a);
    expect(parsed.board).toBe("cbse"); expect(parsed.schoolGradePercent).toBe(70);
    expect(buildProfile(parsed).qualificationHistory?.completedYears).toBe(1);
    expect(buildProfile(parsed).schoolQualification?.country).toBe("in");
  });
  it("completes fresh actual-Saudi history on an Indian landing without foreign school prompts", () => {
    const source = { ...saudiAnswers, certificateCountry: "in", hasExistingApsCertificate: false } as const;
    let a: PartialAnswers = { qualificationHistoryVersion: 1, apsScopeVersion: 1, saudiCertificateVersion: 1, targetDegree: "bachelor", curriculumType: "national", certificateCountry: "in", schoolQualificationCountry: "sa", schoolQualificationContext: "national" };
    for (let index = 0; index < visibleSteps(a).length; index++) {
      const step = visibleSteps(a)[index];
      if (!isAnswered(a, step)) a = withAnswer(a, step, source[step as keyof typeof source] as Answers[typeof step]);
      expect(isAnswered(a, step), step).toBe(true);
    }
    once(a, [...core, ...issuer]);
    expect(visibleSteps(a)).not.toContain("board");
    expect(visibleSteps(a)).not.toContain("schoolGradePercent");
    expect(buildProfile(AnswersSchema.parse(a)).schoolQualification?.country).toBe("sa");
  });
  it("does not preserve hidden foreign history when prior study is explicitly absent", () => {
    const a = { ...actualIndia, hasPriorUniversityStudy: false, priorQualificationContext: "national" } as const;
    const token = JSON.stringify(a);
    const pruned = normalizeAnswers(a);
    expect(pruned).not.toHaveProperty("priorStudyInstitution");
    expect(pruned).not.toHaveProperty("priorQualificationContext");
    expect(pruned).not.toHaveProperty("priorStudyRecognitionReference");
    expect(JSON.stringify(a)).toBe(token);
  });
  it("preserves unresolved subtype history only for the actual Saudi national branch", () => {
    const a = { ...saudiAnswers, certificateCountry: "in", saudiCertificateSubtype: undefined } as const;
    const retained = normalizeAnswers(a);
    expect(retained.priorStudyInstitution).toBe(a.priorStudyInstitution);
    expect(retained.priorStudyRecognitionReference).toBe(a.priorStudyRecognitionReference);
    expect(visibleSteps(retained)).toContain("saudiCertificateSubtype");
    expect(visibleSteps(retained)).not.toContain("hasPriorUniversityStudy");
    once(retained, issuer);
  });
  it("routes India-to-Saudi then back to India without duplicate issuer/history/school steps", () => {
    let a = withAnswer(withAnswer(indiaAnswers, "schoolQualificationCountry", "sa"), "schoolQualificationContext", "national");
    once(a, issuer);
    expect(visibleSteps(a)).toContain("saudiCertificateSubtype");
    expect(visibleSteps(a)).not.toContain("hasPriorUniversityStudy");
    expect(visibleSteps(a)).not.toContain("board");
    a = withAnswer(a, "saudiCertificateSubtype", "private_school");
    a = withAnswer(withAnswer(a, "hasPriorUniversityStudy", true), "priorQualificationType", "bachelor");
    once(a, [...core, ...issuer]);
    a = withAnswer(withAnswer(a, "schoolQualificationCountry", "in"), "schoolQualificationContext", "national");
    once(a, [...core, ...issuer, ...indianSchool]);
  });
});
