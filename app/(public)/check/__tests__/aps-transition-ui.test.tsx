import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProfileReview } from "../profile-review";
import { CheckFlow } from "../check-flow";
import { visibleSteps } from "../steps";
import { QUESTIONS } from "../check-questions";
vi.mock("next/navigation", () => ({useRouter: () => ({push: vi.fn()})}));
vi.mock("posthog-js/react", () => ({usePostHog: () => ({capture: vi.fn()})}));
vi.mock("../actions", () => ({submitCheck: vi.fn()}));
vi.mock("@/components/app/theme-toggle", () => ({ThemeToggle: () => null}));
const answers = {jeeVersion: 2, jeeSchoolCertificate: "unknown", jeeMainStatus: "no_result", jeeAdvancedStatus: "no_result", qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, targetDegree: "bachelor", nationality: "in", certificateCountry: "in", visaApplicationCountry: "in", curriculumType: "national", board: "cbse", schoolGradePercent: 65, jeeAdvanced: false, hasPriorUniversityStudy: false, schoolQualificationCountry: "in", schoolQualificationContext: "national", hasExistingApsCertificate: false, apsApplicationContext: "unknown", apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14", targetField: "cs", intake: null} as const;
it("shows the exact assessed-qualification scope when editing a completed-degree profile", () => {
  const saved = {...answers, hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Example University", priorStudyCountry: "in", priorStudyField: "Computing", priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed", hasExistingApsCertificate: true, apsProcedureStatus: "completed", apsSubmissionDate: "2026-03-16", intake: {term: "winter", year: 2026}} as const;
  const review = renderToStaticMarkup(React.createElement(ProfileReview, {initialAnswers: saved}));
  expect(review).toContain(QUESTIONS.apsSubmissionConfirmation.question);
  expect(review).toContain("Class XII or Class XII plus one-successful-Bachelor-year assessment?");
  expect(review).toContain("For another basis or an uncertain procedure/date, choose Cannot confirm.");
  const unknown = renderToStaticMarkup(React.createElement(ProfileReview, {initialAnswers: {...saved, apsSubmissionConfirmation: "unknown"}}));
  expect(unknown).toContain('aria-pressed="true">Cannot confirm');
  expect(unknown).not.toContain('value="2026-03-16"');
  expect(saved.apsSubmissionDate).toBe("2026-03-16");
  expect(saved.priorStudyCompletion).toBe("completed");
  expect(saved.hasExistingApsCertificate).toBe(true);
});
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
