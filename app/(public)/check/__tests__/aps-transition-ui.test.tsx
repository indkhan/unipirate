import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProfileReview } from "../profile-review";
import { CheckFlow } from "../check-flow";
import { visibleSteps } from "../steps";
vi.mock("next/navigation", () => ({useRouter: () => ({push: vi.fn()})}));
vi.mock("posthog-js/react", () => ({usePostHog: () => ({capture: vi.fn()})}));
vi.mock("../actions", () => ({submitCheck: vi.fn()}));
vi.mock("@/components/app/theme-toggle", () => ({ThemeToggle: () => null}));
const answers = {qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, targetDegree: "bachelor", nationality: "in", certificateCountry: "in", visaApplicationCountry: "in", curriculumType: "national", board: "cbse", schoolGradePercent: 65, jeeAdvanced: false, hasPriorUniversityStudy: false, schoolQualificationCountry: "in", schoolQualificationContext: "national", hasExistingApsCertificate: false, apsApplicationContext: "unknown", apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14", targetField: "cs", intake: null} as const;
it("renders the reported ISO date and source-backed confirmation in both edit surfaces", () => {
  const checker = renderToStaticMarkup(React.createElement(CheckFlow, {initialAnswers: answers, initialStepIndex: visibleSteps(answers).indexOf("apsSubmissionDate")}));
  const review = renderToStaticMarkup(React.createElement(ProfileReview, {initialAnswers: answers}));
  for (const html of [checker, review]) {
    expect(html).toContain('value="2026-03-14"');
    expect(html).toContain('href="https://aps-india.de/news/"');
    expect(html).toContain("YYYY-MM-DD");
  }
  expect(review).toContain("Registration, payment, courier dispatch and delivery dates alone");
  expect(review).not.toContain('disabled=""');
});
it("blocks invalid dates, shows the error, and allows explicit uncertainty", () => {
  const invalid = renderToStaticMarkup(React.createElement(ProfileReview, {initialAnswers: {...answers, apsSubmissionDate: "2026-02-29"}}));
  expect(invalid).toContain('aria-invalid="true"');
  expect(invalid).toContain("Enter a real calendar date");
  expect(invalid).toContain('disabled=""');
  const unknown = renderToStaticMarkup(React.createElement(ProfileReview, {initialAnswers: {...answers, apsSubmissionConfirmation: "unknown"}}));
  expect(unknown).not.toContain('value="2026-03-14"');
  expect(unknown).not.toContain('disabled=""');
});
