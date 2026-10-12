import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { buildOptions, QUESTIONS } from "../check-questions";
import { CheckFlow } from "../check-flow";
import { ProfileReview } from "../profile-review";
import { suggestIntakes } from "../steps";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

it("suggests later intakes once typical cutoffs pass", () => {
  expect(suggestIntakes("2026-10-12T00:00:00Z").map(o => o.label)).toEqual(["Summer 2027", "Winter 2027/28", "Summer 2028"]);
  expect(suggestIntakes("2027-01-15T12:00:00Z").map(o => o.label)).toEqual(["Summer 2027", "Winter 2027/28", "Summer 2028"]);
  expect(suggestIntakes("2027-01-16T00:00:00Z").map(o => o.label)).toEqual(["Winter 2027/28", "Summer 2028", "Winter 2028/29"]);
  expect(suggestIntakes("2026-07-15T12:00:00Z").map(o => o.label)).toEqual(["Winter 2026/27", "Summer 2027", "Winter 2027/28"]);
  expect(suggestIntakes("2026-07-16T00:00:00Z").map(o => o.label)).toEqual(["Summer 2027", "Winter 2027/28", "Summer 2028"]);
});

it("applies cutoffs in Berlin time, not UTC", () => {
  // 2026-07-15 22:30 UTC is already July 16 in Berlin: winter cutoff passed.
  expect(suggestIntakes("2026-07-15T22:30:00Z")[0]).toEqual({ term: "summer", year: 2027, label: "Summer 2027" });
  // 2026-07-15 21:30 UTC is still July 15 in Berlin: winter cutoff day counts.
  expect(suggestIntakes("2026-07-15T21:30:00Z")[0]).toEqual({ term: "winter", year: 2026, label: "Winter 2026/27" });
});

it("rolls over calendar years without code edits", () => {
  expect(suggestIntakes("2029-11-02T00:00:00Z").map(o => o.label)).toEqual(["Summer 2030", "Winter 2030/31", "Summer 2031"]);
});

it("builds future intake options plus Not sure, labelled as planning seasons", () => {
  const options = buildOptions("intake", {}, "2026-10-12T00:00:00Z");
  expect(options.map(o => o.label)).toEqual(["Summer 2027", "Winter 2027/28", "Summer 2028", "Not sure yet"]);
  expect(options[0].value).toEqual({ term: "summer", year: 2027 });
  expect(options.at(-1)).toEqual({ value: null, label: "Not sure yet", key: "unsure" });
  expect(QUESTIONS.intake.subtitle).toMatch(/typical planning seasons, not official deadlines/i);
});

it("saved earlier intakes stay selectable answers even when no longer suggested", () => {
  const options = buildOptions("intake", { intake: { term: "winter", year: 2026 } }, "2026-10-12T00:00:00Z");
  expect(options.some(o => o.key === "winter-2026")).toBe(false);
});

it("checker and review screens show no optional visa/funding form", () => {
  for (const html of [
    renderToStaticMarkup(<CheckFlow initialAnswers={{ targetDegree: "bachelor" }} todayIso="2026-10-12T00:00:00Z" />),
    renderToStaticMarkup(<ProfileReview initialAnswers={{ targetDegree: "bachelor" }} todayIso="2026-10-12T00:00:00Z" />),
  ]) expect(html).not.toContain("Optional visa and funding context");
});
