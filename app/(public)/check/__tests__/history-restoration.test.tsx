import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProfileReview } from "../profile-review";
import { CheckFlow } from "../check-flow";
import { buildProfile } from "../steps";
import { evaluate } from "@/lib/engine/evaluate";
import { reviewedIndiaStudyRules } from "@/lib/engine/__tests__/india-study.fixture";
import { indiaAnswers } from "./india-study.fixture";
import { dmatAnswers } from "./dmat.fixture";
import { AnswersSchema, PartialAnswersSchema, visibleSteps, withAnswer, isAnswered, type Answers, type PartialAnswers } from "../steps";

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

function recover(raw: string, country = "sa") {
  captured.effects = [];
  captured.values = [];
  const removeItem = vi.fn();
  vi.stubGlobal("sessionStorage", { getItem: vi.fn(() => raw), removeItem });
  vi.stubGlobal("window", { history: { state: {}, replaceState: vi.fn() }, location: { href: "http://localhost/check" } });
  vi.stubGlobal("queueMicrotask", (callback: () => void) => callback());
  try {
    renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: { certificateCountry: country } }));
    captured.effects[1]();
    return { answers: captured.values[0], stepIndex: captured.values[1], removeItem };
  } finally { vi.unstubAllGlobals(); }
}

const draft = { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: true, priorQualificationType: "bachelor", priorStudyInstitution: "Saved University", priorStudyCountry: "in", priorQualificationContext: "national", priorStudyField: "Saved field", priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed", hasExistingApsCertificate: true } as const;
it("restores the new dMAT version and stops at its first newly missing question", () => {
  const legacyDraft = Object.fromEntries(Object.entries(dmatAnswers).filter(([key]) => !key.startsWith("dmat")));
  const result = recover(JSON.stringify({ answers: legacyDraft, stepIndex: 99 }));
  expect(result.answers).toMatchObject({ dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, priorStudyCountry: "in", priorStudyField: "Mechanical Engineering" });
  expect(result.stepIndex).toBe(visibleSteps({ ...dmatAnswers, dmatQualificationScope: undefined }).indexOf("dmatQualificationScope"));
  expect(legacyDraft).not.toHaveProperty("dmatVersion");
});

it("restores no-prior-study answers without hidden degree or APS data", () => {
  const result = recover(JSON.stringify({ answers: { ...draft, hasPriorUniversityStudy: false }, stepIndex: 99 }));
  expect(result.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: false });
  expect(result.removeItem).not.toHaveBeenCalled();
});

it("resets malformed country drafts before installing any answers", () => {
  const result = recover(JSON.stringify({ answers: { ...draft, priorStudyCountry: 123 }, stepIndex: 99 }));
  expect(result.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, certificateCountry: "sa" });
  expect(result.stepIndex).toBe(0);
  expect(result.removeItem).toHaveBeenCalledOnce();
});

it("resets wrong-shaped storage and invalid step indices but keeps valid partial drafts", () => {
  for (const saved of [null, [], { answers: null }, { answers: [] }, { answers: draft, stepIndex: "bad" }, { answers: draft, stepIndex: -1 }]) {
    const result = recover(JSON.stringify(saved));
    expect(result.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, certificateCountry: "sa" });
    expect(result.stepIndex).toBe(0);
    expect(result.removeItem).toHaveBeenCalledOnce();
  }
  const incomplete = recover(JSON.stringify({ answers: { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk" }, stepIndex: 99 }));
  expect(incomplete.answers).toEqual({ qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, targetDegree: "master", nationality: "pk" });
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
  expect(recover(JSON.stringify({ answers: legacy, stepIndex: 0 })).answers).toEqual({ ...legacy, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2 });
  captured.initial = [];
  renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: legacy }));
  expect(captured.initial[0]).toEqual({ ...legacy, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2 });
});

it("keeps an unfinished text draft and stops at its empty required answer", () => {
  const unfinished = { ...draft, priorStudyInstitution: "" };
  const result = recover(JSON.stringify({ answers: unfinished, stepIndex: 99 }));
  expect(result.answers).toEqual({ ...unfinished, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2 });
  expect(result.stepIndex).toBe(5);
  expect(result.removeItem).not.toHaveBeenCalled();
});

it.each([6.5, -1, 101, undefined, 0, 6, 100])("restores semester draft %s without discarding history or enabling invalid results", dmatCompletedSemesters => {
  const seed = { ...dmatAnswers, priorStudyCompletion: "in_progress", yearsOfUniversityStudy: 3,
    dmatProcedure: "unknown", dmatFieldBasis: "unknown", dmatPartnershipStatus: "none",
    dmatSemesterStatus: "known", dmatCompletedSemesters } as const;
  const stepIndex = visibleSteps(seed).indexOf("dmatCompletedSemesters");
  const raw = JSON.stringify({ answers: seed, stepIndex });
  const result = recover(raw);
  const restored = result.answers as PartialAnswers;
  expect(restored).toMatchObject({ priorStudyInstitution: "Example University", priorStudyCountry: "in",
    priorStudyField: "Mechanical Engineering", priorStudyCompletion: "in_progress", yearsOfUniversityStudy: 3,
    dmatProcedure: "unknown", dmatFieldBasis: "unknown", dmatPartnershipStatus: "none", dmatSemesterStatus: "known" });
  expect(restored.dmatCompletedSemesters).toBe(dmatCompletedSemesters);
  expect(result.stepIndex).toBe(stepIndex);
  expect(result.removeItem).not.toHaveBeenCalled();
  expect(PartialAnswersSchema.safeParse(JSON.parse(raw).answers).success).toBe(true);
  const valid = dmatCompletedSemesters !== undefined && Number.isInteger(dmatCompletedSemesters) &&
    dmatCompletedSemesters >= 0 && dmatCompletedSemesters <= 100;
  expect(AnswersSchema.safeParse(restored).success).toBe(valid);
  const html = renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: restored, initialStepIndex: stepIndex }));
  expect(html).toContain("See my result");
  expect(html.includes('disabled=""')).toBe(!valid);
  expect(html.includes('aria-invalid="true"')).toBe(!valid && dmatCompletedSemesters !== undefined);
});

it('restores finite unfinished Indian successful-years and assessment drafts without losing history',()=>{
 for(const yearsOfUniversityStudy of [-1,50.1]) {const input={...indiaAnswers,yearsOfUniversityStudy};const restored=recover(JSON.stringify({answers:input,stepIndex:99}), "in");expect(restored.answers).toMatchObject({priorStudyInstitution:input.priorStudyInstitution,yearsOfUniversityStudy});expect(restored.removeItem).not.toHaveBeenCalled();expect(restored.stepIndex).toBe(visibleSteps(input).indexOf('yearsOfUniversityStudy'));expect(AnswersSchema.safeParse(input).success).toBe(false);}
 const empty={...indiaAnswers,priorStudyRecognitionReference:''};const restored=recover(JSON.stringify({answers:empty,stepIndex:99}), "in");expect(restored.removeItem).not.toHaveBeenCalled();expect(restored.answers).toMatchObject({priorStudyRecognitionReference:'',priorStudyInstitution:empty.priorStudyInstitution});expect(restored.stepIndex).toBe(visibleSteps(empty).indexOf('priorStudyRecognitionReference'));
});
it('upgrades a saved India history and reaches missing assessments rather than skipping them',()=>{
 const saved=Object.fromEntries(Object.entries(indiaAnswers).filter(([key])=>key!=='indiaStudyRouteVersion'&&!['priorStudyMode','priorStudyRecognition','priorStudyRecognitionReference','priorStudyTargetRelation','priorStudyTargetRelationReference'].includes(key)));
 const restored=recover(JSON.stringify({answers:saved,stepIndex:99}), "in");expect(restored.answers).toMatchObject({indiaStudyRouteVersion:1,priorStudyInstitution:indiaAnswers.priorStudyInstitution});expect(restored.stepIndex).toBe(visibleSteps(indiaAnswers).indexOf('priorStudyMode'));expect(restored.removeItem).not.toHaveBeenCalled();
});

it("restores an academic edit at its missing assessment and completes with fresh APS timing", () => {
  const edited = withAnswer({ ...indiaAnswers, apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14" }, "priorStudyMode", "distance_online");
  const recovered = recover(JSON.stringify({ answers: edited, stepIndex: 99 }), "in");
  let answers = recovered.answers as PartialAnswers;
  expect(recovered.removeItem).not.toHaveBeenCalled();
  expect(answers.apsProcedureStatus).toBeUndefined();
  expect(recovered.stepIndex).toBe(visibleSteps(answers).indexOf("priorStudyRecognition"));
  for (let index = recovered.stepIndex as number; index < visibleSteps(answers).length; index++) {
    const step = visibleSteps(answers)[index];
    if (!isAnswered(answers, step)) answers = withAnswer(answers, step, indiaAnswers[step as keyof typeof indiaAnswers] as Answers[typeof step]);
  }
  expect(AnswersSchema.safeParse(answers).success).toBe(true);
  expect(answers.apsProcedureStatus).toBe("unknown");
  expect(answers.apsSubmissionDate).toBeUndefined();
  expect(answers.priorStudyMode).toBe("distance_online");
});

it("restores an issuer edit and retains only its diagnostic marker across validated mapping", () => {
  const edited = withAnswer({ ...indiaAnswers, apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14" }, "schoolQualificationCountry", "unknown");
  const restored = recover(JSON.stringify({ answers: edited, stepIndex: 99 }), "in");
  let answers = restored.answers as PartialAnswers;
  expect(restored.removeItem).not.toHaveBeenCalled();
  expect(answers.priorStudyRecognitionReference).toBeUndefined();
  expect(answers.apsSubmissionDate).toBeUndefined();
  for (let index = restored.stepIndex as number; index < visibleSteps(answers).length; index++) {
    const step = visibleSteps(answers)[index];
    if (!isAnswered(answers, step)) answers = withAnswer(answers, step, indiaAnswers[step as keyof typeof indiaAnswers] as Answers[typeof step]);
  }
  const profile = buildProfile(AnswersSchema.parse(answers));
  const result = evaluate(profile, reviewedIndiaStudyRules());
  expect(result.path).toBe("unknown");
  expect(result.unknowns.some(note => /issuer/i.test(note))).toBe(true);
  expect(profile.qualificationHistory?.indiaStudyRouteVersion).toBe(1);
  expect(profile.qualificationHistory).not.toHaveProperty("priorStudyMode");
  expect(profile.qualificationHistory).not.toHaveProperty("priorStudyRecognition");
  expect(profile.qualificationHistory).not.toHaveProperty("priorStudyTargetRelation");
  expect(profile.apsProcedure).toBeUndefined();
});


it("restores legacy JEE drafts at Main without inventing passage or losing university history", () => {
  const legacy = { ...indiaAnswers, jeeVersion: undefined, jeeMainStatus: undefined,
    jeeAdvancedStatus: undefined, jeeEvidenceContext: undefined, jeeAdvanced: true };
  const result = recover(JSON.stringify({ answers: legacy, stepIndex: 99 }), "in");
  const restored = result.answers as PartialAnswers;
  expect(restored).toMatchObject({ jeeVersion: 2, priorStudyInstitution: indiaAnswers.priorStudyInstitution });
  expect(restored.jeeMainStatus).toBeUndefined();
  expect(restored.jeeAdvancedStatus).toBeUndefined();
  expect(result.stepIndex).toBe(visibleSteps(restored).indexOf("jeeMainStatus"));
  expect(buildProfile(restored as Answers).jeeAdvanced).toBeUndefined();
  expect(result.removeItem).not.toHaveBeenCalled();
});

it("restores uncertain JEE passage at its missing evidence-context question", () => {
  const saved = { ...indiaAnswers, jeeVersion: 1, jeeMainStatus: "unknown", jeeAdvancedStatus: "passed" };
  const result = recover(JSON.stringify({ answers: saved, stepIndex: 99 }), "in");
  const restored = result.answers as PartialAnswers;
  expect(restored).toMatchObject({ jeeMainStatus: "unknown", jeeAdvancedStatus: "passed" });
  expect(result.stepIndex).toBe(visibleSteps(restored).indexOf("jeeEvidenceContext"));
});


it("renders separate sourced JEE questions and exception choices in account editing", () => {
  const answers = { ...indiaAnswers, jeeMainStatus: "passed", jeeAdvancedStatus: "passed", jeeEvidenceContext: "main_exemption" } as const;
  const html = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: answers }));
  expect(html).toContain("Have you successfully passed JEE Main?");
  expect(html).toContain("Have you successfully qualified in JEE Advanced?");
  expect(html).toContain("https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/");
  expect(html).toContain("Preparatory-course rank only or unclear rank type");
  expect(html).toContain("Main exemption / direct foreign-entry exception");
  expect(html).toContain("Cannot confirm qualifying passage");
});
