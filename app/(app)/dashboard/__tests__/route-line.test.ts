import { describe, expect, it } from "vitest";

import type { Result } from "@/lib/engine/evaluate";

import { dashboardRouteStations } from "../route-line";

const result = (aps: Result["aps"]): Result =>
  ({
    path: "studienkolleg",
    aps,
    testAS: "unknown",
    dMAT: "not_required",
    documents: [],
    steps: [],
    stepsDetailed: [],
    citations: [],
    unknowns: [],
  }) satisfies Result;

describe("dashboardRouteStations", () => {
  it("omits APS when the latest eligibility result says APS is not required", () => {
    expect(
      dashboardRouteStations({
        hasApplications: false,
        hasProfile: true,
        result: result("not_required"),
      }).map((station) => station.label),
    ).toEqual(["Eligibility", "Applications", "Visa"]);
  });

  it("shows APS when the latest eligibility result says APS is required", () => {
    expect(
      dashboardRouteStations({
        hasApplications: false,
        hasProfile: true,
        result: result("required"),
      }).map((station) => station.label),
    ).toEqual(["Eligibility", "APS", "Applications", "Visa"]);
  });

  it("does not mark APS complete just because a profile exists", () => {
    const stations = dashboardRouteStations({
      hasApplications: true,
      hasProfile: true,
      result: result("required"),
    });

    expect(stations.find((station) => station.label === "APS")?.active).toBe(
      false,
    );
    expect(stations.find((station) => station.label === "Applications")?.active).toBe(
      true,
    );
  });
});
