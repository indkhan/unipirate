import { describe, expect, it } from "vitest";

import {
  p1CbseNoJee,
  p11ALevelsInSaudi,
} from "@/lib/engine/__tests__/personas";
import { fixtureRules } from "@/lib/engine/__tests__/rules.fixture";
import { evaluate } from "@/lib/engine/evaluate";

import {
  AnswersSchema,
  buildProfile,
  isAnswered,
  visibleSteps,
  withAnswer,
  type Answers,
} from "../steps";

// The exact clicks a user makes in the checker UI for each persona.
const p1Answers: Answers = AnswersSchema.parse({
  targetDegree: "bachelor",
  nationality: "in",
  certificateCountry: "in",
  visaApplicationCountry: "in",
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
  visaApplicationCountry: "sa",
  curriculumType: "gce",
  gceAwardingBody: "caie",
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
    expect(r.aps).toBe("not_required");
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
      "certificateCountry",
      "targetDegree",
      "nationality",
      "visaApplicationCountry",
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
      "certificateCountry",
      "targetDegree",
      "nationality",
      "visaApplicationCountry",
      "curriculumType",
      "gceAwardingBody",
      "gceSubjects",
      "targetField",
      "intake",
    ]);
  });

  it("withAnswer drops stale branch answers when curriculum changes", () => {
    const next = withAnswer(p1Answers, "curriculumType", "gce");
    expect(next.board).toBeUndefined();
    expect(next.schoolGradePercent).toBeUndefined();
    expect(next.jeeAdvanced).toBeUndefined();
    expect(next.nationality).toBe("in");
    // APS-certificate answer survives: it depends on country, not curriculum
    expect(next.hasExistingApsCertificate).toBe(false);
  });

  it("skips the existing-APS question when the visa is filed from Saudi Arabia", () => {
    const next = withAnswer(p1Answers, "visaApplicationCountry", "sa");
    expect(visibleSteps(next)).not.toContain("hasExistingApsCertificate");
    // the stale APS answer is pruned along with its step
    expect(next.hasExistingApsCertificate).toBeUndefined();
  });

  it("incomplete answers fail schema validation", () => {
    expect(
      AnswersSchema.safeParse({ ...p1Answers, board: undefined }).success,
    ).toBe(false);
  });

  it("rejects impossible school percentages before submission", () => {
    expect(
      isAnswered({ ...p1Answers, schoolGradePercent: 150 }, "schoolGradePercent"),
    ).toBe(false);
    expect(
      isAnswered({ ...p1Answers, schoolGradePercent: -1 }, "schoolGradePercent"),
    ).toBe(false);
    expect(
      AnswersSchema.safeParse({ ...p1Answers, schoolGradePercent: 150 })
        .success,
    ).toBe(false);
  });
});
