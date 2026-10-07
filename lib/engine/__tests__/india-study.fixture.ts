// Approved UP-ELIG-03 coverage only; parent UP-TEST-01 remains OPEN.
// References are synthetic applicant-reported official assessments.
import type { Profile, Result } from '../evaluate';
import { indiaStudyCandidates } from '@/scripts/india-study.rules';
import { ruleData } from '@/scripts/rules.bootstrap';
import legacy from './india-study-legacy.fixture.json';
export const indianStudyProfile: Profile = {
    targetDegree: 'bachelor', curriculumType: 'national', certificateCountry: 'in', nationality: 'in',
    visaApplicationCountry: 'in', board: 'cbse', schoolGradePercent: 70, jeeAdvanced: false,
    schoolQualification: { country: 'in', context: 'national' }, targetField: 'cs', intake: { term: 'winter', year: 2026 }, hasExistingApsCertificate: false,
    qualificationHistory: { hasPriorUniversityStudy: true, qualificationType: 'bachelor', institution: 'Example University', country: 'in', field: 'Computer Science', degreeYears: 4, completedYears: 1, completion: 'in_progress', indiaStudyRouteVersion: 1, priorStudyMode: 'regular', priorStudyRecognition: 'reported_official_confirmed', priorStudyRecognitionReference: 'APS A: this institution, bachelor programme and attained study recognised', priorStudyTargetRelation: 'reported_official_previous', priorStudyTargetRelationReference: 'University B: this previous field and intended CS bachelor confirmed' }
};
export const historyChange = (change: Partial<NonNullable<Profile['qualificationHistory']>>): Profile => ({ ...indianStudyProfile, qualificationHistory: { ...indianStudyProfile.qualificationHistory!, ...change } });
export function reviewedIndiaStudyRules() { return [...legacy, ...indiaStudyCandidates.map(r => ({ ...r, status: 'verified' })), ...ruleData.filter(r => r.id.startsWith('aps-transition-') || r.id.startsWith('aps-scoped-')).map(r => ({ ...r, status: 'verified' }))]; }
type Case = {
    id: string;
    kind: 'positive' | 'negative' | 'boundary' | 'missing' | 'exception';
    profile: Profile;
    path: Result['path'];
    reason?: RegExp;
};
export const INDIA_STUDY_ACCEPTANCE: Case[] = [
    { id: 'FUTURE-India-one-year-route', kind: 'positive', profile: indianStudyProfile, path: 'subject_restricted' },
    ...['cbse', 'cisce', 'state_board'].map(board => ({ id: 'board-' + board, kind: 'positive' as const, profile: { ...indianStudyProfile, board }, path: 'subject_restricted' as const })),
    ...[1, 1.01, 2].map(completedYears => ({ id: 'years-' + completedYears, kind: 'boundary' as const, profile: historyChange({ completedYears }), path: 'subject_restricted' as const })),
    ...[70, 70.01].map(schoolGradePercent => ({ id: 'grade-' + schoolGradePercent, kind: 'boundary' as const, profile: { ...indianStudyProfile, schoolGradePercent }, path: 'subject_restricted' as const })),
    ...(['completed', 'in_progress', 'discontinued'] as const).map(completion => ({ id: 'status-' + completion, kind: 'exception' as const, profile: historyChange({ completion }), path: 'subject_restricted' as const })),
    { id: 'closely-related', kind: 'positive', profile: historyChange({ priorStudyTargetRelation: 'reported_official_closely_related' }), path: 'subject_restricted' },
    ...[0, 0.5, 0.99].map(completedYears => ({ id: 'unmet-years-' + completedYears, kind: 'negative' as const, profile: historyChange({ completedYears }), path: 'unknown' as const, reason: /successful.*year.*unmet/i })),
    { id: 'completed-degree-years-missing', kind: 'missing', profile: historyChange({ completedYears: undefined, completion: 'completed' }), path: 'unknown', reason: /Establish successfully completed/ },
    { id: 'recognition-rejected', kind: 'negative', profile: historyChange({ priorStudyRecognition: 'reported_official_rejected' }), path: 'unknown', reason: /rejects recognition/ },
    { id: 'recognition-unknown', kind: 'missing', profile: historyChange({ priorStudyRecognition: 'unknown' }), path: 'unknown', reason: /recognition assessment/ },
    { id: 'recognition-reference-missing', kind: 'missing', profile: historyChange({ priorStudyRecognitionReference: undefined }), path: 'unknown', reason: /recognition assessment/ },
    { id: 'recognition-reference-blank', kind: 'missing', profile: historyChange({ priorStudyRecognitionReference: ' ' }), path: 'unknown', reason: /recognition assessment/ },
    { id: 'same-name-no-assessment', kind: 'missing', profile: historyChange({ priorStudyRecognition: undefined, priorStudyRecognitionReference: undefined }), path: 'unknown', reason: /recognition assessment/ },
    { id: 'unrelated-target', kind: 'negative', profile: historyChange({ priorStudyTargetRelation: 'reported_official_unrelated' }), path: 'unknown', reason: /outside.*subject scope/ },
    { id: 'target-unknown', kind: 'missing', profile: historyChange({ priorStudyTargetRelation: 'unknown' }), path: 'unknown', reason: /target relationship/ },
    { id: 'target-reference-missing', kind: 'missing', profile: historyChange({ priorStudyTargetRelationReference: undefined }), path: 'unknown', reason: /target relationship/ },
    { id: 'same-field-no-assessment', kind: 'missing', profile: historyChange({ field: 'cs', priorStudyTargetRelation: undefined, priorStudyTargetRelationReference: undefined }), path: 'unknown', reason: /target relationship/ },
    ...(['distance_online', 'other', 'unknown'] as const).map(priorStudyMode => ({ id: 'mode-' + priorStudyMode, kind: 'exception' as const, profile: historyChange({ priorStudyMode }), path: 'unknown' as const, reason: /study mode/ })),
    ...(['diploma', 'master', 'other'] as const).map(qualificationType => ({ id: 'qualification-' + qualificationType, kind: 'exception' as const, profile: historyChange({ qualificationType }), path: 'unknown' as const, reason: /bachelor-study basis/ })),
    ...['pk', undefined, 'other'].map(country => ({ id: 'country-' + country, kind: 'exception' as const, profile: historyChange({ country }), path: 'unknown' as const, reason: /coverage/ })),
    { id: 'school-only', kind: 'positive', profile: { ...indianStudyProfile, qualificationHistory: { hasPriorUniversityStudy: false } }, path: 'studienkolleg' },
    { id: 'prior-study-missing', kind: 'missing', profile: { ...indianStudyProfile, qualificationHistory: undefined }, path: 'unknown', reason: /basis/ },
    { id: 'summer-2026', kind: 'boundary', profile: { ...indianStudyProfile, intake: { term: 'summer', year: 2026 } }, path: 'studienkolleg' },
    { id: 'summer-2027', kind: 'boundary', profile: { ...indianStudyProfile, intake: { term: 'summer', year: 2027 } }, path: 'subject_restricted' },
    { id: 'passport-visa-independent', kind: 'exception', profile: { ...indianStudyProfile, nationality: 'pk', visaApplicationCountry: 'sa' }, path: 'subject_restricted' },
];
