import {ordinaryGce} from './gce.fixture';
import {ordinaryIb} from './ib.fixture';
import {fixtureRules} from './rules.fixture';
import approved from '@/docs/spec-data/pakistan-current-one-year.json';
import {ruleToChunk,type KbRule} from '@/lib/ai/kb';
import {expect,it} from 'vitest';
import {evaluate,type Profile} from '../evaluate';
import {currentPakistanProfile,reviewedPakistanRules} from './pakistan.fixture';
it.each(['science','commerce','humanities'] as const)('current %s one-year route at all reviewed intakes',group=>{
 for(const intake of [{term:'winter',year:2026},{term:'summer',year:2027},{term:'winter',year:2027}] as const){const result=evaluate({...currentPakistanProfile,intake,pakistan:{...currentPakistanProfile.pakistan!,group,targetFamily:'other',targetFamilyReference:undefined}},reviewedPakistanRules());expect(result.path).toBe('subject_restricted');expect(result.citations.some(c=>c.sourceUrl==='https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang')).toBe(true);expect(result.citations.map(c=>c.claim).join(' ')).toMatch(/reported.*two.*institution/i);}
});

it.each([{certificate_country:'pk'},{certificate_country:{op:'neq' as const,value:'in'}},{}] as KbRule['conditions'][])('legacy Pakistan metadata cannot revive broad access %j',conditions=>{
 const rule={...reviewedPakistanRules()[0],id:'renamed',conditions,outcomes:{path:'direct',note:'UNSAFE blanket access',steps:[{order:1,text:'UNSAFE apply anywhere'}]},source_url:'https://www.daad.pk/en/study-research-in-germany/eight-steps-to-germany/getting-started/',source_quote:'UNSAFE old prose'};
 const result=evaluate(currentPakistanProfile,[rule]);expect(result.path).toBe('unknown');expect(result.stepsDetailed).toEqual([]);
 expect(ruleToChunk({...rule,slug:'renamed',country_code:'pk',last_verified_at:rule.last_verified_at!}).content).not.toContain('UNSAFE');
});

it.each([0,0.5])('insufficient successful years %s stay unknown',completedYears=>expect(evaluate({...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,completedYears}},reviewedPakistanRules()).path).toBe('unknown'));
it.each([{mode:'part_time'},{mode:'distance_online'},{regulations:'unknown'},{annualRecords:'unknown'},{successfulYearsReference:undefined},{successfulYearsReference:' '},{recognition:'reported_official_rejected'},{recognitionReference:undefined},{recognitionReference:' '},{relation:'reported_official_unrelated'},{relationReference:undefined},{relationReference:' '},{assessment:'reported_contrary'},{assessment:'unknown'},{assessmentReference:undefined},{assessmentReference:' '},{evidenceVersion:undefined}])('missing/contrary/legacy study reports %j stay sourced unknown',change=>{
 const result=evaluate({...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,pakistanStudy:{...currentPakistanProfile.qualificationHistory!.pakistanStudy!,...change} as never}},reviewedPakistanRules());expect(result.path).toBe('unknown');expect(result.citations.length).toBeGreaterThan(0);if(change.assessment==='reported_contrary')expect(result.unknowns.join(' ')).toMatch(/individual confirmation conflict/);
});
it.each([{country:'in'},{country:undefined},{completion:'discontinued'},{completion:'completed'},{completedYears:undefined},{qualificationType:'master'},{institution:undefined},{field:undefined}])('unsupported history %j stays unknown',change=>expect(evaluate({...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,...change} as never},reviewedPakistanRules()).path).toBe('unknown'));
it.each([{certificate:'fsc'},{certificate:'fa'},{certificate:'icom'},{certificate:'ics'},{certificate:'ssc'},{group:'mixed'},{completion:'incomplete'}])('unclassified school %j stays unknown',change=>expect(evaluate({...currentPakistanProfile,pakistan:{...currentPakistanProfile.pakistan!,...change} as never},reviewedPakistanRules()).path).toBe('unknown'));
it.each([{country:'in',context:'national'},{country:'pk',context:'international'},{country:'unknown',context:'national'}])('wrong school scope %j stays unknown',schoolQualification=>expect(evaluate({...currentPakistanProfile,schoolQualification:schoolQualification as never},reviewedPakistanRules()).path).toBe('unknown'));
it.each([undefined,{term:'summer',year:2026},{term:'summer',year:2028}])('noncovered intake %j stays targeted unknown',intake=>{const r=evaluate({...currentPakistanProfile,intake:intake as never},reviewedPakistanRules());expect(r.path).toBe('unknown');expect(r.unknowns.join(' ')).toMatch(/intake.*coverage/i);});
it('current grade 49.99/50 boundary and missing percentage differ',()=>{expect(evaluate(currentPakistanProfile,reviewedPakistanRules()).path).toBe('subject_restricted');for(const schoolGradePercent of [49.99,undefined]){const r=evaluate({...currentPakistanProfile,schoolGradePercent},reviewedPakistanRules());expect(r.path).toBe('unknown');expect(r.unknowns.join(' ')).toMatch(schoolGradePercent===undefined?/percentage.*missing/i:/50%.*unmet/i);}});
it('actual equal-specificity conflicting current authorities cite both, drafts grant nothing',()=>{const rule=reviewedPakistanRules().find(r=>r.id==='pakistan-current-year-science')!;const opposite={...rule,id:'current-conflicting-assessment',outcomes:{path:'unknown',note:'Applicable current authority conflict requires confirmation'}};const result=evaluate(currentPakistanProfile,[rule,opposite]);expect(result.path).toBe('unknown');expect(result.stepsDetailed).toEqual([]);expect(result.citations.map(c=>c.ruleId)).toEqual(expect.arrayContaining([rule.id,opposite.id]));expect(evaluate(currentPakistanProfile,[{...rule,status:'draft'}]).path).toBe('unknown');});

it.each(approved.acceptance_cases)('adopted actual-source corpus $id executes against candidates, not JSON facts',c=>{
 const values=c.overrides as Record<string,unknown>;const profile:Profile={...currentPakistanProfile,pakistan:{...currentPakistanProfile.pakistan!,group:c.documentary_group as never},qualificationHistory:{...currentPakistanProfile.qualificationHistory!,pakistanStudy:{...currentPakistanProfile.qualificationHistory!.pakistanStudy!}}};
 if(values.pk_grade_percent!==undefined)profile.schoolGradePercent=values.pk_grade_percent as number;
 if('omit' in c && c.omit?.includes('pk_grade_percent'))profile.schoolGradePercent=undefined;
 profile.qualificationHistory!.completedYears=values.pk_successful_academic_years as number;
 if(values.pk_prior_study_kind==='completed_qualification')profile.qualificationHistory!.completion='completed';
 if(values.pk_study_mode)profile.qualificationHistory!.pakistanStudy!.mode=values.pk_study_mode as never;
 if(values.pk_reported_target_relation)profile.qualificationHistory!.pakistanStudy!.relation=values.pk_reported_target_relation as never;
 const index=values.intake_index as number;profile.intake={term:index%2?'winter':'summer',year:Math.floor(index/2)};
 expect(evaluate(profile,reviewedPakistanRules()).path).toBe(c.expected_path);
});

it.each([ordinaryGce,ordinaryIb])('Pakistan issuer does not absorb independent $curriculumType source rules',profile=>{const rules=fixtureRules.filter(r=>r.conditions.curriculum===profile.curriculumType).map(r=>({...r,conditions:{...r.conditions,certificate_country:'pk'}}));const result=evaluate({...profile,certificateCountry:'pk'},rules);expect(result.path).toBe(profile.curriculumType==='ib'?'direct':'subject_restricted');});

it.each([1,2])('actual successful %s years retain bounded current orientation',completedYears=>expect(evaluate({...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,completedYears}},reviewedPakistanRules()).path).toBe('subject_restricted'));
