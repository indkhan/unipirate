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

export const IB_GRADES = ["7", "6", "5", "4", "3", "2", "1"] as const;

export const IB_LEVELS = [
  { value: "HL", label: "Higher Level (HL)" },
  { value: "SL", label: "Standard Level (SL)" },
] as const;

// Trade-off: static catalog of common IB subjects with their group and DAAD
// category, mirroring
// https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/ — the
// same page the seeded ib-* rules cite. Group 1 is language and literature,
// group 2 is language acquisition (hence foreignLanguage), groups 3-6 are
// individuals and societies, sciences, mathematics and the arts.
// Only subjects DAAD recognizes are listed, so `ib_all_subjects_recognized`
// cannot currently come back false; add unrecognized entries here rather than
// guessing a classification. Move into the DB alongside `qualifications` when
// the list needs to grow.
export const IB_SUBJECTS = [
  { id: "language_a", label: "Language A (literature)", group: 1, category: "language" },
  { id: "language_b", label: "Language B (acquisition)", group: 2, category: "language", foreignLanguage: true },
  { id: "german_b", label: "German B", group: 2, category: "language", foreignLanguage: true },
  { id: "history", label: "History", group: 3, category: "other" },
  { id: "geography", label: "Geography", group: 3, category: "other" },
  { id: "economics", label: "Economics", group: 3, category: "other" },
  { id: "psychology", label: "Psychology", group: 3, category: "other" },
  { id: "business_management", label: "Business Management", group: 3, category: "other" },
  { id: "biology", label: "Biology", group: 4, category: "biology" },
  { id: "chemistry", label: "Chemistry", group: 4, category: "chemistry" },
  { id: "physics", label: "Physics", group: 4, category: "physics" },
  { id: "computer_science", label: "Computer Science", group: 4, category: "other" },
  { id: "mathematics", label: "Mathematics", group: 5, category: "math" },
  { id: "visual_arts", label: "Visual Arts", group: 6, category: "other" },
  { id: "music", label: "Music", group: 6, category: "other" },
] as const;

export type IbSubjectId = (typeof IB_SUBJECTS)[number]["id"];

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

// Trade-off: the supported countries and their school boards are static
// catalogs, like the subject lists above — three countries and six boards do
// not earn a database table. Move into the DB when a non-engineer needs to
// add one without a deploy.
export const COUNTRIES = [
  { code: "in", name: "India" },
  { code: "pk", name: "Pakistan" },
  { code: "sa", name: "Saudi Arabia" },
] as const;

export const BOARDS = [
  { id: "cbse", label: "CBSE", country: "in" },
  { id: "cisce", label: "CISCE", country: "in" },
  { id: "state_board", label: "State board", country: "in" },
  { id: "fsc", label: "FSc/HSSC", country: "pk" },
  { id: "tawjihiyah", label: "Tawjihiyah", country: "sa" },
  { id: "private_school", label: "Private-school certificate", country: "sa" },
] as const;

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

const IbSubjectAnswerSchema = z.object({
  subjectId: z.enum(IB_SUBJECTS.map((s) => s.id) as [IbSubjectId, ...IbSubjectId[]]),
  level: z.enum(["HL", "SL"]),
  grade: z.enum(IB_GRADES),
});

export type IbSubjectAnswer = z.infer<typeof IbSubjectAnswerSchema>;

/**
 * Steps rendered as a bare number input rather than option cards. `error` is
 * shown when a value is present but fails `isAnswered`.
 */
export const NUMBER_STEPS = {
  priorDegreeYears: { label: "Qualification duration in years · required", min: 0, max: 50, placeholder: "4", error: "Enter a duration from 0 to 50 years." },
  yearsOfUniversityStudy: { label: "Successfully completed study in years · required", min: 0, max: 50, placeholder: "1", error: "Enter completed study from 0 to 50 years." },
  schoolGradePercent: {
    label: "Overall marks · required",
    suffix: "%",
    min: 0,
    max: 100,
    placeholder: "85",
    error: "Enter a percentage from 0 to 100.",
  },
  ibExamYear: {
    label: "Exam year · required",
    min: 1990,
    max: 2035,
    placeholder: "2026",
    error: "Enter the year you sat your IB exams.",
  },
  ibTotalPoints: {
    label: "Total points · required",
    min: 0,
    max: 45,
    placeholder: "36",
    error: "Enter your total points, from 0 to 45.",
  },
} as const;

export type NumberStepId = keyof typeof NUMBER_STEPS;

export const TEXT_STEPS = {
  priorStudyInstitution: { label: "Previous institution", maxLength: 200 },
  priorStudyCountryOther: { label: "Awarding institution country", maxLength: 100 },
  priorStudyField: { label: "Previous field of study", maxLength: 200 },
} as const;

export function isTextStep(step: StepId): step is keyof typeof TEXT_STEPS {
  return step in TEXT_STEPS;
}

export const HISTORY_STEPS = [
  "hasPriorUniversityStudy", "priorQualificationType", "priorStudyInstitution",
  "priorStudyCountry", "priorStudyField", "priorDegreeYears",
  "yearsOfUniversityStudy", "priorStudyCompletion", "priorQualificationContext", "priorStudyCountryOther",
] as const;

export function isNumberStep(step: StepId): step is NumberStepId {
  return step in NUMBER_STEPS;
}

const AnswerFieldsSchema = z
  .object({
    qualificationHistoryVersion: z.literal(1).optional(),
    hasPriorUniversityStudy: z.boolean().optional(),
    priorQualificationType: z.enum(["bachelor", "master", "diploma", "other"]).optional(),
    priorStudyInstitution: z.string().trim().min(1).max(200).optional(),
    priorStudyCountry: z.union([z.literal("other"), z.string().trim().toLowerCase().regex(/^[a-z]{2}$/)]).optional(),
    priorStudyCountryOther: z.string().trim().min(1).max(100).optional(),
    priorQualificationContext: z.enum(["national", "other", "unknown"]).optional(),
    priorStudyField: z.string().trim().min(1).max(200).optional(),
    priorDegreeYears: z.number().finite().min(0).max(50).optional(),
    yearsOfUniversityStudy: z.number().finite().min(0).max(50).optional(),
    priorStudyCompletion: z.enum(["completed", "in_progress", "discontinued"]).optional(),
    targetDegree: z.enum(["bachelor", "master"]),
    nationality: z.string().min(2),
    certificateCountry: z.string().min(2).optional(),
    // country of the German mission the visa is filed with; "other" = elsewhere
    visaApplicationCountry: z.string().min(2).optional(),
    curriculumType: z.enum(["national", "ib", "gce", "other"]).optional(),
    board: z.string().min(1).optional(),
    schoolGradePercent: z.number().min(0).max(100).optional(),
    jeeAdvanced: z.boolean().optional(),
    hasExistingApsCertificate: z.boolean().optional(),
    gceAwardingBody: z
      .enum(AWARDING_BODIES.map((b) => b.id) as [string, ...string[]])
      .optional(),
    gceSubjects: z.array(GceSubjectAnswerSchema).min(1).optional(),
    ibFullDiploma: z.boolean().optional(),
    ibExamYear: z.number().int().min(1990).max(2035).optional(),
    ibSchoolYears: z.union([z.literal(12), z.literal(13)]).optional(),
    ibTotalPoints: z.number().int().min(0).max(45).optional(),
    ibSubjects: z.array(IbSubjectAnswerSchema).min(1).optional(),
    ibMathCourse: z.enum(["AA", "AI", "other"]).optional(),
    targetField: z.string().min(1),
    // null = "not sure yet" — intake is omitted from the profile
    intake: z
      .object({
        term: z.enum(["winter", "summer"]),
        year: z.number().int().min(2025).max(2035),
      })
      .nullable(),
  })
  .strict();

export type Answers = z.infer<typeof AnswerFieldsSchema>;
export type PartialAnswers = Partial<Answers>;
// Draft text can be unfinished; complete submissions retain required-text checks.
export const PartialAnswersSchema = AnswerFieldsSchema.partial().extend({
  priorStudyInstitution: z.string().trim().max(200).optional(),
  priorStudyField: z.string().trim().max(200).optional(),
  priorStudyCountryOther: z.string().trim().max(100).optional(),
  gceSubjects: z.array(GceSubjectAnswerSchema).optional(),
  ibSubjects: z.array(IbSubjectAnswerSchema).optional(),
});
export const AnswersSchema = AnswerFieldsSchema
  .transform((answers) => normalizeAnswers(answers))
  .superRefine((answers, ctx) => {
    // Legacy records retain their original required school-country boundary.
    if (answers.qualificationHistoryVersion === undefined && answers.certificateCountry === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["certificateCountry"],
        message: 'Missing answer for step "certificateCountry"' });
    }
    // Only the versioned master's flow can omit the former school question.
    if (answers.targetDegree === "master" &&
        answers.qualificationHistoryVersion === undefined &&
        answers.curriculumType === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["curriculumType"],
        message: 'Missing answer for step "curriculumType"' });
    }
    for (const step of visibleSteps(answers)) {
      // Legacy stored checks stay readable. New/edited flows require history.
      if (answers.qualificationHistoryVersion === undefined &&
          !HISTORY_STEPS.some((key) => answers[key] !== undefined) &&
          HISTORY_STEPS.includes(step as (typeof HISTORY_STEPS)[number])) continue;
      if (!isAnswered(answers, step)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [step],
          message: `Missing answer for step "${step}"`,
        });
      }
    }
  });

// --------------------------------------------------------------------- steps

export type StepId =
  | (typeof HISTORY_STEPS)[number]
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
  | "ibFullDiploma"
  | "ibExamYear"
  | "ibSchoolYears"
  | "ibTotalPoints"
  | "ibSubjects"
  | "ibMathCourse"
  | "targetField"
  | "intake";

/**
 * Ordered question list for the current answers. Branches:
 * curriculum type is asked BEFORE the board (a board only makes sense for a
 * national curriculum) and routes national-board, GCE and IB questions; an IB
 * certificate short of the full diploma skips the rest, since no rule can give
 * it a path. "Something else" collects no curriculum detail, so the engine
 * returns honest unknowns instead of guessing.
 */
export function visibleSteps(answers: PartialAnswers): StepId[] {
  const steps: StepId[] = ["targetDegree"];
  if (answers.targetDegree !== "master") steps.push("certificateCountry");
  steps.push("nationality", "visaApplicationCountry");
  const bachelor = answers.targetDegree === "bachelor";
  if (answers.targetDegree !== "master") steps.push("curriculumType");
  if (bachelor && answers.curriculumType === "national") {
    steps.push("board", "schoolGradePercent");
    if (answers.certificateCountry === "in") steps.push("jeeAdvanced");
  }
  if (bachelor && answers.curriculumType === "gce") {
    steps.push("gceAwardingBody", "gceSubjects");
  }
  if (bachelor && answers.curriculumType === "ib") {
    steps.push("ibFullDiploma");
    // An IB Certificate is never accepted as a Diploma, so the detail questions
    // cannot change the outcome — don't ask them.
    if (answers.ibFullDiploma) {
      steps.push(
        "ibExamYear",
        "ibSchoolYears",
        "ibTotalPoints",
        "ibSubjects",
        "ibMathCourse",
      );
    }
  }
  // National bachelor routes can depend on previous university study. GCE/IB
  // history is reserved for their route issues; no eligibility is inferred here.
  if (answers.targetDegree === "master" || (bachelor && answers.curriculumType === "national")) {
    steps.push("hasPriorUniversityStudy");
    if (answers.hasPriorUniversityStudy === true) {
      steps.push("priorQualificationType");
      if (answers.priorQualificationType !== undefined) {
        steps.push("priorStudyInstitution", "priorStudyCountry");
        if (answers.priorStudyCountry === "other") steps.push("priorStudyCountryOther");
        if (answers.targetDegree === "master") steps.push("priorQualificationContext");
        steps.push("priorStudyField", "priorDegreeYears", "yearsOfUniversityStudy", "priorStudyCompletion");
      }
    }
  }
  // no APS on the Riyadh checklist, so an existing certificate is irrelevant
  // when the visa is filed from Saudi Arabia
  if (
    qualificationCountry(answers) === "in" &&
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
  const next: PartialAnswers = { ...answers, qualificationHistoryVersion: 1, [field]: value };
  if (answers[field] !== value) {
    const dependents: Partial<Record<StepId, readonly StepId[]>> = {
      targetDegree: HISTORY_STEPS,
      curriculumType: HISTORY_STEPS,
      certificateCountry: ["board", "schoolGradePercent", "jeeAdvanced"],
      priorQualificationType: [...HISTORY_STEPS.filter((key) => key !== "hasPriorUniversityStudy" && key !== "priorQualificationType"), "hasExistingApsCertificate"],
      priorStudyCountry: ["priorStudyCountryOther", "priorQualificationContext", "hasExistingApsCertificate"],
      priorQualificationContext: ["hasExistingApsCertificate"],
      priorStudyInstitution: ["priorStudyCountry", "priorStudyCountryOther", "priorQualificationContext", "hasExistingApsCertificate"],
    };
    for (const key of dependents[field] ?? []) delete next[key];
  }
  return normalizeAnswers(next);
}

/** Preserve legacy records; versioned answers contain only reachable questions. */
export function normalizeAnswers<T extends PartialAnswers>(answers: T): T {
  const next = { ...answers };
  if (next.qualificationHistoryVersion !== 1) return next;
  // Removing a hidden country can also hide APS, so prune to a stable result.
  let changed: boolean;
  do {
    changed = false;
    const visible = new Set<string>(visibleSteps(next));
    for (const key of Object.keys(next)) {
      if (key !== "qualificationHistoryVersion" && !visible.has(key)) {
        delete next[key as StepId];
        changed = true;
      }
    }
  } while (changed);
  return next;
}

export function isAnswered(answers: PartialAnswers, step: StepId): boolean {
  if (isTextStep(step)) {
    const value = answers[step];
    return typeof value === "string" && value.trim().length > 0 &&
      value.trim().length <= TEXT_STEPS[step].maxLength;
  }
  if (step === "priorStudyCountry") return answers.priorStudyCountry === "other" || /^[a-z]{2}$/i.test(typeof answers.priorStudyCountry === "string" ? answers.priorStudyCountry.trim() : "");
  if (step === "intake") return answers.intake !== undefined;
  if (step === "gceSubjects" || step === "ibSubjects") {
    const subjects = answers[step] ?? [];
    return subjects.length > 0 && !hasDuplicateSubjects(subjects);
  }
  if (isNumberStep(step)) {
    const { min, max } = NUMBER_STEPS[step];
    const value = answers[step];
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
    );
  }
  return answers[step] !== undefined;
}

export function hasDuplicateSubjects(
  subjects: { subjectId: string }[],
): boolean {
  const subjectIds = new Set<string>();
  for (const subject of subjects) {
    if (subjectIds.has(subject.subjectId)) return true;
    subjectIds.add(subject.subjectId);
  }
  return false;
}

// ------------------------------------------------------------------- profile

/** The actual qualification being assessed, never a master's school location. */
export function qualificationCountry(answers: PartialAnswers): string | undefined {
  return answers.targetDegree === "master" && answers.qualificationHistoryVersion === 1
    ? answers.hasPriorUniversityStudy ? answers.priorStudyCountry : undefined
    : answers.certificateCountry;
}

/** Maps completed answers onto the engine Profile shape. */
export function buildProfile(answers: Answers): Profile {
  answers = normalizeAnswers(answers);
  const tertiary = answers.targetDegree === "master" && answers.qualificationHistoryVersion === 1;
  const profile: Profile = {
    targetDegree: answers.targetDegree,
    nationality: answers.nationality,
    certificateCountry: qualificationCountry(answers),
    curriculumType: tertiary ? "other" : answers.curriculumType ?? "other",
    targetField: answers.targetField,
  };
  if (answers.hasPriorUniversityStudy !== undefined) {
    profile.qualificationHistory = answers.hasPriorUniversityStudy ? {
      hasPriorUniversityStudy: true,
      qualificationType: answers.priorQualificationType,
      institution: answers.priorStudyInstitution,
      country: answers.priorStudyCountry,
      ...(answers.priorStudyCountryOther ? { countryName: answers.priorStudyCountryOther } : {}),
      field: answers.priorStudyField,
      degreeYears: answers.priorDegreeYears,
      completedYears: answers.yearsOfUniversityStudy,
      completion: answers.priorStudyCompletion,
    } : { hasPriorUniversityStudy: false };
  }
  if (answers.intake) profile.intake = answers.intake;
  if (answers.visaApplicationCountry !== undefined) {
    profile.visaApplicationCountry = answers.visaApplicationCountry;
  }
  if (answers.hasExistingApsCertificate !== undefined) {
    profile.hasExistingApsCertificate = answers.hasExistingApsCertificate;
  }
  if (tertiary) {
    // Explicit awarding context supplies the existing qualification facts;
    // school curriculum and location are not inferred or used for master's rules.
    profile.tertiaryQualification = answers.hasPriorUniversityStudy ? {
      issuer: answers.priorStudyInstitution,
      country: answers.priorStudyCountry,
      context: answers.priorQualificationContext,
      ...(answers.priorStudyCountryOther ? { countryName: answers.priorStudyCountryOther } : {}),
    } : {};
    return profile;
  }
  if (answers.board !== undefined) profile.board = answers.board;
  if (answers.schoolGradePercent !== undefined) {
    profile.schoolGradePercent = answers.schoolGradePercent;
  }
  if (answers.jeeAdvanced !== undefined) {
    profile.jeeAdvanced = answers.jeeAdvanced;
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
  if (answers.curriculumType === "ib" && answers.ibFullDiploma !== undefined) {
    const subjects = answers.ibSubjects?.map((s) => {
      const subject = IB_SUBJECTS.find((c) => c.id === s.subjectId)!;
      return {
        group: subject.group,
        level: s.level,
        grade: Number(s.grade),
        category: subject.category,
        ...("foreignLanguage" in subject
          ? { foreignLanguage: subject.foreignLanguage }
          : {}),
        // The catalog lists only subjects DAAD recognizes — see IB_SUBJECTS.
        recognizedForGermany: true,
      };
    });
    // Only the diploma question is asked when the answer is "no": nothing below
    // it can change the outcome, so those facts stay genuinely unknown.
    profile.ib = {
      fullDiploma: answers.ibFullDiploma,
      totalPoints: answers.ibTotalPoints,
      examYear: answers.ibExamYear,
      schoolYears: answers.ibSchoolYears,
      mathCourse: answers.ibMathCourse ?? null,
      mathLevel:
        subjects?.find((s) => s.category === "math")?.level ?? null,
      subjects,
    };
  }
  return profile;
}
