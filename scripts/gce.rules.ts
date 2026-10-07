// Source-reviewed candidates only. seed.ts preserves draft status; no runtime import.
import { intakeIndex, type EngineRule } from '../lib/engine/evaluate';
const url = 'https://www.daad.de/en/studying-in-germany/requirements/gce/';
const checked = '2026-10-07T00:00:00Z';
const bodies = ['aqa', 'caie', 'ccea', 'lrn', 'ocr', 'oxford_aqa', 'pearson', 'wjec'];
const base: EngineRule["conditions"] = { curriculum: 'gce', target_degree: 'bachelor', gce_qualification_context: { op: 'in', value: ['uk', 'british_international'] }, gce_qualification_type: { op: 'in', value: ['al', 'ial'] }, gce_evidence: 'final', gce_awarding_body: { op: 'in', value: bodies }, gce_school_years: { op: 'gte', value: 12 }, gce_distinct_al_count: { op: 'gte', value: 3 }, gce_list_a_count: { op: 'gte', value: 2 }, gce_general_al_count: { op: 'gte', value: 3 }, gce_min_al_grade: { op: 'gte', value: 3 } };
const targets: {
    id: string;
    fields: string[];
    conditions: EngineRule['conditions'];
    note: string;
}[] = [
    { id: 'technical', fields: ['cs', 'it', 'engineering', 'mechanical_engineering', 'electrical_engineering', 'civil_engineering', 'math'], conditions: { gce_has_math_al: true, gce_has_technical_support_al: true }, note: 'Mathematics and technical studies require Mathematics and one Biology/Chemistry/Physics/Computer Science AL in the same qualifying trio.' },
    { id: 'social-economics', fields: ['economics', 'business', 'management', 'commerce', 'accounting', 'finance', 'social_science'], conditions: { gce_has_social_economics_al: true, gce_has_science_or_math_al: true }, note: 'Social science/economics requires a social/economics AL and a science/math AL in the same qualifying trio.' },
    { id: 'humanities', fields: ['humanities', 'law', 'history', 'geography', 'language'], conditions: { gce_has_humanities_al: true }, note: 'Humanities/law requires a language/history/geography/social studies/politics/economics AL in the same qualifying trio.' },
    { id: 'science', fields: ['physics', 'chemistry', 'biology', 'natural_science'], conditions: { gce_science_or_math_count: { op: 'gte', value: 2 } }, note: 'Natural sciences require two Mathematics/Biology/Chemistry/Physics/Computer Science ALs in the same qualifying trio.' },
    { id: 'medicine-pharmacy', fields: ['medicine', 'pharmacy'], conditions: { gce_science_or_math_count: { op: 'gte', value: 3 } }, note: 'Medicine including pharmacy requires three Mathematics/Biology/Chemistry/Physics/Computer Science ALs in the same qualifying trio.' },
    { id: 'arts', fields: ['arts'], conditions: {}, note: 'Art oriented studies have no additional subject-specific AL requirement.' },
];
export const gceCandidates: (EngineRule & {
    country: null;
})[] = targets.flatMap(t => {
    const candidate = { id: 'gce-' + t.id + '-subject-restricted', country: null, status: 'draft' as const, conditions: { ...base, ...t.conditions, target_field: { op: 'in' as const, value: t.fields }, intake_index: { op: 'in' as const, value: [intakeIndex('winter', 2026), intakeIndex('summer', 2027), intakeIndex('winter', 2027)] } }, outcomes: { path: 'subject_restricted' as const, note: t.note + ' Ordinary UK/British-international qualification; binding recognition and programme admission remain with the responsible authority.' }, source_url: url, source_quote: '3 general, independent subjects at A Level with a minimum grade of C', last_verified_at: checked,
        // Coverage scope, NOT a claimed DAAD effective date. Publication/reviewer unknown.
        publication_metadata: null, source_checked_date: '2026-10-07', coverage: 'current ordinary 2026/27–2027/28; historical national-system and List C programme variants unverified' };
    return [candidate, { ...candidate, id: candidate.id + '-cambridge', conditions: { ...candidate.conditions, gce_awarding_body: 'caie', intake_index: { op: 'gte' as const, value: intakeIndex('summer', 2022) } }, source_url: 'https://www.cambridgeinternational.org/Images/648183-pre-u-recognition-in-germany.pdf', source_quote: 'Universities will apply the new framework already from summer semester 2022, if it is more favourable for admission purposes.', coverage: 'Cambridge International AL: new framework Summer 2024; favourable new-formula route Summer 2022 onward. No old-formula automation.' }];
});
