// Source review 2026-10-08. Candidates remain unpublished; never imported by runtime.
import type { EngineRule } from '../lib/engine/evaluate';
const database = 'https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=6&ad-layerId=';
const scope = { target_degree: 'bachelor', curriculum: 'national', aps_issuer_country: 'pk', aps_qualification_context: 'national' } as const;
const metadata = { country: 'pk', status: 'draft', last_verified_at: '2026-10-07T23:15:59Z', published_at: null, applicability: 'Current DAAD undergraduate guidance; applicant reports; institution final assessment', effective_intake: null } as const;
const disclaimer = ' Subject-restricted preparatory/Feststellungsprüfung access only; no arbitrary programme eligibility or admission guarantee. Target family is applicant-reported, not independently verified. Current official database guidance is nonbinding; the institution makes the final assessment. Effective intake is not established.';
export const pakistanCandidates: (EngineRule & {
    country: string;
    published_at: null;
    applicability: string;
    effective_intake: null;
})[] = [];
for (const [group, families, label, prep, direct] of [
    ['science', ['medicine', 'natural_sciences', 'technology'], 'Medicine, Natural Sciences and Technology', '193', '195'],
    ['commerce', ['social_sciences', 'economics'], 'Social Sciences and Economics', '197', '199'],
    ['humanities', ['humanities'], 'Humanities', '204', null],
] as const) {
    pakistanCandidates.push({ ...metadata, id: 'pakistan-prep-' + group, conditions: { ...scope, pk_certificate: { op: 'in', value: ['hssc', 'intermediate'] }, pk_documentary_group: group, pk_school_completion: 'completed_12_grades', pk_grade_percent: { op: 'gte', value: 50 }, pk_prior_study_kind: 'none', pk_target_family: { op: 'in', value: [...families] } }, outcomes: { path: 'studienkolleg', note: 'Preparatory subject areas: ' + label + '.' + disclaimer }, source_url: database + prep, source_quote: group === 'humanities' ? 'subject area of Humanities' : label });
    if (direct) {
        const conditions = { ...scope, pk_documentary_group: group, pk_prior_study_kind: 'bachelor' };
        const note = 'One-year versus two-year prior-study source conflict: current DAAD selected result says one successfully completed academic year; the still-linked 2022 PDF says two. No verified supersession or effective scope resolves this conflict. Direct entry remains unknown even with reported successful study. Recognition, full-time academic study under regulations, annual subject/marks records, Pakistan study country and previous/related target require applicable evidence. This conflict is separate from completed two-year-degree equivalence. Confirm with DAAD and the receiving institution.';
        pakistanCandidates.push({ ...metadata, id: 'pakistan-study-conflict-current-' + group, conditions, outcomes: { path: 'unknown', note }, source_url: database + direct, source_quote: '1 successfully completed academic year' });
        pakistanCandidates.push({ ...metadata, id: 'pakistan-study-conflict-pdf-' + group, conditions, outcomes: { path: 'unknown', note }, source_url: 'https://www.daad.pk/files/2022/11/Study-in-Germany-Undergraduate-Degree-Courses_2022.pdf', source_quote: 'FSc + two successfully completed years' });
    }
}
for (const [kind, note] of [['completed_qualification', 'Completed qualification outcomes (including two-/four-year degrees) require separate official assessment; degree completion is distinct from successful academic-year study.'], ['other', 'Another prior qualification requires its own official assessment.'], ['unknown', 'Prior university-study answer is missing or uncertain; elapsed time and a university name do not establish successful academic years.']] as const)
    pakistanCandidates.push({ ...metadata, id: 'pakistan-review-' + kind, conditions: { ...scope, pk_prior_study_kind: kind }, outcomes: { path: 'unknown', note: note + ' Confirm with the university and uni-assist Pakistan.' }, source_url: 'https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/pk/', source_quote: 'overview of subjects and grades' });
pakistanCandidates.push({ ...metadata, id: 'pakistan-study-humanities-review', conditions: { ...scope, pk_documentary_group: 'humanities', pk_prior_study_kind: 'bachelor' }, outcomes: { path: 'unknown', note: 'Humanities prior-study selected result 206 is unavailable. No verified direct outcome; confirm with DAAD and the university.' }, source_url: database + '204', source_quote: 'no periods of study' });
pakistanCandidates.push({ ...metadata, id: 'pakistan-master-review', conditions: { target_degree: 'master', certificate_country: 'pk' }, outcomes: { path: 'unknown', note: 'Pakistan master admission requires a separate completed-qualification assessment. Completed two-/four-year degrees and HEC attestation do not establish programme eligibility; confirm with the institution and uni-assist Pakistan. The two-year-degree discrepancy differs from the prior-study one-/two-year conflict.' }, source_url: 'https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/pk/', source_quote: 'minimum passing grade for your degree to be awarded' });
