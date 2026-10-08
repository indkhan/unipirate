import {expect,it} from 'vitest';
import {evaluate} from '../evaluate';
import {indianStudyProfile,historyChange,reviewedIndiaStudyRules} from './india-study.fixture';
import {currentPakistanProfile,reviewedPakistanRules} from './pakistan.fixture';
import {indiaStudyCandidates} from '@/scripts/india-study.rules';
import {visibleUnknowns,buildVerdicts} from '@/app/(public)/result/[id]/result-model';
it.each([[indianStudyProfile,reviewedIndiaStudyRules()],[currentPakistanProfile,reviewedPakistanRules()]] as const)('asks one precise prior-study question', (profile,rules)=>{
 const r=evaluate({...profile,qualificationHistory:undefined},rules);
 expect(r.path).toBe('unknown');
 expect(r.diagnostics?.filter(d=>d.followUp).map(d=>d.followUp?.question)).toEqual(['Have you previously studied at a university?']);
 expect(buildVerdicts(r,profile)[0].label).toContain('missing');
 expect(visibleUnknowns(r,profile)).not.toContain('No rule covers your admission path — confirm with the DAAD admission database and the uni-assist country page for your certificate.');
});
it.each([49.99,50,undefined])('records actual Pakistan grade %s and literal threshold',schoolGradePercent=>{
 const r=evaluate({...currentPakistanProfile,schoolGradePercent},reviewedPakistanRules());
 if(schoolGradePercent===50){expect(r.path).toBe('subject_restricted');expect(r.diagnostics).toContainEqual(expect.objectContaining({status:'known_route',support:'path'}));}
 else {const d=r.diagnostics?.find(d=>d.facts.some(f=>f.key==='pk_grade_percent'));expect(d?.status).toBe(schoolGradePercent===undefined?'targeted_missing_fact':'known_unmet_condition');expect(d?.facts).toContainEqual(expect.objectContaining({key:'pk_grade_percent',expected:{op:'gte',value:50},...(schoolGradePercent===undefined?{}:{actual:49.99})}));}
});
it('records successful years, never nominal duration',()=>{
 for(const completedYears of [undefined,0.99]){const r=evaluate(historyChange({completedYears,degreeYears:4}),reviewedIndiaStudyRules());const d=r.diagnostics?.find(d=>d.facts.some(f=>f.key==='in_class12_successful_bachelor_years'));expect(d?.status).toBe(completedYears===undefined?'targeted_missing_fact':'known_unmet_condition');if(completedYears===undefined)expect(d?.followUp?.question).toMatch(/successfully completed/);}
});
it('records actual resolver conflict and all distinct sources',()=>{
 const a={...indiaStudyCandidates[0],status:'verified'};const b={...a,id:'opposing-reviewed-copy',source_url:'https://www.daad.in/en/',outcomes:{path:'insufficient'}};
 const r=evaluate(indianStudyProfile,[a,b]);expect(r.path).toBe('unknown');expect(r.diagnostics).toContainEqual(expect.objectContaining({status:'source_conflict',support:'path',ruleIds:[a.id,b.id]}));expect(r.diagnostics?.some(d=>d.followUp)).toBe(false);expect(r.citations.map(c=>c.sourceUrl)).toEqual([a.source_url,b.source_url]);
});
it('a supported alternate route survives candidate failure',()=>{
 const alt={id:'independent-mechanics-route',conditions:{target_degree:'bachelor'},outcomes:{path:'direct'},status:'verified',source_url:'https://example.invalid/alternate',source_quote:'Synthetic matcher control',last_verified_at:'2026-10-07T00:00:00Z'};
 const r=evaluate({...indianStudyProfile,schoolGradePercent:69.99},[{...indiaStudyCandidates[0],status:'verified'},alt]);expect(r.path).toBe('direct');expect(r.diagnostics).toContainEqual(expect.objectContaining({status:'known_route'}));expect(r.diagnostics).toContainEqual(expect.objectContaining({status:'known_unmet_condition'}));expect(r.diagnostics?.some(d=>d.followUp)).toBe(false);
});
it('no reviewed inputs remain unsupported with no invented candidate',()=>expect(evaluate(indianStudyProfile,[]).diagnostics).toContainEqual(expect.objectContaining({status:'unsupported',ruleIds:[]})));

import {ordinaryGce,gceSubject} from './gce.fixture';
import {fixtureRules} from './rules.fixture';
it('winning GCE decisive facts come from one full trio',()=>{const p={...ordinaryGce,gce:{...ordinaryGce.gce!,subjects:[...ordinaryGce.gce!.subjects,{...gceSubject('biology'),grade:'U' as const}]}};const r=evaluate(p,fixtureRules);expect(r.path).toBe('subject_restricted');expect(r.diagnostics?.find(d=>d.status==='known_route'&&d.support==='path')?.facts.find(f=>f.key==='gce_min_al_grade')?.actual).toBe(3);});
it('explicit foreign context is unsupported, not an academic failure',()=>{const r=evaluate({...indianStudyProfile,schoolQualification:{country:'in',context:'international'}},reviewedIndiaStudyRules());expect(r.diagnostics?.find(d=>d.facts.some(f=>f.key==='aps_qualification_context'))?.status).toBe('unsupported');});
it('a targeted question keeps independent caveats without repeated generic confirmation',()=>{const p={...indianStudyProfile,qualificationHistory:undefined};const r=evaluate(p,reviewedIndiaStudyRules());const visible=visibleUnknowns(r,p).join(' ');expect(visible).toContain('separately supported school alternative');expect(visible).not.toContain('Confirm with the university.');expect(visible).toContain('APS');});

import {completedSaudiProfile} from './saudi.fixture';
import {saudiCandidates} from '@/scripts/saudi.rules';
it.each([{priorStudyRecognition:'reported_official_rejected' as const},{saudiBachelorEvidence:{...completedSaudiProfile.qualificationHistory!.saudiBachelorEvidence!,assessment:'reported_official_unmet' as const}}])('explicit Saudi completed-degree negative is reported unmet %j',change=>{const r=evaluate({...completedSaudiProfile,qualificationHistory:{...completedSaudiProfile.qualificationHistory!,...change}},saudiCandidates.map(r=>({...r,status:'verified'})));expect(r.path).toBe('unknown');expect(r.diagnostics).toContainEqual(expect.objectContaining({status:'known_unmet_condition'}));});

it('historical display retains original diagnostic unknown strings',()=>{const p={...indianStudyProfile,qualificationHistory:undefined};const r=evaluate(p,reviewedIndiaStudyRules());expect(visibleUnknowns(r,p,true)).toContain(r.unknowns.find(n=>n.includes('Confirm with the university.')));});

it('known unmet threshold shows its condition without generic official confirmation for that same formula',()=>{const p={...currentPakistanProfile,schoolGradePercent:49.99};const r=evaluate(p,reviewedPakistanRules());const visible=visibleUnknowns(r,p);expect(visible).not.toContain('No rule covers your admission path — confirm with the DAAD admission database and the uni-assist country page for your certificate.');expect(visible.find(n=>n.includes('50% condition unmet'))).not.toContain('Confirm with');});
