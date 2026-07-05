import { describe, expect, it } from "vitest";

import {
  p1CbseNoJee,
  p11ALevelsInSaudi,
} from "@/lib/engine/__tests__/personas";
import { fixtureRules } from "@/lib/engine/__tests__/rules.fixture";
import { evaluate } from "@/lib/engine/evaluate";

import { AnswersSchema, buildProfile, visibleSteps, type Answers } from "../steps";

// The exact clicks a user makes in the checker UI for each persona.
const p1Answers: Answers = AnswersSchema.parse({
  targetDegree: "bachelor",
  nationality: "in",
  certificateCountry: "in",
  curriculumType: "national",
  board: "cbse",
  schoolGradePercent: 82,
  jeeAdvanced: false,
  hasExistingApsCertificate: false,
  targetField: "cs",
  intake: { term: "winter", year: 2026 },
});

const p11Answers: Answers = AnswersSchema.parse({
  targetDegree: "bachelor",
  nationality: "pk",
  certificateCountry: "sa",
  curriculumType: "gce",
  gceAwardingBody: "caie",
  gceSchoolYears: 12,
  gceSubjects: [
    { subjectId: "mathematics", level: "AL", grade: "A" },
    { subjectId: "physics", level: "AL", grade: "A" },
    { subjectId: "computer_science", level: "AL", grade: "B" },
    { subjectId: "english_language", level: "AS", grade: "A" },
  ],
  targetField: "cs",
  intake: null,
});

describe("buildProfile reproduces engine-test personas", () => {
  it("persona #1: CBSE 82%, no JEE", () => {
    expect(buildProfile(p1Answers)).toEqual(p1CbseNoJee);
  });

  it("persona #11: A-Levels (CAIE) in Saudi Arabia", () => {
    expect(buildProfile(p11Answers)).toEqual(p11ALevelsInSaudi);
  });

  it("persona #1 answers evaluate to the persona-#1 outcome", () => {
    const r = evaluate(buildProfile(p1Answers), fixtureRules);
    expect(r.path).toBe("studienkolleg");
    expect(r.aps).toBe("required");
    expect(r.testAS).toBe("unknown");
    expect(r.dMAT).toBe("not_required");
  });

  it("persona #11 answers evaluate to the persona-#11 outcome", () => {
    const r = evaluate(buildProfile(p11Answers), fixtureRules);
    expect(r.path).toBe("subject_restricted");
    expect(r.aps).toBe("unknown");
  });
});

describe("visibleSteps", () => {
  it("asks curriculum type before the board (domain rule 5)", () => {
    const steps = visibleSteps(p1Answers);
    expect(steps.indexOf("curriculumType")).toBeGreaterThan(-1);
    expect(steps.indexOf("curriculumType")).toBeLessThan(
      steps.indexOf("board"),
    );
  });

  it("persona #1 path shows Indian national-board steps", () => {
    expect(visibleSteps(p1Answers)).toEqual([
      "targetDegree",
      "nationality",
      "certificateCountry",
      "curriculumType",
      "board",
      "schoolGradePercent",
      "jeeAdvanced",
      "hasExistingApsCertificate",
      "targetField",
      "intake",
    ]);
  });

  it("persona #11 path shows GCE steps, never board/JEE/APS-cert", () => {
    expect(visibleSteps(p11Answers)).toEqual([
      "targetDegree",
      "nationality",
      "certificateCountry",
      "curriculumType",
      "gceAwardingBody",
      "gceSchoolYears",
      "gceSubjects",
      "targetField",
      "intake",
    ]);
  });

  it("incomplete answers fail schema validation", () => {
    expect(
      AnswersSchema.safeParse({ ...p1Answers, board: undefined }).success,
    ).toBe(false);
  });
});
