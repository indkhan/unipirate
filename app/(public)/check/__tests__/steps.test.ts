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
  hasDuplicateSubjects,
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

/**
 * A fully compliant IB Diploma: six subjects, four at HL, a group-2 foreign
 * language at HL, a group-3 social science, a group-4 natural science, and
 * Mathematics AA. `mathLevel` and `targetField` are what the ib-* rules branch
 * on, so each IB case below varies only those.
 */
function ibAnswers(overrides: {
  mathLevel: "HL" | "SL";
  targetField: string;
}): Answers {
  return AnswersSchema.parse({
    targetDegree: "bachelor",
    nationality: "in",
    certificateCountry: "in",
    visaApplicationCountry: "in",
    curriculumType: "ib",
    ibFullDiploma: true,
    ibExamYear: 2026,
    ibSchoolYears: 12,
    ibTotalPoints: 36,
    ibMathCourse: "AA",
    ibSubjects: [
      { subjectId: "language_a", level: "HL", grade: "5" },
      { subjectId: "german_b", level: "HL", grade: "5" },
      { subjectId: "history", level: "HL", grade: "5" },
      {
        subjectId: "physics",
        level: overrides.mathLevel === "HL" ? "SL" : "HL",
        grade: "5",
      },
      { subjectId: "mathematics", level: overrides.mathLevel, grade: "6" },
      { subjectId: "visual_arts", level: "SL", grade: "4" },
    ],
    hasExistingApsCertificate: false,
    targetField: overrides.targetField,
    intake: { term: "winter", year: 2026 },
  });
}

describe("IB answers reach the seeded IB rules", () => {
  it("Mathematics at HL gives general direct admission", () => {
    const profile = buildProfile(ibAnswers({ mathLevel: "HL", targetField: "cs" }));
    expect(profile.ib?.mathLevel).toBe("HL");
    expect(evaluate(profile, fixtureRules).path).toBe("direct");
  });

  it("Mathematics at SL closes the direct route to a STEM target", () => {
    const profile = buildProfile(
      ibAnswers({ mathLevel: "SL", targetField: "mechanical_engineering" }),
    );
    expect(evaluate(profile, fixtureRules).path).toBe("studienkolleg");
  });

  it("Mathematics at SL still allows subject-restricted access outside STEM", () => {
    const profile = buildProfile(
      ibAnswers({ mathLevel: "SL", targetField: "humanities" }),
    );
    expect(evaluate(profile, fixtureRules).path).toBe("subject_restricted");
  });

  it("an IB Certificate short of the diploma is an honest unknown", () => {
    const answers = AnswersSchema.parse({
      targetDegree: "bachelor",
      nationality: "in",
      certificateCountry: "in",
      visaApplicationCountry: "in",
      curriculumType: "ib",
      ibFullDiploma: false,
      hasExistingApsCertificate: false,
      targetField: "cs",
      intake: { term: "winter", year: 2026 },
    });

    // The detail questions cannot change the outcome, so they are not asked
    // and their facts stay undefined rather than being invented.
    expect(visibleSteps(answers)).not.toContain("ibSubjects");
    const profile = buildProfile(answers);
    expect(profile.ib).toEqual({
      fullDiploma: false,
      totalPoints: undefined,
      examYear: undefined,
      schoolYears: undefined,
      mathCourse: null,
      mathLevel: null,
      subjects: undefined,
    });
    expect(evaluate(profile, fixtureRules).path).toBe("unknown");
  });

  it("derives mathLevel from the Mathematics subject rather than asking", () => {
    const profile = buildProfile(ibAnswers({ mathLevel: "SL", targetField: "cs" }));
    expect(profile.ib?.mathLevel).toBe("SL");
    expect(profile.ib?.mathCourse).toBe("AA");
  });
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
  it("asks curriculum type before the board", () => {
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

  it("asks the IB detail questions only after a full diploma is confirmed", () => {
    const certificate = ibAnswers({ mathLevel: "HL", targetField: "cs" });
    const diplomaSteps = visibleSteps(certificate);
    expect(diplomaSteps).toContain("ibSubjects");
    expect(diplomaSteps).toContain("ibMathCourse");
    expect(diplomaSteps).not.toContain("board");
    expect(diplomaSteps).not.toContain("gceSubjects");

    const next = withAnswer(certificate, "ibFullDiploma", false);
    expect(visibleSteps(next)).not.toContain("ibSubjects");
    // the pruned detail answers go with their steps
    expect(next.ibSubjects).toBeUndefined();
    expect(next.ibTotalPoints).toBeUndefined();
  });

  it("does not count duplicate IB subjects as a complete answer", () => {
    const answers = ibAnswers({ mathLevel: "HL", targetField: "cs" });
    const duplicates = [
      { subjectId: "physics", level: "HL", grade: "5" },
      { subjectId: "physics", level: "SL", grade: "4" },
    ] satisfies Answers["ibSubjects"];

    expect(isAnswered({ ...answers, ibSubjects: duplicates }, "ibSubjects")).toBe(
      false,
    );
  });

  it("rejects an IB total outside 0-45", () => {
    const answers = ibAnswers({ mathLevel: "HL", targetField: "cs" });
    expect(isAnswered({ ...answers, ibTotalPoints: 46 }, "ibTotalPoints")).toBe(
      false,
    );
    expect(
      AnswersSchema.safeParse({ ...answers, ibTotalPoints: 46 }).success,
    ).toBe(false);
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

  it("does not count duplicate GCE subjects as a complete answer", () => {
    const duplicateSubjects = [
      { subjectId: "mathematics", level: "AL", grade: "A" },
      { subjectId: "mathematics", level: "AL", grade: "B" },
    ] satisfies Answers["gceSubjects"];

    expect(hasDuplicateSubjects(duplicateSubjects)).toBe(true);
    expect(
      isAnswered({ ...p11Answers, gceSubjects: duplicateSubjects }, "gceSubjects"),
    ).toBe(false);
    expect(
      AnswersSchema.safeParse({ ...p11Answers, gceSubjects: duplicateSubjects })
        .success,
    ).toBe(false);
  });
});
