import { describe, expect, it } from 'vitest';
import { deriveFacts, evaluate, EngineRuleSchema } from '../evaluate';
import { indiaStudyCandidates } from '@/scripts/india-study.rules';
import { ruleToChunk } from '@/lib/ai/kb';
import legacy from './india-study-legacy.fixture.json';
import { INDIA_STUDY_ACCEPTANCE, historyChange, indianStudyProfile, reviewedIndiaStudyRules } from './india-study.fixture';
describe('UP-ELIG-03 accepted official-source route', () => {
    it.each(INDIA_STUDY_ACCEPTANCE)('$id [$kind]', c => {
        const r = evaluate(c.profile, reviewedIndiaStudyRules());
        expect(r.path).toBe(c.path);
        if (c.reason)
            expect(r.unknowns.some(n => c.reason!.test(n))).toBe(true);
        if (c.path === 'subject_restricted') {
            const citation = r.citations.find(c => c.ruleId === 'india-study-successful-year');
            expect(citation).toMatchObject({ sourceUrl: 'https://aps-india.de/news/', verifiedAt: '2026-10-07T00:00:00Z', supports: ['path'] });
            expect(citation?.claim).toMatch(/applicant-reported.*not independently verified.*admission/i);
        }
        expect(r.citations.some(c => c.ruleId === '0e872b82-e7fb-41bb-9a35-53ecbe200df4')).toBe(false);
    });
    it('retains exact unsafe legacy metadata inactive', () => { const old = legacy.find(r => r.id === '0e872b82-e7fb-41bb-9a35-53ecbe200df4')!; expect(old.slug).toBe('in-1yr-bachelor-70pct-subject-restricted'); expect(old.last_verified_at).toBe('2026-07-04T00:00:00+00:00'); expect(EngineRuleSchema.safeParse(old).success).toBe(false); expect(evaluate(indianStudyProfile, [old]).path).toBe('unknown'); });
    it('positive route has exact 13 keys and no JEE failure dependency; JEE remains independent', () => { expect(Object.keys(indiaStudyCandidates[0].conditions)).toHaveLength(13); expect(indiaStudyCandidates[0].conditions).not.toHaveProperty('jee_advanced'); for (const jeeAdvanced of [true, false, undefined])
        expect(evaluate({ ...indianStudyProfile, jeeAdvanced }, reviewedIndiaStudyRules()).path).toBe('subject_restricted'); expect(evaluate({ ...historyChange({ priorStudyRecognition: 'unknown' }), jeeAdvanced: true }, reviewedIndiaStudyRules()).path).toBe('unknown'); });
    it('does not invent publication or conflate certificate fulfilment', () => { expect(indiaStudyCandidates.every(r => r.status === 'draft')).toBe(true); for (const rules of [[], indiaStudyCandidates])
        expect(evaluate(indianStudyProfile, rules).citations).toEqual([]); for (const hasExistingApsCertificate of [true, false, undefined]) {
        const r = evaluate({ ...indianStudyProfile, hasExistingApsCertificate }, reviewedIndiaStudyRules());
        expect(r.path).toBe('subject_restricted');
        expect(r.apsCertificate).toBe(hasExistingApsCertificate === true ? 'held' : hasExistingApsCertificate === false ? 'missing' : 'unknown');
    } });
    it('retains ELIG06 below-70 transition boundaries and uncertain timing', () => { for (const submissionDate of ['2026-03-14', '2026-03-15', '2026-03-16']) {
        const r = evaluate({ ...indianStudyProfile, schoolGradePercent: 69.99, apsProcedure: { status: 'pending', submissionConfirmation: 'confirmed', submissionDate } }, reviewedIndiaStudyRules());
        expect(r.path).toBe(submissionDate === '2026-03-14' ? 'unknown' : 'insufficient');
        expect(r.citations.some(c => c.ruleId === 'india-study-successful-year')).toBe(false);
    } for (const hasExistingApsCertificate of [true, false, undefined]) {
        const r = evaluate({ ...indianStudyProfile, schoolGradePercent: 69.99, hasExistingApsCertificate }, reviewedIndiaStudyRules());
        expect(r.path).toBe('unknown');
        expect(r.unknowns.some(n => /complete.*submission/i.test(n))).toBe(true);
    } });
    it('resolves equal-specificity conflict to unknown with both citations', () => { const positive = { ...indiaStudyCandidates[0], status: 'verified' }; const opposing = { ...positive, id: 'opposing-reviewed-copy', source_url: 'https://www.daad.in/en/', outcomes: { path: 'insufficient' } }; const r = evaluate(indianStudyProfile, [positive, opposing]); expect(r.path).toBe('unknown'); expect(r.citations.map(c => c.ruleId)).toEqual([positive.id, opposing.id]); expect(r.unknowns.some(n => /Conflicting rules/.test(n))).toBe(true); });
    it('labels reported semantic facts and retains source metadata in KB', () => { const r = indiaStudyCandidates[0]; const chunk = ruleToChunk({ ...r, slug: r.id, country_code: 'in', last_verified_at: r.last_verified_at ?? null }); expect(chunk.content).toContain('not app verification'); expect(chunk.content).toContain('not programme duration'); expect(chunk.source_url).toBe(r.source_url); expect(chunk.last_verified_at).toBe(r.last_verified_at); });
    it('does not extend route to PK/SA qualifications, IB/GCE or masters', () => { for (const change of [{ schoolQualification: { country: 'pk', context: 'national' as const } }, { schoolQualification: { country: 'sa', context: 'national' as const } }, { curriculumType: 'ib' as const }, { curriculumType: 'gce' as const }, { targetDegree: 'master' as const }]) {
        const p = { ...indianStudyProfile, ...change };
        expect(deriveFacts(p)).not.toHaveProperty('in_class12_prior_study_kind');
        expect(evaluate(p, reviewedIndiaStudyRules()).citations.some(c => c.ruleId.startsWith('india-study-'))).toBe(false);
    } });
    it.each([{ schoolGradePercent: undefined }, { intake: undefined }, { schoolQualification: undefined }, { schoolQualification: { country: 'in', context: undefined } }])('requires missing applicability %j', change => { const r = evaluate({ ...indianStudyProfile, ...change }, reviewedIndiaStudyRules()); expect(r.path).toBe('unknown'); expect(r.unknowns.some(n => /Class XII|intake|issuer|context/.test(n))).toBe(true); });
});
it('explicit school-only history retains its independent reviewed school route; a legacy JEE boolean cannot grant direct access', () => { expect(evaluate({ ...indianStudyProfile, qualificationHistory: { hasPriorUniversityStudy: false }, jeeAdvanced: true }, reviewedIndiaStudyRules()).path).toBe('studienkolleg'); });

it('can show reported direct access while scoped APS preparation is outstanding',()=>{const r=evaluate({...indianStudyProfile,apsApplicationContext:'uni_assist',hasExistingApsCertificate:false},reviewedIndiaStudyRules());expect(r.path).toBe('subject_restricted');expect(r.apsScopes?.qualification).toBe('required');expect(r.apsScopes?.application).toBe('required');expect(r.apsCertificate).toBe('missing');expect(r.stepsDetailed.some(s=>s.acquisition)).toBe(true);});

it('keeps an explicit unknown school issuer diagnostic despite a saved legacy school fallback', () => {
 const p = { ...indianStudyProfile, schoolQualification: { country: 'unknown', context: 'national' as const } };
 const r = evaluate({ ...p, nationality: 'pk', visaApplicationCountry: 'sa' }, reviewedIndiaStudyRules());
 expect(deriveFacts(p).aps_issuer_country).toBe('unknown');
 expect(r.path).toBe('unknown');
 expect(r.unknowns.some(n => /issuer/i.test(n))).toBe(true);
 expect(r.citations.some(c => c.ruleId === '8d95fa83-385f-4863-88cc-7dfe0a3036c6')).toBe(false);
});
