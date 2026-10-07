import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckFlow } from "../check-flow";
import { ProfileReview } from "../profile-review";
import { visibleSteps, upgradeSaudiAnswers } from "../steps";
import { saudiAnswers } from "./saudi.fixture";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));
describe("Saudi forms", () => {
 it("requires explicit subtype when editing a legacy Saudi certificate, without changing stored input", () => {
  const legacy = { ...saudiAnswers, saudiCertificateVersion: undefined, saudiCertificateSubtype: undefined };
  const review = renderToStaticMarkup(<ProfileReview initialAnswers={legacy} />);
  expect(review).toContain("Which exact Saudi school certificate do you have?"); expect(review).toContain('disabled=""');
  expect(review).not.toContain("Class 12 result"); expect(legacy.saudiCertificateVersion).toBeUndefined();
  expect(upgradeSaudiAnswers(legacy)).not.toHaveProperty("saudiCertificateSubtype", "private_school");
 });
 it("renders Saudi official source and reported evidence rather than APS guidance", () => {
  const html = renderToStaticMarkup(<CheckFlow initialAnswers={saudiAnswers} initialStepIndex={visibleSteps(saudiAnswers).indexOf("priorStudyRecognition")} />);
  expect(html).toContain("uni-assist.de"); expect(html).not.toContain("aps-india.de");
  expect(html).toContain("does not independently verify");
  const review = renderToStaticMarkup(<ProfileReview initialAnswers={saudiAnswers} />);
  expect(review).toContain("Which official subject assessment covers this private-school certificate?");
 });
});
