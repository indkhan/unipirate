import { describe, expect, it } from "vitest";
import { evaluate } from "../evaluate";
import { ordinaryGce } from "./gce.fixture";
import { gceCandidates } from "@/scripts/gce.rules";
import { officialApsRules, officialIndianProfile } from "./aps-scopes.fixture";

// Removing checker questions must never change evaluation results (#50/#51/#52).
// Each removed answer is either unused by every rule or replaced by an
// issuer-driven condition that resolves the same scope without it.
describe("question-removal evaluation parity", () => {
  it("Indian issuer resolves application required without a filing-route answer (#51)", () => {
    const withRoute = evaluate(officialIndianProfile, officialApsRules());
    const withoutRoute = evaluate({...officialIndianProfile, apsApplicationContext: undefined}, officialApsRules());
    expect(withRoute.apsScopes?.application).toBe("required");
    expect(withoutRoute.apsScopes?.application).toBe("required");
  });
  it("Saudi issuer resolves visa not-listed without a mission answer (#52)", () => {
    const saudi = {...officialIndianProfile, schoolQualification: {country: "sa", context: "national" as const}};
    const withMission = evaluate(saudi, officialApsRules());
    const withoutMission = evaluate({...saudi, visaMissionContext: undefined}, officialApsRules());
    expect(withMission.apsScopes?.visa).toBe("not_listed");
    expect(withoutMission.apsScopes?.visa).toBe("not_listed");
  });
  it("complete GCE resolves the same path with or without a school-years answer (#49/#50)", () => {
    const rules = gceCandidates.map(r => ({...r, status: 'verified' as const}));
    const withoutYears = evaluate({...ordinaryGce, qualificationGuidanceVersion: 1 as const}, rules);
    const withYears = evaluate({...ordinaryGce, gce: {...ordinaryGce.gce!, schoolYears: 12}}, rules);
    expect(withoutYears.path).toBe("subject_restricted");
    expect(withYears.path).toBe("subject_restricted");
  });
});
