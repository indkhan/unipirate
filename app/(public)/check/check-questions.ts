import {
  AWARDING_BODIES,
  BOARDS,
  nationalSchoolCountry,
  COUNTRIES,
  INTAKE_OPTIONS,
  TARGET_FIELDS,
  isIndiaStudyBranch, isSaudiStudyBranch, isSaudiDegreeBranch, isPakistanBranch,
  type PartialAnswers,
  type StepId,
} from "./steps";
import { DMAT_FIELD_ENTRIES, DMAT_FIELD_SOURCE, DMAT_SOURCE } from "@/lib/engine/dmat";

import { SAUDI_CERTIFICATES, SAUDI_SOURCE, SAUDI_ANABIN } from "@/lib/engine/saudi";
import { JEE_SOURCE, JEE_ADMISSION_SOURCE } from "@/lib/engine/jee";
import { IB_SOURCE } from "@/lib/engine/ib";

export type Option = { value: unknown; label: string; key: string };

/** Prompt (and optional subtitle) shown for each step of the checker. */
const PK_SOURCE='https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=6&ad-layerId=193';
const reported='Applicant-reported evidence; UniPirate does not independently verify it. Current nonbinding guidance includes a bounded one-year subject-restricted route; the linked regional brochure still says two years. Unsupported or historical cases and contrary applicable assessments need individual confirmation. The institution makes the final decision.';
export const QUESTIONS: Record<StepId, { question: string; subtitle?: string; sourceUrl?: string }> = {
  saudiNationalCategory: {question:"Which literal national certificate category appears on your document?",subtitle:"Report the actual Saudi national documentary category, not a board alias or school location.",sourceUrl:SAUDI_ANABIN},
  saudiSecondaryCompletion: {question:"Do you hold the completed twelve-grade national secondary certificate?",subtitle:"This is the current product coverage boundary, not a source claim that Anabin requires twelve grades.",sourceUrl:SAUDI_ANABIN},
  saudiTargetFamily: {question:"How does an applicable official statement classify this exact intended target?",subtitle:"Report humanities, law, social sciences or economics for the intended target. Names, marketing and personal STEM guesses cannot classify it. Your report is not app verification.",sourceUrl:SAUDI_ANABIN},
  saudiTargetFamilyReference: {question:"Which official statement classifies this exact target?",subtitle:"Identify authority, document and applicable conclusion, without personal identifiers.",sourceUrl:SAUDI_ANABIN},
  saudiPrivateAssessmentCoverage: {question:"Does that applicable official diploma/subject assessment cover all private-school prerequisites?",subtitle:"It must explicitly confirm regional-US accreditation applicability, breadth across first/foreign language, natural sciences, mathematics and social sciences, and every individual subject's passing minimum. No school/body whitelist or numeric minimum is inferred. Unknown if it cannot confirm all of these for this exact diploma.",sourceUrl:SAUDI_ANABIN},
  saudiBachelorAssessment: {question:"Does an applicable official qualification assessment cover this exact completed Bachelor?",subtitle:"Confirm identity and that the actual minimum-four-year recognized study followed prescribed norms and generally full-time study. Nominal duration, completion and recognition remain separate. This supports undergraduate access, not Master's equivalence. Your report is not app verification.",sourceUrl:SAUDI_ANABIN},
  saudiBachelorAssessmentReference: {question:"Which official assessment covers this completed qualification and its actual study norms?",subtitle:"Identify authority, document and applicable conclusion for this exact qualification, without personal identifiers.",sourceUrl:SAUDI_ANABIN},
  saudiCertificateSubtype: { question: "Which exact Saudi school certificate do you have?", subtitle: "Use the title and school type on your certificate. Citizenship, residence, curriculum and legacy board labels do not establish subtype. Only the reviewed documentary categories and current product intakes are covered; universities decide admission.", sourceUrl: SAUDI_SOURCE },
  saudiNationalStream: { question: "What stream is printed on your national certificate?", subtitle: "Copy it verbatim, or enter unknown. Only the literal Literary, Science and Commercial documentary labels are covered; no grade cutoff is inferred.", sourceUrl: SAUDI_SOURCE },
  saudiSubjectAssessment: { question: "Does an applicable official assessment confirm your private-school diploma meets the ZAB subject requirements?", subtitle: "Report uni-assist or university assessment for this exact certificate. Accreditation names or a US curriculum label alone are not proof. UniPirate does not independently verify your report.", sourceUrl: SAUDI_SOURCE },
  saudiSubjectAssessmentReference: { question: "Which official subject assessment covers this private-school certificate?", subtitle: "Identify authority, document/communication and applicable conclusion; omit personal identifiers.", sourceUrl: SAUDI_SOURCE },
  saudiEnrollment: { question: "Do you have a current Bachelor enrollment certificate for this institution and programme?", subtitle: "Enrollment is separate from successful academic years. Recognition and subject scope need applicable official evidence.", sourceUrl: SAUDI_SOURCE },
  saudiEnrollmentReference: { question: "Which enrollment certificate establishes this current Bachelor enrollment?", subtitle: "Identify the document and programme; omit personal identifiers. This is reported evidence, not app verification.", sourceUrl: SAUDI_SOURCE },
  saudiEnrollmentField: { question: "What field is stated on that enrollment certificate?", subtitle: "Copy the enrolled subject area. It can differ from previously completed study.", sourceUrl: SAUDI_SOURCE },
  saudiEnrollmentTargetRelation: { question: "Does an official assessment place this target in the enrollment certificate subject area?", subtitle: "Matching field text alone cannot establish the applicable target scope.", sourceUrl: SAUDI_SOURCE },
  saudiEnrollmentTargetRelationReference: { question: "Which assessment confirms this enrollment field and intended target relationship?", subtitle: "Identify authority, document/communication and conclusion for this target; omit personal identifiers.", sourceUrl: SAUDI_SOURCE },
 pkCurrentAssessment:{question:'What does the intended institution/uni-assist current assessment say for this exact qualification, study, target and intake?',subtitle:'Current source guidance is nonbinding. Report a specific contrary instruction as a conflict; old or unrelated assessments cannot confirm this basis. '+reported,sourceUrl:'https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang'},
 pkCurrentAssessmentReference:{question:'Which authority, document and conclusion applies to this exact current case and intake?',subtitle:reported,sourceUrl:'https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang'},
 pkCertificate:{question:'What exact certificate title category appears on your document?',subtitle:'HSSC and Intermediate are separate from FSc, FA, ICom and ICS titles. We do not automatically classify those aliases.',sourceUrl:PK_SOURCE},
 pkSchoolCompletion:{question:'Does your certificate confirm completion of twelve school grades?',subtitle:'School completion is separate from your marks and documentary group.',sourceUrl:PK_SOURCE},
 pkGroup:{question:'Which documentary group is stated on your school grade report?',subtitle:'Use the explicit Science/Pre-Engineering/Pre-Medical, Commerce or Humanities group. ICS, mixed or unclassified records need assessment; no subject combination is inferred.',sourceUrl:PK_SOURCE},
 pkTargetFamily:{question:'Which subject family does the intended programme belong to?',subtitle:'Use the programme or institution assessment. Preparatory access is restricted to the cited families; choosing a family does not guarantee admission to a particular programme.',sourceUrl:PK_SOURCE},
 pkTargetFamilyReference:{question:'Which programme source or institution assessment identifies this target family?',subtitle:reported,sourceUrl:PK_SOURCE},
 pkStudyMode:{question:'Was the previous academic study full-time?',subtitle:reported,sourceUrl:PK_SOURCE},
 pkStudyRegulations:{question:'Was that academic study completed according to the study regulations?',subtitle:reported,sourceUrl:PK_SOURCE},
 pkAnnualRecords:{question:'Do you have subjects and marks for each academic year of study?',subtitle:'Elapsed time, enrolment and two semesters alone do not establish a successful academic year. '+reported,sourceUrl:PK_SOURCE},
 pkSuccessfulYearsReference:{question:'Which annual subject/marks records establish the successful academic years you reported?',subtitle:reported,sourceUrl:PK_SOURCE},
 pkRecognition:{question:'What does an applicable official assessment say about recognition of this institution and academic study?',subtitle:'Names and HEC attestation alone do not establish recognition. '+reported,sourceUrl:'https://www.kmk.org/zab/central-office-for-foreign-education.html'},
 pkRecognitionReference:{question:'Which authority, document and conclusion covers recognition of this institution and attained study?',subtitle:reported,sourceUrl:PK_SOURCE},
 pkTargetRelation:{question:'What does an applicable official assessment say about the previous field and intended target?',subtitle:'Equal field names do not establish previous/related subject eligibility. '+reported,sourceUrl:PK_SOURCE},
 pkTargetRelationReference:{question:'Which authority, document and conclusion covers this previous field and intended target?',subtitle:reported,sourceUrl:PK_SOURCE},
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
    question: "Where did you attend school?",
    subtitle: "Choose your school's country. We ask about the qualification issuer separately.",
  },
  visaApplicationCountry: {
    question: "Where will you apply for your German visa?",
    subtitle:
      "Choose the country where you will file your student visa application. Academic and application requirements are assessed separately.",
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
  jeeSchoolCertificate: { question: "Do you hold a completed Indian national secondary school-leaving certificate after 12 grades?", subtitle: "Report the completed certificate itself. A board label, provisional or future results, university study or Class XII percentage alone cannot establish this category. Your report is not independently verified by UniPirate.", sourceUrl: JEE_ADMISSION_SOURCE },
  jeeTargetFamily: { question: "What does an applicable official classification say about this intended programme?", subtitle: "Report a university or uni-assist statement covering this exact target as technology or natural sciences. Personal guesses, marketing, the broad DAAD family sentence alone, another programme or an unclassified mixed title cannot establish it. This is applicant-reported evidence, not app verification.", sourceUrl: JEE_ADMISSION_SOURCE },
  jeeTargetFamilyReference: { question: "Which official statement classifies this exact intended target?", subtitle: "Identify the university or uni-assist, document or communication and applicable conclusion for this programme/target. Your report does not guarantee programme admission.", sourceUrl: JEE_ADMISSION_SOURCE },
  jeeMainStatus: { question: "Have you successfully passed JEE Main?", subtitle: "Report confirmed qualifying passage from official examination evidence. A score, percentile, result sheet or eligibility to sit Advanced alone is not a confirmed pass. Choose Cannot confirm if the wording is unclear. Your report is not independently verified by UniPirate.", sourceUrl: JEE_SOURCE },
  jeeAdvancedStatus: { question: "Have you successfully qualified in JEE Advanced?", subtitle: "Report official qualifying passage/rank, not merely a result, marks or participation. Preparatory ranks, unclear results or cross-year evidence need individual assessment; use the next evidence question.", sourceUrl: JEE_SOURCE },
  jeeEvidenceContext: { question: "Does your JEE evidence need an exception or individual assessment?", subtitle: "Choose the relevant uncertainty even if an exam report says qualified. An Indian examination Main exemption or foreign-entry rule does not establish a German recognition exception. Certificate and intake applicability remain separate.", sourceUrl: JEE_SOURCE },
  jeeAdvanced: {
    question: "Do you have a valid JEE Advanced result?",
    subtitle: "Historical answer only; new assessments require separate Main and Advanced qualifying passage.",
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
  ibSchooling:{question:'Was your schooling ascending and full-time?',sourceUrl:IB_SOURCE},
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
      "Analysis and Approaches or Applications and Interpretation. This helps assess your subject scope.",
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
  const options=(entries:readonly (readonly [string,string])[])=>entries.map(([value,label])=>({value,key:value,label}));
  switch (stepId) {
    case "saudiNationalCategory": return [["general_certificate","General Secondary Education Certificate"],["general_transcript","General Secondary Education Transcript"],["graduation_certificate","Secondary School Graduation Certificate"],["unknown","Cannot confirm this documentary category"]].map(([value,label])=>({value,key:value,label}));
    case "saudiSecondaryCompletion": return [["completed_12_year_secondary","Reported completed twelve-grade Saudi national certificate"],["unknown","Cannot confirm this completed category"]].map(([value,label])=>({value,key:value,label}));
    case "saudiTargetFamily": return [["reported_official_humanities","Applicable official humanities classification"],["reported_official_law","Applicable official law classification"],["reported_official_social_sciences","Applicable official social sciences classification"],["reported_official_economics","Applicable official economics classification"],["reported_official_outside","Applicable classification outside these families"],["unknown","Cannot confirm an applicable classification"]].map(([value,label])=>({value,key:value,label}));
    case "saudiPrivateAssessmentCoverage": return [["reported_official_all_met","Applicable official assessment explicitly confirms accreditation, breadth and all individual passing minima"],["reported_official_unmet","Applicable assessment says requirements unmet"],["unknown","Cannot confirm all applicable prerequisites"]].map(([value,label])=>({value,key:value,label}));
    case "saudiBachelorAssessment": return [["reported_official_norms_full_time","Applicable official assessment confirms this completed Bachelor followed prescribed norms and generally full-time study"],["reported_official_unmet","Applicable assessment does not confirm these requirements"],["unknown","Cannot confirm an applicable qualification assessment"]].map(([value,label])=>({value,key:value,label}));
    case "saudiCertificateSubtype": return SAUDI_CERTIFICATES.map(c => ({ value: c.id, key: c.id, label: c.label }));
    case "saudiSubjectAssessment": return [{ value: "reported_official_met", key: "reported_official_met", label: "Applicable official subject assessment confirms requirements met" }, { value: "reported_official_unmet", key: "reported_official_unmet", label: "Applicable official subject assessment says requirements unmet" }, { value: "unknown", key: "unknown", label: "Cannot confirm an applicable assessment" }];
    case "saudiEnrollment": return [{ value: "reported_document", key: "reported_document", label: "Current Bachelor enrollment certificate available" }, { value: "not_enrolled", key: "not_enrolled", label: "Not currently enrolled" }, { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case "saudiEnrollmentTargetRelation": return [{ value: "reported_official_previous", key: "reported_official_previous", label: "Official assessment confirms the enrollment subject area" }, { value: "reported_official_unrelated", key: "reported_official_unrelated", label: "Official assessment places the target outside that subject area" }, { value: "unknown", key: "unknown", label: "Cannot confirm" }];
    case 'pkCurrentAssessment':return options([['reported_current_support','Applicable current assessment supports this exact case'],['reported_contrary','Specific applicable assessment gives contrary requirements'],['unknown','Cannot confirm an applicable current assessment']]);
    case 'pkCertificate':return options([['hssc','Higher Secondary (School) Certificate'],['intermediate','Intermediate (Examination) Certificate'],['ssc','SSC / less than twelve grades'],['fsc','FSc title; category requires assessment'],['fa','FA title; category requires assessment'],['icom','ICom title; category requires assessment'],['ics','ICS title; category requires assessment'],['other','Another certificate'],['unknown','Cannot confirm']]);
    case 'pkGroup':return options([['science','Science / Pre-Engineering / Pre-Medical'],['commerce','Commerce'],['humanities','Humanities'],['mixed','ICS or mixed/unclassified'],['other','Another group'],['unknown','Cannot confirm']]);
    case 'pkSchoolCompletion':return options([['completed_12_grades','Certificate confirms twelve completed grades'],['incomplete','Incomplete or fewer than twelve grades'],['unknown','Cannot confirm']]);
    case 'pkTargetFamily':return options([['medicine','Medicine'],['natural_sciences','Natural Sciences'],['technology','Technology'],['social_sciences','Social Sciences'],['economics','Economics'],['humanities','Humanities'],['other','Another or mixed family'],['unknown','Cannot confirm']]);
    case 'pkStudyMode':return options([['full_time','Full-time academic study'],['part_time','Part-time'],['distance_online','Distance or online'],['other','Another mode'],['unknown','Cannot confirm']]);
    case 'pkStudyRegulations':return options([['confirmed','Records confirm study according to regulations'],['not_confirmed','Does not meet that basis'],['unknown','Cannot confirm']]);
    case 'pkAnnualRecords':return options([['confirmed','Annual subjects and marks available'],['not_available','Annual records unavailable'],['unknown','Cannot confirm']]);
    case 'pkRecognition':return options([['reported_official_confirmed','Official assessment confirms recognition'],['reported_official_rejected','Official assessment rejects recognition'],['unknown','Cannot confirm applicable assessment']]);
    case 'pkTargetRelation':return options([['reported_official_previous','Official assessment confirms previous subject'],['reported_official_closely_related','Official assessment confirms related subject'],['reported_official_unrelated','Official assessment places target outside scope'],['unknown','Cannot confirm applicable assessment']]);

    case "jeeSchoolCertificate": return [
      {value:"completed_12_year_secondary",key:"completed_12_year_secondary",label:"I hold the completed Indian national secondary school-leaving certificate after 12 grades"},
      {value:"other",key:"other",label:"Another, incomplete or shorter school qualification"},
      {value:"unknown",key:"unknown",label:"Cannot confirm this completed certificate category"},
    ];
    case "jeeTargetFamily": return [
      {value:"reported_official_technology",key:"reported_official_technology",label:"Applicable official statement classifies this target as technology"},
      {value:"reported_official_natural_sciences",key:"reported_official_natural_sciences",label:"Applicable official statement classifies this target as natural sciences"},
      {value:"reported_official_outside",key:"reported_official_outside",label:"Applicable official statement places this target outside these families"},
      {value:"unknown",key:"unknown",label:"Cannot confirm an applicable official classification"},
    ];
    case "jeeMainStatus":
    case "jeeAdvancedStatus": return [
      {value:"passed",key:"passed",label:"Official evidence confirms qualifying passage"},
      {value:"not_passed",key:"not_passed",label:"Not passed / not qualified"},
      {value:"no_result",key:"no_result",label:"No result (not taken or pending)"},
      {value:"unknown",key:"unknown",label:"Cannot confirm qualifying passage"},
    ];
    case "jeeEvidenceContext": return [
      {value:"ordinary",key:"ordinary",label:"Ordinary qualifying evidence; no exception or uncertainty"},
      {value:"main_exemption",key:"main_exemption",label:"Main exemption / direct foreign-entry exception"},
      {value:"preparatory_rank",key:"preparatory_rank",label:"Preparatory-course rank only or unclear rank type"},
      {value:"cross_year",key:"cross_year",label:"Results from different years / year applicability uncertain"},
      {value:"unclear",key:"unclear",label:"Other unclear examination evidence"},
    ];
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
      if (isIndiaStudyBranch(answers) || isSaudiStudyBranch(answers) || isPakistanBranch(answers)) options.push({ value: "unknown", label: "Cannot confirm the institution country", key: "unknown" });
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
        .filter((b) => b.country === (answers.saudiCertificateVersion !== undefined && answers.schoolQualificationCountry === undefined ? answers.certificateCountry : nationalSchoolCountry(answers)))
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
    case 'gceQualificationContext': return [{value:'uk',label:'UK GCE qualification',key:'uk'},{value:'british_international',label:'British international A-Level qualification',key:'british_international'},{value:'national',label:'Part of a national school-leaving system',key:'national'},{value:'unknown',label:'Not sure',key:'unknown'}];
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

export function questionFor(step: StepId, answers: PartialAnswers) {
  const copy = QUESTIONS[step];
  if (isSaudiDegreeBranch(answers)) {
    if (step === "priorStudyMode") return { ...copy, sourceUrl: SAUDI_ANABIN, subtitle: "Report the actual mode of this completed Bachelor. Applicable official qualification evidence must confirm prescribed study norms and generally full-time study; nominal duration alone is insufficient." };
    if (step === "priorStudyRecognition") return { ...copy, sourceUrl: SAUDI_ANABIN, subtitle: "Report an applicable official qualification or recognition assessment for this exact institution and completed Bachelor. Institution names or marketing cannot establish recognition. This is an applicant report, not app verification; undergraduate access does not establish Master’s equivalence or programme admission." };
    if (step === "priorStudyRecognitionReference") return { ...copy, sourceUrl: SAUDI_ANABIN, subtitle: "Identify the assessing authority, document or communication and applicable recognition conclusion for THIS institution and completed Bachelor. Omit personal identifiers. This is an applicant report, not app verification; the university decides admission." };
  }
  if (!isSaudiStudyBranch(answers) || !["priorStudyMode", "priorStudyRecognition", "priorStudyRecognitionReference", "priorStudyTargetRelation", "priorStudyTargetRelationReference"].includes(step)) return copy;
  return { ...copy, sourceUrl: SAUDI_SOURCE, subtitle: "Report an applicable uni-assist or university assessment for this exact Bachelor programme, attained study and target subject area. Names and matching field text are not proof. UniPirate does not independently verify reports; the university decides admission." };
}
