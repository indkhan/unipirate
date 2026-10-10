import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { evaluate, EngineRuleSchema, NO_RULE_MESSAGES } from '@/lib/engine/evaluate';
import { ordinaryGce, gceSubject } from '@/lib/engine/__tests__/gce.fixture';
import { gceCandidates } from '@/scripts/gce.rules';
import { VerdictCard } from '../result-components';
import { primaryDiagnostic, visibleUnknowns } from '../result-model';
import { IB_ACCEPTANCE, ordinaryIb, ibRows } from '@/lib/engine/__tests__/ib.fixture';
import { ibCandidates } from '@/scripts/ib.rules';
import { AnswersSchema, buildProfile } from '@/app/(public)/check/steps';
import { evaluateAssessment, parseStoredAssessment } from '@/lib/rules/assessment';
import { simulatedPublication, TEST_CONTEXT } from '@/lib/engine/__tests__/up-test-01.publication.fixture';
import { RawRuleSchema } from '@/lib/rules/versioning';
vi.mock('../result-client', () => ({ SignupResultLink: () => null }));
const rules = gceCandidates.map(r => ({...r,status:'verified' as const}));
const profile = {...ordinaryGce,qualificationGuidanceVersion:1 as const};

it('renders checks with a short scope and candidate source without a verified admission stamp or duration checklist', () => {
  const result = evaluate(profile,rules);
  const html = renderToStaticMarkup(<VerdictCard result={result} profile={profile} profileLine="Cambridge A-Levels" />);
  expect(html).toContain('Your qualification checks meet the cited criteria');
  expect(html).toContain('Checked qualification evidence, subjects and grades');
  expect(html).toContain('School attendance was not assessed');
  expect(html).toContain('Source for these checks');
  expect(html).not.toContain('>Verified<');
  expect(html).not.toMatch(/school years|missing or uncertain|How many/);
  for (const historical of [false,true]) expect(visibleUnknowns(result,profile,historical)).not.toContain(NO_RULE_MESSAGES.path);
});
it('presents the closest applicable qualification checks rather than an unrelated failed awarding-body candidate', () => {
  const pearson = {...profile,gce:{...profile.gce!,awardingBody:'pearson' as const,subjects:[gceSubject('mathematics'),gceSubject('physics'),gceSubject('chemistry','D')]}};
  const result = evaluate(pearson,rules);
  const diagnostic = primaryDiagnostic(result);
  expect(diagnostic?.facts.map(f=>f.key)).toEqual(['gce_min_al_grade']);
  const html=renderToStaticMarkup(<VerdictCard result={result} profile={pearson} profileLine="Pearson" />);
  expect(html).toContain('Some qualification checks need review');
  expect(html).not.toContain('school years');
});

const conflictingIb = IB_ACCEPTANCE.find(c => c.id === 'duplicate006880')!.profile.ib!;
it.each([
  {marker: undefined, ib: conflictingIb, conflict: true},
  {marker: 1, ib: conflictingIb, conflict: true},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school}, conflict: false},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school, subjects: ibRows({0: {grade: null}})}, conflict: false},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school}, conflict: true, annexConditions: {ib_math_level: 'HL'}},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school}, conflict: false, annexConditions: {ib_math_level: 'HL', ib_exam_year: {op: 'lt', value: 2025}}},
  {marker: 1, ib: {...conflictingIb, subjects: conflictingIb.subjects!.map((s, i) => i === 0 ? {...s, grade: 2} : s)}, conflict: true},
] as const)('selects the applicable IB explanation through immutable assessment and rendering (marker $marker, mathematics $ib.mathLevel)', (testCase) => {
  const {marker, ib, conflict} = testCase;
  const answers = AnswersSchema.parse({
    targetDegree: 'bachelor', curriculumType: 'ib', certificateCountry: 'sa', nationality: 'pk',
    visaApplicationCountry: 'other', targetField: 'cs', intake: {term: 'winter', year: 2026},
    qualificationGuidanceVersion: marker, ibVersion: 1, ibDocumentStatus: ib.documentStatus,
    ibExamYear: ib.examYear, ibExamSession: ib.examSession, ibSchoolYears: ib.schoolYears,
    ibSchooling: ib.schooling, ibTotalPoints: ib.totalPoints, ibProgramme: ib.programme,
    ibSchoolIdentity: 'known', ibSchoolName: ib.school!.name, ibSchoolCountry: ib.school!.country,
    ibSchoolCode: ib.school!.code, ibSubjects: ib.subjects!.map(s => ({...s, grade: s.grade === null ? 'unknown' : String(s.grade)})),
  });
  const profile = buildProfile(answers);
  // Synthetic immutable published copies in memory only; names have no authority.
  const versions = simulatedPublication(ibCandidates).map(v => {
    const raw = RawRuleSchema.parse(v.raw_snapshot);
    const policy = EngineRuleSchema.parse(raw);
    const conditions = 'annexConditions' in testCase && policy.conditions.ib_annex_status === 'applicable'
      ? {...policy.conditions, ...testCase.annexConditions} : policy.conditions;
    return {...v, raw_snapshot: {...raw, slug: 'renamed-candidate', conditions}};
  });
  const before = structuredClone({answers, versions});
  const assessment = evaluateAssessment(profile, versions, TEST_CONTEXT);
  expect(assessment.metadata.selectedVersionIds).toEqual(versions.map(v => v.id));
  expect(assessment.result.path).toBe('unknown');
  expect(assessment.result.diagnostics).toContainEqual(expect.objectContaining({
    status: 'source_conflict', facts: expect.arrayContaining([expect.objectContaining({key: 'ib_annex_status', actual: 'source_conflict'})]),
  }));
  expect(assessment.result.citations.some(c => c.supports.includes('path'))).toBe(false);
  expect(assessment.result.stepsDetailed).toEqual([]);
  expect(assessment.result.diagnostics?.some(d => d.followUp)).toBe(false);
  const stored = {answers, result: assessment.result, assessment_metadata: assessment.metadata};
  const original = structuredClone(stored);
  const parsed = parseStoredAssessment(stored, versions);
  expect(parsed.kind).toBe('authoritative');
  const result = parsed.original!.result;
  const diagnostic = primaryDiagnostic(result);
  expect(diagnostic?.status).toBe(conflict ? 'source_conflict' : ib.subjects!.some(s => s.grade === null) ? 'targeted_missing_fact' : 'qualification_guidance');
  const html = renderToStaticMarkup(<VerdictCard result={result} profile={profile} profileLine="IB Diploma" />);
  expect(html).toContain('recognition authority');
  if (conflict) {
    expect(html).toContain('Conflicting evidence leaves this admission assessment unresolved');
    expect(html).toContain('source_conflict');
    expect(html).not.toContain('Your qualification checks meet the cited criteria');
  } else {
    expect(html).toContain(ib.subjects!.some(s => s.grade === null) ? 'Some qualification checks need review' : 'Your qualification checks meet the cited criteria');
    expect(html).not.toContain('Conflicting evidence');
    expect(html).not.toContain('reported HL; candidate requires SL');
    expect(html).not.toContain('source_conflict');
    expect(html).toContain('School attendance was not assessed');
  }
  const citation = result.candidateCitations!.find(c => diagnostic!.ruleIds.includes(c.ruleId))!;
  expect(html).toContain(citation.sourceUrl);
  if (marker === 1) {
    expect(html).not.toMatch(/school years|How many|candidate requires at least 12/);
    expect(profile.ib?.schoolYears).toBeUndefined();
  }
  expect(stored).toEqual(original);
  expect({answers, versions}).toEqual(before);
});
