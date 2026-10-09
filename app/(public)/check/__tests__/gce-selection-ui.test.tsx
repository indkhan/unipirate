// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CheckFlow } from "../check-flow";
import { ProfileReview } from "../profile-review";
import { visibleSteps, type PartialAnswers } from "../steps";

// Mock only external I/O; React state, effects, DOM and event dispatch are real.
const posthog = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => posthog }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

const initialAnswers: PartialAnswers = {
  targetDegree: "bachelor", certificateCountry: "sa", nationality: "pk",
  visaApplicationCountry: "pk", curriculumType: "gce", gceVersion: 1,
};
const choices = [
  ["british_international", "British international A-Level qualification"],
  ["uk", "UK GCE qualification"],
  ["national", "Part of a national school-leaving system"],
  ["unknown", "Not sure"],
] as const;
let container: HTMLDivElement;
let root: Root;

function button(name: string, scope: ParentNode = container): HTMLButtonElement {
  const matches = Array.from(scope.querySelectorAll("button")).filter(b => b.textContent === name);
  expect(matches, name).toHaveLength(1);
  return matches[0];
}
async function click(target: HTMLButtonElement) {
  await act(async () => target.click());
}
async function mountChecker() {
  await act(async () => root.render(<CheckFlow initialAnswers={initialAnswers}
    initialStepIndex={visibleSteps(initialAnswers).indexOf("gceQualificationContext")} />));
}
function selected(name: string, scope: ParentNode = container) {
  expect(button(name, scope).getAttribute("aria-pressed")).toBe("true");
  expect(scope.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  window.history.replaceState({}, "", "/check");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it.each(choices)("mounted checker selects %s and retains it through Continue, Back and draft remount", async (value, name) => {
  await mountChecker();
  expect(button("Continue").disabled).toBe(true);
  await click(button(name));
  selected(name);
  expect(button(name).className).toContain("optionSelected");
  expect(button("Continue").disabled).toBe(false);
  expect(JSON.parse(sessionStorage.getItem("unipirate.check.v1:sa")!).answers.gceQualificationContext).toBe(value);

  await click(button("Continue"));
  expect(container.querySelector("h1")?.textContent).toContain("printed on");
  await click(button("‹ Back"));
  // Back uses the browser history API: wait for jsdom's asynchronous popstate.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
  selected(name);
  expect(button("Continue").disabled).toBe(false);

  await act(async () => root.unmount());
  root = createRoot(container);
  await mountChecker(); // A fresh React instance recovers the real session draft.
  selected(name);
  expect(button("Continue").disabled).toBe(false);
});

it("mounted profile restores the saved identity and switches all qualification alternatives", async () => {
  const saved = { ...initialAnswers, gceQualificationContext: "british_international" as const };
  await act(async () => root.render(<ProfileReview initialAnswers={saved} />));
  const field = container.querySelector("#gceQualificationContext-label")!.closest("section")!;
  selected(choices[0][1], field);
  for (const [, name] of [...choices.slice(1), choices[0]]) {
    await click(button(name, field));
    selected(name, field);
    expect(button(name, field).className).toContain("reviewChoiceSelected");
  }
  expect(saved.gceQualificationContext).toBe("british_international");
});
