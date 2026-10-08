import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { evaluate, type Profile, type Result } from "@/lib/engine/evaluate";
import { indianStudyProfile } from "@/lib/engine/__tests__/india-study.fixture";
import { indiaStudyCandidates } from "@/scripts/india-study.rules";

import { VerdictCard } from "../result-components";

const BADGE = "Official confirmation needed";

function render(result: Result, profile: Profile): string {
  return renderToStaticMarkup(
    createElement(VerdictCard, { result, profile, profileLine: "" }),
  );
}

describe("diagnostic badge for a known unmet candidate condition", () => {
  it("keeps the sourced unmet condition without the generic badge", () => {
    // TESTONLY verified copy for rendering; not a publication.
    const rule = { ...indiaStudyCandidates[0], status: "verified" as const };
    const profile = { ...indianStudyProfile, schoolGradePercent: 69.99 };
    const result = evaluate(profile, [rule]);

    expect(result.path).toBe("unknown");
    const primary = result.diagnostics?.find((d) => d.support === "path");
    expect(primary?.status).toBe("known_unmet_condition");
    expect(primary?.followUp).toBeUndefined();
    expect(
      result.citations.filter((c) => c.supports?.includes("path")),
    ).toHaveLength(0);

    const html = render(result, profile);
    expect(html).toContain("reported 69.99");
    expect(html).toContain("candidate requires at least 70");
    expect(html).toContain(rule.source_url);
    expect(html).toContain("07 Oct 2026");
    expect(html).not.toContain(BADGE);
  });

  it("keeps the generic badge when no rule covers the path", () => {
    const result = evaluate(indianStudyProfile, []);
    expect(result.path).toBe("unknown");
    expect(
      result.diagnostics?.some((d) => d.status === "unsupported"),
    ).toBe(true);

    const html = render(result, indianStudyProfile);
    expect(html).toContain(BADGE);
  });

  it("keeps the existing follow-up path without the generic badge", () => {
    // TESTONLY verified copy for rendering; not a publication.
    const rule = { ...indiaStudyCandidates[0], status: "verified" as const };
    const profile = { ...indianStudyProfile, qualificationHistory: undefined };
    const result = evaluate(profile, [rule]);

    expect(result.path).toBe("unknown");
    expect(result.diagnostics?.some((d) => d.followUp)).toBe(true);

    const html = render(result, profile);
    expect(html).toContain(rule.source_url);
    expect(html).not.toContain(BADGE);
  });

  it("keeps conflicting evidence citable without inventing a route", () => {
    const a = { ...indiaStudyCandidates[0], status: "verified" as const };
    const b = {
      ...a,
      id: "opposing-reviewed-copy",
      source_url: "https://www.daad.in/en/",
      outcomes: { path: "insufficient" as const },
    };
    const result = evaluate(indianStudyProfile, [a, b]);

    expect(result.path).toBe("unknown");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ status: "source_conflict" }),
    );

    const html = render(result, indianStudyProfile);
    expect(html).toContain(a.source_url);
    expect(html).toContain(b.source_url);
    expect(html).not.toContain(
      "Your reported qualifications indicate a subject-restricted direct route.",
    );
  });
});
