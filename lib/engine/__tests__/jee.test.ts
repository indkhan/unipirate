import { describe, expect, it } from 'vitest';
import { deriveFacts, EngineRuleSchema, evaluate, type EngineRule } from '../evaluate';
import { jeeProfile, JEE_ACCEPTANCE, reviewedJeeRules } from './jee.fixture';
import legacy from './jee-legacy.fixture.json';
import { indianStudyProfile, reviewedIndiaStudyRules } from './india-study.fixture';

// Artificial UNPUBLISHED specification fixture, NOT official admission proof.
// The example certificate/field/intakes below deliberately test the matcher contract only.
const specification: EngineRule = {
 id:'UNPUBLISHED-SPECIFICATION-JEE',status:'draft',
 conditions:{target_degree:'bachelor',curriculum:'national',aps_issuer_country:'in',aps_qualification_context:'national',jee_school_certificate:'completed_12_year_secondary',
 jee_main_status:'passed',jee_advanced_status:'passed',jee_evidence_context:'ordinary',jee_reported_target_family:{op:'in',value:['reported_official_technology','reported_official_natural_sciences']},target_field:{op:'in',value:['mechanical_engineering','physics']},intake_index:{op:'in',value:[4053,4054]}},
 outcomes:{path:'subject_restricted'},source_url:'https://example.org/unpublished-specification',source_quote:'Artificial matcher specification; not an official eligibility claim.',last_verified_at:null,
};
const disposable = {...specification,status:'verified',last_verified_at:'2026-10-07T00:00:00Z'};
describe('UP-ELIG-04 ordinary qualifying-pass contract',()=>{
 it('separate statuses restate reported evidence; legacy true supplies neither passage',()=>{
  expect(deriveFacts(jeeProfile)).toMatchObject({jee_main_status:'passed',jee_advanced_status:'passed',jee_evidence_context:'ordinary'});
  const facts=deriveFacts({...jeeProfile,jee:undefined,jeeAdvanced:true});
  expect(facts).not.toHaveProperty('jee_main_status');expect(facts).not.toHaveProperty('jee_advanced_status');
 });
 it('requires a complete explicitly scoped positive rule; unpublished candidates cannot grant access',()=>{
  expect(EngineRuleSchema.safeParse(specification).success).toBe(true);
  expect(evaluate(jeeProfile,[specification]).path).toBe('unknown');
  const r=evaluate(jeeProfile,[disposable]);expect(r.path).toBe('subject_restricted');
  expect(r.citations[0]).toMatchObject({ruleId:specification.id,sourceUrl:specification.source_url,verifiedAt:disposable.last_verified_at,supports:['path']});
 });
 it.each(['jee_main_status','jee_advanced_status','jee_evidence_context','aps_issuer_country','aps_qualification_context','jee_school_certificate','jee_reported_target_family','intake_index'])('quarantines positive rule missing %s',key=>{
  const conditions={...disposable.conditions};delete conditions[key as keyof typeof conditions];
  expect(evaluate(jeeProfile,[{...disposable,conditions}]).path).toBe('unknown');
 });
 it.each(['jee_school_certificate','jee_reported_target_family','intake_index'] as const)('rejects exclusion-only applicability for %s',key=>{
  const conditions={...disposable.conditions,[key]:{op:'neq' as const,value:'unspecified'}};
  expect(evaluate(jeeProfile,[{...disposable,conditions}]).path).toBe('unknown');
 });
 it('malformed new evidence cannot revive a historical false fallback',()=>{
  const profile={...jeeProfile,jeeAdvanced:false,jee:{main:99}} as unknown as typeof jeeProfile;
  expect(deriveFacts(profile)).not.toHaveProperty('jee_advanced');
 });
 it.each(JEE_ACCEPTANCE)('official expected facts: $id',c=>{
  const r=evaluate(c.profile,reviewedJeeRules());expect(r.path).toBe(c.path);if("reason" in c && c.reason)expect(r.unknowns.join(' ')).toMatch(c.reason);
 });
 it.each(['not_passed','no_result','unknown',undefined] as const)('Advanced %s cannot match ordinary JEE or invent Studienkolleg',advanced=>{
  const r=evaluate({...jeeProfile,jee:{...jeeProfile.jee!,advanced}},[disposable]);expect(r.path).toBe('unknown');
 });
 it.each(['not_passed','no_result','unknown',undefined] as const)('Main %s cannot match ordinary JEE',main=>{
  expect(evaluate({...jeeProfile,jee:{...jeeProfile.jee!,main}},[disposable]).path).toBe('unknown');
 });
 it.each(['main_exemption','preparatory_rank','cross_year','unclear',undefined] as const)('exception/context %s cannot receive automatic access',context=>{
  expect(evaluate({...jeeProfile,jee:{...jeeProfile.jee!,context}},[disposable]).path).toBe('unknown');
 });
 it.each(['law','medicine','pharmacy','biology','other',undefined])('unmapped target %s is never classified by code',targetField=>{
  const r=evaluate({...jeeProfile,targetField,jee:{...jeeProfile.jee!,targetFamily:undefined}},[disposable]);expect(r.path).toBe('unknown');expect(r.unknowns.join(' ')).toMatch(/target.*field/i);
 });
 it.each([{term:'summer',year:2026},{term:'winter',year:2027},undefined] as const)('intake outside specification stays unresolved: %s',intake=>{
  expect(evaluate({...jeeProfile,intake},[disposable]).path).toBe('unknown');
 });
 it.each([69.99,70,70.01])('no code threshold or below-70 exemption: %s',schoolGradePercent=>{
  expect(evaluate({...jeeProfile,schoolGradePercent},[disposable]).path).toBe('subject_restricted');
  expect(evaluate({...jeeProfile,schoolGradePercent},legacy).path).toBe('unknown');
 });
 it('fresh exact published metadata is quarantined even for legacy true; source metadata retained for review',()=>{
  const r=evaluate({...jeeProfile,jee:undefined,jeeAdvanced:true},legacy);
  expect(r.path).toBe('unknown');expect(r.citations[0]).toMatchObject({ruleId:legacy[0].id,sourceUrl:legacy[0].source_url,verifiedAt:legacy[0].last_verified_at,supports:['unknowns']});
  expect(r.citations[0].claim).not.toContain('gives direct');
 });
 it('quarantine does not erase independent process outcomes on the same row',()=>{
  const r=evaluate({...jeeProfile,jee:undefined,jeeAdvanced:true},[{...legacy[0],outcomes:{...legacy[0].outcomes,dmat:'not_required'}}]);
  expect(r.path).toBe('unknown');expect(r.dMAT).toBe('not_required');
 });
 it('failed JEE preserves successful university history and its independently supported route',()=>{
  const profile={...indianStudyProfile,jee:{main:'passed',advanced:'not_passed',context:'ordinary'} as const};
  expect(evaluate(profile,reviewedIndiaStudyRules()).path).toBe('subject_restricted');
  expect(profile.qualificationHistory).toEqual(indianStudyProfile.qualificationHistory);
 });
 it('nationality/visa never supply academic passage or exception',()=>{
  const r=evaluate({...jeeProfile,nationality:'pk',visaApplicationCountry:'sa'},[disposable]);expect(r.path).toBe('subject_restricted');
  expect(deriveFacts({...jeeProfile,jee:undefined,nationality:'in'})).not.toHaveProperty('jee_main_status');
 });
 it('malformed direct-caller statuses fail closed',()=>{
  const p={...jeeProfile,jee:{main:99,advanced:'passed',context:'ordinary'}};
  expect(evaluate(p as unknown as typeof jeeProfile,[disposable]).path).toBe('unknown');
 });
});
