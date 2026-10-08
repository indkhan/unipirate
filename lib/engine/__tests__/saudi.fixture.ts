// Synthetic institutions and applicant-reported assessment references, not app verification.
// Current reviewed Anabin and uni-assist clauses only; publication is simulated in memory.
import type { Profile, Result } from "../evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";
export const saudiProfile: Profile = {
  targetDegree: "bachelor", curriculumType: "national", certificateCountry: "sa", nationality: "in", visaApplicationCountry: "sa",
  schoolQualification: { country: "sa", context: "national" }, targetField: "cs", intake: { term: "winter", year: 2026 },
  saudiCertificate: { version: 2, subtype: "private_school", privateAssessmentCoverage: "reported_official_all_met", subjectAssessment: "reported_official_met", subjectAssessmentReference: "Synthetic applicable official assessment: this exact diploma meets regional-US accreditation, breadth and every individual passing minimum under ZAB guidelines" },
  qualificationHistory: { hasPriorUniversityStudy: true, qualificationType: "bachelor", institution: "Synthetic University", country: "sa", field: "Computing", degreeYears: 4, completedYears: 1, completion: "in_progress", priorStudyMode: "regular",
    priorStudyRecognition: "reported_official_confirmed", priorStudyRecognitionReference: "Synthetic university assessment: this Bachelor programme and attained/enrolled study recognised",
    priorStudyTargetRelation: "reported_official_previous", priorStudyTargetRelationReference: "Synthetic assessment: this intended target is in the previous subject area" },
};
export const saHistory = (change: Partial<NonNullable<Profile["qualificationHistory"]>>): Profile => ({ ...saudiProfile, qualificationHistory: { ...saudiProfile.qualificationHistory!, ...change } });
export const industrialProfile: Profile = { ...saudiProfile, saudiCertificate: { version: 1, subtype: "industrial_certificate", enrollment: "reported_document", enrollmentReference: "Synthetic current Bachelor enrollment certificate", enrollmentField: "Computing",
  enrollmentTargetRelation: "reported_official_previous", enrollmentTargetRelationReference: "Synthetic assessment: intended target in enrollment subject area" }, qualificationHistory: { ...saudiProfile.qualificationHistory!, completedYears: 0 } };
export function reviewedSaudiRules() { return ruleData.filter(r => r.id.startsWith("sa-reviewed-")).map(r => ({ ...r, status: "verified" as const })); }
export const nationalProfile = (stream: string, years = 0): Profile => ({...saudiProfile, saudiCertificate: {version:2,subtype:"national",nationalCategory:"general_certificate",secondaryCompletion:"completed_12_year_secondary",nationalStream:stream,targetFamily:"reported_official_economics",targetFamilyReference:"Synthetic applicable official classification for this exact target"},qualificationHistory:{...saudiProfile.qualificationHistory!,completedYears:years}});
export const completedSaudiProfile: Profile = {...saudiProfile, curriculumType:"other",saudiCertificate:undefined,qualificationHistory:{...saudiProfile.qualificationHistory!,completion:"completed",completedYears:4,saudiBachelorEvidence:{version:2,context:"national",assessment:"reported_official_norms_full_time",reference:"Synthetic official qualification assessment of this exact completed Bachelor under prescribed norms and generally full time"}}};
type Case = { id: string; kind: "positive" | "negative" | "boundary" | "missing" | "exception"; profile: Profile; path: Result["path"]; fh?: boolean; reason?: RegExp };
export const SAUDI_ACCEPTANCE: Case[] = [
  ...["Literary Section","Science Section","Commercial Section"].flatMap(stream => [{id:stream+"-prep",kind:"positive" as const,profile:nationalProfile(stream),path:"studienkolleg" as const},{id:stream+"-year",kind:"positive" as const,profile:nationalProfile(stream,1),path:"subject_restricted" as const}]),
  {id:"completed-four-year-general",kind:"positive",profile:completedSaudiProfile,path:"direct"},
  ...["Literary Section","Science Section","Commercial Section"].map(stream=>({id:"completed-with-"+stream,kind:"exception" as const,profile:{...nationalProfile(stream,1),qualificationHistory:completedSaudiProfile.qualificationHistory},path:"direct" as const})),
  {id:"completed-with-private",kind:"exception",profile:{...saudiProfile,qualificationHistory:completedSaudiProfile.qualificationHistory},path:"direct"},
  {id:"completed-with-industrial",kind:"exception",profile:{...industrialProfile,qualificationHistory:completedSaudiProfile.qualificationHistory},path:"direct"},
  ...["literary","commercial"].map(id=>({id:id+"-outside-prep",kind:"negative" as const,profile:{...nationalProfile(id==="literary"?"Literary Section":"Commercial Section"),saudiCertificate:{...nationalProfile("Literary Section").saudiCertificate!,nationalStream:id==="literary"?"Literary Section":"Commercial Section",targetFamily:"reported_official_outside" as const}},path:"unknown" as const})),
  ...[2,3.99].map(degreeYears=>({id:"nominal-"+degreeYears,kind:"negative" as const,profile:{...completedSaudiProfile,qualificationHistory:{...completedSaudiProfile.qualificationHistory!,degreeYears}},path:"unknown" as const})),
  ...["in_progress","discontinued"].map(completion=>({id:"degree-"+completion,kind:"negative" as const,profile:{...completedSaudiProfile,qualificationHistory:{...completedSaudiProfile.qualificationHistory!,completion:completion as "in_progress"|"discontinued"}},path:"unknown" as const})),
  ...[undefined,{term:"winter" as const,year:2028},{term:"summer" as const,year:2026}].map((intake,i)=>({id:"degree-intake-"+i,kind:"boundary" as const,profile:{...completedSaudiProfile,intake},path:"unknown" as const})),
  ...["unknown","reported_official_unmet"].map(privateAssessmentCoverage=>({id:"private-coverage-"+privateAssessmentCoverage,kind:"missing" as const,profile:{...saudiProfile,saudiCertificate:{...saudiProfile.saudiCertificate!,privateAssessmentCoverage:privateAssessmentCoverage as "unknown"|"reported_official_unmet"}},path:"unknown" as const})),

  { id: "private-one", kind: "positive", profile: saudiProfile, path: "studienkolleg" },
  { id: "private-two", kind: "positive", profile: saHistory({ completedYears: 2 }), path: "subject_restricted" },
  { id: "private-zero", kind: "negative", profile: saHistory({ completedYears: 0 }), path: "unknown", reason: /successful.*years/i },
  ...[0.99, 1.99, 2.01].map(completedYears => ({ id: "fraction-" + completedYears, kind: "boundary" as const, profile: saHistory({ completedYears }), path: "unknown" as const, reason: /successful.*years/i })),
  { id: "private-years-missing", kind: "missing", profile: saHistory({ completedYears: undefined, completion: "completed" }), path: "unknown", reason: /successful.*years/i },
  { id: "recognition-rejected", kind: "negative", profile: saHistory({ priorStudyRecognition: "reported_official_rejected" }), path: "unknown", reason: /recognition.*unmet/i },
  { id: "recognition-unknown", kind: "missing", profile: saHistory({ priorStudyRecognition: "unknown" }), path: "unknown", reason: /recognition/i },
  { id: "recognition-reference", kind: "missing", profile: saHistory({ priorStudyRecognitionReference: " " }), path: "unknown", reason: /recognition/i },
  { id: "target-unrelated", kind: "negative", profile: saHistory({ priorStudyTargetRelation: "reported_official_unrelated" }), path: "unknown", reason: /target.*unmet/i },
  { id: "private-one-neighbour-not-prior", kind: "exception", profile: saHistory({ priorStudyTargetRelation: "reported_official_closely_related" }), path: "unknown", reason: /target/i },
  { id: "target-reference", kind: "missing", profile: saHistory({ priorStudyTargetRelationReference: undefined }), path: "unknown", reason: /target/i },
  ...(["unknown", "reported_official_unmet"] as const).map(subjectAssessment => ({ id: "subject-" + subjectAssessment, kind: "missing" as const, profile: { ...saudiProfile, saudiCertificate: { ...saudiProfile.saudiCertificate!, subjectAssessment } }, path: "unknown" as const, reason: /subject assessment/i })),
  { id: "subject-reference", kind: "missing", profile: { ...saudiProfile, saudiCertificate: { ...saudiProfile.saudiCertificate!, subjectAssessmentReference: undefined } }, path: "unknown", reason: /subject assessment/i },
  { id: "industrial-enrollment", kind: "positive", profile: industrialProfile, path: "studienkolleg", fh: true },
  { id: "industrial-diploma-enrollment", kind: "positive", profile: { ...industrialProfile, saudiCertificate: { ...industrialProfile.saudiCertificate!, subtype: "industrial_diploma" } }, path: "studienkolleg", fh: true },
  { id: "industrial-successful-one", kind: "positive", profile: { ...industrialProfile, qualificationHistory: { ...industrialProfile.qualificationHistory!, completedYears: 1 } }, path: "subject_restricted", fh: true },
  { id: "industrial-no-enrollment-year-two", kind: "exception", profile: { ...industrialProfile, saudiCertificate: { version: 1, subtype: "industrial_diploma" }, qualificationHistory: { ...industrialProfile.qualificationHistory!, completedYears: 2, completion: "discontinued" } }, path: "subject_restricted", fh: true },
  { id: "industrial-before", kind: "boundary", profile: { ...industrialProfile, intake: { term: "summer", year: 2026 } }, path: "unknown", reason: /intake/i },
  { id: "industrial-next", kind: "boundary", profile: { ...industrialProfile, intake: { term: "summer", year: 2027 } }, path: "studienkolleg", fh: true },
  { id: "industrial-intake-missing", kind: "missing", profile: { ...industrialProfile, intake: undefined }, path: "unknown", reason: /intake/i },
  { id: "industrial-enrollment-reference", kind: "missing", profile: { ...industrialProfile, saudiCertificate: { ...industrialProfile.saudiCertificate!, enrollmentReference: undefined } }, path: "unknown", reason: /enrollment/i },
  { id: "industrial-enrollment-field", kind: "missing", profile: { ...industrialProfile, saudiCertificate: { ...industrialProfile.saudiCertificate!, enrollmentField: undefined } }, path: "unknown", reason: /enrollment/i },
  { id: "industrial-enrollment-target-unrelated", kind: "negative", profile: { ...industrialProfile, saudiCertificate: { ...industrialProfile.saudiCertificate!, enrollmentTargetRelation: "reported_official_unrelated" } }, path: "unknown", reason: /enrollment.*target/i },
  ...(["completed", "in_progress", "discontinued"] as const).map(completion => ({ id: "status-" + completion, kind: "exception" as const, profile: saHistory({ completion }), path: "studienkolleg" as const })),
  { id: "passport-visa", kind: "exception", profile: { ...saudiProfile, nationality: "pk", visaApplicationCountry: "in" }, path: "studienkolleg" },
  { id: "foreign-accredited-study", kind: "exception", profile: saHistory({ country: "in" }), path: "studienkolleg" },
  { id: "master-degree", kind: "exception", profile: { ...saHistory({ completedYears: 4, completion: "completed" }), targetDegree: "master", tertiaryQualification: { issuer: "Synthetic University", country: "sa", context: "national" } }, path: "unknown" },
];
