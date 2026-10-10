// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CheckFlow } from '../check-flow';
import { ProfileReview } from '../profile-review';
import { type PartialAnswers } from '../steps';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('../actions', () => ({ submitCheck: vi.fn() }));
vi.mock('@/components/app/theme-toggle', () => ({ ThemeToggle: () => null }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); window.history.replaceState({}, '', '/check?degree=bachelor');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const gce: PartialAnswers = { qualificationHistoryVersion: 1, targetDegree: 'bachelor', certificateCountry: 'sa', curriculumType: 'gce', gceVersion: 1, gceQualificationContext: 'british_international', gceQualificationType: 'ial', gceEvidence: 'final', gceAwardingBody: 'caie', gceSchoolYears: 13 };

it('restores a draft parked at the removed question into real subject editing, Back and remount', async () => {
  sessionStorage.setItem('unipirate.check.v1:none:bachelor', JSON.stringify({ answers: gce, stepId: 'gceSchoolYears', stepIndex: 7 }));
  const mount = async () => act(async () => root.render(<CheckFlow initialAnswers={{targetDegree:'bachelor'}} entryDegree="bachelor" />));
  await mount();
  expect(container.querySelector('h1')?.textContent).toBe('Which subjects did you take?');
  expect(container.querySelector('input[type="number"]')).toBeNull();
  expect(JSON.parse(sessionStorage.getItem('unipirate.check.v1:none:bachelor')!).answers.gceSchoolYears).toBeUndefined();
  const back = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '‹ Back')!;
  await act(async () => back.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
  expect(container.querySelector('h1')?.textContent).toContain('awarding body');
  await act(async () => root.unmount()); root = createRoot(container); await mount();
  expect(container.querySelector('h1')?.textContent).toContain('awarding body');
  expect(gce.gceSchoolYears).toBe(13);
});
it.each(['caie', 'pearson', 'other'])('mounted %s profile keeps awarding and exam evidence without duration', async body => {
  await act(async () => root.render(<ProfileReview initialAnswers={{...gce,gceAwardingBody:body}} />));
  for (const key of ['gceSchoolYears','ibSchoolYears','ibFullDiploma']) expect(container.querySelector(`#${key}-label`)).toBeNull();
  for (const key of ['gceQualificationContext','gceQualificationType','gceEvidence','gceAwardingBody','gceSubjects']) expect(container.querySelector(`#${key}-label`)).not.toBeNull();
});
it('mounted IB profile retains one award-evidence question plus independent examination and subject evidence', async () => {
  await act(async () => root.render(<ProfileReview initialAnswers={{targetDegree:'bachelor',certificateCountry:'sa',curriculumType:'ib',ibVersion:1,ibDocumentStatus:'official_results',ibSchoolYears:12}} />));
  for (const key of ['ibSchoolYears','ibFullDiploma']) expect(container.querySelector(`#${key}-label`)).toBeNull();
  for (const key of ['ibDocumentStatus','ibExamYear','ibExamSession','ibTotalPoints','ibSubjects']) expect(container.querySelector(`#${key}-label`)).not.toBeNull();
});
