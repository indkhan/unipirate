import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile, qualificationCountry, visibleSteps, withAnswer } from "../steps";
import { deriveFacts, evaluate } from "@/lib/engine/evaluate";
import { fixtureRules } from "@/lib/engine/__tests__/rules.fixture";
import { buildOptions, QUESTIONS } from "../check-questions";

const master = {
  qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk",
  certificateCountry: "sa", visaApplicationCountry: "in", targetField: "cs", intake: null,
  hasPriorUniversityStudy: true, priorQualificationType: "bachelor",
  priorStudyInstitution: "Example University", priorStudyCountry: "in",
  priorQualificationContext: "national", priorStudyField: "Computing",
  priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed",
  hasExistingApsCertificate: false,
} as const;

// Unparsed input deliberately exercises the current mapping before the new boundary field exists.
describe("master qualification context", () => {
  it("keeps unscoped legacy APS unresolved without inventing scope", () => {
    const legacy = buildProfile(AnswersSchema.parse({ targetDegree: "master", nationality: "pk", certificateCountry: "in", visaApplicationCountry: "in", curriculumType: "national", targetField: "cs", intake: null, hasExistingApsCertificate: false }));
    const current = buildProfile(master);
    expect(evaluate(legacy, fixtureRules).aps).toBe("unknown");
    expect(evaluate(current, fixtureRules)).toEqual(evaluate(legacy, fixtureRules));
    expect(current.curriculumType).toBe("other");
    expect(current.tertiaryQualification).toEqual({ issuer: "Example University", country: "in", context: "national" });
    expect(deriveFacts(current).curriculum).toBe("national");
  });
  it("routes by Indian degree despite Saudi school and never by Indian school for Saudi degree", () => {
    expect(buildProfile(master).certificateCountry).toBe("in");
    const opposite = buildProfile({ ...master, certificateCountry: "in", priorStudyCountry: "sa" });
    expect(opposite.certificateCountry).toBe("sa");
    expect(evaluate(opposite, fixtureRules).aps).toBe("unknown");
    expect(opposite.nationality).toBe("pk");
    expect(opposite.visaApplicationCountry).toBe("in");
  });
  it("does not infer national context from degree type, country or matching field", () => {
    for (const context of [undefined, "unknown", "other"] as const) {
      const profile = buildProfile({ ...master, priorQualificationContext: context });
      expect(evaluate(profile, fixtureRules).aps).toBe("unknown");
      expect(deriveFacts(profile)).not.toHaveProperty("university_study_field_matches_target");
    }
  });
  it("uses a single authoritative master's awarding country and prunes stale APS/context after edits", () => {
    expect(visibleSteps(master)).not.toContain("certificateCountry");
    expect(visibleSteps(master)[0]).toBe("targetDegree");
    const changed = withAnswer(master, "priorStudyCountry", "sa");
    expect(changed).not.toHaveProperty("certificateCountry");
    expect(changed).not.toHaveProperty("hasExistingApsCertificate");
    expect(changed).not.toHaveProperty("priorQualificationContext");
    expect(qualificationCountry(changed)).toBe("sa");
    expect(withAnswer(master, "hasPriorUniversityStudy", false)).not.toHaveProperty("priorStudyCountry");
    const newIssuer = withAnswer(master, "priorStudyInstitution", "Different University");
    expect(newIssuer).not.toHaveProperty("priorStudyCountry");
    expect(newIssuer).not.toHaveProperty("priorQualificationContext");
    expect(newIssuer).not.toHaveProperty("hasExistingApsCertificate");
  });
  it("validates new context, supports countries as choices and preserves legacy code values", () => {
    expect(AnswersSchema.safeParse(master).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...master, certificateCountry: undefined }).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...master, priorQualificationContext: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...master, priorQualificationContext: "guessed" }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...master, priorStudyCountry: "de" }).success).toBe(true);
    expect(buildOptions("priorStudyCountry", { ...master, priorStudyCountry: "de" })).toContainEqual({ value: "de", key: "de", label: "Germany" });
    const other = { ...master, priorStudyCountry: "other", priorStudyCountryOther: "Canada" };
    expect(AnswersSchema.safeParse(other).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...other, priorStudyCountryOther: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...other, priorStudyCountryOther: " " }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...other, priorStudyCountryOther: "a".repeat(101) }).success).toBe(false);
    expect(buildProfile(AnswersSchema.parse(other)).tertiaryQualification?.countryName).toBe("Canada");
    expect(evaluate(buildProfile(AnswersSchema.parse(other)), fixtureRules).aps).toBe("unknown");
    expect(AnswersSchema.safeParse({ ...master, priorStudyCountry: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...master, qualificationHistoryVersion: undefined, certificateCountry: undefined }).success).toBe(false);
    const none = buildProfile(AnswersSchema.parse({ ...master, hasPriorUniversityStudy: false }));
    expect(none.certificateCountry).toBeUndefined();
    expect(deriveFacts(none)).not.toHaveProperty("curriculum");
    expect(deriveFacts(none)).not.toHaveProperty("certificate_country");
    expect(buildOptions("priorStudyCountry", master).map((o) => o.value)).toEqual(["in", "pk", "sa", "other"]);
    expect(QUESTIONS.priorStudyCountry.question).toContain("awarded");
    expect(QUESTIONS.priorStudyCountry.subtitle).not.toContain("two-letter");
  });
});
