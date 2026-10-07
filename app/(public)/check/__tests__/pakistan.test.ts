import { buildOptions, QUESTIONS } from '../check-questions';
import { describe, expect, it } from 'vitest';
import { AnswersSchema, PartialAnswersSchema, buildProfile, normalizeAnswers, visibleSteps, withAnswer } from '../steps';
import { deriveFacts } from '@/lib/engine/evaluate';
const a = { qualificationHistoryVersion: 1, pakistanVersion: 1, apsScopeVersion: 1, targetDegree: 'bachelor', nationality: 'in', visaApplicationCountry: 'sa', certificateCountry: 'pk', curriculumType: 'national', schoolQualificationCountry: 'pk', schoolQualificationContext: 'national', pkCertificate: 'hssc', pkGroup: 'science', pkSchoolCompletion: 'completed_12_grades', schoolGradePercent: 50, hasPriorUniversityStudy: false, targetField: 'cs', pkTargetFamily: 'technology', pkTargetFamilyReference: 'University programme lists Technology', intake: null, apsApplicationContext: 'unknown', visaMissionContext: 'unknown' } as const;
describe('Pakistan versioned checker', () => {
    it('maps validated exact certificate and group separately', () => { const p = buildProfile(AnswersSchema.parse(a)); expect(p.pakistan).toMatchObject({ version: 1, certificate: 'hssc', group: 'science', completion: 'completed_12_grades' }); expect(deriveFacts(p).pk_certificate).toBe('hssc'); });
    it('progressive issuer certificate completion group grade collection', () => { const s = visibleSteps(a); expect(s.indexOf('schoolQualificationCountry')).toBeLessThan(s.indexOf('pkCertificate')); expect(s.indexOf('pkCertificate')).toBeLessThan(s.indexOf('pkGroup')); expect(s).not.toContain('board'); expect(visibleSteps({ ...a, pkCertificate: undefined })).not.toContain('pkGroup'); expect(AnswersSchema.safeParse({ ...a, pkGroup: undefined }).success).toBe(false); });
    it('explicit uncertainty stays distinct from absent grade and history', () => { expect(AnswersSchema.safeParse({ ...a, schoolGradePercent: null }).success).toBe(true); expect(AnswersSchema.safeParse({ ...a, schoolGradePercent: undefined }).success).toBe(false); expect(AnswersSchema.safeParse({ ...a, hasPriorUniversityStudy: undefined }).success).toBe(false); });
    it('prunes changed certificate group issuer target and non-national context', () => { for (const [key, value] of [['pkCertificate', 'ics'], ['pkGroup', 'commerce'], ['schoolQualificationCountry', 'sa'], ['curriculumType', 'gce']] as const) {
        const n = withAnswer(a, key, value);
        expect(n.pkTargetFamilyReference).toBeUndefined();
    } expect(withAnswer(a, 'targetField', 'physics').pkTargetFamily).toBeUndefined(); expect(withAnswer(a, 'nationality', 'pk').pkTargetFamilyReference).toBe(a.pkTargetFamilyReference); expect(withAnswer(a, 'visaApplicationCountry', 'in').pkTargetFamilyReference).toBe(a.pkTargetFamilyReference); });
    it('legacy reads do not alias FSc and restoration prunes hidden data', () => { const old = { targetDegree: 'bachelor', nationality: 'pk', certificateCountry: 'pk', visaApplicationCountry: 'pk', curriculumType: 'national', board: 'fsc', schoolGradePercent: 70, targetField: 'cs', intake: null } as const; expect(AnswersSchema.safeParse(old).success).toBe(true); expect(buildProfile(AnswersSchema.parse(old)).pakistan).toBeUndefined(); expect(normalizeAnswers({ ...a, curriculumType: 'ib' })).not.toHaveProperty('pkGroup'); expect(PartialAnswersSchema.safeParse({ ...a, pkTargetFamilyReference: '' }).success).toBe(true); });
});
it('provides every Pakistan option with reported-evidence copy and official links', () => { for (const step of visibleSteps({ ...a, hasPriorUniversityStudy: true, priorQualificationType: 'bachelor', pkAnnualRecords: 'unknown', pkRecognition: 'unknown', pkTargetRelation: 'unknown' })) {
    if (step.startsWith('pk') && !step.endsWith('Reference')) {
        expect(buildOptions(step, a).length).toBeGreaterThan(1);
        expect(QUESTIONS[step].sourceUrl).toMatch(/^https:/);
    }
} });
it('successful years and records are separate from degree completion', () => { const study = { ...a, hasPriorUniversityStudy: true, priorQualificationType: 'bachelor', priorStudyInstitution: 'University', priorStudyCountry: 'pk', priorStudyField: 'cs', priorDegreeYears: 4, yearsOfUniversityStudy: 1, priorStudyCompletion: 'in_progress', pkStudyMode: 'full_time', pkStudyRegulations: 'confirmed', pkAnnualRecords: 'confirmed', pkSuccessfulYearsReference: 'Annual subjects and marks confirm successful year', pkRecognition: 'unknown', pkTargetRelation: 'unknown' } as const; const p = buildProfile(AnswersSchema.parse(study)); expect(p.qualificationHistory?.completion).toBe('in_progress'); expect(deriveFacts(p).pk_successful_academic_years).toBe(1); expect(AnswersSchema.safeParse({ ...study, pkSuccessfulYearsReference: undefined }).success).toBe(false); expect(AnswersSchema.safeParse({ ...study, yearsOfUniversityStudy: null, pkAnnualRecords: 'unknown' }).success).toBe(true); for (const key of ['priorStudyInstitution', 'priorStudyCountry', 'priorQualificationType'] as const) {
    const n = withAnswer(study, key, key === 'priorStudyCountry' ? 'in' : key === 'priorQualificationType' ? 'diploma' : 'Changed');
    expect(n.pkStudyMode).toBeUndefined();
    expect(n.pkAnnualRecords).toBeUndefined();
} });
it('new forward Pakistan flow reaches every newly required question', () => { let current = { qualificationHistoryVersion: 1, pakistanVersion: 1, apsScopeVersion: 1 } as import('../steps').PartialAnswers; for (let i = 0; i < visibleSteps(current).length; i++) {
    const key = visibleSteps(current)[i];
    if (current[key] === undefined)
        current = withAnswer(current, key, a[key as keyof typeof a] as never);
} expect(AnswersSchema.safeParse(current).success).toBe(true); expect(buildProfile(AnswersSchema.parse(current)).pakistan?.group).toBe('science'); });
