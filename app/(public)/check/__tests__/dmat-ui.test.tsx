import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProfileReview } from "../profile-review";
import { CheckFlow } from "../check-flow";
import { visibleSteps } from "../steps";
import { dmatAnswers } from "./dmat.fixture";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

it("upgrades restored master's inputs and exposes the new questions", () => {
  const initial = { ...dmatAnswers, dmatVersion: undefined };
  const html = renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: initial,
    initialStepIndex: visibleSteps(dmatAnswers).indexOf("dmatQualificationScope") }));
  expect(html).toContain("Can this dMAT assessment use one relevant previous qualification?");
});
it("renders classification provenance and reported dates without conflating March submission", () => {
  const initial = { ...dmatAnswers, dmatRegistrationStatus: "completed", dmatRegistrationDate: "2026-06-29",
    dmatDispatchStatus: "complete", dmatDispatchDate: "2026-06-28" } as const;
  const html = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: initial }));
  expect(html).toContain('value="2026-06-29"');
  expect(html).toContain('value="2026-06-28"');
  expect(html).toContain("March complete-submission milestone");
  expect(html).toContain("dMAT_India_Affected_Fields_List.pdf");
  expect(html).toContain("non-exhaustive");
});
it("blocks impossible dates but accepts explicit uncertain events", () => {
  const invalid = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: {
    ...dmatAnswers, dmatRegistrationStatus: "completed", dmatRegistrationDate: "2026-02-29" } }));
  expect(invalid).toContain('aria-invalid="true"');
  expect(invalid).toContain('disabled=""');
  const unknown = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: {
    ...dmatAnswers, dmatRegistrationStatus: "unknown", dmatDispatchStatus: "unknown" } }));
  expect(unknown).not.toContain('disabled=""');
});
