import { describe, expect, it } from "vitest";

import type { Profile, Result } from "@/lib/engine/evaluate";

import {
  buildRoute,
  buildVerdicts,
  documentPreview,
  intakeLabel,
  isBetaCountry,
} from "../result-model";

const result: Result = {
  path: "studienkolleg",
  aps: "required",
  testAS: "unknown",
  dMAT: "not_required",
  documents: ["1", "2", "3", "4", "5", "6", "7"],
  steps: [],
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
    const verdicts = buildVerdicts(result);
    expect(verdicts[0].citations).toHaveLength(1);
    expect(verdicts[1].citations).toHaveLength(0);
    expect(verdicts[2]).toEqual(expect.objectContaining({ unknown: true }));
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

