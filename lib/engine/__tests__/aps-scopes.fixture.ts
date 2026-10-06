import type { Profile } from "../evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";

// Official scope evidence checked 2026-10-06; candidate publication is simulated
// only on a disposable copy. Production candidates remain drafts.
export const officialApsRules = () => ruleData.map(r => r.id.startsWith("aps-scoped-") ? { ...r, status: "verified" } : r);
export const officialIndianProfile: Profile = {
  targetDegree: "bachelor", curriculumType: "national", certificateCountry: "sa",
  schoolQualification: { country: "in", context: "national" },
  visaApplicationCountry: "sa", visaMissionContext: "saudi_study",
  apsApplicationContext: "uni_assist",
  hasExistingApsCertificate: false,
};
