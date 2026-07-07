import { describe, expect, it } from "vitest";

import type { Profile, Result } from "@/lib/engine/evaluate";

import { NO_RULE_MESSAGES } from "@/lib/engine/evaluate";

import {
  buildRoute,
  buildVerdicts,
  documentPreview,
  intakeLabel,
  isBetaCountry,
  visibleUnknowns,
} from "../result-model";

const bachelorProfile: Profile = {
  targetDegree: "bachelor",
  curriculumType: "national",
  certificateCountry: "in",
};

const result: Result = {
  path: "studienkolleg",
  aps: "required",
  testAS: "unknown",
  dMAT: "not_required",
  documents: ["1", "2", "3", "4", "5", "6", "7"],
  steps: [],
  stepsDetailed: [],
  unknowns: [],
  citations: [
    {
      ruleId: "path",
      sourceUrl: "https://example.com/path",
      verifiedAt: "2026-07-01T00:00:00Z",
      claim: "path",
      status: "verified",
      supports: ["path"],
    },
  ],
};

describe("result page model", () => {
  it("attaches citations only to their supported verdict", () => {
    const verdicts = buildVerdicts(result, bachelorProfile);
    expect(verdicts[0].citations).toHaveLength(1);
    expect(verdicts[1].citations).toHaveLength(0);
    expect(verdicts[2]).toEqual(expect.objectContaining({ unknown: true }));
  });

  it("hides dMAT for bachelor's applicants and TestAS for master's", () => {
    const bachelor = buildVerdicts(result, bachelorProfile);
    expect(bachelor.map((v) => v.key)).toEqual(["path", "aps", "testAS"]);

    const master = buildVerdicts(
      { ...result, testAS: "unknown", dMAT: "unknown" },
      { ...bachelorProfile, targetDegree: "master" },
    );
    expect(master.map((v) => v.key)).toEqual(["path", "aps", "dMAT"]);
  });

  it("hides dMAT for non-Indian certificates but never hides a required flag", () => {
    const saudiMaster = buildVerdicts(
      { ...result, dMAT: "unknown" },
      { ...bachelorProfile, targetDegree: "master", certificateCountry: "sa" },
    );
    expect(saudiMaster.map((v) => v.key)).not.toContain("dMAT");

    const required = buildVerdicts(
      { ...result, dMAT: "required" },
      bachelorProfile,
    );
    expect(required.map((v) => v.key)).toContain("dMAT");
  });

  it("drops confirm-whether gaps for flags the profile never needs", () => {
    const unknowns = [NO_RULE_MESSAGES.dmat, NO_RULE_MESSAGES.aps, "other gap"];
    expect(
      visibleUnknowns(
        { ...result, dMAT: "unknown", unknowns },
        bachelorProfile,
      ),
    ).toEqual([NO_RULE_MESSAGES.aps, "other gap"]);
  });

  it("personalizes route stations from evaluated outcomes", () => {
    expect(buildRoute(result).map((station) => station.label)).toEqual([
      "Eligibility",
      "Studienkolleg",
      "APS",
      "Applications",
      "Visa",
      "Germany",
    ]);
    expect(buildRoute(result)[1].state).toBe("current");
  });

  it("shows five real documents and gates only the remainder", () => {
    expect(documentPreview(result.documents)).toEqual({
      visible: ["1", "2", "3", "4", "5"],
      hiddenCount: 2,
    });
    expect(documentPreview(["one"]).hiddenCount).toBe(0);
  });

  it("marks only the planned beta countries", () => {
    expect(
      isBetaCountry({
        targetDegree: "bachelor",
        curriculumType: "national",
        certificateCountry: "pk",
      }),
    ).toBe(true);
    expect(
      isBetaCountry({
        targetDegree: "bachelor",
        curriculumType: "national",
        certificateCountry: "in",
      }),
    ).toBe(false);
  });

  it("formats intake without inventing a deadline", () => {
    const profile: Profile = {
      targetDegree: "bachelor",
      curriculumType: "national",
      intake: { term: "winter", year: 2027 },
    };
    expect(intakeLabel(profile)).toBe("Winter 2027");
    expect(intakeLabel({ ...profile, intake: undefined })).toBeNull();
  });
});
