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

it('renders a known subject-restricted route for a complete GCE profile without a duration checklist', () => {
  const result = evaluate(profile,rules);
  const html = renderToStaticMarkup(<VerdictCard result={result} profile={profile} profileLine="Cambridge A-Levels" />);
  expect(primaryDiagnostic(result)?.status).toBe('known_route');
  expect(html).toContain('You have a subject-restricted direct admission route');
  expect(html).not.toContain('Your qualification checks meet the cited criteria');
  expect(html).not.toMatch(/school years|missing or uncertain|How many/);
  for (const historical of [false,true]) expect(visibleUnknowns(result,profile,historical)).not.toContain(NO_RULE_MESSAGES.path);
});
it('presents the unmet grade condition rather than an unrelated failed awarding-body candidate', () => {
  const pearson = {...profile,gce:{...profile.gce!,awardingBody:'pearson' as const,subjects:[gceSubject('mathematics'),gceSubject('physics'),gceSubject('chemistry','D')]}};
  const result = evaluate(pearson,rules);
  const diagnostic = primaryDiagnostic(result);
  expect(diagnostic?.status).toBe('known_unmet_condition');
  expect(diagnostic?.facts.map(f=>f.key)).toEqual(['gce_min_al_grade']);
  const html=renderToStaticMarkup(<VerdictCard result={result} profile={pearson} profileLine="Pearson" />);
  expect(html).toContain('A condition is unmet for the cited route');
  expect(html).not.toContain('school years');
});

const conflictingIb = IB_ACCEPTANCE.find(c => c.id === 'duplicate006880')!.profile.ib!;
it.each([
  {marker: undefined, ib: conflictingIb, path: 'unknown', diag: 'source_conflict'},
  {marker: 1, ib: conflictingIb, path: 'unknown', diag: 'source_conflict'},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school}, path: 'direct', diag: 'known_route'},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school, subjects: ibRows({0: {grade: null}})}, path: 'unknown', diag: 'source_conflict'},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school}, path: 'direct', diag: 'known_route', annexConditions: {ib_math_level: 'HL'}},
  {marker: 1, ib: {...ordinaryIb.ib!, school: conflictingIb.school}, path: 'direct', diag: 'known_route', annexConditions: {ib_math_level: 'HL', ib_exam_year: {op: 'lt', value: 2025}}},
  {marker: 1, ib: {...conflictingIb, subjects: conflictingIb.subjects!.map((s, i) => i === 0 ? {...s, grade: 2} : s)}, path: 'unknown', diag: 'source_conflict'},
] as const)('selects the applicable IB explanation through immutable assessment and rendering (marker $marker, mathematics $ib.mathLevel)', (testCase) => {
  const {marker, ib, path, diag} = testCase;
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
  expect(assessment.result.path).toBe(path);
  if (path === 'unknown') {
    expect(assessment.result.diagnostics).toContainEqual(expect.objectContaining({
      status: 'source_conflict', facts: expect.arrayContaining([expect.objectContaining({key: 'ib_annex_status', actual: 'source_conflict'})]),
    }));
    expect(assessment.result.citations.some(c => c.supports.includes('path'))).toBe(false);
    expect(assessment.result.stepsDetailed).toEqual([]);
  } else {
    expect(assessment.result.citations.some(c => c.supports.includes('path'))).toBe(true);
  }
  expect(assessment.result.diagnostics?.some(d => d.followUp)).toBe(false);
  const stored = {answers, result: assessment.result, assessment_metadata: assessment.metadata};
  const original = structuredClone(stored);
  const parsed = parseStoredAssessment(stored, versions);
  expect(parsed.kind).toBe('authoritative');
  const result = parsed.original!.result;
  const diagnostic = primaryDiagnostic(result);
  expect(diagnostic?.status).toBe(diag);
  const html = renderToStaticMarkup(<VerdictCard result={result} profile={profile} profileLine="IB Diploma" />);
  if (diag === 'source_conflict') {
    expect(html).toContain('Conflicting evidence leaves this admission assessment unresolved');
    expect(html).toContain('source_conflict');
    expect(html).toContain('recognition authority');
    expect(html).not.toContain('Your qualification checks meet the cited criteria');
  } else {
    expect(html).toContain('You can apply directly to Bachelor programmes');
    expect(html).not.toContain('Conflicting evidence');
    expect(html).not.toContain('Your qualification checks meet the cited criteria');
    expect(html).not.toContain('source_conflict');
  }
  const citation = [...result.citations, ...(result.candidateCitations ?? [])].find(c => diagnostic!.ruleIds.includes(c.ruleId))!;
  expect(html).toContain(citation.sourceUrl);
  if (marker === 1) {
    expect(html).not.toMatch(/school years|How many|candidate requires at least 12/);
    expect(profile.ib?.schoolYears).toBeUndefined();
  }
  expect(stored).toEqual(original);
  expect({answers, versions}).toEqual(before);
});
