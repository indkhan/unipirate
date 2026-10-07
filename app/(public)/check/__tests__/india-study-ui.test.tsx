import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ProfileReview } from '../profile-review';
import { CheckFlow } from '../check-flow';
import { visibleSteps } from '../steps';
import { indiaAnswers } from './india-study.fixture';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('../actions', () => ({ submitCheck: vi.fn() }));
vi.mock('@/components/app/theme-toggle', () => ({ ThemeToggle: () => null }));
it('renders applicant reports and applicable references in profile review', () => { const html = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: indiaAnswers })); expect(html).toContain('THIS institution, bachelor programme and attained study'); expect(html).toContain('not app verification'); expect(html).toContain(indiaAnswers.priorStudyRecognitionReference); expect(html).not.toContain('disabled=""'); });
it('offers explicit successful-years uncertainty in checker and review', () => { const input = { ...indiaAnswers, yearsOfUniversityStudy: null, priorStudyRecognition: 'unknown' as const, priorStudyTargetRelation: 'unknown' as const }; const check = renderToStaticMarkup(React.createElement(CheckFlow, { initialAnswers: input, initialStepIndex: visibleSteps(input).indexOf('yearsOfUniversityStudy') })); const review = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: input })); for (const html of [check, review]) {
    expect(html).toContain('aria-pressed="true">Cannot establish successful academic years');
    expect(html).not.toContain('disabled=""');
} });
it('keeps partial assessment reference and numeric drafts visible while submission is blocked', () => { for (const change of [{ yearsOfUniversityStudy: -1 }, { yearsOfUniversityStudy: 50.1 }, { priorStudyRecognitionReference: '' }]) {
    const html = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: { ...indiaAnswers, ...change } }));
    expect(html).toContain(indiaAnswers.priorStudyInstitution);
    expect(html).toContain('disabled=""');
} });
it('does not infer an assessment for a different programme or target', () => { const html = renderToStaticMarkup(React.createElement(ProfileReview, { initialAnswers: { ...indiaAnswers, priorStudyRecognition: 'unknown', priorStudyTargetRelation: 'unknown' } })); expect(html).toContain('another programme or uncertain basis'); expect(html).toContain('assessment covers another target'); expect(html).not.toContain('disabled=""'); });
