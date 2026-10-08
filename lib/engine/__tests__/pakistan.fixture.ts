// UP-TEST-01: adopted bounded prep/current one-year candidate acceptance; publication remains separate.
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

export const currentPakistanProfile: Profile = {...pakistanProfile,intake:{term:'winter',year:2026},qualificationHistory:{hasPriorUniversityStudy:true,qualificationType:'bachelor',institution:'Reported Pakistan academic university',country:'pk',field:'Previous academic field',degreeYears:4,completedYears:1,completion:'in_progress',pakistanStudy:{evidenceVersion:2,mode:'full_time',regulations:'confirmed',annualRecords:'confirmed',successfulYearsReference:'Annual subjects and marks establish one successful academic year',recognition:'reported_official_confirmed',recognitionReference:'Applicable institutional assessment recognises this institution and academic bachelor study',relation:'reported_official_closely_related',relationReference:'Applicable university assessment identifies intended target as neighbouring previous subject',assessment:'reported_current_support',assessmentReference:'Intended university assessment supports this exact current qualification, study, target and intake'}}};

export const PAKISTAN_CURRENT_ACCEPTANCE = (['science','commerce','humanities'] as const).flatMap(group => ([{term:'winter',year:2026},{term:'summer',year:2027},{term:'winter',year:2027}] as const).map(intake => ({id:'PK-current-'+group+'-'+intake.term+'-'+intake.year,profile:{...currentPakistanProfile,pakistan:{...currentPakistanProfile.pakistan!,group},intake},path:'subject_restricted' as const})));
