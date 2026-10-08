// UP-ELIG-03: reviewed 2026-10-07. Candidates only; never published here.
import type { EngineRule } from "../lib/engine/evaluate";

const scope: EngineRule["conditions"] = {
  target_degree: "bachelor", curriculum: "national",
  aps_issuer_country: "in", aps_qualification_context: "national",
  board: { op: "in", value: ["cbse", "cisce", "state_board"] },
  intake_index: { op: "gte", value: 4053 },
  class12_percent: { op: "gte", value: 70 },
};
const evidence = {
  country: "in", status: "draft",
  source_url: "https://aps-india.de/news/",
  source_quote: "The academic year must form part of a regular Bachelor’s degree program and must have been successfully completed.",
  last_verified_at: "2026-10-07T00:00:00Z",
} as const;
const reportedNote = "Based on your applicant-reported official assessments and successful study, this route gives subject-restricted access to the previous or closely related subject. UniPirate has not independently verified your reports; programme admission is decided separately by the university. APS requirements and certificate preparation remain separate.";

export const indiaStudyCandidates: (EngineRule & { country: string })[] = [
  { ...evidence, id: "india-study-successful-year", conditions: {
    ...scope, in_class12_prior_study_kind: "bachelor", in_class12_prior_study_country: "in",
    in_class12_successful_bachelor_years: { op: "gte", value: 1 }, in_class12_study_mode: "regular",
    in_class12_reported_recognition: "confirmed",
    in_class12_reported_target_relation: { op: "in", value: ["previous", "closely_related"] },
  }, outcomes: { path: "subject_restricted", note: reportedNote } },
  { ...evidence, id: "india-study-school-only", conditions: { ...scope, in_class12_prior_study_kind: "none" },
    outcomes: { path: "studienkolleg", note: "With explicit no prior university study, the Class XII school route is via Studienkolleg. APS and programme requirements remain separate." } },
];

// UP-ELIG-04: JEE absence/failure is not an academic fact for this independent route.
// A reported study assessment must not disappear behind the less-specific old
// school fallback. JEE is independent; these review candidates do not defeat it.
const review = { ...scope, in_class12_prior_study_kind: "bachelor" } as const;
const gaps: { id: string; conditions: EngineRule["conditions"]; note: string }[] = [
  { id: "kind", conditions: { in_class12_prior_study_kind: { op: "in", value: ["other", "unknown"] } }, note: "Establish the previous bachelor-study basis; another qualification or missing prior-study answer is not covered by this route." },
  { id: "country", conditions: { in_class12_prior_study_country: { op: "neq", value: "in" } }, note: "Confirm the previous institution country. Foreign or uncertain study is outside this reviewed India-only coverage; it is not a rejection of foreign study." },
  { id: "mode", conditions: { in_class12_study_mode: { op: "neq", value: "regular" } }, note: "Confirm applicability of this study mode. Distance/online, other or uncertain modes need a separate applicable assessment." },
  { id: "years-missing", conditions: { in_class12_successful_bachelor_years: "unknown" }, note: "Establish successfully completed bachelor academic years from attained study records. Programme duration, enrolment and a completed-degree label cannot supply successful years." },
  { id: "years-unmet", conditions: { in_class12_successful_bachelor_years: { op: "lt", value: 1 } }, note: "The successful bachelor academic year condition is unmet: fewer than one successful academic year is reported. Duration is not attainment." },
  { id: "recognition-rejected", conditions: { in_class12_reported_recognition: "rejected" }, note: "The reported official assessment rejects recognition of this institution/bachelor study; the recognition condition is unmet." },
  { id: "recognition-missing", conditions: { in_class12_reported_recognition: "unknown" }, note: "Confirm an applicable official recognition assessment for THIS institution, bachelor programme and attained study, with an authority/document/conclusion reference. A name or Class XII-only APS certificate cannot establish it." },
  { id: "relation-unrelated", conditions: { in_class12_reported_target_relation: "unrelated" }, note: "The intended target is outside the reported official previous/closely related subject scope; the target relationship condition is unmet." },
  { id: "relation-missing", conditions: { in_class12_reported_target_relation: "unknown" }, note: "Confirm an applicable official previous-field/intended-target relationship assessment with its authority/document/conclusion reference. Equal field names or recognition alone cannot establish this target relationship." },
];
for (const gap of gaps) indiaStudyCandidates.push({ ...evidence, id: `india-study-review-${gap.id}`,
  conditions: { ...review, ...gap.conditions }, outcomes: { path: "unknown", note: `${gap.note} A separately supported school alternative may remain available; this direct-route assessment is unresolved. Confirm with the university.` } });

// Missing applicability must not be concealed by an unscoped legacy school row.
for (const [key, label] of [["class12_percent", "Class XII overall score"], ["intake_index", "intake"], ["aps_issuer_country", "qualification issuer country"], ["aps_qualification_context", "qualification context"]] as const) {
  const conditions: EngineRule["conditions"] = { ...review, [key]: "unknown" };
  if (key === "aps_issuer_country") delete conditions.aps_qualification_context;
  indiaStudyCandidates.push({ ...evidence, id: "india-study-review-missing-" + key,
    conditions,
    outcomes: { path: "unknown", note: "Establish the missing " + label + " for this Indian Class XII/bachelor assessment. No direct-route conclusion is established; confirm the qualification pathway with the university." } });
}
