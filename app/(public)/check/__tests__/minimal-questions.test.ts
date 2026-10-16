// #75: the checker asks each fact once and only while it can change the outcome.
import { describe, expect, it } from "vitest";
import { questionSteps, visibleSteps, withAnswer, type PartialAnswers } from "../steps";
import { AUDIT_PERSONAS, simulate } from "../../../../scripts/audit-checker.personas";

const base: PartialAnswers = { qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, jeeVersion: 2, targetDegree: "bachelor", curriculumType: "national" };

describe("derived national context", () => {
  it("fills national context from a national curriculum and never asks it", () => {
    const a = withAnswer(base, "schoolQualificationCountry", "in");
    expect(a.schoolQualificationContext).toBe("national");
    expect(visibleSteps(a)).toContain("schoolQualificationContext");
    expect(questionSteps(a)).not.toContain("schoolQualificationContext");
  });
  it("still asks context for an 'other' curriculum, where international is possible", () => {
    const a = withAnswer({ ...base, curriculumType: "other" }, "schoolQualificationCountry", "in");
    expect(a.schoolQualificationContext).toBeUndefined();
    expect(questionSteps(a)).toContain("schoolQualificationContext");
  });
  it("re-derives after an issuer change instead of re-asking", () => {
    const a = withAnswer(withAnswer(base, "schoolQualificationCountry", "in"), "schoolQualificationCountry", "pk");
    expect(a.schoolQualificationContext).toBe("national");
  });
});

describe("JEE gating", () => {
  const indian = withAnswer(withAnswer(base, "schoolQualificationCountry", "in"), "jeeSchoolCertificate", "completed_12_year_secondary");
  it.each(["not_passed", "no_result"] as const)("Main %s skips Advanced and evidence context", main => {
    const steps = visibleSteps(withAnswer(indian, "jeeMainStatus", main));
    expect(steps).toContain("jeeMainStatus");
    expect(steps).not.toContain("jeeAdvancedStatus");
    expect(steps).not.toContain("jeeEvidenceContext");
  });
  it("Main passed asks Advanced; context only when both can still pass", () => {
    const main = withAnswer(indian, "jeeMainStatus", "passed");
    expect(visibleSteps(main)).toContain("jeeAdvancedStatus");
    expect(visibleSteps(withAnswer(main, "jeeAdvancedStatus", "not_passed"))).not.toContain("jeeEvidenceContext");
    expect(visibleSteps(withAnswer(main, "jeeAdvancedStatus", "passed"))).toContain("jeeEvidenceContext");
  });
});

describe("audit personas", () => {
  // Budgets lock in the reductions; raise one only with a reason in #75.
  const budget: Record<string, number> = {
    "IN-cbse-85-no-jee-cs": 14, "IN-cbse-92-jee-adv-eng": 17, "IN-cbse-living-SA-cs": 14,
    "PK-fsc-80-eng": 13, "SA-tawjihiyah-science-cs": 12, "GCE-cambridge-AAB-eng": 11,
  };
  it.each(AUDIT_PERSONAS.map(p => [p.id, p] as const))("%s completes without repeated or dead-end questions", (_id, persona) => {
    const run = simulate(persona.answers);
    expect(new Set(run.asked).size).toBe(run.asked.length);
    expect(run.asked).not.toContain("schoolQualificationContext");
    if (budget[persona.id] !== undefined) expect(run.asked.length).toBeLessThanOrEqual(budget[persona.id]);
  });
});
