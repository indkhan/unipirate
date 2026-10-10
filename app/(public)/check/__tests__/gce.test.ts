import { describe, expect, it } from 'vitest';
import { AnswersSchema, PartialAnswersSchema, buildProfile, isAnswered, visibleSteps, withAnswer } from '../steps';
const legacy = { targetDegree: 'bachelor', nationality: 'in', certificateCountry: 'sa', visaApplicationCountry: 'sa', curriculumType: 'gce', gceAwardingBody: 'caie', gceSubjects: [{ subjectId: 'mathematics', level: 'AL', grade: 'C' }, { subjectId: 'physics', level: 'AL', grade: 'C' }, { subjectId: 'chemistry', level: 'AL', grade: 'C' }], targetField: 'cs', intake: { term: 'winter', year: 2026 } } as const;
const current = { ...legacy, gceVersion: 1, gceSchoolYears: 12, gceQualificationContext: 'british_international', gceQualificationType: 'ial', gceEvidence: 'final' } as const;
describe('reported GCE evidence', () => {
    it('reads legacy results without inventing years or context', () => { const a = AnswersSchema.parse(legacy); expect(buildProfile(a).gce?.schoolYears).toBeUndefined(); expect(buildProfile(a).gce?.qualificationContext).toBeUndefined(); });
    it('requires new actual schooling and identity evidence', () => { expect(AnswersSchema.safeParse(current).success).toBe(true); for (const key of ['gceSchoolYears', 'gceQualificationContext', 'gceQualificationType', 'gceEvidence'])
        expect(AnswersSchema.safeParse({ ...current, [key]: undefined }).success).toBe(false); });
    it('accepts low reported whole years and rejects impossible values', () => { for (const years of [0, 1, 11, 12, 13])
        expect(AnswersSchema.safeParse({ ...current, gceSchoolYears: years }).success).toBe(true); for (const years of [-1, 11.5, 51])
        expect(isAnswered({ ...current, gceSubjects: [...current.gceSubjects], gceSchoolYears: years }, 'gceSchoolYears')).toBe(false); });
    it('retains unfinished numeric drafts', () => { expect(PartialAnswersSchema.safeParse({ ...current, gceSchoolYears: 11.5 }).success).toBe(true); });
    it('edits collect evidence and preserve country, APS fulfilment and intake', () => { const edit = withAnswer(AnswersSchema.parse(legacy), 'targetField', 'physics'); expect(visibleSteps(edit)).not.toContain('gceSchoolYears'); expect(edit.certificateCountry).toBe('sa'); expect(edit.intake).toEqual(legacy.intake); });
    it('maps the source catalogue and separates national identity from country', () => { const a = AnswersSchema.parse({ ...current, certificateCountry: 'pk', gceQualificationContext: 'national', gceSubjects: [{ subjectId: 'statistics', level: 'AL', grade: 'C' }] }); expect(buildProfile(a).gce?.subjects[0].list).toBe('B'); expect(buildProfile(a).gce?.qualificationContext).toBe('national'); });
    it('curriculum changes prune GCE evidence', () => { const a = withAnswer(AnswersSchema.parse(current), 'curriculumType', 'other'); expect(a.gceSchoolYears).toBeUndefined(); expect(a.gceQualificationContext).toBeUndefined(); });
});
