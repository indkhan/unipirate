import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckFlow } from "../check-flow";
import { ProfileReview } from "../profile-review";
import { visibleSteps, upgradeSaudiAnswers, withAnswer, isSaudiDegreeBranch, isSaudiStudyBranch, type PartialAnswers } from "../steps";
import { buildOptions, questionFor } from "../check-questions";
import { SAUDI_ANABIN } from "@/lib/engine/saudi";
import { indiaAnswers } from "./india-study.fixture";
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

const indiaIssuer = (a: PartialAnswers) => withAnswer(withAnswer(a, "schoolQualificationCountry", "in"), "schoolQualificationContext", "national");
it.each([1, 2] as const)("offers actual Indian boards on a Saudi version %s issuer edit", version => {
 const answers = indiaIssuer({ ...saudiAnswers, saudiCertificateVersion: version });
 const options = buildOptions("board", answers).map(o => o.value);
 expect(options).toEqual(expect.arrayContaining(["cbse", "cisce", "state_board"]));
 expect(options).not.toContain("tawjihiyah"); expect(options).not.toContain("private_school");
});
it("offers selectable CBSE in fresh and edited Saudi v2 India flows without a prefilled board", () => {
 for (const initial of [{ targetDegree: "bachelor", certificateCountry: "sa", curriculumType: "national", saudiCertificateVersion: 2 } as const, saudiAnswers]) {
  const answers = indiaIssuer(initial);
  expect(answers.board).toBeUndefined();
  const html = renderToStaticMarkup(<CheckFlow initialAnswers={answers} initialStepIndex={visibleSteps(answers).indexOf("board")} />);
  expect(html).toContain("CBSE"); expect(html).toContain("CISCE"); expect(html).not.toContain("Tawjihiyah");
  const review = renderToStaticMarkup(<ProfileReview initialAnswers={answers} />);
  const board = review.split('id="board-label"')[1]?.split("</section>")[0];
  expect(board).toContain("CBSE"); expect(board).not.toContain("Tawjihiyah");
 }
});
it("retains Saudi board fallback when legacy answers have no established issuer", () => {
 for (const saudiCertificateVersion of [undefined, 1, 2] as const) {
  expect(buildOptions("board", { certificateCountry: "sa", saudiCertificateVersion }).map(o => o.value)).toContain("tawjihiyah");
 }
});
const completed = { ...saudiAnswers, saudiBachelorVersion: 2, priorStudyCompletion: "completed", yearsOfUniversityStudy: 4, priorQualificationContext: "national", saudiBachelorAssessment: "reported_official_norms_full_time", saudiBachelorAssessmentReference: "Synthetic applicable assessment of this completed qualification and actual norms" } as const;
it.each([{ saudiCertificateSubtype: "unknown" }, { saudiCertificateSubtype: "other" }, { curriculumType: "other" }] as const)("sources independent completed Saudi degree questions for %j", school => {
 const answers = { ...completed, ...school };
 expect(isSaudiDegreeBranch(answers)).toBe(true); expect(isSaudiStudyBranch(answers)).toBe(false);
 for (const step of ["priorStudyMode", "priorStudyRecognition", "priorStudyRecognitionReference"] as const) {
  expect(visibleSteps(answers)).toContain(step);
  const question = questionFor(step, answers);
  expect(question.sourceUrl).toBe(SAUDI_ANABIN);
  expect(question.subtitle).not.toMatch(/APS|Class XII/);
  const html = renderToStaticMarkup(<CheckFlow initialAnswers={answers} initialStepIndex={visibleSteps(answers).indexOf(step)} />);
  expect(html).toContain(SAUDI_ANABIN); expect(html).not.toContain("aps-india.de");
 }
 const review = renderToStaticMarkup(<ProfileReview initialAnswers={answers} />);
 expect(review).toContain(SAUDI_ANABIN); expect(review).not.toContain("aps-india.de");
 expect(questionFor("priorStudyMode", answers).subtitle).toMatch(/generally full.time/);
 expect(questionFor("priorStudyRecognition", answers).subtitle).toContain("not app verification");
 expect(visibleSteps(answers)).not.toContain("priorStudyTargetRelation");
});
it("keeps actual Indian study copy and does not treat incomplete or Master's history as Saudi undergraduate degree", () => {
 expect(questionFor("priorStudyRecognition", indiaAnswers).sourceUrl).toBe("https://aps-india.de/faqs/");
 for (const answers of [{ ...completed, saudiCertificateSubtype: "unknown", priorStudyCompletion: "in_progress" }, { ...completed, saudiCertificateSubtype: "unknown", targetDegree: "master" }, { ...completed, saudiCertificateSubtype: "unknown", priorStudyCountry: "in" }] as const) expect(isSaudiDegreeBranch(answers)).toBe(false);
});
