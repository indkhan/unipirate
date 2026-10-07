import {
  AWARDING_BODIES,
  BOARDS,
  COUNTRIES,
  INTAKE_OPTIONS,
  TARGET_FIELDS,
  isIndiaStudyBranch,
  type PartialAnswers,
  type StepId,
} from "./steps";
import { DMAT_FIELD_ENTRIES, DMAT_FIELD_SOURCE, DMAT_SOURCE } from "@/lib/engine/dmat";

import { IB_SOURCE } from "@/lib/engine/ib";

export type Option = { value: unknown; label: string; key: string };

/** Prompt (and optional subtitle) shown for each step of the checker. */
export const QUESTIONS: Record<StepId, { question: string; subtitle?: string; sourceUrl?: string }> = {
  priorStudyMode: { question: "Was this bachelor study in a regular degree programme?", subtitle: "Distance or online and other modes need separate applicability confirmation.", sourceUrl: "https://aps-india.de/news/" },
  priorStudyRecognition: { question: "What does an official assessment say about this institution, bachelor programme and study?", subtitle: "Report an applicable APS, uni-assist or university assessment. Institution marketing, an accreditation-name guess or an APS certificate covering only Class XII cannot confirm this bachelor study. Choose Cannot confirm for another programme or uncertain basis. UniPirate does not independently verify your report.", sourceUrl: "https://aps-india.de/faqs/" },
  priorStudyRecognitionReference: { question: "Which official assessment establishes that recognition conclusion?", subtitle: "Identify the assessing authority, document or communication and its conclusion for THIS institution, bachelor programme and attained study. This is applicant-reported official assessment, not app verification.", sourceUrl: "https://aps-india.de/news/" },
  priorStudyTargetRelation: { question: "What does an official assessment say about your previous field and this intended target?", subtitle: "Report the applicable subject-scope conclusion. Matching field names or a recognition assessment alone cannot establish this relationship. Choose Cannot confirm if the assessment covers another target.", sourceUrl: "https://aps-india.de/news/" },
  priorStudyTargetRelationReference: { question: "Which official assessment covers this previous field and intended target?", subtitle: "Identify the assessing authority, document or communication and applicable target-scope conclusion. Your report does not guarantee programme admission.", sourceUrl: "https://aps-india.de/news/" },
  dmatQualificationScope: { question: "Can this dMAT assessment use one relevant previous qualification?", subtitle: "Multiple relevant qualifications or an uncertain basis need APS confirmation.", sourceUrl: DMAT_FIELD_SOURCE },
  dmatDegreeTitle: { question: "What is the official title of that previous qualification?", subtitle: "Copy the degree title from your academic documents. Your reported study field supplies the branch or major; neither your target Master's title nor a marketing title determines classification.", sourceUrl: DMAT_FIELD_SOURCE },
  dmatProcedure: { question: "Which APS procedure is relevant to this qualification?", subtitle: "Holding an old certificate alone does not confirm completion of this procedure. Choose a new evaluation when that certificate does not cover the relevant qualifications.", sourceUrl: DMAT_SOURCE },
  dmatFieldBasis: { question: "What establishes your previous-degree field classification?", subtitle: "The APS list v1.0 (29 June 2026) is non-exhaustive. Standalone CS, BCA, IT, AI or Data Science, B.Tech without a clear Engineering branch, and mixed or sector-specific titles need confirmation. Absence from the list is not an exemption; formal recognition remains separate.", sourceUrl: DMAT_FIELD_SOURCE },
  dmatFieldEntry: { question: "Which listed group clearly matches your official degree title and branch?", subtitle: "Report the group shown by your official academic documents. If it is mixed, conditional or unclear, change the classification basis to Cannot confirm.", sourceUrl: DMAT_FIELD_SOURCE },
  dmatApsClassification: { question: "What did APS confirm for this previous qualification?", sourceUrl: DMAT_FIELD_SOURCE },
  dmatClassificationReference: { question: "Which APS confirmation establishes that classification?", subtitle: "Report the confirmation reference or wording for this exact qualification. This is a reported confirmation, not an independent verification by UniPirate.", sourceUrl: DMAT_FIELD_SOURCE },
  dmatRegistrationStatus: { question: "Has online APS registration for this procedure been completed?", subtitle: "APS registration is separate from dMAT test registration, payment and document submission.", sourceUrl: DMAT_SOURCE },
  dmatRegistrationDate: { question: "When was this APS online registration completed?", subtitle: "Use the completed registration date, not payment, dispatch, receipt or the March complete-submission milestone.", sourceUrl: DMAT_SOURCE },
  dmatDispatchStatus: { question: "Have the complete APS application documents for this procedure been dispatched?", subtitle: "Report dispatch, not APS receipt. Incomplete or uncertain documentation cannot establish a complete-document shipment exemption.", sourceUrl: DMAT_SOURCE },
  dmatDispatchDate: { question: "When were the complete APS documents dispatched?", subtitle: "Use the actual dispatch date and retain shipment proof. A later delivery date is a separate event.", sourceUrl: DMAT_SOURCE },
  dmatPartnershipStatus: { question: "Is this an officially confirmed exchange, double-degree or partnership procedure?", subtitle: "Pending participation or an informal partnership claim is not official confirmation.", sourceUrl: DMAT_SOURCE },
  dmatPartnershipKind: { question: "Which programme kind is officially confirmed?", sourceUrl: DMAT_SOURCE },
  dmatPartnershipIssuerRole: { question: "Who issued the programme confirmation?", sourceUrl: DMAT_SOURCE },
  dmatPartnershipIssuer: { question: "Which institution or programme coordinator issued it?", sourceUrl: DMAT_SOURCE },
  dmatPartnershipGroup: { question: "What group number appears in the confirmation?", sourceUrl: DMAT_SOURCE },
  dmatPartnershipReference: { question: "Which official programme confirmation covers this procedure?", subtitle: "Submit the confirmation and group number with your APS documents.", sourceUrl: DMAT_SOURCE },
  dmatSemesterStatus: { question: "Can you confirm the number of actually completed bachelor semesters?", subtitle: "Use your semester records. Completed years are not converted into semesters.", sourceUrl: DMAT_SOURCE },
  dmatCompletedSemesters: { question: "How many bachelor semesters have you actually completed?", sourceUrl: DMAT_SOURCE },
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
  gceSchoolYears: {question:'How many years of ascending school attendance did you actually complete?',subtitle:'Report your school years, excluding university study. Shorter schooling needs recognition review; an A-Level does not tell us your duration.'},
  gceQualificationContext: {question:'Which qualification system awarded these A-Levels?',subtitle:'School location and citizenship do not decide this. National-system GCE certificates need their own country assessment.'},
  gceQualificationType: {question:'What qualification is printed on the awarding-body certificate?'},
  gceEvidence: {question:'Which examination evidence do you have?',subtitle:'School-issued certificates alone are insufficient. Provisional results and other qualifications need separate recognition review.'},
  gceAwardingBody: { question: "Which awarding body issued your A-Levels?" },
  gceSubjects: {
    question: "Which subjects did you take?",
    subtitle: "Add each A-Level (AL) and AS subject with its grade.",
  },
  ibDocumentStatus: {question:'Which IB Diploma evidence do you have?',subtitle:'Official IBO results must confirm Diploma award. School predictions or a candidate-site screenshot alone do not establish it. A physical Diploma still pending differs from not awarded or Certificate only.',sourceUrl:'https://www.uni-assist.de/en/faqs/assemble-your-documents/'},
  ibExamSession:{question:'Which IB examination session awarded these results?',subtitle:'May or November, separate from your intended university intake. Recognised COVID substitute sessions do not require invented exam attendance.',sourceUrl:IB_SOURCE},
  ibSchooling:{question:'Were these ascending school years in full-time schooling?',sourceUrl:IB_SOURCE},
  ibProgramme:{question:'Was this ordinary IB or gemischtsprachiges IB (GIB)?',subtitle:'School identity alone cannot establish a GIB-only exception.',sourceUrl:IB_SOURCE},
  ibSchoolIdentity:{question:'Can you identify the exact school for a mathematics exception?',subtitle:'Use the official name, country and six-digit IB code where available. Missing identity is not evidence that your school is unlisted. Other ordinary requirements still apply.',sourceUrl:IB_SOURCE},
  ibSchoolName:{question:'What is the exact school name?',subtitle:'Copy the name shown in the current KMK annex; aliases require confirmation.',sourceUrl:IB_SOURCE},
  ibSchoolCountry:{question:'Which country heading covers this school in the KMK annex?',subtitle:'Copy the official heading exactly. This is separate from nationality, visa and certificate-country answers.',sourceUrl:IB_SOURCE},
  ibSchoolCode:{question:'What is the six-digit IB school code?',subtitle:'Keep leading zeros. Enter unknown if you cannot establish it or the GIB annex provides no code.',sourceUrl:IB_SOURCE},
  ibFullDiploma: {
    question: "Did you complete the full IB Diploma?",
    subtitle:
      "German universities do not accept an IB Certificate in place of the Diploma.",
  },
  ibExamYear: {
    question: "Which year is your IB examination session?",
    subtitle: "The requirements changed from the 2025 exam year onward.",
  },
  ibSchoolYears: {
    question: "How many ascending school years did you actually complete?",
  },
  ibTotalPoints: {
    question: "What was your total IB score?",
    subtitle: "Out of 45, including the bonus points.",
  },
  ibSubjects: {
    question: "Which six subjects did you take?",
    subtitle: "Use the exact course, level and grade, language context, independence and continuous two-year study. Computer Science cannot replace required Biology, Chemistry or Physics.",
    sourceUrl: IB_SOURCE,
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
    case 'ibDocumentStatus':return [{value:'awarded',key:'awarded',label:'Diploma awarded; final IBO document available'},{value:'official_results',key:'official_results',label:'Official IBO results confirm Diploma; physical document pending'},{value:'not_awarded',key:'not_awarded',label:'Diploma not awarded'},{value:'certificate',key:'certificate',label:'IB Certificate / course results only'},{value:'unknown',key:'unknown',label:'Cannot confirm'}];
    case 'ibExamSession':return [{value:'may',key:'may',label:'May'},{value:'november',key:'november',label:'November'},{value:'unknown',key:'unknown',label:'Cannot confirm'}];
    case 'ibSchooling':return [{value:'ascending_full_time',key:'ascending_full_time',label:'Ascending years at schools with full-time instruction'},{value:'other',key:'other',label:'Another schooling pattern'},{value:'unknown',key:'unknown',label:'Cannot confirm'}];
    case 'ibProgramme':return [{value:'ib',key:'ib',label:'Ordinary IB Diploma Programme'},{value:'gib',key:'gib',label:'Gemischtsprachiges IB (GIB)'},{value:'unknown',key:'unknown',label:'Cannot confirm'}];
    case 'ibSchoolIdentity':return [{value:'known',key:'known',label:'I can provide exact identity from the official annex'},{value:'unknown',key:'unknown',label:'Cannot confirm exact identity / membership'}];
    case "priorStudyMode": return [
      { value: "regular", key: "regular", label: "Regular bachelor degree programme" },
      { value: "distance_online", key: "distance_online", label: "Distance or online" },
      { value: "other", key: "other", label: "Another mode" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "priorStudyRecognition": return [
      { value: "reported_official_confirmed", key: "reported_official_confirmed", label: "Official assessment confirms this bachelor study is recognised" },
      { value: "reported_official_rejected", key: "reported_official_rejected", label: "Official assessment rejects recognition of this bachelor study" },
      { value: "unknown", key: "unknown", label: "Cannot confirm an applicable assessment" }];
    case "priorStudyTargetRelation": return [
      { value: "reported_official_previous", key: "reported_official_previous", label: "Official assessment confirms the previous subject" },
      { value: "reported_official_closely_related", key: "reported_official_closely_related", label: "Official assessment confirms a closely related subject" },
      { value: "reported_official_unrelated", key: "reported_official_unrelated", label: "Official assessment places this target outside the subject scope" },
      { value: "unknown", key: "unknown", label: "Cannot confirm an applicable target assessment" }];
    case "dmatQualificationScope": return [
      { value: "single", key: "single", label: "One relevant qualification" },
      { value: "multiple", key: "multiple", label: "Multiple relevant qualifications" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "dmatProcedure": return [
      { value: "relevant_completed", key: "relevant_completed", label: "This relevant procedure is completed and its certificate received" },
      { value: "current_initial", key: "current_initial", label: "Current initial procedure, planned or pending" },
      { value: "current_new", key: "current_new", label: "A new evaluation is needed or underway" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "dmatFieldBasis": return [
      { value: "list_v1", key: "list_v1", label: "Official title and branch clearly match a listed affected group" },
      { value: "aps_confirmation", key: "aps_confirmation", label: "APS confirmed this exact qualification's classification" },
      { value: "unknown", key: "unknown", label: "Mixed, conditional, unlisted or cannot confirm" }];
    case "dmatFieldEntry": return DMAT_FIELD_ENTRIES.map(entry => ({ value: entry, key: entry, label: entry }));
    case "dmatApsClassification": return [
      { value: "affected", key: "affected", label: "Affected field" },
      { value: "unaffected", key: "unaffected", label: "Outside the affected fields" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "dmatRegistrationStatus": return [
      { value: "completed", key: "completed", label: "Completed" },
      { value: "not_completed", key: "not_completed", label: "Not completed" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "dmatDispatchStatus": return [
      { value: "complete", key: "complete", label: "Complete documents dispatched" },
      { value: "incomplete", key: "incomplete", label: "Only incomplete documents dispatched" },
      { value: "not_sent", key: "not_sent", label: "Documents not dispatched" },
      { value: "unknown", key: "unknown", label: "Cannot confirm completeness or dispatch" }];
    case "dmatPartnershipStatus": return [
      { value: "confirmed", key: "confirmed", label: "Official confirmation received" },
      { value: "none", key: "none", label: "No partnership procedure applies" },
      { value: "pending", key: "pending", label: "Participation or confirmation pending" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "dmatPartnershipKind": return [
      { value: "exchange", key: "exchange", label: "Exchange" },
      { value: "double_degree", key: "double_degree", label: "Double-degree" },
      { value: "partnership", key: "partnership", label: "University partnership" }];
    case "dmatPartnershipIssuerRole": return [
      { value: "home_institution", key: "home_institution", label: "Home institution" },
      { value: "german_partner", key: "german_partner", label: "German partner institution" },
      { value: "coordinator", key: "coordinator", label: "Programme coordinator" }];
    case "dmatSemesterStatus": return [
      { value: "known", key: "known", label: "Yes, from my semester records" },
      { value: "unknown", key: "unknown", label: "Cannot confirm" }];
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
      if (isIndiaStudyBranch(answers)) options.push({ value: "unknown", label: "Cannot confirm the institution country", key: "unknown" });
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
    case 'gceQualificationContext': return [{value:'uk',label:'UK GCE qualification',key:'uk'},{value:'british_international',label:'British international A-Level qualification',key:'international'},{value:'national',label:'Part of a national school-leaving system',key:'national'},{value:'unknown',label:'Not sure',key:'unknown'}];
    case 'gceQualificationType': return [{value:'al',label:'GCE Advanced Level (AL)',key:'al'},{value:'ial',label:'International Advanced Level',key:'ial'},{value:'pre_u',label:'Cambridge Pre-U',key:'pre_u'},{value:'aice',label:'AICE Diploma',key:'aice'},{value:'other',label:'Another qualification',key:'other'},{value:'unknown',label:'Not sure',key:'unknown'}];
    case 'gceEvidence': return [{value:'final',label:'Final awarding-body certificate',key:'final'},{value:'provisional',label:'Awarding-body provisional results',key:'provisional'},{value:'school',label:'School certificate only',key:'school'},{value:'unknown',label:'Not sure',key:'unknown'}];
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
