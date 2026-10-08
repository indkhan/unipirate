import { describe, expect, it } from 'vitest';
import { AnswersSchema, PartialAnswersSchema, buildProfile, isAnswered, normalizeAnswers, visibleSteps, withAnswer, type PartialAnswers } from '../steps';
import { buildOptions, QUESTIONS } from '../check-questions';
import { deriveFacts, evaluate } from '@/lib/engine/evaluate';
import { fixtureRules } from '@/lib/engine/__tests__/rules.fixture';
const legacy = {targetDegree:'bachelor',nationality:'in',certificateCountry:'in',visaApplicationCountry:'in',curriculumType:'national',board:'cbse',schoolGradePercent:82,jeeAdvanced:true,hasExistingApsCertificate:false,targetField:'mechanical_engineering',intake:{term:'winter',year:2026}} as const;
export const jeeAnswers = {...legacy,jeeAdvanced:undefined,qualificationHistoryVersion:1,apsScopeVersion:1,indiaStudyRouteVersion:1,jeeVersion:1,schoolQualificationCountry:'in',schoolQualificationContext:'national',hasPriorUniversityStudy:false,apsApplicationContext:'unknown',jeeMainStatus:'passed',jeeAdvancedStatus:'passed',jeeEvidenceContext:'ordinary'} as const;
describe('UP-ELIG-04 checker',()=>{
 it('collects separate qualifying passages after issuer and before APS timing',()=>{
 const steps=visibleSteps(jeeAnswers);expect(steps).toContain('jeeMainStatus');expect(steps).toContain('jeeAdvancedStatus');expect(steps).toContain('jeeEvidenceContext');expect(steps).not.toContain('jeeAdvanced');expect(steps.indexOf('jeeMainStatus')).toBeGreaterThan(steps.indexOf('schoolQualificationContext'));
 const p=buildProfile(AnswersSchema.parse(jeeAnswers));expect(p.jee).toEqual({main:'passed',advanced:'passed',context:'ordinary'});expect(p.jeeAdvanced).toBeUndefined();
 expect(deriveFacts(p)).toMatchObject({jee_main_status:'passed',jee_advanced_status:'passed'});
 });
 it.each(['passed','not_passed','no_result','unknown'] as const)('validates each explicit reported status %s',status=>{
 expect(PartialAnswersSchema.safeParse({...jeeAnswers,jeeMainStatus:status,jeeAdvancedStatus:status}).success).toBe(true);
 expect(buildOptions('jeeMainStatus',jeeAnswers).map(o=>o.value)).toContain(status);
 });
 it('score, percentile, rank and result possession never satisfy qualifying passage',()=>{
 for(const value of [true,99.9,'rank','result_available']) expect(PartialAnswersSchema.safeParse({...jeeAnswers,jeeMainStatus:value}).success).toBe(false);
 expect(AnswersSchema.safeParse({...jeeAnswers,jeeMainStatus:undefined}).success).toBe(false);
 expect(AnswersSchema.safeParse({...jeeAnswers,jeeEvidenceContext:undefined}).success).toBe(false);
 expect(QUESTIONS.jeeMainStatus.subtitle).toMatch(/percentile|score/);expect(QUESTIONS.jeeAdvancedStatus.subtitle).toMatch(/qualifying/);
 });
 it('failed/no-result statuses remain complete reports, without auto school fallback',()=>{
 const answers={...jeeAnswers,jeeMainStatus:'no_result',jeeAdvancedStatus:'not_passed',jeeEvidenceContext:undefined} as const;
 expect(AnswersSchema.safeParse(answers).success).toBe(true);expect(visibleSteps(answers)).not.toContain('jeeEvidenceContext');
 expect(evaluate(buildProfile(AnswersSchema.parse(answers)),fixtureRules).path).toBe('unknown');
 });
 it.each(['main_exemption','preparatory_rank','cross_year','unclear'] as const)('preserves exception %s for individual assessment',jeeEvidenceContext=>{
 const p=buildProfile(AnswersSchema.parse({...jeeAnswers,jeeEvidenceContext}));expect(p.jee?.context).toBe(jeeEvidenceContext);expect(evaluate(p,fixtureRules).unknowns.join(' ')).toMatch(/individual assessment/i);
 });
 it.each([['board','cisce'],['certificateCountry','sa'],['curriculumType','gce'],['targetDegree','master'],['schoolQualificationCountry','pk'],['schoolQualificationContext','international']] as const)('qualification edit %s invalidates stale evidence', (key,value)=>{
 const a=withAnswer(jeeAnswers,key,value);expect(a.jeeMainStatus).toBeUndefined();expect(a.jeeAdvancedStatus).toBeUndefined();expect(a.jeeEvidenceContext).toBeUndefined();
 });
 it('exam-status edits invalidate context while retaining the independent other exam and history',()=>{
 const a=withAnswer(jeeAnswers,'jeeMainStatus','unknown');expect(a.jeeAdvancedStatus).toBe('passed');expect(a.jeeEvidenceContext).toBeUndefined();expect(a.hasPriorUniversityStudy).toBe(false);
 });
 it('target/intake edits retain exam evidence but re-evaluate; passport/visa alone supply no facts',()=>{
 for(const [key,value] of [['targetField','law'],['intake',null],['nationality','pk'],['visaApplicationCountry','sa']] as const){
 const a=withAnswer(jeeAnswers,key,value);expect(a.jeeMainStatus).toBe('passed');expect(a.jeeAdvancedStatus).toBe('passed');
 expect(evaluate(buildProfile(a as typeof jeeAnswers),fixtureRules).path).not.toBe('direct');}
 });
 it('legacy stored/draft answers stay readable but never become Main/qualifying passage',()=>{
 const saved=PartialAnswersSchema.parse(JSON.parse(JSON.stringify(legacy)));expect(saved.jeeAdvanced).toBe(true);expect(AnswersSchema.safeParse(saved).success).toBe(true);
 const p=buildProfile(AnswersSchema.parse(saved));expect(p.jeeAdvanced).toBe(true);expect(p.jee).toBeUndefined();expect(evaluate(p,fixtureRules).path).toBe('unknown');
 const edited=withAnswer(saved,'board','cisce');expect(edited.jeeVersion).toBe(2);expect(edited.jeeMainStatus).toBeUndefined();
 });
 it('normalization keeps partial explicit uncertainty and prunes hidden evidence without mutating input',()=>{
 const input={...jeeAnswers,jeeMainStatus:'unknown',jeeAdvancedStatus:undefined,jeeEvidenceContext:undefined} as const;
 const draft=normalizeAnswers(PartialAnswersSchema.parse(JSON.parse(JSON.stringify(input))));expect(draft.jeeMainStatus).toBe('unknown');expect(isAnswered(draft,'jeeAdvancedStatus')).toBe(false);
 const hidden=normalizeAnswers({...jeeAnswers,targetDegree:'master'} as PartialAnswers);expect(hidden.jeeMainStatus).toBeUndefined();expect(jeeAnswers.jeeMainStatus).toBe('passed');
 });
});
