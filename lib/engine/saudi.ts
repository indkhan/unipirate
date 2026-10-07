// Saudi certificate evidence only. Pure; no recognition lookup or policy thresholds.
import type { Profile } from "./evaluate";

export const SAUDI_SOURCE = "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/";
export const SAUDI_SOURCE_DE = "https://www.uni-assist.de/tools/laenderhinweise/laenderdetails/country/sa/";
export const SAUDI_CERTIFICATES = [
  { id: "national", label: "National secondary school certificate (Tawjihiyah)" },
  { id: "private_school", label: "High School Diploma from a private school" },
  { id: "industrial_certificate", label: "Secondary Industrial Education Certificate" },
  { id: "industrial_diploma", label: "Secondary Industrial Institutes Diploma" },
  { id: "other", label: "Another school certificate" },
  { id: "unknown", label: "Cannot confirm the certificate subtype" },
] as const;
export type SaudiCertificate = (typeof SAUDI_CERTIFICATES)[number]["id"];
export type SaudiReport = {
  version: 1;
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
  if (c.curriculum === "gce" || c.curriculum === "ib") return false;
  return rule.outcomes.path !== undefined && (includes(c.certificate_country, "sa") || includes(c.aps_issuer_country, "sa") ||
    ["tawjihiyah", "private_school", "industrial_certificate", "industrial_diploma"].some(b => includes(c.board, b)));
}
export function isScopedSaudiRule(rule: { conditions: Record<string, unknown> }): boolean {
  const c = rule.conditions;
  return c.sa_certificate_evidence === "v1" && c.sa_certificate_subtype !== undefined &&
    c.aps_issuer_country === "sa" && c.aps_qualification_context === "national" &&
    c.curriculum === "national" && c.target_degree === "bachelor";
}
export const SAUDI_FACT_LABELS: Record<string, string> = {
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
const reference = (s?: string) => !!s?.trim() && s.trim().length <= 500;
export function deriveSaudiFacts(p: Profile): Record<string, string | number> {
  if (!isSaudiSchoolProfile(p) || p.schoolQualification?.country !== "sa" || p.schoolQualification.context !== "national") return {};
  const s = p.saudiCertificate;
  const h = p.qualificationHistory;
  const basis = s?.version === 1 && h?.hasPriorUniversityStudy && h.qualificationType === "bachelor" && !!h.institution?.trim() && !!h.field?.trim();
  return {
    sa_certificate_evidence: s?.version === 1 ? "v1" : "unknown",
    sa_certificate_subtype: s?.subtype ?? "unknown",
    sa_reported_subject_assessment: s?.version === 1 && reference(s.subjectAssessmentReference)
      ? s.subjectAssessment === "reported_official_met" ? "met" : s.subjectAssessment === "reported_official_unmet" ? "unmet" : "unknown" : "unknown",
    sa_prior_study_kind: h?.hasPriorUniversityStudy === false ? "none" : h?.qualificationType === "bachelor" ? "bachelor" : h?.qualificationType ? "other" : "unknown",
    sa_successful_bachelor_years: basis && typeof h.completedYears === "number" && Number.isInteger(h.completedYears) && h.completedYears >= 0 && h.completedYears <= 50 ? h.completedYears : "unknown",
    sa_reported_recognition: basis && reference(h.priorStudyRecognitionReference) ? h.priorStudyRecognition === "reported_official_confirmed" ? "confirmed" : h.priorStudyRecognition === "reported_official_rejected" ? "rejected" : "unknown" : "unknown",
    sa_reported_target_relation: basis && !!p.targetField?.trim() && reference(h.priorStudyTargetRelationReference) ? h.priorStudyTargetRelation === "reported_official_previous" ? "previous" : h.priorStudyTargetRelation === "reported_official_unrelated" ? "unrelated" : "unknown" : "unknown",
    sa_reported_enrollment: basis && h.completion === "in_progress" && s?.enrollment === "reported_document" && reference(s.enrollmentReference) && !!s.enrollmentField?.trim() ? "document" : s?.enrollment === "not_enrolled" ? "none" : "unknown",
    sa_reported_enrollment_relation: basis && !!s?.enrollmentField?.trim() && !!p.targetField?.trim() && reference(s.enrollmentTargetRelationReference) ? s.enrollmentTargetRelation === "reported_official_previous" ? "previous" : s.enrollmentTargetRelation === "reported_official_unrelated" ? "unrelated" : "unknown" : "unknown",
  };
}
