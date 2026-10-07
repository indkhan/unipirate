import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { ruleData } from '../../../scripts/rules.bootstrap';
import { fixtureRules } from './rules.fixture';
import { GCE_ACCEPTANCE, ordinaryGce, gceCase, gceSubject } from './gce.fixture';
export const reviewedGceRules = () => fixtureRules.map(r => r.id.startsWith('gce-') ? { ...r, status: 'verified' as const } : r);
describe('UP-ELIG-01 ordinary GCE', () => {
    it.each(GCE_ACCEPTANCE)('$id', c => { const r = evaluate(c.profile, reviewedGceRules()); expect(r.path).toBe(c.path); if (c.reason)
        expect(r.unknowns.some(n => c.reason!.test(n)), r.unknowns.join('\n')).toBe(true); });
    it('preserves academic outcome across citizenship, visa and order', () => { for (const country of ['in', 'pk', 'sa'])
        expect(evaluate({ ...ordinaryGce, nationality: country, visaApplicationCountry: country, gce: { ...ordinaryGce.gce!, subjects: [...ordinaryGce.gce!.subjects].reverse() } }, reviewedGceRules()).path).toBe('subject_restricted'); });
    it('does not invent a composite witness', () => { const p = gceCase(['mathematics', 'physics', 'statistics', 'psychology']); expect(evaluate(p, reviewedGceRules()).path).toBe('subject_restricted'); const rules = reviewedGceRules().filter(r => !r.id.startsWith('gce-') || r.id === 'gce-technical-subject-restricted').map(r => r.id === 'gce-technical-subject-restricted' ? { ...r, conditions: { ...r.conditions, gce_list_a_count: { op: 'gte' as const, value: 3 }, gce_has_humanities_al: true, gce_science_or_math_count: { op: "gte" as const, value: 3 } } } : r); expect(evaluate({ ...ordinaryGce, gce: { ...ordinaryGce.gce!, subjects: [...ordinaryGce.gce!.subjects, gceSubject('english_language')] } }, rules).path).toBe('unknown'); });
    it('quarantines legacy positive rows without qualification applicability', () => { const old = { id: 'legacy-gce', conditions: { curriculum: 'gce' }, outcomes: { path: 'subject_restricted' }, status: 'verified', source_url: 'https://www.daad.de/en/studying-in-germany/requirements/gce/', source_quote: 'Stored historical evidence', last_verified_at: '2026-07-04T00:00:00Z' }; expect(evaluate(ordinaryGce, [old]).path).toBe('unknown'); });
    it('retains D/E/U extras, exact C boundary and recognised Pearson current coverage', () => { for (const grade of ['D', 'E', 'U'] as const)
        expect(evaluate({ ...ordinaryGce, gce: { ...ordinaryGce.gce!, awardingBody: 'pearson', subjects: [...ordinaryGce.gce!.subjects, { ...gceSubject('biology'), grade }] } }, reviewedGceRules()).path).toBe('subject_restricted'); });
    it('uses issuer-specific Marine Science and explicit unrecognised subjects', () => { const marine = gceCase(['history', 'geography', 'marine_science'], 'humanities'); expect(evaluate(marine, reviewedGceRules()).path).toBe('subject_restricted'); expect(evaluate({ ...marine, gce: { ...marine.gce!, awardingBody: 'pearson' } }, reviewedGceRules()).path).toBe('unknown'); });
    it('does not count a language alias or unknown catalogue ID as independent recognition', () => { expect(evaluate(gceCase(['english_literature', 'literature_in_english', 'history'], 'humanities'), reviewedGceRules()).path).toBe('unknown'); expect(evaluate(gceCase(['mathematics', 'physics', 'guessed_subject']), reviewedGceRules()).path).toBe('unknown'); });
    it('leaves provisional evidence without dates and AICE unresolved', () => { for (const p of [{ ...ordinaryGce, gce: { ...ordinaryGce.gce!, evidence: 'provisional' as const } }, { ...ordinaryGce, gce: { ...ordinaryGce.gce!, qualificationType: 'aice' as const } }])
        expect(evaluate(p, reviewedGceRules()).path).toBe('unknown'); });
    it('candidate publication remains draft and absent rules do not establish criteria', () => { expect(ruleData.filter(r => r.id.startsWith('gce-')).every(r => r.status === 'draft')).toBe(true); expect(evaluate(ordinaryGce, []).path).toBe('unknown'); });
});
