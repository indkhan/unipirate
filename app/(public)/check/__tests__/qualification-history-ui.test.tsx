import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckFlow } from "../check-flow";
import { ProfileReview } from "../profile-review";
import { visibleSteps } from "../steps";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));
const answers = { targetDegree: "master", nationality: "pk", certificateCountry: "pk", visaApplicationCountry: "sa", targetField: "cs", intake: null, qualificationHistoryVersion: 1, hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Example University", priorStudyCountry: "in", priorQualificationContext: "national", priorStudyField: "Computing", priorDegreeYears: 4, yearsOfUniversityStudy: 2, priorStudyCompletion: "in_progress" } as const;
describe("history UI", () => {
  it("renders editable text history in checker and review", () => {
    const html = renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: answers, initialStepIndex: visibleSteps({ ...answers, apsScopeVersion: 1 }).indexOf("priorStudyInstitution") }));
    expect(html).toContain('value="Example University"');
    expect(html).toContain('type="text"');
    const review = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: answers }));
    expect(review).toContain('value="Example University"');
    expect(review).toContain("In progress");
    expect(review).toContain('step="any"');
    expect(review).not.toContain("Class 12 result");
    expect(review).not.toContain("Curriculum");
  });
  it("renders missing history as required and disables profile submission", () => {
    const review = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: { targetDegree: "master", nationality: "pk", certificateCountry: "pk", visaApplicationCountry: "sa", targetField: "cs", intake: null } }));
    expect(review).toContain("Previous higher education");
    expect(review).toContain("Required");
    expect(review).toContain('disabled=""');
    expect(review).not.toContain("Curriculum");
  });
  it("shows awarding-country choices without a school-country or code prompt for masters", () => {
    const html = renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: answers, initialStepIndex: visibleSteps({ ...answers, apsScopeVersion: 1 }).indexOf("priorStudyCountry") }));
    expect(html).toContain("India");
    expect(html).toContain("Another country");
    expect(html).not.toContain("two-letter");
    const review = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: answers }));
    expect(review).not.toContain("Certificate country");
    expect(review).toContain("Qualification education system");
    const other = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: { ...answers, priorStudyCountry: "other", priorStudyCountryOther: "Canada" } }));
    expect(other).toContain('value="Canada"');
  });
  it("renders a no-history branch without degree inputs", () => {
    const review = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: { ...answers, hasPriorUniversityStudy: false } }));
    expect(review).not.toContain('value="Example University"');
    expect(review).toContain('aria-pressed="true"');
  });
});
