// UP-TEST-01: source-reviewed bounded prep only. Parent direct gate is BLOCKED.
// Test reports/references are synthetic applicant evidence, never app verification.
import type { Profile } from '../evaluate';
import { pakistanCandidates } from '@/scripts/pakistan.rules';
export const pakistanProfile: Profile = { targetDegree: 'bachelor', curriculumType: 'national', certificateCountry: 'pk', schoolQualification: { country: 'pk', context: 'national' }, schoolGradePercent: 50, targetField: 'cs', qualificationHistory: { hasPriorUniversityStudy: false }, pakistan: { version: 1, certificate: 'hssc', group: 'science', completion: 'completed_12_grades', targetFamily: 'technology', targetFamilyReference: 'Example institution programme identifies Technology' } };
export const reviewedPakistanRules = () => pakistanCandidates.map(r => ({ ...r, status: 'verified' as const }));
export const PAKISTAN_PREP_ACCEPTANCE = [
    { id: 'PK-prep-science', profile: pakistanProfile, path: 'studienkolleg', sourceId: '193' },
    { id: 'PK-prep-commerce', profile: { ...pakistanProfile, pakistan: { ...pakistanProfile.pakistan!, group: 'commerce', targetFamily: 'economics' } }, path: 'studienkolleg', sourceId: '197' },
    { id: 'PK-prep-humanities', profile: { ...pakistanProfile, pakistan: { ...pakistanProfile.pakistan!, group: 'humanities', targetFamily: 'humanities' } }, path: 'studienkolleg', sourceId: '204' },
    { id: 'PK-prep-boundary-unmet', profile: { ...pakistanProfile, schoolGradePercent: 49.99 }, path: 'unknown', sourceId: '193' },
    { id: 'PK-prep-missing-grade', profile: { ...pakistanProfile, schoolGradePercent: undefined }, path: 'unknown', sourceId: '193' },
    { id: 'PK-prep-outside-family', profile: { ...pakistanProfile, pakistan: { ...pakistanProfile.pakistan!, targetFamily: 'economics' } }, path: 'unknown', sourceId: '193' },
] satisfies {
    id: string;
    profile: Profile;
    path: string;
    sourceId: string;
}[];
