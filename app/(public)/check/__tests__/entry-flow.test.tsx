// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckFlow } from "../check-flow";
import { visibleSteps, type PartialAnswers } from "../steps";
import { checkerEntry, nextEntryStep, restoredStepIndex } from "../entry";

const posthog = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => posthog }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));
let root: Root;
let container: HTMLDivElement;
function button(name: string) {
  const matches = [...container.querySelectorAll("button")].filter(b => b.textContent === name);
  expect(matches, name).toHaveLength(1);
  return matches[0];
}
async function click(name: string) {
  await act(async () => { button(name).click(); await new Promise(r => setTimeout(r, 25)); });
}
async function mount(initialAnswers: PartialAnswers = {}, entryDegree?: "bachelor" | "master") {
  await act(async () => root.render(<CheckFlow initialAnswers={initialAnswers} entryDegree={entryDegree} />));
}
async function remount(initialAnswers: PartialAnswers = {}) {
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount(initialAnswers);
}
function question() { return container.querySelector("h1")?.textContent; }
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear(); window.history.replaceState({}, "", "/check");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it("starts the selected Bachelor at country, then qualification, and Back edits both entry answers", async () => {
  await mount({ targetDegree: "bachelor" });
  expect(question()).toBe("Where did you attend school?");
  await click("Saudi Arabia"); await click("Continue");
  expect(question()).toBe("Which curriculum did you study?");
  await click("‹ Back"); expect(question()).toBe("Where did you attend school?");
  await click("India"); await click("‹ Back");
  expect(question()).toBe("Which degree level are you applying for?");
  await click("Continue"); expect(question()).toBe("Which curriculum did you study?");
  await remount({ targetDegree: "bachelor" });
  expect(question()).toBe("Which curriculum did you study?");
  await click("‹ Back"); expect(button("India").getAttribute("aria-pressed")).toBe("true");
});

it.each(["national", "gce", "ib"] as const)("reuses a country entry once for Bachelor %s without inferring issuer", async curriculumType => {
  await mount({ certificateCountry: "sa" });
  expect(question()).toBe("Which degree level are you applying for?");
  await click("A Bachelor's degree"); await click("Continue");
  expect(question()).toBe("Which curriculum did you study?");
  const label = { national: "National board (CBSE, FSc, Tawjihiyah …)", gce: "GCE A-Levels", ib: "IB Diploma" }[curriculumType];
  await click(label); await click("Continue");
  const stored = JSON.parse(sessionStorage.getItem("unipirate.check.v1:sa")!).answers;
  expect(stored).toMatchObject({ targetDegree: "bachelor", certificateCountry: "sa", curriculumType });
  expect(stored.schoolQualificationCountry).toBeUndefined();
  expect(question()).not.toBe("Where did you attend school?");
  await remount({ certificateCountry: "sa" });
  expect(question()).not.toBe("Which degree level are you applying for?");
});

it("starts Master at university history and prunes school answers when switching degree across refresh", async () => {
  const initial: PartialAnswers = { targetDegree: "bachelor", certificateCountry: "sa", curriculumType: "gce", gceAwardingBody: "caie", gceSchoolYears: 13 };
  await mount(initial); await click("‹ Back"); await click("‹ Back");
  expect(question()).toBe("Which degree level are you applying for?");
  await click("A Master's degree"); await click("Continue");
  expect(question()).toBe("Have you studied at a university or other higher education institution?");
  await remount(initial);
  expect(question()).toBe("Have you studied at a university or other higher education institution?");
  const stored = JSON.parse(sessionStorage.getItem("unipirate.check.v1:sa")!).answers;
  expect(stored.targetDegree).toBe("master");
  for (const key of ["certificateCountry", "curriculumType", "gceAwardingBody", "gceSchoolYears"]) expect(stored[key]).toBeUndefined();
  expect(initial.gceSchoolYears).toBe(13);
  await click("‹ Back"); await click("A Bachelor's degree"); await click("Continue");
  expect(question()).toBe("Where did you attend school?");
});

it("puts academic entry before nationality and visa and never adds school questions to Master", () => {
  expect(visibleSteps({ targetDegree: "bachelor" }).slice(0, 3)).toEqual(["targetDegree", "certificateCountry", "curriculumType"]);
  const master = visibleSteps({ targetDegree: "master" });
  expect(master.slice(0, 2)).toEqual(["targetDegree", "hasPriorUniversityStudy"]);
  for (const step of ["certificateCountry", "curriculumType", "gceSchoolYears", "ibSchoolYears", "schoolQualificationCountry"]) expect(master).not.toContain(step);
});

it("restores an edited country under the original country entry key", async () => {
  const initial = { certificateCountry: "sa" };
  await mount(initial); await click("A Bachelor's degree"); await click("Continue");
  await click("‹ Back"); await click("India"); await click("Continue");
  await remount(initial);
  expect(question()).toBe("Which curriculum did you study?");
  await click("‹ Back"); expect(button("India").getAttribute("aria-pressed")).toBe("true");
});

it("browser history after a degree switch stops at missing new-branch evidence", async () => {
  await mount({ targetDegree: "master" });
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate", { state: { __unipirateCheckStep: 99 } })));
  expect(question()).toBe("Have you studied at a university or other higher education institution?");
});

it("validates entry hints independently and never turns school location into a Master's issuer", () => {
  expect(checkerEntry({ degree: "bachelor", country: "sa" })).toEqual({ targetDegree: "bachelor", certificateCountry: "sa" });
  expect(checkerEntry({ degree: "master", country: "sa" })).toEqual({ targetDegree: "master" });
  expect(checkerEntry({ degree: "doctorate", country: ["sa"] })).toEqual({});
  expect(checkerEntry({ country: "in" })).toEqual({ certificateCountry: "in" });
  expect(nextEntryStep({ targetDegree: "bachelor", certificateCountry: "sa" })).toBe(2);
  const draft: PartialAnswers = { targetDegree: "bachelor", certificateCountry: "sa", curriculumType: "gce", gceQualificationContext: "uk" };
  expect(restoredStepIndex(draft, 1, "gceQualificationType")).toBe(visibleSteps(draft).indexOf("gceQualificationType"));
  expect(restoredStepIndex(draft, 99, "not-a-step")).toBe(visibleSteps(draft).indexOf("gceQualificationType"));
});

it("degree links isolate drafts and retain an edited degree under the original entry key", async () => {
  sessionStorage.setItem("unipirate.check.v1:none:bachelor", JSON.stringify({ answers: { targetDegree: "bachelor", certificateCountry: "sa", curriculumType: "gce" }, stepIndex: 3 }));
  await mount({ targetDegree: "master" }, "master");
  expect(question()).toBe("Have you studied at a university or other higher education institution?");
  await click("‹ Back"); await click("A Bachelor's degree"); await click("Continue");
  expect(question()).toBe("Where did you attend school?");
  await act(async () => root.unmount()); root = createRoot(container);
  await mount({ targetDegree: "master" }, "master");
  expect(question()).toBe("Where did you attend school?");
  expect(JSON.parse(sessionStorage.getItem("unipirate.check.v1:none:bachelor")!).answers.curriculumType).toBe("gce");
});
