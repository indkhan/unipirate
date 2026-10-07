import { describe, expect, it } from "vitest";
import { AnswersSchema, PartialAnswersSchema, buildProfile, visibleSteps, withAnswer, isAnswered, type PartialAnswers, type Answers } from "../steps";
import { buildOptions } from "../check-questions";
import { evaluate } from "@/lib/engine/evaluate";
import { reviewedSaudiRules } from "@/lib/engine/__tests__/saudi.fixture";
import { saudiAnswers } from "./saudi.fixture";

const legacy = { targetDegree: "bachelor", nationality: "sa", certificateCountry: "sa", visaApplicationCountry: "sa", curriculumType: "national", board: "tawjihiyah", schoolGradePercent: 92, targetField: "cs", intake: null } as const;
describe("Saudi versioned checker", () => {
  it("asks explicit subtype before history; missing subtype does not guess from board", () => {
    const a = { ...saudiAnswers, saudiCertificateSubtype: undefined };
    const steps = visibleSteps(a);
    expect(steps).toContain("saudiCertificateSubtype");
    expect(steps).not.toContain("hasPriorUniversityStudy");
    expect(steps).not.toContain("board");
    expect(steps).not.toContain("schoolGradePercent");
    expect(AnswersSchema.safeParse(a).success).toBe(false);
    expect(buildProfile(legacy)).not.toHaveProperty("saudiCertificate");
    expect(AnswersSchema.safeParse(legacy).success).toBe(true);
  });
  it("maps references and reuses history without turning report into verification", () => {
    const parsed = AnswersSchema.parse(saudiAnswers);
    const p = buildProfile(parsed);
    expect(p.saudiCertificate).toMatchObject({ version: 1, subtype: "private_school", subjectAssessment: "reported_official_met" });
    expect(p.qualificationHistory?.completedYears).toBe(1);
    expect(evaluate(p, reviewedSaudiRules()).path).toBe("studienkolleg");
    expect(buildOptions("saudiCertificateSubtype", saudiAnswers).map(o => o.label)).toContain("Secondary Industrial Institutes Diploma");
    expect(buildOptions("priorStudyTargetRelation", saudiAnswers).some(o => o.value === "reported_official_closely_related")).toBe(false);
  });
  it("keeps no/unknown/unmet reports usable and references progressive", () => {
    const a: PartialAnswers = { ...saudiAnswers, saudiSubjectAssessment: "unknown", priorStudyRecognition: "unknown", priorStudyTargetRelation: "unknown", yearsOfUniversityStudy: null, priorStudyCountry: "unknown" };
    expect(AnswersSchema.safeParse(a).success).toBe(true);
    expect(visibleSteps(a)).not.toContain("saudiSubjectAssessmentReference");
    expect(buildProfile(AnswersSchema.parse(a)).qualificationHistory?.completedYears).toBeUndefined();
    expect(AnswersSchema.safeParse({ ...saudiAnswers, saudiSubjectAssessmentReference: "" }).success).toBe(false);
    expect(PartialAnswersSchema.safeParse({ ...saudiAnswers, saudiSubjectAssessmentReference: "", yearsOfUniversityStudy: -1 }).success).toBe(true);
    expect(isAnswered({ ...saudiAnswers, yearsOfUniversityStudy: -1 }, "yearsOfUniversityStudy")).toBe(false);
    expect(AnswersSchema.safeParse({ ...saudiAnswers, saudiCertificateVersion: 2 }).success).toBe(false);
  });
  it("prunes changed issuer/type/history/target reports while preserving nationality and visa", () => {
    for (const [key, value] of [["schoolQualificationCountry", "in"], ["curriculumType", "gce"], ["saudiCertificateSubtype", "industrial_diploma"]] as const) {
      const next = withAnswer(saudiAnswers, key, value);
      expect(next.saudiSubjectAssessmentReference).toBeUndefined();
      expect(next.priorStudyRecognitionReference).toBeUndefined();
    }
    expect(withAnswer(saudiAnswers, "targetField", "physics").priorStudyTargetRelationReference).toBeUndefined();
    expect(withAnswer(saudiAnswers, "priorStudyInstitution", "Changed").priorStudyRecognitionReference).toBeUndefined();
    expect(withAnswer(saudiAnswers, "priorStudyField", "Physics").priorStudyRecognitionReference).toBeUndefined();
    expect(withAnswer(saudiAnswers, "nationality", "pk").priorStudyRecognitionReference).toBe(saudiAnswers.priorStudyRecognitionReference);
    expect(withAnswer(saudiAnswers, "visaApplicationCountry", "in").priorStudyRecognitionReference).toBe(saudiAnswers.priorStudyRecognitionReference);
  });
  it("completes a fresh forward flow with no stale evidence cleared after its question", () => {
    let a: PartialAnswers = { qualificationHistoryVersion: 1, apsScopeVersion: 1, saudiCertificateVersion: 1 };
    for (let index = 0; index < visibleSteps(a).length; index++) {
      const step = visibleSteps(a)[index];
      if (!isAnswered(a, step)) a = withAnswer(a, step, saudiAnswers[step as keyof typeof saudiAnswers] as Answers[typeof step]);
      expect(isAnswered(a, step), step).toBe(true);
    }
    expect(AnswersSchema.safeParse(a).success).toBe(true);
    expect(evaluate(buildProfile(AnswersSchema.parse(a)), reviewedSaudiRules()).path).toBe("studienkolleg");
  });
  it("completes industrial enrollment in forward order and clears changed context", () => {
    const industrial = { ...saudiAnswers, saudiCertificateSubtype: "industrial_certificate", yearsOfUniversityStudy: 0, priorStudyTargetRelation: "unknown", saudiEnrollment: "reported_document", saudiEnrollmentField: "Computing", saudiEnrollmentReference: "Synthetic enrollment certificate", saudiEnrollmentTargetRelation: "reported_official_previous", saudiEnrollmentTargetRelationReference: "Synthetic target assessment" } as const;
    let a: PartialAnswers = { qualificationHistoryVersion: 1, apsScopeVersion: 1, saudiCertificateVersion: 1 };
    for (let index = 0; index < visibleSteps(a).length; index++) {
      const step = visibleSteps(a)[index];
      if (!isAnswered(a, step)) a = withAnswer(a, step, industrial[step as keyof typeof industrial] as Answers[typeof step]);
      expect(isAnswered(a, step), step).toBe(true);
    }
    expect(evaluate(buildProfile(AnswersSchema.parse(a)), reviewedSaudiRules()).institutionRestriction).toBe("fachhochschule");
    expect(withAnswer(a, "saudiEnrollmentField", "Physics").saudiEnrollmentReference).toBeUndefined();
    expect(withAnswer(a, "priorStudyCompletion", "discontinued").saudiEnrollmentReference).toBeUndefined();
  });
  it("keeps national and other subtypes source held and tertiary degrees separate", () => {
    for (const subtype of ["national", "other", "unknown"] as const) {
      const a = { ...saudiAnswers, saudiCertificateSubtype: subtype, saudiNationalStream: "Reported science stream" };
      expect(visibleSteps(a)).not.toContain("priorStudyRecognition");
      if (subtype === "national") expect(visibleSteps(a)).toContain("saudiNationalStream");
      expect(evaluate(buildProfile(a), reviewedSaudiRules()).path).toBe("unknown");
    }
    expect(visibleSteps({ ...saudiAnswers, targetDegree: "master" })).not.toContain("saudiCertificateSubtype");
    expect(visibleSteps({ ...saudiAnswers, curriculumType: "gce" })).not.toContain("saudiCertificateSubtype");
  });
});
