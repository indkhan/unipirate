import type { Profile } from '../evaluate';
export const gceSubject = (id: string, grade: 'C' | 'D' = 'C', level: 'AL' | 'AS' = 'AL'): NonNullable<Profile['gce']>['subjects'][number] => ({ independenceGroup: id, category: ({ mathematics: 'math', further_mathematics: 'math', physics: 'physics', chemistry: 'chemistry', biology: 'biology', history: 'history', geography: 'geography', economics: 'economics', english_language: 'language', computer_science: 'computer_science' } as Record<string, NonNullable<Profile['gce']>['subjects'][number]['category']>)[id] ?? 'other', list: ['statistics', 'geology', 'psychology', 'marine_science'].includes(id) ? 'B' : id === 'electronics' ? 'C' : id === 'unlisted' ? 'unrecognized' : 'A', level, grade });
export const ordinaryGce: Profile = { targetDegree: 'bachelor', nationality: 'in', certificateCountry: 'sa', curriculumType: 'gce', targetField: 'cs', intake: { term: 'winter', year: 2026 }, gce: { awardingBody: 'caie', schoolYears: 12, qualificationContext: 'british_international', qualificationType: 'ial', evidence: 'final', subjects: ['mathematics', 'physics', 'chemistry'].map(id => gceSubject(id)) } };
export const gceCase = (ids: string[], targetField = 'cs'): Profile => ({ ...ordinaryGce, targetField, gce: { ...ordinaryGce.gce!, subjects: ids.map(id => gceSubject(id)) } });
export const GCE_ACCEPTANCE = [
    { id: 'ordinary-trio', profile: ordinaryGce, path: 'subject_restricted' },
    { id: 'extra-D', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, subjects: [...ordinaryGce.gce!.subjects, gceSubject('biology', 'D')] } }, path: 'subject_restricted' },
    { id: 'dependent-maths', profile: gceCase(['mathematics', 'further_mathematics', 'physics']), path: 'unknown', reason: /independent/ },
    { id: 'dependent-statistics', profile: gceCase(['mathematics', 'physics', 'statistics']), path: 'unknown', reason: /independent/ },
    { id: 'dependent-geology', profile: gceCase(['history', 'geography', 'geology'], 'humanities'), path: 'unknown', reason: /independent/ },
    { id: 'two-AL', profile: gceCase(['mathematics', 'physics']), path: 'unknown', reason: /three|3/ },
    { id: 'AS-not-AL', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, subjects: [gceSubject('mathematics'), gceSubject('physics'), gceSubject('chemistry', 'C', 'AS')] } }, path: 'unknown', reason: /three|3/ },
    { id: 'grade-D', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, subjects: [gceSubject('mathematics'), gceSubject('physics'), gceSubject('chemistry', 'D')] } }, path: 'unknown', reason: /grade|C/ },
    { id: 'unknown-issuer', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, awardingBody: 'other' as const } }, path: 'unknown', reason: /awarding body/ },
    { id: 'unknown-subject', profile: gceCase(['mathematics', 'physics', 'unlisted']), path: 'unknown', reason: /subject.*recogn|ZAB/i },
    { id: 'missing-years', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, schoolYears: undefined } }, path: 'unknown', reason: /school.*years|years.*school/i },
    { id: 'eleven-years', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, schoolYears: 11 } }, path: 'unknown', reason: /12.*school|school.*12/i },
    { id: 'same-witness', profile: { ...gceCase(['history', 'geography', 'psychology']), gce: { ...ordinaryGce.gce!, subjects: [gceSubject('history'), gceSubject('geography'), gceSubject('psychology'), gceSubject('mathematics', 'D'), gceSubject('physics', 'D')] } }, path: 'unknown', reason: /target|mathematics/ },
    { id: 'science', profile: gceCase(['mathematics', 'physics', 'history'], 'physics'), path: 'subject_restricted' },
    { id: 'science-shortfall', profile: gceCase(['mathematics', 'geography', 'history'], 'physics'), path: 'unknown', reason: /science|target/ },
    { id: 'medicine', profile: gceCase(['mathematics', 'physics', 'chemistry'], 'medicine'), path: 'subject_restricted' },
    { id: 'pharmacy', profile: gceCase(['mathematics', 'physics', 'chemistry'], 'pharmacy'), path: 'subject_restricted' },
    { id: 'medicine-shortfall', profile: gceCase(['mathematics', 'physics', 'history'], 'medicine'), path: 'unknown', reason: /science|target/ },
    { id: 'arts', profile: gceCase(['mathematics', 'physics', 'chemistry'], 'arts'), path: 'subject_restricted' },
    { id: 'List-B', profile: gceCase(['mathematics', 'physics', 'psychology']), path: 'subject_restricted' },
    { id: 'Pakistan-location', profile: { ...ordinaryGce, certificateCountry: 'pk' }, path: 'subject_restricted' },
    { id: 'national-identity', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, qualificationContext: 'national' as const } }, path: 'unknown', reason: /national/ },
    { id: 'missing-context', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, qualificationContext: undefined } }, path: 'unknown', reason: /context|system/ },
    { id: 'missing-intake', profile: { ...ordinaryGce, intake: undefined }, path: 'unknown', reason: /intake/ },
    { id: 'Cambridge-2022', profile: { ...ordinaryGce, intake: { term: 'summer' as const, year: 2022 } }, path: 'subject_restricted' },
    { id: 'Cambridge-before-2022', profile: { ...ordinaryGce, intake: { term: 'winter' as const, year: 2021 } }, path: 'unknown', reason: /historical|intake/ },
    { id: 'Pearson-history', profile: { ...ordinaryGce, intake: { term: 'summer' as const, year: 2024 }, gce: { ...ordinaryGce.gce!, awardingBody: 'pearson' as const } }, path: 'unknown', reason: /historical|intake/ },
    { id: 'List-C-no-proxy', profile: gceCase(['mathematics', 'physics', 'electronics']), path: 'unknown', reason: /List C|vocational/ },
    { id: 'unused-List-C', profile: gceCase(['mathematics', 'physics', 'chemistry', 'electronics']), path: 'subject_restricted' },
    { id: 'school-certificate', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, evidence: 'school' as const } }, path: 'unknown', reason: /certificate/ },
    { id: 'Pre-U-no-conversion', profile: { ...ordinaryGce, gce: { ...ordinaryGce.gce!, qualificationType: 'pre_u' as const } }, path: 'unknown', reason: /Pre-U|type/ },
] satisfies {
    id: string;
    profile: Profile;
    path: string;
    reason?: RegExp;
}[];
