import {
  AWARDING_BODIES,
  BOARDS,
  COUNTRIES,
  INTAKE_OPTIONS,
  TARGET_FIELDS,
  type PartialAnswers,
  type StepId,
} from "./steps";

export type Option = { value: unknown; label: string; key: string };

/** Prompt (and optional subtitle) shown for each step of the checker. */
export const QUESTIONS: Record<StepId, { question: string; subtitle?: string }> = {
  targetDegree: { question: "Which degree level are you applying for?" },
  nationality: { question: "What is your nationality?" },
  certificateCountry: {
    question: "Where did you finish school?",
    subtitle: "Or where you will finish it — the country of your certificate.",
  },
  visaApplicationCountry: {
    question: "Where will you apply for your German visa?",
    subtitle:
      "The country you'll file your student-visa application from — usually where you live. It decides which embassy's rules (like APS) apply.",
  },
  curriculumType: {
    question: "Which curriculum did you study?",
    subtitle: "This decides which rules apply to you.",
  },
  board: { question: "Which board is your certificate from?" },
  schoolGradePercent: {
    question: "What is your overall Class 12 result?",
    subtitle: "Your overall percentage across subjects.",
  },
  jeeAdvanced: {
    question: "Do you have a valid JEE Advanced result?",
    subtitle: "A qualifying JEE Advanced rank changes your admission path.",
  },
  hasExistingApsCertificate: {
    question: "Do you already have an APS certificate?",
  },
  gceAwardingBody: { question: "Which awarding body issued your A-Levels?" },
  gceSubjects: {
    question: "Which subjects did you take?",
    subtitle: "Add each A-Level (AL) and AS subject with its grade.",
  },
  ibFullDiploma: {
    question: "Did you complete the full IB Diploma?",
    subtitle:
      "German universities do not accept an IB Certificate in place of the Diploma.",
  },
  ibExamYear: {
    question: "Which year did you sit your IB exams?",
    subtitle: "The requirements changed from the 2025 exam year onward.",
  },
  ibSchoolYears: {
    question: "How many school years did you complete in total?",
  },
  ibTotalPoints: {
    question: "What was your total IB score?",
    subtitle: "Out of 45, including the bonus points.",
  },
  ibSubjects: {
    question: "Which six subjects did you take?",
    subtitle: "Add each subject with its level (HL or SL) and grade.",
  },
  ibMathCourse: {
    question: "Which Mathematics course did you take?",
    subtitle:
      "Analysis and Approaches or Applications and Interpretation — this decides which subjects you can be admitted to.",
  },
  targetField: { question: "What do you want to study?" },
  intake: { question: "When do you want to start?" },
};

const countryOptions = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
  key: c.code,
}));

/** The selectable options for a single-choice step. Grade/subject steps render
 * their own bespoke inputs and return []. */
export function buildOptions(stepId: StepId, answers: PartialAnswers): Option[] {
  switch (stepId) {
    case "targetDegree":
      return [
        { value: "bachelor", label: "A Bachelor's degree", key: "bachelor" },
        { value: "master", label: "A Master's degree", key: "master" },
      ];
    case "nationality":
    case "visaApplicationCountry":
      return [
        ...countryOptions,
        { value: "other", label: "Another country", key: "other" },
      ];
    case "certificateCountry":
      return countryOptions;
    case "curriculumType":
      return [
        {
          value: "national",
          label: "National board (CBSE, FSc, Tawjihiyah …)",
          key: "national",
        },
        { value: "ib", label: "IB Diploma", key: "ib" },
        { value: "gce", label: "GCE A-Levels", key: "gce" },
        { value: "other", label: "Something else", key: "other" },
      ];
    case "board":
      return BOARDS
        .filter((b) => b.country === answers.certificateCountry)
        .map((b) => ({ value: b.id, label: b.label, key: b.id }));
    case "jeeAdvanced":
    case "hasExistingApsCertificate":
    case "ibFullDiploma":
      return [
        { value: true, label: "Yes", key: "yes" },
        { value: false, label: "No", key: "no" },
      ];
    case "ibSchoolYears":
      return [
        { value: 12, label: "12 years", key: "12" },
        { value: 13, label: "13 years", key: "13" },
      ];
    case "ibMathCourse":
      return [
        { value: "AA", label: "Analysis and Approaches (AA)", key: "AA" },
        { value: "AI", label: "Applications and Interpretation (AI)", key: "AI" },
        { value: "other", label: "Another Mathematics course", key: "other" },
      ];
    case "gceAwardingBody":
      return AWARDING_BODIES.map((b) => ({
        value: b.id,
        label: b.label,
        key: b.id,
      }));
    case "targetField":
      return TARGET_FIELDS.map((f) => ({
        value: f.id,
        label: f.label,
        key: f.id,
      }));
    case "intake":
      return [
        ...INTAKE_OPTIONS.map((o) => ({
          value: { term: o.term, year: o.year },
          label: o.label,
          key: `${o.term}-${o.year}`,
        })),
        { value: null, label: "Not sure yet", key: "unsure" },
      ];
    default:
      return [];
  }
}
