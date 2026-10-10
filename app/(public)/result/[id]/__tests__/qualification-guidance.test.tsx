import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { evaluate, NO_RULE_MESSAGES } from '@/lib/engine/evaluate';
import { ordinaryGce, gceSubject } from '@/lib/engine/__tests__/gce.fixture';
import { gceCandidates } from '@/scripts/gce.rules';
import { VerdictCard } from '../result-components';
import { primaryDiagnostic, visibleUnknowns } from '../result-model';
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
