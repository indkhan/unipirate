// Saudi certificate evidence only. Pure; no recognition lookup or policy thresholds.
import type { Profile } from "./evaluate";

export const SAUDI_ANABIN = "https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang";
export const NATIONAL_CATEGORIES = ["general_certificate", "general_transcript", "graduation_certificate"];
export const SCIENCE_STREAMS = ["Science Section", "Scientific Track", "Natural Sciences Section"];
export const NATIONAL_STREAMS: Record<string, "literary" | "science" | "commercial"> = {
  "Literary Section": "literary", "Literary Track": "literary", "Human Sciences Section": "literary",
  "Science Section": "science", "Scientific Track": "science", "Natural Sciences Section": "science", "Commercial Section": "commercial",
};
const positiveValues = (c: unknown, values: string[]): boolean => typeof c === "string" ? values.includes(c) : !!c && typeof c === "object" && "op" in c && "value" in c && (c.op === "eq" && typeof c.value === "string" && values.includes(c.value) || c.op === "in" && Array.isArray(c.value) && c.value.length > 0 && c.value.every(v => typeof v === "string" && values.includes(v)));
const atLeast = (c: unknown, n: number): boolean => typeof c === "number" ? c >= n : !!c && typeof c === "object" && "op" in c && "value" in c && c.op === "gte" && typeof c.value === "number" && c.value >= n;
export const exactCurrentIntakes = (c: unknown): boolean => !!c && typeof c === "object" && "op" in c && "value" in c && c.op === "in" && Array.isArray(c.value) && c.value.length === 3 && [4053,4054,4055].every(v => (c.value as unknown[]).includes(v));
export const SAUDI_SOURCE = "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/";
export const SAUDI_SOURCE_DE = "https://www.uni-assist.de/tools/laenderhinweise/laenderdetails/country/sa/";
export const SAUDI_CERTIFICATES = [
  { id: "national", label: "General Secondary Education Certificate / Transcript / Secondary School Graduation Certificate" },
  { id: "private_school", label: "High School Diploma from a private school" },
  { id: "industrial_certificate", label: "Secondary Industrial Education Certificate" },
  { id: "industrial_diploma", label: "Secondary Industrial Institutes Diploma" },
  { id: "other", label: "Another school certificate" },
  { id: "unknown", label: "Cannot confirm the certificate subtype" },
] as const;
export type SaudiCertificate = (typeof SAUDI_CERTIFICATES)[number]["id"];
export type SaudiReport = {
  version: 1 | 2;
  nationalCategory?: "general_certificate" | "general_transcript" | "graduation_certificate" | "unknown";
  secondaryCompletion?: "completed_12_year_secondary" | "unknown";
  targetFamily?: "reported_official_humanities" | "reported_official_law" | "reported_official_social_sciences" | "reported_official_economics" | "reported_official_outside" | "unknown";
  targetFamilyReference?: string;
  privateAssessmentCoverage?: "reported_official_all_met" | "reported_official_unmet" | "unknown";
  subtype?: SaudiCertificate;
  nationalStream?: string;
  subjectAssessment?: "reported_official_met" | "reported_official_unmet" | "unknown";
  subjectAssessmentReference?: string;
  enrollment?: "reported_document" | "not_enrolled" | "unknown";
  enrollmentReference?: string;
  enrollmentField?: string;
  enrollmentTargetRelation?: "reported_official_previous" | "reported_official_unrelated" | "unknown";
  enrollmentTargetRelationReference?: string;
};
export const isIndustrialCertificate = (type?: string) => type === "industrial_certificate" || type === "industrial_diploma";
export function isSaudiSchoolProfile(p: Profile): boolean {
  return p.targetDegree === "bachelor" && p.curriculumType === "national" &&
    (p.schoolQualification?.country === "sa" || p.certificateCountry === "sa");
}
const includes = (condition: unknown, value: string): boolean => condition === value ||
  !!condition && typeof condition === "object" && (
    "op" in condition && "value" in condition &&
    (condition.op === "eq" && condition.value === value || condition.op === "in" && Array.isArray(condition.value) && condition.value.includes(value)));
export function isSaudiAdmissionRule(rule: { conditions: Record<string, unknown>; outcomes: { path?: unknown } }): boolean {
  const c = rule.conditions;
  if (rule.outcomes.path !== undefined && Object.keys(c).some(key => key.startsWith("sa_"))) return true;
  if (c.curriculum === "gce" || c.curriculum === "ib") return false;
  return rule.outcomes.path !== undefined && (includes(c.certificate_country, "sa") || includes(c.aps_issuer_country, "sa") ||
    ["tawjihiyah", "private_school", "industrial_certificate", "industrial_diploma"].some(b => includes(c.board, b)));
}
export function isScopedSaudiRule(rule: { conditions: Record<string, unknown>; outcomes?: {path?: unknown; institution_restriction?: unknown} }): boolean {
  const c = rule.conditions;
  const path = rule.outcomes?.path;
  if (!["direct", "subject_restricted", "studienkolleg"].includes(String(path))) return false;
  if (c.target_degree !== "bachelor" || !exactCurrentIntakes(c.intake_index)) return false;
  if (c.sa_degree_evidence === "v2") return path === "direct" && rule.outcomes?.institution_restriction === undefined && c.sa_degree_issuer === "sa" && c.sa_degree_context === "national" && c.sa_degree_kind === "bachelor" && c.sa_degree_completion === "completed" && atLeast(c.sa_degree_nominal_years, 4) && c.sa_degree_mode === "regular" && c.sa_degree_norms === "met" && c.sa_degree_recognition === "confirmed" && c.sa_degree_institution === "reported" && c.sa_degree_field === "reported";
  if (c.aps_issuer_country !== "sa" || c.aps_qualification_context !== "national" || c.curriculum !== "national") return false;
  const study = c.sa_prior_study_kind === "bachelor" && c.sa_reported_recognition === "confirmed" && positiveValues(c.sa_reported_target_relation, ["previous", "neighbouring"]);
  if (c.sa_certificate_subtype === "national") {
    const prep = path === "studienkolleg" && (positiveValues(c.sa_national_stream, SCIENCE_STREAMS) || positiveValues(c.sa_national_stream, ["Literary Section", "Literary Track", "Human Sciences Section"]) && positiveValues(c.sa_reported_target_family, ["humanities", "law", "social_sciences", "economics"]) || c.sa_national_stream === "Commercial Section" && positiveValues(c.sa_reported_target_family, ["economics"]) || positiveValues(c.sa_national_stream, ["Commercial Section"]) && positiveValues(c.sa_reported_target_family, ["economics"]));
    return rule.outcomes?.institution_restriction === undefined && c.sa_certificate_evidence === "v2" && c.sa_secondary_completion === "completed_12_year_secondary" && positiveValues(c.sa_national_category, NATIONAL_CATEGORIES) && positiveValues(c.sa_national_stream, Object.keys(NATIONAL_STREAMS)) && (path === "subject_restricted" && study && atLeast(c.sa_successful_bachelor_years, 1) || prep);
  }
  if (c.sa_certificate_subtype === "private_school") return rule.outcomes?.institution_restriction === undefined && (path === "studienkolleg" && c.sa_successful_bachelor_years === 1 && c.sa_reported_target_relation === "previous" || path === "subject_restricted" && atLeast(c.sa_successful_bachelor_years, 2)) && c.sa_certificate_evidence === "v2" && c.sa_reported_subject_assessment === "met" && c.sa_private_assessment_coverage === "met" && study && atLeast(c.sa_successful_bachelor_years, 1);
  return rule.outcomes?.institution_restriction === "fachhochschule" && positiveValues(c.sa_certificate_subtype, ["industrial_certificate", "industrial_diploma"]) && positiveValues(c.sa_certificate_evidence, ["v1", "v2"]) && c.sa_prior_study_kind === "bachelor" && c.sa_reported_recognition === "confirmed" && (path === "subject_restricted" && study && atLeast(c.sa_successful_bachelor_years, 1) || path === "studienkolleg" && c.sa_reported_enrollment === "document" && c.sa_reported_enrollment_relation === "previous");
}
export const SAUDI_FACT_LABELS: Record<string, string> = {
  sa_secondary_completion: "reported completed secondary category (covered product scope)",
  sa_national_category: "literal reported national documentary category", sa_national_stream: "literal documentary national stream",
  sa_reported_target_family: "applicant-reported applicable official classification of this exact target with reference",
  sa_private_assessment_coverage: "reported applicable accreditation, subject breadth and all individual passing minima",
  sa_degree_evidence: "versioned independent completed Bachelor evidence", sa_degree_issuer: "actual tertiary issuer country", sa_degree_context: "actual tertiary qualification context",
  sa_degree_kind: "reported Bachelor qualification identity", sa_degree_completion: "actual degree completion", sa_degree_nominal_years: "nominal degree duration, not elapsed/successful years",
  sa_degree_mode: "reported actual study mode", sa_degree_norms: "applicable reported prescribed norms and generally full-time qualification assessment", sa_degree_recognition: "applicable reported official qualification recognition",
  sa_degree_institution: "reported qualification institution", sa_degree_field: "reported qualification field",
  sa_certificate_evidence: "versioned Saudi school-certificate evidence",
  sa_certificate_subtype: "explicit school-certificate subtype",
  sa_reported_subject_assessment: "reported ZAB-guideline subject assessment with reference",
  sa_prior_study_kind: "reported previous Bachelor-study basis",
  sa_successful_bachelor_years: "successfully completed Bachelor academic years (not elapsed years or semesters)",
  sa_reported_recognition: "reported applicable official institution/Bachelor recognition with reference",
  sa_reported_target_relation: "reported previous-subject/intended-target assessment with reference",
  sa_reported_enrollment: "reported Bachelor enrollment certificate and its field",
  sa_reported_enrollment_relation: "reported enrollment-field/intended-target assessment with reference",
};
const reportedText = (s: unknown) => typeof s === "string" && s.trim().length > 0;
const reference = (s: unknown) => typeof s === "string" && s.trim().length > 0 && s.trim().length <= 500;
export function deriveSaudiFacts(p: Profile): Record<string, string | number> {
  const h = p.qualificationHistory;
  const d = h?.saudiBachelorEvidence;
  const degree: Record<string, string | number> = {};
  if (p.targetDegree === "bachelor" && h?.country === "sa") {
    Object.assign(degree, {sa_degree_evidence: d?.version === 2 ? "v2" : "unknown", sa_degree_issuer: h.country, sa_degree_context: d?.context ?? "unknown", sa_degree_kind: h.qualificationType ?? "unknown", sa_degree_completion: h.completion ?? "unknown", sa_degree_nominal_years: typeof h.degreeYears === "number" && Number.isFinite(h.degreeYears) ? h.degreeYears : "unknown", sa_degree_mode: h.priorStudyMode ?? "unknown", sa_degree_norms: d?.version === 2 && reference(d.reference) && d.assessment === "reported_official_norms_full_time" ? "met" : "unknown", sa_degree_recognition: reference(h.priorStudyRecognitionReference) && h.priorStudyRecognition === "reported_official_confirmed" ? "confirmed" : "unknown", sa_degree_institution: h.hasPriorUniversityStudy && reportedText(h.institution) ? "reported" : "unknown", sa_degree_field: reportedText(h.field) ? "reported" : "unknown"});
  }
  if (!isSaudiSchoolProfile(p) || p.schoolQualification?.country !== "sa" || p.schoolQualification.context !== "national") return degree;
  const s = p.saudiCertificate;
  const basis = (s?.version === 1 || s?.version === 2) && h?.hasPriorUniversityStudy && h.qualificationType === "bachelor" && !!reportedText(h.institution) && !!reportedText(h.field);
  return {
    ...degree,
    sa_secondary_completion: s?.version === 2 ? s.secondaryCompletion ?? "unknown" : "unknown",
    sa_national_category: s?.version === 2 ? s.nationalCategory ?? "unknown" : "unknown",
    sa_national_stream: s?.version === 2 && Object.hasOwn(NATIONAL_STREAMS, s.nationalStream ?? "") ? s.nationalStream! : "unknown",
    sa_reported_target_family: s?.version === 2 && reportedText(p.targetField) && reference(s.targetFamilyReference) && typeof s.targetFamily === "string" && ["reported_official_humanities", "reported_official_law", "reported_official_social_sciences", "reported_official_economics", "reported_official_outside"].includes(s.targetFamily) ? s.targetFamily.replace("reported_official_", "") : "unknown",
    sa_private_assessment_coverage: s?.version === 2 && reference(s.subjectAssessmentReference) ? s.privateAssessmentCoverage === "reported_official_all_met" ? "met" : s.privateAssessmentCoverage === "reported_official_unmet" ? "unmet" : "unknown" : "unknown",
    sa_certificate_evidence: s?.version === 2 ? "v2" : s?.version === 1 ? "v1" : "unknown",
    sa_certificate_subtype: s?.subtype ?? "unknown",
    sa_reported_subject_assessment: (s?.version === 1 || s?.version === 2) && reference(s.subjectAssessmentReference)
      ? s.subjectAssessment === "reported_official_met" ? "met" : s.subjectAssessment === "reported_official_unmet" ? "unmet" : "unknown" : "unknown",
    sa_prior_study_kind: h?.hasPriorUniversityStudy === false ? "none" : h?.qualificationType === "bachelor" ? "bachelor" : h?.qualificationType ? "other" : "unknown",
    sa_successful_bachelor_years: basis && typeof h.completedYears === "number" && Number.isInteger(h.completedYears) && h.completedYears >= 0 && h.completedYears <= 50 ? h.completedYears : "unknown",
    sa_reported_recognition: basis && reference(h.priorStudyRecognitionReference) ? h.priorStudyRecognition === "reported_official_confirmed" ? "confirmed" : h.priorStudyRecognition === "reported_official_rejected" ? "rejected" : "unknown" : "unknown",
    sa_reported_target_relation: basis && !!reportedText(p.targetField) && reference(h.priorStudyTargetRelationReference) ? h.priorStudyTargetRelation === "reported_official_previous" ? "previous" : h.priorStudyTargetRelation === "reported_official_closely_related" ? "neighbouring" : h.priorStudyTargetRelation === "reported_official_unrelated" ? "unrelated" : "unknown" : "unknown",
    sa_reported_enrollment: basis && h.completion === "in_progress" && s?.enrollment === "reported_document" && reference(s.enrollmentReference) && !!reportedText(s.enrollmentField) ? "document" : s?.enrollment === "not_enrolled" ? "none" : "unknown",
    sa_reported_enrollment_relation: basis && !!reportedText(s?.enrollmentField) && !!reportedText(p.targetField) && reference(s.enrollmentTargetRelationReference) ? s.enrollmentTargetRelation === "reported_official_previous" ? "previous" : s.enrollmentTargetRelation === "reported_official_unrelated" ? "unrelated" : "unknown" : "unknown",
  };
}
