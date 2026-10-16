// Typical-student personas for the checker audit. Answers are what a student
// realistically knows BEFORE applying: no APS/university decision references.
// Pure: no I/O, so tests can import it.
import {
  AnswersSchema, buildProfile, isAnswered, normalizeAnswers, upgradeSaudiAnswers, visibleSteps, withAnswer,
  type PartialAnswers, type StepId,
} from "@/app/(public)/check/steps";

type Persona = { id: string; answers: Record<string, unknown> };
const intake = { term: "winter", year: 2027 };
const noStudy = { hasPriorUniversityStudy: false };
const indianSchool = {
  targetDegree: "bachelor", certificateCountry: "in", curriculumType: "national",
  schoolQualificationCountry: "in", schoolQualificationContext: "national", board: "cbse",
  hasExistingApsCertificate: false, visaApplicationCountry: "in", intake,
};
const indianBachelor = {
  hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Anna University",
  priorStudyCountry: "in", priorQualificationContext: "national", priorStudyField: "Computer Science",
};

export const AUDIT_PERSONAS: Persona[] = [
  { id: "IN-cbse-85-no-jee-cs", answers: { ...indianSchool, schoolGradePercent: 85, jeeSchoolCertificate: "completed_12_year_secondary",
    jeeMainStatus: "no_result", jeeAdvancedStatus: "no_result", ...noStudy, targetField: "cs", apsProcedureStatus: "not_started" } },
  { id: "IN-cbse-92-jee-adv-eng", answers: { ...indianSchool, schoolGradePercent: 92, jeeSchoolCertificate: "completed_12_year_secondary",
    jeeMainStatus: "passed", jeeAdvancedStatus: "passed", jeeEvidenceContext: "ordinary", ...noStudy, targetField: "mechanical_engineering",
    jeeTargetFamily: "unknown", apsProcedureStatus: "not_started" } },
  { id: "IN-cbse-1yr-btech-cs", answers: { ...indianSchool, schoolGradePercent: 80, jeeSchoolCertificate: "completed_12_year_secondary",
    jeeMainStatus: "not_passed", jeeAdvancedStatus: "no_result", ...indianBachelor, priorDegreeYears: 4, yearsOfUniversityStudy: 1,
    priorStudyCompletion: "in_progress", priorStudyMode: "regular", priorStudyRecognition: "unknown", targetField: "cs",
    priorStudyTargetRelation: "unknown", apsProcedureStatus: "not_started" } },
  { id: "IN-btech4-master-cs", answers: { targetDegree: "master", ...indianBachelor, priorDegreeYears: 4, yearsOfUniversityStudy: 4,
    priorStudyCompletion: "completed", hasExistingApsCertificate: false, visaApplicationCountry: "in", targetField: "cs", intake,
    dmatQualificationScope: "single", dmatDegreeTitle: "B.Tech Computer Science", dmatProcedure: "unknown", dmatPartnershipStatus: "none",
    dmatFieldBasis: "unknown" } },
  { id: "IN-bsc3-master-physics", answers: { targetDegree: "master", ...indianBachelor, priorStudyField: "Physics", priorDegreeYears: 3,
    yearsOfUniversityStudy: 3, priorStudyCompletion: "completed", hasExistingApsCertificate: false, visaApplicationCountry: "in",
    targetField: "physics", intake, dmatQualificationScope: "single", dmatDegreeTitle: "B.Sc Physics", dmatProcedure: "unknown",
    dmatPartnershipStatus: "none", dmatFieldBasis: "unknown" } },
  { id: "IN-cbse-living-SA-cs", answers: { ...indianSchool, visaApplicationCountry: "sa", certificateCountry: "sa", schoolGradePercent: 88,
    jeeSchoolCertificate: "completed_12_year_secondary", jeeMainStatus: "no_result", jeeAdvancedStatus: "no_result", ...noStudy,
    targetField: "cs", apsProcedureStatus: "not_started" } },
  { id: "PK-fsc-80-eng", answers: { targetDegree: "bachelor", certificateCountry: "pk", curriculumType: "national",
    schoolQualificationCountry: "pk", schoolQualificationContext: "national", pkCertificate: "fsc", pkSchoolCompletion: "completed_12_grades",
    pkGroup: "science", schoolGradePercent: 80, ...noStudy, visaApplicationCountry: "pk", targetField: "mechanical_engineering",
    pkTargetFamily: "unknown", intake } },
  { id: "SA-tawjihiyah-science-cs", answers: { targetDegree: "bachelor", certificateCountry: "sa", curriculumType: "national",
    schoolQualificationCountry: "sa", schoolQualificationContext: "national", saudiCertificateSubtype: "national",
    saudiNationalCategory: "general_certificate", saudiSecondaryCompletion: "completed_12_year_secondary", saudiNationalStream: "Natural Sciences Section",
    ...noStudy, visaApplicationCountry: "sa", targetField: "cs", intake } },
  { id: "GCE-cambridge-AAB-eng", answers: { targetDegree: "bachelor", certificateCountry: "sa", curriculumType: "gce",
    gceQualificationContext: "british_international", gceQualificationType: "al", gceEvidence: "final", gceAwardingBody: "caie",
    gceSubjects: [{ subjectId: "mathematics", level: "AL", grade: "A" }, { subjectId: "physics", level: "AL", grade: "A" }, { subjectId: "chemistry", level: "AL", grade: "B" }],
    visaApplicationCountry: "sa", targetField: "mechanical_engineering", intake } },
  { id: "IB-36-mathAA-HL-cs", answers: { targetDegree: "bachelor", certificateCountry: "in", curriculumType: "ib", ibDocumentStatus: "awarded",
    ibExamYear: 2025, ibExamSession: "may", ibSchooling: "ascending_full_time", ibTotalPoints: 36, ibProgramme: "ib", ibSchoolIdentity: "unknown",
    ibSubjects: [
      { subjectId: "language_a", level: "SL", grade: "6", language: "English", continuedForeign: "no" },
      { subjectId: "language_b", level: "HL", grade: "6", language: "French", continuedForeign: "yes" },
      { subjectId: "economics", level: "SL", grade: "6" }, { subjectId: "physics", level: "HL", grade: "6" },
      { subjectId: "math_aa", level: "HL", grade: "6" }, { subjectId: "computer_science", level: "SL", grade: "6" },
    ].map(subject => ({ continuity: "two_years", independence: "independent", ...subject })),
    hasExistingApsCertificate: false, visaApplicationCountry: "in", targetField: "cs", intake } },
];

/** Answer the first unanswered visible step, exactly as the UI's Continue does, until done. */
export function simulate(persona: Record<string, unknown>) {
  let answers: PartialAnswers = normalizeAnswers(upgradeSaudiAnswers({
    qualificationHistoryVersion: 1, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1,
    indiaStudyRouteVersion: 1, jeeVersion: 2,
  } as PartialAnswers));
  const asked: StepId[] = [];
  for (let guard = 0; guard < 120; guard++) {
    const step = visibleSteps(answers).find(s => !isAnswered(answers, s));
    if (!step) break;
    if (!(step in persona)) throw new Error(`persona has no answer for visible step "${step}" (asked so far: ${asked.join(", ")})`);
    answers = withAnswer(answers, step, persona[step] as never);
    if (!isAnswered(answers, step)) throw new Error(`persona answer for "${step}" does not satisfy the step`);
    asked.push(step);
  }
  return { asked, inputs: inputCount(asked, answers), answers, profile: buildProfile(AnswersSchema.parse(answers)) };
}

/** Form inputs a student fills, not screens: subject tables expand to one input per cell. */
export function inputCount(asked: StepId[], answers: PartialAnswers): number {
  let inputs = 0;
  for (const step of asked) {
    if (step === "gceSubjects") inputs += (answers.gceSubjects?.length ?? 0) * 3;
    else if (step === "ibSubjects") inputs += (answers.ibSubjects ?? []).reduce((n, s) => n + Object.keys(s).length, 0);
    else if (step === "intake") inputs += 2;
    else inputs += 1;
  }
  return inputs;
}
