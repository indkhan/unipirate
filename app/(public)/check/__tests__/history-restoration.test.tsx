import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProfileReview } from "../profile-review";
import { CheckFlow } from "../check-flow";
import { dmatAnswers } from "./dmat.fixture";
import { visibleSteps } from "../steps";

const captured = vi.hoisted(() => ({ effects: [] as (() => void)[], values: [] as unknown[], initial: [] as unknown[] }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useEffect: (effect: () => void) => { captured.effects.push(effect); },
    useState: <T,>(initial: T) => {
      const [value] = react.useState(initial);
      captured.initial.push(value);
      return [value, (next: unknown) => captured.values.push(next)];
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

it("restores a master's saved edits under its landing-country key and stops at newly missing answers", () => {
  const saved = { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Saved University", priorStudyCountry: "in", priorStudyField: "Saved field", priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed", hasExistingApsCertificate: false };
  captured.effects = [];
  captured.values = [];
  vi.stubGlobal("sessionStorage", { getItem: vi.fn(() => JSON.stringify({ answers: saved, stepIndex: 99 })), removeItem: vi.fn() });
  vi.stubGlobal("window", { history: { state: {}, replaceState: vi.fn() }, location: { href: "http://localhost/check?country=sa" } });
  vi.stubGlobal("queueMicrotask", (callback: () => void) => callback());
  try {
    renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: { certificateCountry: "sa" } }));
    captured.effects[1]();
    expect(captured.values[0]).toMatchObject({ priorStudyInstitution: "Saved University", priorStudyField: "Saved field", priorStudyCountry: "in" });
    // The newly required context question precedes the already-answered final intake.
    expect(captured.values[1]).toBe(7);
  } finally { vi.unstubAllGlobals(); }
});

function recover(raw: string) {
  captured.effects = [];
  captured.values = [];
  const removeItem = vi.fn();
  vi.stubGlobal("sessionStorage", { getItem: vi.fn(() => raw), removeItem });
  vi.stubGlobal("window", { history: { state: {}, replaceState: vi.fn() }, location: { href: "http://localhost/check" } });
  vi.stubGlobal("queueMicrotask", (callback: () => void) => callback());
  try {
    renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: { certificateCountry: "sa" } }));
    captured.effects[1]();
    return { answers: captured.values[0], stepIndex: captured.values[1], removeItem };
  } finally { vi.unstubAllGlobals(); }
}

const draft = { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Saved University", priorStudyCountry: "in", priorQualificationContext: "national", priorStudyField: "Saved field", priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed", hasExistingApsCertificate: true } as const;
it("restores the new dMAT version and stops at its first newly missing question", () => {
  const legacyDraft = Object.fromEntries(Object.entries(dmatAnswers).filter(([key]) => !key.startsWith("dmat")));
  const result = recover(JSON.stringify({ answers: legacyDraft, stepIndex: 99 }));
  expect(result.answers).toMatchObject({ dmatVersion: 1, priorStudyCountry: "in", priorStudyField: "Mechanical Engineering" });
  expect(result.stepIndex).toBe(visibleSteps({ ...dmatAnswers, dmatQualificationScope: undefined }).indexOf("dmatQualificationScope"));
  expect(legacyDraft).not.toHaveProperty("dmatVersion");
});

it("restores no-prior-study answers without hidden degree or APS data", () => {
  const result = recover(JSON.stringify({ answers: { ...draft, hasPriorUniversityStudy: false }, stepIndex: 99 }));
  expect(result.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: false });
  expect(result.removeItem).not.toHaveBeenCalled();
});

it("resets malformed country drafts before installing any answers", () => {
  const result = recover(JSON.stringify({ answers: { ...draft, priorStudyCountry: 123 }, stepIndex: 99 }));
  expect(result.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, certificateCountry: "sa" });
  expect(result.stepIndex).toBe(0);
  expect(result.removeItem).toHaveBeenCalledOnce();
});

it("resets wrong-shaped storage and invalid step indices but keeps valid partial drafts", () => {
  for (const saved of [null, [], { answers: null }, { answers: [] }, { answers: draft, stepIndex: "bad" }, { answers: draft, stepIndex: -1 }]) {
    const result = recover(JSON.stringify(saved));
    expect(result.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, certificateCountry: "sa" });
    expect(result.stepIndex).toBe(0);
    expect(result.removeItem).toHaveBeenCalledOnce();
  }
  const incomplete = recover(JSON.stringify({ answers: { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk" }, stepIndex: 99 }));
  expect(incomplete.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, targetDegree: "master", nationality: "pk" });
  expect(incomplete.stepIndex).toBe(2);
  expect(incomplete.removeItem).not.toHaveBeenCalled();
});

it("normalizes account editing before initializing state without mutating stored answers", () => {
  captured.initial = [];
  const input = { ...draft, hasPriorUniversityStudy: false };
  renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: input }));
  expect(captured.initial[0]).not.toHaveProperty("priorStudyCountry");
  expect(captured.initial[0]).not.toHaveProperty("hasExistingApsCertificate");
  expect(input.priorStudyCountry).toBe("in");
});

it("preserves valid unversioned school answers on restoration and account initialization", () => {
  const legacy = { targetDegree: "master", nationality: "in", certificateCountry: "sa", curriculumType: "national", visaApplicationCountry: "in", targetField: "cs", intake: null } as const;
  expect(recover(JSON.stringify({ answers: legacy, stepIndex: 0 })).answers).toEqual({ ...legacy, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1 });
  captured.initial = [];
  renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: legacy }));
  expect(captured.initial[0]).toEqual({ ...legacy, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1 });
});

it("keeps an unfinished text draft and stops at its empty required answer", () => {
  const unfinished = { ...draft, priorStudyInstitution: "" };
  const result = recover(JSON.stringify({ answers: unfinished, stepIndex: 99 }));
  expect(result.answers).toEqual({ ...unfinished, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1 });
  expect(result.stepIndex).toBe(5);
  expect(result.removeItem).not.toHaveBeenCalled();
});
