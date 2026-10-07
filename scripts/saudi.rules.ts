// Reviewed 2026-10-08; candidates only. No seed/publication/DB operation.
import type { EngineRule } from "../lib/engine/evaluate";
import { SAUDI_SOURCE, SAUDI_SOURCE_DE } from "../lib/engine/saudi";
const scope = { target_degree: "bachelor", curriculum: "national", aps_issuer_country: "sa", aps_qualification_context: "national", sa_certificate_evidence: "v1" } as const;
const study = { sa_prior_study_kind: "bachelor", sa_reported_recognition: "confirmed", sa_reported_target_relation: "previous" } as const;
const evidence = { country: "sa", status: "draft", published_at: null, last_verified_at: "2026-10-08T00:00:00Z" } as const;
const report = "Based on applicant-reported applicable official assessments; UniPirate has not independently verified these reports. The university decides programme admission.";
const privateScope = { ...scope, sa_certificate_subtype: "private_school", sa_reported_subject_assessment: "met", ...study } as const;
const industrialScope = { ...scope, sa_certificate_subtype: { op: "in", value: ["industrial_certificate", "industrial_diploma"] as string[] }, intake_index: { op: "gte", value: 4053 } } as const;
export const saudiCandidates: (EngineRule & { country: string; published_at: null })[] = [
  { ...evidence, id: "sa-reviewed-private-one", conditions: { ...privateScope, sa_successful_bachelor_years: 1 },
    outcomes: { path: "studienkolleg", note: "Private-school diploma: preparatory study in the previous subject area. " + report,
      steps: [{ order: 15, text: "Confirm Studienkolleg in the previous subject area with the university using your private-school subject assessment and successful Bachelor-year records." }] },
    source_url: SAUDI_SOURCE_DE, source_quote: "in einem Bachelor-Studium an einer anerkannten Hochschule erfolgreich abgeschlossen" },
  { ...evidence, id: "sa-reviewed-private-two", conditions: { ...privateScope, sa_successful_bachelor_years: { op: "gte", value: 2 } },
    outcomes: { path: "subject_restricted", note: "Private-school diploma: Bachelor access in the previous subject area. " + report,
      steps: [{ order: 15, text: "Confirm Bachelor admission in the previous subject area using your private-school subject assessment and successful two-year Bachelor-study records." }] },
    source_url: SAUDI_SOURCE, source_quote: "Successful completion of two years of studies" },
  { ...evidence, id: "sa-reviewed-industrial-enrollment", conditions: { ...industrialScope, sa_prior_study_kind: "bachelor", sa_reported_recognition: "confirmed", sa_reported_enrollment: "document", sa_reported_enrollment_relation: "previous" },
    outcomes: { path: "studienkolleg", institution_restriction: "fachhochschule", note: "Industrial school certificate: preparatory study at a Fachhochschule in the enrollment subject area, from Winter 2026/27. " + report,
      steps: [{ order: 15, text: "Confirm Studienkolleg at a Fachhochschule (university of applied sciences) in the subject area on your recognized Bachelor enrollment certificate." }] },
    source_url: SAUDI_SOURCE, source_quote: "From the 2026/27 winter semester onwards" },
  { ...evidence, id: "sa-reviewed-industrial-year", conditions: { ...industrialScope, ...study, target_field: { op: "neq", value: "" }, sa_successful_bachelor_years: { op: "gte", value: 1 } },
    outcomes: { path: "subject_restricted", note: "Industrial school certificate: Bachelor access in the previous subject area, from Winter 2026/27. This successful-study clause does not state an FH restriction. " + report,
      steps: [{ order: 15, text: "Confirm Bachelor admission in the previous subject area using your industrial school certificate and successful Bachelor-year records." }] },
    source_url: SAUDI_SOURCE_DE, source_quote: "in der bereits studierten Fachrichtung" },
];
