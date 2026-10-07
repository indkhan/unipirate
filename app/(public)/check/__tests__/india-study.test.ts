import { describe, expect, it } from "vitest";
import { AnswersSchema, PartialAnswersSchema, buildProfile, isAnswered, visibleSteps, withAnswer, type PartialAnswers, type StepId, type Answers } from "../steps";
import { deriveFacts, evaluate, EngineRuleSchema } from "@/lib/engine/evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";

import { reviewedIndiaStudyRules } from "@/lib/engine/__tests__/india-study.fixture";
import { indiaAnswers } from "./india-study.fixture";

describe("UP-ELIG-03 checker contract", () => {
  it("maps reported assessments into existing history and enables only semantic facts", () => {
    const p = buildProfile(AnswersSchema.parse(indiaAnswers));
    expect(p.qualificationHistory).toMatchObject({ completedYears: 1, degreeYears: 4, priorStudyMode: "regular" });
    expect(deriveFacts(p)).toMatchObject({ in_class12_prior_study_kind: "bachelor", in_class12_successful_bachelor_years: 1, in_class12_reported_recognition: "confirmed", in_class12_reported_target_relation: "previous" });
    const rules = ruleData.filter(r => r.id.startsWith("india-study-")).map(r => ({ ...r, status: "verified" }));
    expect(evaluate(p, rules).path).toBe("subject_restricted");
    for (const key of ["years_of_university_study", "university_study_institution_recognized", "university_study_field_matches_target", "prior_degree_years", "prior_degree_field", "school_certificate_requirements_met"]) {
      expect(EngineRuleSchema.safeParse({ ...rules[0], conditions: { [key]: 1 } }).success).toBe(false);
    }
  });
  it("asks relationship after target and only for the Indian national bachelor history", () => {
    const steps = visibleSteps(indiaAnswers);
    expect(steps.indexOf("priorStudyTargetRelation")).toBeGreaterThan(steps.indexOf("targetField"));
    for (const changed of [{ targetDegree: "master" }, { curriculumType: "ib" }, { schoolQualificationCountry: "pk" }, { priorQualificationType: "diploma" }, { hasPriorUniversityStudy: false }]) {
      expect(visibleSteps({ ...indiaAnswers, ...changed } as typeof indiaAnswers)).not.toContain("priorStudyRecognition");
    }
  });
  it("accepts explicit uncertainty but keeps empty and finite unfinished drafts incomplete", () => {
    const unknown = { ...indiaAnswers, yearsOfUniversityStudy: null, priorStudyRecognition: "unknown", priorStudyTargetRelation: "unknown" };
    expect(AnswersSchema.safeParse(unknown).success).toBe(true);
    expect(buildProfile(AnswersSchema.parse(unknown)).qualificationHistory?.completedYears).toBeUndefined();
    expect(AnswersSchema.safeParse({ ...unknown, indiaStudyRouteVersion: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...indiaAnswers, yearsOfUniversityStudy: undefined }).success).toBe(false);
    for (const n of [-1, 50.1, 0.5]) expect(PartialAnswersSchema.safeParse({ ...indiaAnswers, yearsOfUniversityStudy: n }).success).toBe(true);
    for (const n of [-1, NaN, Infinity, 50.1]) expect(isAnswered({ ...indiaAnswers, yearsOfUniversityStudy: n }, "yearsOfUniversityStudy")).toBe(false);
    expect(PartialAnswersSchema.safeParse({ ...indiaAnswers, priorStudyRecognitionReference: "" }).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...indiaAnswers, priorStudyRecognitionReference: "" }).success).toBe(false);
  });
  it("prunes dependent reports and APS timing while preserving nationality/visa edits", () => {
    const a = { ...indiaAnswers, apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14" } as const;
    for (const [key, value] of [["priorStudyInstitution", "Changed"], ["priorStudyCountry", "pk"], ["priorQualificationType", "diploma"], ["priorStudyMode", "distance_online"], ["yearsOfUniversityStudy", 2]] as const) {
      const next = withAnswer(a, key, value);
      expect(next.priorStudyRecognition).toBeUndefined();
      expect(next.priorStudyTargetRelation).toBeUndefined();
      expect(next.apsSubmissionDate).toBeUndefined();
    }
    for (const [key, value] of [["priorStudyField", "Physics"], ["targetField", "physics"]] as const) {
      const next = withAnswer(a, key, value);
      expect(next.priorStudyTargetRelationReference).toBeUndefined();
      expect(next.priorStudyRecognitionReference).toBe(a.priorStudyRecognitionReference);
    }
    expect(withAnswer(a, "nationality", "pk").priorStudyRecognitionReference).toBe(a.priorStudyRecognitionReference);
    expect(withAnswer(a, "visaApplicationCountry", "sa").apsSubmissionDate).toBe(a.apsSubmissionDate);
  });
});

it('rejects null successful-years outside India even when a field would be hidden',()=>{for(const change of [{curriculumType:'gce'},{targetDegree:'master'},{schoolQualificationCountry:'pk'}]) expect(AnswersSchema.safeParse({...indiaAnswers,...change,yearsOfUniversityStudy:null}).success).toBe(false);});
it('restores normalized edits without stale target evidence or guessed matching strings',()=>{const changed=withAnswer(indiaAnswers,'targetField','physics');expect(changed.priorStudyTargetRelation).toBeUndefined();expect(visibleSteps(changed)).toContain('priorStudyTargetRelation');expect(AnswersSchema.safeParse(changed).success).toBe(false);});

it('accepts an explicit unknown institution country in the India branch',()=>{const a={...indiaAnswers,priorStudyCountry:'unknown',priorStudyRecognition:'unknown',priorStudyTargetRelation:'unknown'};expect(AnswersSchema.safeParse(a).success).toBe(true);expect(deriveFacts(buildProfile(AnswersSchema.parse(a))).in_class12_prior_study_country).toBe('unknown');});

// Follow the same dynamic numeric progression used by CheckFlow.next.
function finishForward(seed: PartialAnswers = {}, start = 0, replies: PartialAnswers = indiaAnswers) {
  let answers: PartialAnswers = { qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, indiaStudyRouteVersion: 1, ...seed };
  const visited: StepId[] = [];
  for (let index = start; index < visibleSteps(answers).length; index++) {
    const step = visibleSteps(answers)[index];
    visited.push(step);
    if (!isAnswered(answers, step)) {
      answers = withAnswer(answers, step, replies[step] as Answers[typeof step]);
    }
    expect(isAnswered(answers, step), step).toBe(true);
  }
  return { answers, visited };
}
it("completes a fresh forward Indian history flow without losing APS timing", () => {
  const { answers, visited } = finishForward();
  expect(AnswersSchema.safeParse(answers).success).toBe(true);
  expect(visited.indexOf("apsProcedureStatus")).toBeGreaterThan(visited.indexOf("priorStudyTargetRelationReference"));
  expect(answers.apsProcedureStatus).toBe("unknown");
  expect(AnswersSchema.safeParse(answers).success).toBe(true);
});
it("resumes partial academic edits and recollects invalidated APS timing before submission", () => {
  const edited = withAnswer({ ...indiaAnswers, apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14" }, "priorStudyMode", "distance_online");
  expect(edited.apsProcedureStatus).toBeUndefined();
  expect(edited.apsSubmissionDate).toBeUndefined();
  const partial = PartialAnswersSchema.parse(JSON.parse(JSON.stringify(edited)));
  const start = visibleSteps(partial).findIndex(step => !isAnswered(partial, step));
  const { answers, visited } = finishForward(partial, start);
  expect(AnswersSchema.safeParse(answers).success).toBe(true);
  expect(visited.indexOf("apsProcedureStatus")).toBeGreaterThan(visited.indexOf("priorStudyTargetRelationReference"));
  expect(answers.priorStudyMode).toBe("distance_online");
  expect(answers.apsProcedureStatus).toBe("unknown");
  expect(answers.apsSubmissionDate).toBeUndefined();
  expect(AnswersSchema.safeParse(answers).success).toBe(true);
});

it("keeps unknown issuer diagnostic through fresh forward validated answers and the mapper", () => {
  const { answers, visited } = finishForward({}, 0, { ...indiaAnswers, schoolQualificationCountry: "unknown" });
  expect(visited).not.toContain("priorStudyRecognition");
  const profile = buildProfile(AnswersSchema.parse(answers));
  expect(profile.schoolQualification?.country).toBe("unknown");
  const result = evaluate(profile, reviewedIndiaStudyRules());
  expect(result.path).toBe("unknown");
  expect(result.unknowns.some(note => /issuer/i.test(note))).toBe(true);
  expect(profile.qualificationHistory?.indiaStudyRouteVersion).toBe(1);
  expect(profile.qualificationHistory).not.toHaveProperty("priorStudyRecognition");
  expect(profile.qualificationHistory).not.toHaveProperty("priorStudyTargetRelation");
  expect(result.citations.some(c => c.ruleId === "8d95fa83-385f-4863-88cc-7dfe0a3036c6")).toBe(false);
});
it("keeps confirmed, foreign and unversioned mapping boundaries separate", () => {
  const confirmed = buildProfile(AnswersSchema.parse(indiaAnswers));
  expect(evaluate(confirmed, reviewedIndiaStudyRules()).path).toBe("subject_restricted");
  for (const schoolQualificationCountry of ["pk", "sa"]) {
    const p = buildProfile(AnswersSchema.parse({ ...indiaAnswers, schoolQualificationCountry }));
    expect(p.qualificationHistory?.indiaStudyRouteVersion).toBeUndefined();
    expect(p.qualificationHistory).not.toHaveProperty("priorStudyRecognition");
    expect(deriveFacts(p)).not.toHaveProperty("in_class12_prior_study_kind");
  }
  const legacy = buildProfile(AnswersSchema.parse({ ...indiaAnswers, indiaStudyRouteVersion: undefined, schoolQualificationCountry: "unknown" }));
  expect(legacy.qualificationHistory?.indiaStudyRouteVersion).toBeUndefined();
  expect(deriveFacts(legacy)).not.toHaveProperty("in_class12_prior_study_kind");
  expect(AnswersSchema.safeParse({ ...indiaAnswers, schoolQualificationCountry: undefined }).success).toBe(false);
  const foreignContext = buildProfile(AnswersSchema.parse({ ...indiaAnswers, schoolQualificationCountry: "unknown", schoolQualificationContext: "international" }));
  expect(foreignContext.qualificationHistory?.indiaStudyRouteVersion).toBeUndefined();
});
