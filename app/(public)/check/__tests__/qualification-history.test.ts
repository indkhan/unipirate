import { describe, expect, it } from "vitest";
import { deriveFacts, EngineRuleSchema, evaluate } from "@/lib/engine/evaluate";
import { fixtureRules } from "@/lib/engine/__tests__/rules.fixture";
import { ruleToChunk } from "@/lib/ai/kb";
import { AnswersSchema, buildProfile, isAnswered, normalizeAnswers, PartialAnswersSchema, visibleSteps, withAnswer } from "../steps";

const legacy = { targetDegree: "bachelor", nationality: "pk", certificateCountry: "pk", visaApplicationCountry: "sa", curriculumType: "national", board: "fsc", schoolGradePercent: 80, targetField: "cs", intake: null } as const;
const history = { qualificationHistoryVersion: 1, hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Example University", priorStudyCountry: "in", priorStudyField: "cs", priorDegreeYears: 4, yearsOfUniversityStudy: 2, priorStudyCompletion: "in_progress" } as const;

describe("qualification history", () => {
  it("asks national bachelor applicants about prior study, then progressively asks details", () => {
    expect(visibleSteps(legacy)).toContain("hasPriorUniversityStudy");
    expect(visibleSteps(legacy)).not.toContain("priorStudyInstitution");
    expect(visibleSteps({ ...legacy, ...history })).toContain("priorStudyInstitution");
    expect(visibleSteps({ ...legacy, curriculumType: "gce" })).not.toContain("hasPriorUniversityStudy");
  });
  it("masters collect higher education rather than school curriculum details", () => {
    const steps = visibleSteps({ ...legacy, targetDegree: "master" });
    expect(steps).toContain("hasPriorUniversityStudy");
    expect(steps).not.toContain("curriculumType");
    expect(steps).not.toContain("board");
  });
  it("maps history without conflating countries or inventing recognition", () => {
    const profile = buildProfile(AnswersSchema.parse({ ...legacy, ...history }));
    expect(profile.qualificationHistory).toEqual({ hasPriorUniversityStudy: true, qualificationType: "bachelor", institution: "Example University", country: "in", field: "cs", degreeYears: 4, completedYears: 2, completion: "in_progress" });
    expect(profile.nationality).toBe("pk");
    expect(profile.certificateCountry).toBe("pk");
    expect(profile.visaApplicationCountry).toBe("sa");
  });
  it("preserves legacy saved answers and their profile mapping", () => {
    expect(AnswersSchema.safeParse(legacy).success).toBe(true);
    expect(buildProfile(AnswersSchema.parse(legacy))).not.toHaveProperty("qualificationHistory");
    const master = { ...legacy, targetDegree: "master" };
    expect(AnswersSchema.safeParse(master).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...master, curriculumType: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...master, curriculumType: undefined, qualificationHistoryVersion: 1, hasPriorUniversityStudy: false }).success).toBe(true);
    expect(buildProfile(AnswersSchema.parse(master))).toEqual({ targetDegree: "master", nationality: "pk", certificateCountry: "pk", visaApplicationCountry: "sa", curriculumType: "national", board: "fsc", schoolGradePercent: 80, targetField: "cs" });
  });
  it("prunes details after no prior study, qualification type and degree changes", () => {
    expect(withAnswer({ ...legacy, ...history }, "hasPriorUniversityStudy", false)).not.toHaveProperty("priorStudyInstitution");
    expect(withAnswer({ ...legacy, ...history }, "priorQualificationType", "diploma")).not.toHaveProperty("priorDegreeYears");
    expect(withAnswer({ ...legacy, ...history }, "targetDegree", "master")).not.toHaveProperty("board");
    expect(withAnswer({ ...legacy, ...history }, "curriculumType", "gce")).not.toHaveProperty("priorStudyField");
    expect(withAnswer({ ...legacy, ...history }, "certificateCountry", "sa")).not.toHaveProperty("board");
    expect(withAnswer({ ...legacy, ...history }, "priorQualificationType", "bachelor").priorStudyInstitution).toBe("Example University");
  });
  it("requires new visible history answers and validates boundaries and exceptional numbers", () => {
    expect(AnswersSchema.safeParse({ ...legacy, qualificationHistoryVersion: 1 }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, hasPriorUniversityStudy: false }).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...legacy, ...history }).success).toBe(true);
    for (const value of [-1, Infinity, NaN]) {
      expect(AnswersSchema.safeParse({ ...legacy, ...history, yearsOfUniversityStudy: value }).success).toBe(false);
      expect(isAnswered({ ...legacy, ...history, yearsOfUniversityStudy: value }, "yearsOfUniversityStudy")).toBe(false);
    }
    for (const value of [0, 0.5, 50]) {
      expect(AnswersSchema.safeParse({ ...legacy, ...history, yearsOfUniversityStudy: value }).success).toBe(true);
    }
    expect(AnswersSchema.safeParse({ ...legacy, ...history, yearsOfUniversityStudy: 50.1 }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, priorStudyCountry: "IND" }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, priorStudyCountry: " IN " }).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, priorStudyInstitution: "a".repeat(201) }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, priorStudyCompletion: "maybe" }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, priorStudyCompletion: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...legacy, ...history, qualificationHistoryVersion: 2 }).success).toBe(false);
    const noStudy = buildProfile(AnswersSchema.parse({ ...legacy, qualificationHistoryVersion: 1, hasPriorUniversityStudy: false }));
    expect(noStudy.qualificationHistory).toEqual({ hasPriorUniversityStudy: false });
    expect(isAnswered({ ...legacy, ...history, priorStudyInstitution: " " }, "priorStudyInstitution")).toBe(false);
  });
});

describe("history fact contract", () => {
  it("restates duration and completed study separately, without decisions", () => {
    const profile = buildProfile(AnswersSchema.parse({ ...legacy, ...history }));
    expect(deriveFacts(profile)).toMatchObject({ prior_degree_years: 4, years_of_university_study: 2, prior_degree_field: "cs", prior_study_country: "in", has_prior_university_study: true });
    expect(deriveFacts(profile)).not.toHaveProperty("university_study_institution_recognized");
    expect(deriveFacts(profile)).not.toHaveProperty("university_study_field_matches_target");
    expect(deriveFacts(profile)).not.toHaveProperty("school_certificate_requirements_met");
    expect(evaluate(profile, fixtureRules)).toEqual(evaluate(buildProfile(AnswersSchema.parse(legacy)), fixtureRules));
  });
  it("no prior study and missing legacy history never fabricate degree facts", () => {
    const profile = buildProfile(AnswersSchema.parse({ ...legacy, ...history, hasPriorUniversityStudy: false }));
    expect(deriveFacts(profile).has_prior_university_study).toBe(false);
    expect(deriveFacts(profile)).not.toHaveProperty("prior_degree_years");
    expect(deriveFacts(buildProfile(AnswersSchema.parse(legacy)))).not.toHaveProperty("has_prior_university_study");
  });
  it("keeps old unsupported published rule conditions disabled", () => {
    for (const key of ["prior_degree_years", "prior_degree_field", "years_of_university_study", "university_study_institution_recognized", "university_study_field_matches_target", "school_certificate_requirements_met"]) {
      const rule = { id: key, conditions: { [key]: 1 }, outcomes: { path: "direct" }, status: "verified", source_url: "https://www.uni-assist.de/en/", source_quote: "Synthetic test fixture", last_verified_at: "2026-10-02T00:00:00Z" };
      expect(EngineRuleSchema.safeParse(rule).success).toBe(false);
      expect(evaluate(buildProfile(AnswersSchema.parse({ ...legacy, ...history })), [rule]).path).toBe("unknown");
    }
  });
  it("labels history without losing official source metadata", () => {
    const chunk = ruleToChunk({ slug: "fixture", conditions: { certificate_country: "in", prior_degree_years: 4, years_of_university_study: 2, prior_degree_field: "cs" }, outcomes: { path: "unknown" }, source_url: "https://www.uni-assist.de/en/", source_quote: "Synthetic test fixture", last_verified_at: "2026-10-02T00:00:00Z", country_code: "in" });
    expect(chunk.content).toContain("country of the assessed qualification is in");
    expect(chunk.content).toContain("previous qualification duration in years is 4");
    expect(chunk.content).toContain("successfully completed university study in years is 2");
    expect(chunk.source_url).toBe("https://www.uni-assist.de/en/");
    expect(chunk.last_verified_at).toBe("2026-10-02T00:00:00Z");
  });
});


it("normalizes to a stable result without mutating input or stripping legacy fields", () => {
  const stale = { ...legacy, ...history, targetDegree: "master" as const, priorQualificationType: undefined, hasExistingApsCertificate: true };
  const normalized = normalizeAnswers(stale);
  expect(normalized).not.toHaveProperty("priorStudyCountry");
  expect(normalized).not.toHaveProperty("hasExistingApsCertificate");
  expect(normalizeAnswers(normalized)).toEqual(normalized);
  expect(stale.priorStudyCountry).toBe("in");
  expect(normalizeAnswers(legacy)).toEqual(legacy);
  expect(buildProfile({ ...stale, hasPriorUniversityStudy: false })).not.toHaveProperty("hasExistingApsCertificate");
  expect(PartialAnswersSchema.safeParse({ gceSubjects: [], priorStudyField: "" }).success).toBe(true);
  for (const invalid of [{ priorStudyCountry: 123 }, { priorDegreeYears: Infinity }, { priorStudyInstitution: "a".repeat(201) }, { unknown: true }]) {
    expect(PartialAnswersSchema.safeParse(invalid).success).toBe(false);
  }
});
