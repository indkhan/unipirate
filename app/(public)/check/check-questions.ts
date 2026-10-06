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
export const QUESTIONS: Record<StepId, { question: string; subtitle?: string; sourceUrl?: string }> = {
  apsProcedureStatus: { question: "Which APS procedure covers the qualifications relevant to this application?", subtitle: "Choose a new evaluation if later qualifications need reassessment. An old certificate alone does not confirm the basis for a new application.", sourceUrl: "https://aps-india.de/faqs/" },
  apsSubmissionConfirmation: { question: "Does APS confirm the complete submission date for your Class XII or Class XII plus one-successful-Bachelor-year assessment?", subtitle: "Use an APS record or communication for this procedure and academic basis. Registration, payment, courier dispatch and delivery dates alone do not establish this milestone. For another basis or an uncertain procedure/date, choose Cannot confirm.", sourceUrl: "https://aps-india.de/news/" },
  apsSubmissionDate: { question: "What complete submission date does APS confirm for this procedure?", subtitle: "Enter YYYY-MM-DD from the APS record or communication. For a new evaluation, use its submission date, not an earlier procedure's date. Certificate validity and university admission are assessed separately.", sourceUrl: "https://aps-india.de/news/" },
  schoolQualificationCountry: { question: "Which country's institution or awarding body issued your school qualification?", subtitle: "Use the issuer on your certificate, not your passport or the country where you attended school. Choose unsure if you cannot confirm." },
  schoolQualificationContext: { question: "What type of qualification did that issuer award?", subtitle: "National qualifications and international qualifications such as IB or GCE have different verification contexts." },
  apsApplicationContext: { question: "Will uni-assist assess your application or issue a VPD?", subtitle: "Confirm this from your programme's application instructions. Choose unsure for other or unconfirmed routes." },
  visaMissionContext: { question: "Does your responsible mission's Saudi study checklist apply to you?", subtitle: "Confirm responsibility from your residence and the mission's instructions. Selecting Saudi Arabia alone does not establish jurisdiction." },
  hasPriorUniversityStudy: { question: "Have you studied at a university or other higher education institution?", subtitle: "Include completed, ongoing or discontinued study. This records your history; it does not determine admission." },
  priorQualificationType: { question: "What qualification was that study leading to?", subtitle: "Use the previous qualification relevant to this application." },
  priorStudyInstitution: { question: "Which institution awarded or will award that qualification?" },
  priorStudyCountry: { question: "Where is the institution that awarded your qualification based?", subtitle: "Use the awarding institution's country, even if your school or study campus was elsewhere." },
  priorStudyCountryOther: { question: "Which other country is the awarding institution based in?", subtitle: "Enter the country name shown in your institution's details." },
  priorQualificationContext: { question: "Which education system issued your previous qualification?", subtitle: "Choose the awarding institution's higher education system, not your school curriculum. If unsure, choose Not sure." },
  priorStudyField: { question: "What was your field of study?", subtitle: "Use the field stated on your academic documents." },
  priorDegreeYears: { question: "What is the full duration of that qualification?", subtitle: "Enter the programme's duration in years, including any study you have not yet completed." },
  yearsOfUniversityStudy: { question: "How many years of university study have you successfully completed?", subtitle: "Enter completed study only, in years. Fractions are allowed; enter 0 if none is completed." },
  priorStudyCompletion: { question: "What is the status of that study?" },
  targetDegree: { question: "Which degree level are you applying for?" },
  nationality: { question: "What is your nationality?" },
  certificateCountry: {
    question: "Where did you finish school?",
    subtitle: "Or where you will finish it — the country of your certificate.",
  },
  visaApplicationCountry: {
    question: "Where will you apply for your German visa?",
    subtitle:
      "The country you'll file your student-visa application from — usually where you live. Academic and application requirements are assessed separately.",
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
    case "apsProcedureStatus":
      return [
        { value: "not_started", key: "not_started", label: "No application submitted for these qualifications" },
        { value: "pending", key: "pending", label: "Relevant application pending" },
        { value: "completed", key: "completed", label: "Relevant procedure completed" },
        { value: "new_evaluation", key: "new_evaluation", label: "New evaluation submitted for updated qualifications" },
        { value: "unknown", key: "unknown", label: "Cannot confirm which procedure applies" },
      ];
    case "apsSubmissionConfirmation":
      return [{ value: "confirmed", key: "confirmed", label: "Yes, APS confirms the complete submission date" }, { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "schoolQualificationCountry":
      return [...countryOptions, { value: "other", label: "Another country", key: "other" }, { value: "unknown", label: "Unsure", key: "unknown" }];
    case "schoolQualificationContext":
      return [{ value: "national", label: "National qualification", key: "national" }, { value: "international", label: "International qualification (IB / GCE)", key: "international" }, { value: "unknown", label: "Unsure", key: "unknown" }];
    case "apsApplicationContext":
      return [{ value: "uni_assist", label: "Yes, confirmed by my programme", key: "uni_assist" }, { value: "unknown", label: "Other route or unsure", key: "unknown" }];
    case "visaMissionContext":
      return [{ value: "saudi_study", label: "Yes, I confirmed this checklist applies", key: "saudi_study" }, { value: "other", label: "Another checklist applies", key: "other" }, { value: "unknown", label: "Unsure", key: "unknown" }];
    case "priorStudyCountry": {
      const options = [...countryOptions, { value: "other", label: "Another country", key: "other" }];
      const saved = answers.priorStudyCountry;
      // Preserve stored country codes beyond the small supported-country catalog.
      if (saved && /^[a-z]{2}$/i.test(saved) && !options.some((o) => o.value === saved)) {
        options.push({ value: saved, key: saved, label: new Intl.DisplayNames(["en"], { type: "region" }).of(saved.toUpperCase()) ?? saved });
      }
      return options;
    }
    case "priorQualificationContext":
      return [
        { value: "national", label: "The awarding country's higher education system", key: "national" },
        { value: "other", label: "An international or other education system", key: "other" },
        { value: "unknown", label: "Not sure", key: "unknown" },
      ];
    case "priorQualificationType":
      return [
        { value: "bachelor", label: "Bachelor's degree", key: "bachelor" },
        { value: "master", label: "Master's degree", key: "master" },
        { value: "diploma", label: "Diploma", key: "diploma" },
        { value: "other", label: "Another qualification", key: "other" },
      ];
    case "priorStudyCompletion":
      return [
        { value: "completed", label: "Completed", key: "completed" },
        { value: "in_progress", label: "In progress", key: "in_progress" },
        { value: "discontinued", label: "Discontinued", key: "discontinued" },
      ];
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
    case "hasPriorUniversityStudy":
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
