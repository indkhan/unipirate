import {currentPakistanAnswers} from './pakistan-current.fixture';
﻿import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProfileReview } from "../profile-review";
import { CheckFlow } from "../check-flow";
import { buildOptions } from "../check-questions";
import { buildProfile } from "../steps";
import { evaluate } from "@/lib/engine/evaluate";
import { reviewedIndiaStudyRules } from "@/lib/engine/__tests__/india-study.fixture";
import { saudiAnswers } from "./saudi.fixture";
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
    expect(captured.values[1]).toBe(visibleSteps(captured.values[0] as PartialAnswers).indexOf("priorQualificationContext"));
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
  expect(result.answers).toEqual({ qualificationHistoryVersion: 1, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: false });
  expect(result.removeItem).not.toHaveBeenCalled();
});

it("resets malformed country drafts before installing any answers", () => {
  const result = recover(JSON.stringify({ answers: { ...draft, priorStudyCountry: 123 }, stepIndex: 99 }));
  expect(result.answers).toEqual({ qualificationHistoryVersion: 1, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, certificateCountry: "sa" });
  expect(result.stepIndex).toBe(0);
  expect(result.removeItem).toHaveBeenCalledOnce();
});

it("resets wrong-shaped storage and invalid step indices but keeps valid partial drafts", () => {
  for (const saved of [null, [], { answers: null }, { answers: [] }, { answers: draft, stepIndex: "bad" }, { answers: draft, stepIndex: -1 }]) {
    const result = recover(JSON.stringify(saved));
    expect(result.answers).toEqual({ qualificationHistoryVersion: 1, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, certificateCountry: "sa" });
    expect(result.stepIndex).toBe(0);
    expect(result.removeItem).toHaveBeenCalledOnce();
  }
  const incomplete = recover(JSON.stringify({ answers: { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk" }, stepIndex: 99 }));
  expect(incomplete.answers).toEqual({ qualificationHistoryVersion: 1, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2, targetDegree: "master", nationality: "pk" });
  expect(incomplete.stepIndex).toBe(visibleSteps(incomplete.answers as PartialAnswers).indexOf("hasPriorUniversityStudy"));
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
  expect(recover(JSON.stringify({ answers: legacy, stepIndex: 0 })).answers).toEqual({ ...legacy, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2 });
  captured.initial = [];
  renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: legacy }));
  expect(captured.initial[0]).toEqual({ ...legacy, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2 });
});

it("keeps an unfinished text draft and stops at its empty required answer", () => {
  const unfinished = { ...draft, priorStudyInstitution: "" };
  const result = recover(JSON.stringify({ answers: unfinished, stepIndex: 99 }));
  expect(result.answers).toEqual({ ...unfinished, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, indiaStudyRouteVersion: 1, jeeVersion: 2 });
  expect(result.stepIndex).toBe(visibleSteps(result.answers as PartialAnswers).indexOf("priorStudyInstitution"));
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

it("restores Saudi edits at the new explicit subtype without guessing or dropping saved history", () => {
  const saved = { ...saudiAnswers, saudiCertificateVersion: undefined, saudiCertificateSubtype: undefined };
  const restored = recover(JSON.stringify({ answers: saved, stepIndex: 99 }));
  expect(restored.answers).toMatchObject({ saudiCertificateVersion: 2, priorStudyInstitution: saved.priorStudyInstitution, priorStudyRecognitionReference: saved.priorStudyRecognitionReference });
  expect(restored.answers).not.toHaveProperty("saudiCertificateSubtype");
  expect(restored.stepIndex).toBe(visibleSteps(restored.answers as PartialAnswers).indexOf("saudiCertificateSubtype"));
  expect(restored.removeItem).not.toHaveBeenCalled();
  expect(saved.saudiCertificateVersion).toBeUndefined();
});

it("restores a Saudi-to-India issuer edit with visible core history and missing assessment", () => {
  const edited = withAnswer(withAnswer({ ...saudiAnswers, board: "cbse", schoolGradePercent: 70, jeeAdvanced: false }, "schoolQualificationCountry", "in"), "schoolQualificationContext", "national");
  const result = recover(JSON.stringify({ answers: { ...edited, board: "cbse", schoolGradePercent: 70, jeeSchoolCertificate: "unknown", jeeMainStatus: "no_result", jeeAdvancedStatus: "no_result", hasExistingApsCertificate: false }, stepIndex: 99 }));
  const a = result.answers as PartialAnswers;
  expect(result.removeItem).not.toHaveBeenCalled();
  expect(visibleSteps(a)).toContain("hasPriorUniversityStudy");
  expect(visibleSteps(a)).toContain("priorStudyInstitution");
  expect(visibleSteps(a)).toContain("yearsOfUniversityStudy");
  expect(a.priorStudyInstitution).toBe(saudiAnswers.priorStudyInstitution);
  expect(a.priorStudyRecognitionReference).toBeUndefined();
  expect(a.priorStudyMode).toBeUndefined();
  expect(result.stepIndex).toBe(visibleSteps(a).indexOf("priorStudyMode"));
  for (const key of ["schoolQualificationCountry", "schoolQualificationContext", "board", "schoolGradePercent"]) expect(visibleSteps(a).filter(s => s === key)).toHaveLength(1);
});
it("restores India-to-Saudi at missing subtype then exposes core history after explicit choice", () => {
  const edited = withAnswer(withAnswer(indiaAnswers, "schoolQualificationCountry", "sa"), "schoolQualificationContext", "national");
  const result = recover(JSON.stringify({ answers: edited, stepIndex: 99 }), "in");
  const a = result.answers as PartialAnswers;
  expect(result.removeItem).not.toHaveBeenCalled();
  expect(result.stepIndex).toBe(visibleSteps(a).indexOf("saudiCertificateSubtype"));
  expect(visibleSteps(a)).not.toContain("hasPriorUniversityStudy");
  const chosen = withAnswer(a, "saudiCertificateSubtype", "industrial_certificate");
  expect(visibleSteps(chosen)).toContain("hasPriorUniversityStudy");
  expect(chosen.priorStudyRecognitionReference).toBeUndefined();
});
it("does not restore stale foreign degree detail through a missing Saudi subtype", () => {
  const saved = { ...indiaAnswers, certificateCountry: "sa", saudiCertificateVersion: 1, hasPriorUniversityStudy: false };
  const result = recover(JSON.stringify({ answers: saved, stepIndex: 99 }));
  expect(result.removeItem).not.toHaveBeenCalled();
  expect(result.answers).not.toHaveProperty("priorStudyInstitution");
  expect(result.answers).not.toHaveProperty("priorStudyRecognitionReference");
});
it('upgrades saved Pakistan drafts and stops at the exact certificate without aliasing FSc',()=>{
 const saved={qualificationHistoryVersion:1,targetDegree:'bachelor',nationality:'pk',certificateCountry:'pk',visaApplicationCountry:'pk',curriculumType:'national',board:'fsc',schoolGradePercent:78,schoolQualificationCountry:'pk',schoolQualificationContext:'national',hasPriorUniversityStudy:false,targetField:'cs',intake:null,apsApplicationContext:'unknown'};
 const restored=recover(JSON.stringify({answers:saved,stepIndex:99}),'pk');const a=restored.answers as PartialAnswers;
 expect(a.pakistanVersion).toBe(1);expect(a.pkCertificate).toBeUndefined();expect(a.board).toBeUndefined();expect(restored.stepIndex).toBe(visibleSteps(a).indexOf('pkCertificate'));expect(restored.removeItem).not.toHaveBeenCalled();
});
it('Pakistan account edits upgrade legacy records and require explicit certificate/group evidence',()=>{
 captured.initial=[];renderToStaticMarkup(React.createElement(ProfileReview,{initialAnswers:{qualificationHistoryVersion:1,targetDegree:'bachelor',nationality:'pk',certificateCountry:'pk',curriculumType:'national',board:'fsc'}}));expect(captured.initial[0]).toMatchObject({pakistanVersion:1});expect(captured.initial[0]).not.toHaveProperty('pkCertificate');
});

it('upgrades unversioned Pakistan drafts into required history without retaining legacy board',()=>{const restored=recover(JSON.stringify({answers:{targetDegree:'bachelor',certificateCountry:'pk',nationality:'pk',visaApplicationCountry:'pk',curriculumType:'national',board:'fsc',schoolGradePercent:78,targetField:'cs',intake:null},stepIndex:99}),'pk');expect(restored.answers).toMatchObject({pakistanVersion:1,qualificationHistoryVersion:1});expect(restored.answers).not.toHaveProperty('board');});


it.each(['pk','in'] as const)('restores %s landing with opposite actual issuer and unique reachable evidence', country=>{
 const actual=country==='pk'?'in':'pk';
 const saved={...indiaAnswers,pakistanVersion:1,certificateCountry:country,schoolQualificationCountry:actual,board:'cbse',pkCertificate:'hssc',pkGroup:'science',pkSchoolCompletion:'completed_12_grades',pkTargetFamily:'technology',pkTargetFamilyReference:'Programme source'} as const;
 const restored=recover(JSON.stringify({answers:saved,stepIndex:99}),country);const answers=restored.answers as PartialAnswers;
 const steps=visibleSteps(answers);expect(new Set(steps).size).toBe(steps.length);
 expect(steps).toContain(actual==='in'?'board':'pkCertificate');
 expect(answers).not.toHaveProperty(actual==='in'?'pkGroup':'board');
 captured.initial=[];renderToStaticMarkup(React.createElement(ProfileReview,{initialAnswers:saved}));
 expect(visibleSteps(captured.initial[0] as PartialAnswers)).toEqual(steps);
 expect(saved.board).toBe('cbse');
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

it("restores Saudi v2 actual India issuer with selectable Indian boards before any board answer", () => {
 const edited = withAnswer(withAnswer(saudiAnswers, "schoolQualificationCountry", "in"), "schoolQualificationContext", "national");
 const recovered = recover(JSON.stringify({ answers: edited, stepIndex: 99 }));
 const answers = recovered.answers as PartialAnswers;
 expect(recovered.removeItem).not.toHaveBeenCalled(); expect(answers.saudiCertificateVersion).toBe(2); expect(answers.board).toBeUndefined();
 expect(recovered.stepIndex).toBe(visibleSteps(answers).indexOf("board"));
 expect(buildOptions("board", answers).map(o => o.value)).toEqual(expect.arrayContaining(["cbse", "cisce", "state_board"]));
 const html = renderToStaticMarkup(<CheckFlow initialAnswers={answers} initialStepIndex={recovered.stepIndex as number} />);
 expect(html).toContain("CBSE"); expect(html).not.toContain("Tawjihiyah");
});
it('restores old Pakistan study reports without inventing current assessment evidence',()=>{
 const saved={...currentPakistanAnswers,pkStudyEvidenceVersion:undefined,pkCurrentAssessment:undefined,pkCurrentAssessmentReference:undefined};
 const restored=recover(JSON.stringify({answers:saved,stepIndex:99}),'pk');const answers=restored.answers as PartialAnswers;
 expect(answers.pkStudyEvidenceVersion).toBe(2);expect(answers.pkCurrentAssessment).toBeUndefined();expect(restored.stepIndex).toBe(visibleSteps(answers).indexOf('pkCurrentAssessment'));expect(AnswersSchema.safeParse(answers).success).toBe(false);
});
it('fresh current Pakistan study flow reaches assessment after first intake and completes actual direct mapping',()=>{
 let answers:PartialAnswers={qualificationHistoryVersion:1,apsScopeVersion:1,indiaStudyRouteVersion:1};
 for(let i=0;i<visibleSteps(answers).length;i++){const step=visibleSteps(answers)[i];if(!isAnswered(answers,step))answers=withAnswer(answers,step,currentPakistanAnswers[step as keyof typeof currentPakistanAnswers] as Answers[typeof step]);}
 expect(AnswersSchema.safeParse(answers).success).toBe(true);expect(answers.pkSuccessfulYearsReference).toBe(currentPakistanAnswers.pkSuccessfulYearsReference);expect(buildProfile(AnswersSchema.parse(answers)).qualificationHistory?.pakistanStudy?.assessment).toBe('reported_current_support');
});

it('new/current Pakistan flow and profile edits show orientation and the official link without blanket denial',()=>{
 const initialStepIndex=visibleSteps(currentPakistanAnswers).indexOf('pkCurrentAssessment');
 for(const html of [renderToStaticMarkup(<CheckFlow initialAnswers={currentPakistanAnswers} initialStepIndex={initialStepIndex}/>),renderToStaticMarkup(<ProfileReview initialAnswers={currentPakistanAnswers}/>)]){
  expect(html).toContain('bounded one-year subject-restricted');
  expect(html).toContain('regional brochure still says two years');
  expect(html).toContain('institution makes the final decision');
  expect(html).toContain('href="https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang"');
  expect(html).not.toContain('No direct entry is established');
 }
});
