import { expect, it } from "vitest";
import { normalizeAnswers, visibleSteps, withAnswer, buildProfile, JEE_STEPS } from "../steps";
import { saudiAnswers } from "./saudi.fixture";
import { indiaAnswers } from "./india-study.fixture";

it("actual Indian issuer on a Saudi landing uses JEE v2 once with reachable independent history", () => {
  const a = withAnswer(withAnswer(saudiAnswers, "schoolQualificationCountry", "in"), "schoolQualificationContext", "national");
  const steps = visibleSteps(a);
  for (const key of ["schoolQualificationCountry", "schoolQualificationContext", "board", "schoolGradePercent", "hasPriorUniversityStudy", "priorStudyInstitution", "yearsOfUniversityStudy", "jeeSchoolCertificate", "jeeMainStatus", "jeeAdvancedStatus"] as const) expect(steps.filter(s => s === key), key).toHaveLength(1);
  expect(steps).not.toContain("jeeAdvanced");
  expect(steps).not.toContain("saudiCertificateSubtype");
  expect(a.priorStudyInstitution).toBe(saudiAnswers.priorStudyInstitution);
  expect(a.priorStudyRecognitionReference).toBeUndefined();
});
it("India to Saudi prunes every foreign JEE report and preserves unresolved subtype history", () => {
  const original = { ...indiaAnswers, jeeVersion: 2 as const, jeeSchoolCertificate: "completed_12_year_secondary" as const, jeeMainStatus: "passed" as const, jeeAdvancedStatus: "passed" as const, jeeEvidenceContext: "ordinary" as const, jeeTargetFamily: "reported_official_technology" as const, jeeTargetFamilyReference: "Reported applicable university classification" };
  const before = JSON.stringify(original);
  const a = withAnswer(withAnswer(original, "schoolQualificationCountry", "sa"), "schoolQualificationContext", "national");
  for (const key of JEE_STEPS) expect(a).not.toHaveProperty(key);
  expect(buildProfile(a as never).jee).toBeUndefined();
  expect(visibleSteps(a).filter(s => s === "schoolQualificationCountry")).toHaveLength(1);
  expect(visibleSteps(a)).toContain("saudiCertificateSubtype");
  expect(a.priorStudyInstitution).toBe(original.priorStudyInstitution);
  expect(normalizeAnswers(a)).toEqual(a);
  expect(JSON.stringify(original)).toBe(before);
});
