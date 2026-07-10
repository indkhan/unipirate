// Pure checker-flow logic: which question comes when, what a complete set of
// answers looks like, and how answers map onto the engine Profile.
// No I/O, no React — unit-tested in __tests__/steps.test.ts.
import { z } from "zod";

import type { Profile } from "@/lib/engine/evaluate";

// ---------------------------------------------------------------- vocabulary

export const AWARDING_BODIES = [
  { id: "caie", label: "Cambridge (CAIE)" },
  { id: "pearson", label: "Pearson Edexcel" },
  { id: "oxford_aqa", label: "OxfordAQA" },
  { id: "aqa", label: "AQA" },
  { id: "ocr", label: "OCR" },
  { id: "wjec", label: "WJEC" },
  { id: "ccea", label: "CCEA" },
  { id: "lrn", label: "LRN" },
  { id: "other", label: "Another awarding body" },
] as const;

export const GCE_GRADES = ["A*", "A", "B", "C", "D", "E", "U"] as const;

// Trade-off: static catalog of common A-Level subjects with their DAAD
// classification; move into the DB alongside `qualifications` when subjects
// beyond this list are needed. List/category mirror
// https://www.daad.de/en/studying-in-germany/requirements/gce/ (List A =
// general-education subjects).
export const GCE_SUBJECTS = [
  { id: "mathematics", label: "Mathematics", category: "math", list: "A" },
  { id: "physics", label: "Physics", category: "physics", list: "A" },
  { id: "chemistry", label: "Chemistry", category: "chemistry", list: "A" },
  { id: "biology", label: "Biology", category: "biology", list: "A" },
  {
    id: "computer_science",
    label: "Computer Science",
    category: "computer_science",
    list: "A",
  },
  {
    id: "english_language",
    label: "English Language",
    category: "language",
    list: "A",
  },
  { id: "economics", label: "Economics", category: "economics", list: "A" },
  { id: "history", label: "History", category: "history", list: "A" },
  { id: "geography", label: "Geography", category: "geography", list: "A" },
] as const;

export type GceSubjectId = (typeof GCE_SUBJECTS)[number]["id"];

// Field ids match the vocabularies the seeded rules condition on
// (scripts/rules.bootstrap.ts STEM/TECHNICAL/SOCIAL_ECONOMICS/HUMANITIES).
export const TARGET_FIELDS = [
  { id: "cs", label: "Computer Science" },
  { id: "it", label: "IT / Software" },
  { id: "mechanical_engineering", label: "Mechanical Engineering" },
  { id: "electrical_engineering", label: "Electrical Engineering" },
  { id: "civil_engineering", label: "Civil Engineering" },
  { id: "engineering", label: "Other Engineering" },
  { id: "math", label: "Mathematics" },
  { id: "physics", label: "Physics" },
  { id: "business", label: "Business / Management" },
  { id: "economics", label: "Economics" },
  { id: "finance", label: "Finance / Accounting" },
  { id: "law", label: "Law" },
  { id: "humanities", label: "Humanities / Languages" },
  { id: "other", label: "Something else" },
] as const;

// qualifications.board_or_type (display label in DB) → engine board fact id.
export const BOARD_IDS: Record<string, string> = {
  CBSE: "cbse",
  CISCE: "cisce",
  "State board": "state_board",
  "FSc/HSSC": "fsc",
  Tawjihiyah: "tawjihiyah",
  "Private-school certificate": "private_school",
};

export const INTAKE_OPTIONS = [
  { term: "winter", year: 2026, label: "Winter 2026/27" },
  { term: "summer", year: 2027, label: "Summer 2027" },
  { term: "winter", year: 2027, label: "Winter 2027/28" },
] as const;

// ------------------------------------------------------------------- answers

const GceSubjectAnswerSchema = z.object({
  subjectId: z.enum(
    GCE_SUBJECTS.map((s) => s.id) as [GceSubjectId, ...GceSubjectId[]],
  ),
  level: z.enum(["AL", "AS"]),
  grade: z.enum(GCE_GRADES),
});

export type GceSubjectAnswer = z.infer<typeof GceSubjectAnswerSchema>;

export const AnswersSchema = z
  .object({
    targetDegree: z.enum(["bachelor", "master"]),
    nationality: z.string().min(2),
    certificateCountry: z.string().min(2),
    // country of the German mission the visa is filed with; "other" = elsewhere
    visaApplicationCountry: z.string().min(2).optional(),
    curriculumType: z.enum(["national", "ib", "gce", "other"]),
    board: z.string().min(1).optional(),
    schoolGradePercent: z.number().min(0).max(100).optional(),
    jeeAdvanced: z.boolean().optional(),
    hasExistingApsCertificate: z.boolean().optional(),
    gceAwardingBody: z
      .enum(AWARDING_BODIES.map((b) => b.id) as [string, ...string[]])
      .optional(),
    gceSchoolYears: z.union([z.literal(12), z.literal(13)]).optional(),
    gceSubjects: z.array(GceSubjectAnswerSchema).min(1).optional(),
    targetField: z.string().min(1),
    // null = "not sure yet" — intake is omitted from the profile
    intake: z
      .object({
        term: z.enum(["winter", "summer"]),
        year: z.number().int().min(2025).max(2035),
      })
      .nullable(),
  })
  .strict()
  .superRefine((answers, ctx) => {
    for (const step of visibleSteps(answers)) {
      if (!isAnswered(answers, step)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [step],
          message: `Missing answer for step "${step}"`,
        });
      }
    }
  });

export type Answers = z.infer<typeof AnswersSchema>;
export type PartialAnswers = Partial<Answers>;

// --------------------------------------------------------------------- steps

export type StepId =
  | "targetDegree"
  | "nationality"
  | "certificateCountry"
  | "visaApplicationCountry"
  | "curriculumType"
  | "board"
  | "schoolGradePercent"
  | "jeeAdvanced"
  | "hasExistingApsCertificate"
  | "gceAwardingBody"
  | "gceSubjects"
  | "targetField"
  | "intake";

/**
 * Ordered question list for the current answers. Branches:
 * curriculum type is asked BEFORE the board (a board only makes sense for a
 * national curriculum) and routes national-board vs GCE questions; IB/other
 * collect no curriculum detail yet, so the engine returns honest unknowns
 * instead of guessing.
 */
export function visibleSteps(answers: PartialAnswers): StepId[] {
  const steps: StepId[] = [
    "certificateCountry",
    "targetDegree",
    "nationality",
    "visaApplicationCountry",
    "curriculumType",
  ];
  const bachelor = answers.targetDegree === "bachelor";
  if (bachelor && answers.curriculumType === "national") {
    steps.push("board", "schoolGradePercent");
    if (answers.certificateCountry === "in") steps.push("jeeAdvanced");
  }
  if (bachelor && answers.curriculumType === "gce") {
    steps.push("gceAwardingBody", "gceSubjects");
  }
  // no APS on the Riyadh checklist, so an existing certificate is irrelevant
  // when the visa is filed from Saudi Arabia
  if (
    answers.certificateCountry === "in" &&
    answers.visaApplicationCountry !== "sa"
  ) {
    steps.push("hasExistingApsCertificate");
  }
  steps.push("targetField", "intake");
  return steps;
}

/**
 * Sets one answer and prunes answers whose step is no longer visible, so
 * changing e.g. curriculum from national to GCE drops the stale board answer.
 */
export function withAnswer<K extends StepId>(
  answers: PartialAnswers,
  field: K,
  value: Answers[K],
): PartialAnswers {
  const next: PartialAnswers = { ...answers, [field]: value };
  const visible = new Set<string>(visibleSteps(next));
  for (const key of Object.keys(next)) {
    if (!visible.has(key)) delete next[key as StepId];
  }
  return next;
}

export function isAnswered(answers: PartialAnswers, step: StepId): boolean {
  if (step === "intake") return answers.intake !== undefined;
  if (step === "gceSubjects") {
    const subjects = answers.gceSubjects ?? [];
    return subjects.length > 0 && !hasDuplicateGceSubjects(subjects);
  }
  if (step === "schoolGradePercent") {
    const grade = answers.schoolGradePercent;
    return (
      typeof grade === "number" &&
      Number.isFinite(grade) &&
      grade >= 0 &&
      grade <= 100
    );
  }
  return answers[step] !== undefined;
}

export function hasDuplicateGceSubjects(subjects: GceSubjectAnswer[]): boolean {
  const subjectIds = new Set<string>();
  for (const subject of subjects) {
    if (subjectIds.has(subject.subjectId)) return true;
    subjectIds.add(subject.subjectId);
  }
  return false;
}

// ------------------------------------------------------------------- profile

/** Maps completed answers onto the engine Profile shape. */
export function buildProfile(answers: Answers): Profile {
  const profile: Profile = {
    targetDegree: answers.targetDegree,
    nationality: answers.nationality,
    certificateCountry: answers.certificateCountry,
    curriculumType: answers.curriculumType,
    targetField: answers.targetField,
  };
  if (answers.intake) profile.intake = answers.intake;
  if (answers.visaApplicationCountry !== undefined) {
    profile.visaApplicationCountry = answers.visaApplicationCountry;
  }
  if (answers.board !== undefined) profile.board = answers.board;
  if (answers.schoolGradePercent !== undefined) {
    profile.schoolGradePercent = answers.schoolGradePercent;
  }
  if (answers.jeeAdvanced !== undefined) {
    profile.jeeAdvanced = answers.jeeAdvanced;
  }
  if (answers.hasExistingApsCertificate !== undefined) {
    profile.hasExistingApsCertificate = answers.hasExistingApsCertificate;
  }
  if (
    answers.curriculumType === "gce" &&
    answers.gceAwardingBody !== undefined &&
    answers.gceSubjects !== undefined
  ) {
    profile.gce = {
      awardingBody:
        answers.gceAwardingBody as NonNullable<Profile["gce"]>["awardingBody"],
      schoolYears: answers.gceSubjects.some((subject) => subject.level === "AL")
        ? 13
        : 12,
      subjects: answers.gceSubjects.map((s) => {
        const subject = GCE_SUBJECTS.find((c) => c.id === s.subjectId)!;
        return {
          independenceGroup: subject.id,
          level: s.level,
          grade: s.grade,
          list: subject.list,
          category: subject.category,
        };
      }),
    };
  }
  return profile;
}
