import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { evaluate, NO_RULE_MESSAGES } from '@/lib/engine/evaluate';
import { ordinaryGce, gceSubject } from '@/lib/engine/__tests__/gce.fixture';
import { gceCandidates } from '@/scripts/gce.rules';
import { VerdictCard } from '../result-components';
import { primaryDiagnostic, visibleUnknowns } from '../result-model';
import { IB_ACCEPTANCE } from '@/lib/engine/__tests__/ib.fixture';
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

it.each([undefined, 1] as const)('keeps the IB annex conflict visible through immutable assessment and rendering (guidance marker %s)', marker => {
  const ib = IB_ACCEPTANCE.find(c => c.id === 'duplicate006880')!.profile.ib!;
  const answers = AnswersSchema.parse({
    targetDegree: 'bachelor', curriculumType: 'ib', certificateCountry: 'sa', nationality: 'pk',
    visaApplicationCountry: 'other', targetField: 'cs', intake: {term: 'winter', year: 2026},
    qualificationGuidanceVersion: marker, ibVersion: 1, ibDocumentStatus: ib.documentStatus,
    ibExamYear: ib.examYear, ibExamSession: ib.examSession, ibSchoolYears: ib.schoolYears,
    ibSchooling: ib.schooling, ibTotalPoints: ib.totalPoints, ibProgramme: ib.programme,
    ibSchoolIdentity: 'known', ibSchoolName: ib.school!.name, ibSchoolCountry: ib.school!.country,
    ibSchoolCode: ib.school!.code, ibSubjects: ib.subjects!.map(s => ({...s, grade: String(s.grade)})),
  });
  const profile = buildProfile(answers);
  // Synthetic immutable published copies in memory only; names have no authority.
  const versions = simulatedPublication(ibCandidates).map(v => ({...v, raw_snapshot: {...RawRuleSchema.parse(v.raw_snapshot), slug: 'renamed-candidate'}}));
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
  expect(diagnostic?.status).toBe('source_conflict');
  const html = renderToStaticMarkup(<VerdictCard result={result} profile={profile} profileLine="IB Diploma" />);
  expect(html).toContain('Conflicting evidence leaves this admission assessment unresolved');
  expect(html).toContain('recognition authority');
  expect(html).toContain('source_conflict');
  const citation = result.candidateCitations!.find(c => diagnostic!.ruleIds.includes(c.ruleId))!;
  expect(html).toContain(citation.sourceUrl);
  expect(html).not.toContain('Your qualification checks meet the cited criteria');
  if (marker === 1) {
    expect(html).not.toMatch(/school years|How many|candidate requires at least 12/);
    expect(profile.ib?.schoolYears).toBeUndefined();
  }
  expect(stored).toEqual(original);
  expect({answers, versions}).toEqual(before);
});
