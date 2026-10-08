import { buildOptions, QUESTIONS } from '../check-questions';
import { describe, expect, it } from 'vitest';
import { AnswersSchema, PartialAnswersSchema, buildProfile, normalizeAnswers, isAnswered, visibleSteps, withAnswer } from '../steps';
import { indiaAnswers } from './india-study.fixture';
import { reviewedPakistanRules } from '@/lib/engine/__tests__/pakistan.fixture';
import { evaluate, deriveFacts } from '@/lib/engine/evaluate';
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


it.each(['pk','in','sa'])('routes explicit Indian issuer once from %s landing and collects its evidence', certificateCountry => {
 let current = withAnswer({...a, certificateCountry, indiaStudyRouteVersion:1}, 'schoolQualificationCountry', 'in');
 current = withAnswer(current, 'schoolQualificationContext', 'national');
 const steps=visibleSteps(current);
 expect(steps.filter(s=>s==='schoolQualificationCountry')).toHaveLength(1);
 expect(steps.filter(s=>s==='schoolQualificationContext')).toHaveLength(1);
 expect(steps).toContain('board');expect(steps).toContain('schoolGradePercent');expect(steps).toContain('jeeAdvanced');
 expect(buildOptions('board',current).map(o=>o.value)).toContain('cbse');
 expect(current.pkGroup).toBeUndefined();
});
it('issuer edits preserve core history but prune wrong-country evidence and recollect school marks',()=>{
 const study={...a,indiaStudyRouteVersion:1,hasPriorUniversityStudy:true,priorQualificationType:'bachelor',priorStudyInstitution:'University',priorStudyCountry:'pk',priorStudyField:'CS',priorDegreeYears:4,yearsOfUniversityStudy:1,priorStudyCompletion:'in_progress',pkStudyMode:'full_time',pkRecognition:'reported_official_confirmed',pkRecognitionReference:'PK assessment'} as const;
 let edited=withAnswer(study,'schoolQualificationCountry','in');
 expect(edited.schoolGradePercent).toBeUndefined();expect(edited.pkRecognition).toBeUndefined();expect(edited.priorStudyInstitution).toBe('University');
 edited=withAnswer(edited,'schoolQualificationContext','national');expect(visibleSteps(edited)).toContain('priorStudyRecognition');
 edited=withAnswer({...edited,board:'cbse',schoolGradePercent:70,priorStudyRecognition:'reported_official_confirmed',priorStudyRecognitionReference:'IN assessment'},'schoolQualificationCountry','pk');
 edited=withAnswer(edited,'schoolQualificationContext','national');expect(visibleSteps(edited)).toContain('pkCertificate');expect(edited.board).toBeUndefined();expect(edited.priorStudyRecognition).toBeUndefined();
 expect(edited.priorStudyInstitution).toBe('University');
});

it('an India landing enters Pakistan evidence without a pre-existing Pakistan marker',()=>{
 const edited=withAnswer({...a,pakistanVersion:undefined,certificateCountry:'in'},'schoolQualificationCountry','pk');
 const current=withAnswer(edited,'schoolQualificationContext','national');expect(current.pakistanVersion).toBe(1);expect(visibleSteps(current)).toContain('pkCertificate');expect(visibleSteps(current)).not.toContain('board');
});

it.each(['other','unknown'])('foreign or uncertain issuer %s cannot retain hidden Indian evidence and stays cited unknown', schoolQualificationCountry=>{
 const input={...a,schoolQualificationCountry,board:'cbse',jeeAdvanced:true} as import('../steps').PartialAnswers;
 const normalized=normalizeAnswers(input);expect(normalized.board).toBeUndefined();expect(normalized.jeeAdvanced).toBeUndefined();expect(normalized.pkGroup).toBeUndefined();
 const profile=buildProfile(AnswersSchema.parse(normalized));expect(deriveFacts(profile).pk_documentary_group).toBeUndefined();
 const result=evaluate(profile,reviewedPakistanRules());expect(result.path).toBe('unknown');expect(result.citations.some(c=>c.sourceUrl.includes('ad-layerId=193'))).toBe(true);
});
it.each(['pk','in'] as const)('fresh %s landing can collect opposite issuer evidence progressively then return', landing=>{
 const target=landing==='pk'?'in':'pk';const values={...a,...indiaAnswers,...(target==='pk'?a:{}),certificateCountry:landing,schoolQualificationCountry:target};
 let current:import('../steps').PartialAnswers={qualificationHistoryVersion:1,apsScopeVersion:1,indiaStudyRouteVersion:1};
 for(let index=0;index<visibleSteps(current).length;index++){const key=visibleSteps(current)[index];if(!isAnswered(current,key))current=withAnswer(current,key,values[key as keyof typeof values] as never);}
 const profile=buildProfile(AnswersSchema.parse(current));expect(profile.certificateCountry).toBe(target);expect(profile.schoolQualification?.country).toBe(target);
 expect(visibleSteps(current)).toContain(target==='in'?'priorStudyRecognition':'pkCertificate');
 current=withAnswer(current,'schoolQualificationCountry',landing);current=withAnswer(current,'schoolQualificationContext','national');expect(visibleSteps(current)).toContain(landing==='in'?'board':'pkCertificate');
});

it.each(['international','unknown'])('uncovered %s school context stays source-review unknown', schoolQualificationContext=>{
 const normalized=normalizeAnswers({...a,schoolQualificationContext} as import('../steps').PartialAnswers);
 const profile=buildProfile(AnswersSchema.parse(normalized));expect(profile.certificateCountry).toBeUndefined();expect(profile.pakistan).toEqual({version:1});
 expect(deriveFacts(profile).pk_grade_percent).toBeUndefined();expect(evaluate(profile,reviewedPakistanRules()).path).toBe('unknown');expect(evaluate(profile,reviewedPakistanRules()).citations.length).toBeGreaterThan(0);
});
it('passport and visa changes preserve reported Pakistan study assessments',()=>{
 const study={...a,hasPriorUniversityStudy:true,priorQualificationType:'bachelor',priorStudyInstitution:'University',priorStudyCountry:'pk',priorStudyField:'CS',priorDegreeYears:4,yearsOfUniversityStudy:1,priorStudyCompletion:'in_progress',pkStudyMode:'full_time',pkStudyRegulations:'confirmed',pkAnnualRecords:'confirmed',pkSuccessfulYearsReference:'Annual records',pkRecognition:'reported_official_confirmed',pkRecognitionReference:'PK assessment',pkTargetRelation:'reported_official_previous',pkTargetRelationReference:'Target assessment'} as const;
 for(const key of ['nationality','visaApplicationCountry'] as const){const next=withAnswer(study,key,'sa');expect(next.pkRecognitionReference).toBe(study.pkRecognitionReference);expect(next.pkTargetRelationReference).toBe(study.pkTargetRelationReference);expect(next.pkSuccessfulYearsReference).toBe(study.pkSuccessfulYearsReference);}
});
