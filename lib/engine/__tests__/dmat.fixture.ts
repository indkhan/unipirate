import type { Profile } from "../evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";

export const dmatProfile: Profile = {
  targetDegree: "master", curriculumType: "other", nationality: "pk",
  tertiaryQualification: { issuer: "Example University", country: "in", context: "national" },
  qualificationHistory: { hasPriorUniversityStudy: true, qualificationType: "bachelor",
    institution: "Example University", country: "in", field: "Mechanical Engineering",
    degreeYears: 4, completedYears: 4, completion: "completed" },
  intake: { term: "summer", year: 2027 }, hasExistingApsCertificate: false,
  dmat: { qualificationScope: "single", degreeTitle: "Bachelor of Technology",
    procedure: "current_initial",
    field: { basis: "list_v1", entry: "Engineering", version: "1.0",
      sourceUrl: "https://aps-india.de/wp-content/uploads/2026/06/dMAT_India_Affected_Fields_List.pdf" },
    registration: { status: "not_completed" }, dispatch: { status: "not_sent" },
    partnership: { status: "none" } },
};

// Disposable publication simulation; no production record or metadata is edited.
export const reviewedDmatRules = () => ruleData.map(r =>
  r.id.startsWith("dmat-reviewed-") ? { ...r, status: "verified" } : r);

// FUTURE-dMAT-affected-field is now executable on simulated publication only.
export const DMAT_ACCEPTANCE: { id: string; profile: Profile; dMAT: "required" | "not_required" | "unknown"; sourceUrl: string }[] = [
  { id: "DMAT-positive-affected", profile: dmatProfile, dMAT: "required", sourceUrl: "https://aps-india.de/dmat/" },
  { id: "DMAT-negative-bachelor", profile: { targetDegree: "bachelor", curriculumType: "other" }, dMAT: "not_required", sourceUrl: "https://aps-india.de/dmat/" },
  { id: "DMAT-boundary-registration-28", profile: { ...dmatProfile, dmat: { ...dmatProfile.dmat!, registration: { status: "completed", date: "2026-06-28" } } }, dMAT: "not_required", sourceUrl: "https://aps-india.de/dmat/" },
  { id: "DMAT-boundary-registration-29", profile: { ...dmatProfile, dmat: { ...dmatProfile.dmat!, registration: { status: "completed", date: "2026-06-29" } } }, dMAT: "required", sourceUrl: "https://aps-india.de/dmat/" },
  { id: "DMAT-missing-field", profile: { ...dmatProfile, dmat: { ...dmatProfile.dmat!, field: { basis: "unknown" } } }, dMAT: "unknown", sourceUrl: "https://aps-india.de/dmat/" },
  { id: "DMAT-exception-relevant-completed", profile: { ...dmatProfile, hasExistingApsCertificate: true, dmat: { qualificationScope: "single", procedure: "relevant_completed" } }, dMAT: "not_required", sourceUrl: "https://aps-india.de/dmat/" },
];
