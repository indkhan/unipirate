// Source-reviewed candidates, not published rules. No I/O or runtime policy branches.
import type { EngineRule } from "../lib/engine/evaluate";
import { DMAT_FIELD_ENTRIES, DMAT_FIELD_SOURCE, DMAT_SOURCE } from "../lib/engine/dmat";

const CHECKED = "2026-10-07T00:00:00Z";
const scope = { target_degree: "master", aps_issuer_country: "in", aps_qualification_context: "national" };
const single = { ...scope, dmat_qualification_scope: "single" };
const current = { ...single, dmat_procedure: { op: "in" as const, value: ["current_initial", "current_new"] } };
type Conditions = EngineRule["conditions"];
function candidate(id: string, conditions: Conditions, dmat: "required" | "not_required" | "unknown",
  source_quote: string, note: string, source_url = DMAT_SOURCE): EngineRule & { country: string } {
  return { id: `dmat-reviewed-${id}`, country: "in", conditions, outcomes: { dmat, note },
    status: "draft", source_url, source_quote, last_verified_at: CHECKED };
}
const intakeQuote = "summer semester 2027";
const beforeQuote = "before 29 June 2026";
const semesterQuote = "5 semesters";
export const dmatCandidates = [
  candidate("before-intake", { ...scope, intake_index: { op: "lte", value: 4053 } }, "not_required", intakeQuote,
    "The published dMAT intake requirement starts with Summer Semester 2027; this earlier intake remains outside that requirement."),
  candidate("review", scope, "unknown", intakeQuote,
    "Confirm your previous-degree classification and relevant APS procedure with APS India (https://aps-india.de/dmat/). Missing timing or confirmation does not establish an exemption; recognition and admission remain separate."),
  candidate("multiple-review", { ...scope, dmat_qualification_scope: { op: "in", value: ["multiple", "unknown"] } }, "unknown", "not exhaustive",
    "Confirm which previous qualification governs this case with APS India; multiple or uncertain qualifications cannot be classified from one reported title.", DMAT_FIELD_SOURCE),
  candidate("completed", { ...single, dmat_procedure: "relevant_completed", has_existing_aps: true }, "not_required", "for that completed APS procedure",
    "The reported relevant APS procedure is completed and its certificate received. This exemption does not cover a later new evaluation."),
  candidate("registration-before", { ...current, dmat_registration_status: "completed", dmat_registration_day: { op: "lt", value: 20260629 } }, "not_required", beforeQuote,
    "Completed APS online registration predates the June boundary for this procedure, even if documents were dispatched later."),
  candidate("dispatch-before", { ...current, dmat_dispatch_status: "complete", dmat_complete_dispatch_day: { op: "lt", value: 20260629 } }, "not_required", beforeQuote,
    "Complete APS documents were dispatched before the June boundary for this procedure; retain shipment proof. Later receipt or pending verification does not erase this exemption."),
  candidate("partnership", { ...single, dmat_partnership_status: "confirmed" }, "not_required", "officially confirmed",
    "Reported official exchange, double-degree or partnership confirmation includes the institution/coordinator and group number. Submit that confirmation with APS documentation."),
  candidate("unaffected", { ...single, dmat_field_basis: "aps_confirmation", dmat_field_classification: "unaffected" }, "not_required", "previous degree",
    "APS reportedly confirmed this previous degree is outside the affected fields. Absence from the non-exhaustive list alone is not this confirmation.", DMAT_FIELD_SOURCE),
  ...[3, 4].map(years => candidate(`enrolled-${years}`, { ...single,
    dmat_prior_qualification_type: "bachelor", dmat_prior_study_completion: "in_progress",
    dmat_prior_degree_years: years, dmat_completed_semesters: { op: "lt", value: years === 3 ? 5 : 7 } }, "not_required", years === 3 ? semesterQuote : "7 semesters",
    "The reported actually completed semesters are below the published enrolled-bachelor exception boundary. Completed years are never converted to semesters.")),
];

// All alternatives are reviewed rule data; missing is never an alternative.
const registrations: Conditions[] = [
  { dmat_registration_status: "not_completed" },
  { dmat_registration_status: "completed", dmat_registration_day: { op: "gte", value: 20260629 } },
];
const dispatches: Conditions[] = [
  { dmat_dispatch_status: "not_sent" },
  { dmat_dispatch_status: "complete", dmat_complete_dispatch_day: { op: "gte", value: 20260629 } },
];
const stages: Conditions[] = [
  { dmat_prior_study_completion: "completed" },
  { dmat_prior_study_completion: "in_progress", dmat_prior_degree_years: 3, dmat_completed_semesters: { op: "gte", value: 5 } },
  { dmat_prior_study_completion: "in_progress", dmat_prior_degree_years: 4, dmat_completed_semesters: { op: "gte", value: 7 } },
];
const classifications: Conditions[] = [
  { dmat_field_basis: "list_v1", dmat_field_version: "1.0", dmat_field_entry: { op: "in", value: [...DMAT_FIELD_ENTRIES] } },
  { dmat_field_basis: "aps_confirmation", dmat_field_classification: "affected" },
];
for (const [r, registration] of registrations.entries()) for (const [d, dispatch] of dispatches.entries())
  for (const [s, stage] of stages.entries()) for (const [f, classification] of classifications.entries()) {
    dmatCandidates.push(candidate(`required-${r}-${d}-${s}-${f}`, { ...current,
      intake_index: { op: "gte", value: 4054 }, dmat_prior_qualification_type: "bachelor",
      dmat_partnership_status: "none", ...registration, ...dispatch, ...stage, ...classification }, "required", intakeQuote,
      "dMAT is required in this reported affected previous-degree case for Summer Semester 2027 or later. Other complete APS documents may be submitted first; issuance awaits the dMAT certificate and checks. A low score does not establish APS refusal or admission failure."));
  }
