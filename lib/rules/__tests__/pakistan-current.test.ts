import {expect,it} from 'vitest';
import {AnswersSchema,buildProfile} from '@/app/(public)/check/steps';
import {evaluateAssessment,parseStoredAssessment} from '../assessment';
import {ENGINE_REVISION} from '../current';
import {reviewedPakistanRules,currentPakistanProfile} from '@/lib/engine/__tests__/pakistan.fixture';
import {version} from './assessment-fixtures';
import {projectVersionedKbMatches} from '@/lib/ai/versioned-kb';
import {projectDmatKbMatches} from '@/lib/ai/kb-retrieval';
import {buildVerdicts,visibleUnknowns} from '@/app/(public)/result/[id]/result-model';
import {generateGlobalTasks} from '@/lib/tasks/generate';
import {currentPakistanAnswers} from '@/app/(public)/check/__tests__/pakistan-current.fixture';
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const pakistanVersions=()=>reviewedPakistanRules().map((r,i)=>version(i+1,{id:uuid(i+100),rule_id:uuid(i+200),version_number:1,raw_snapshot:{...r,id:uuid(i+200),slug:r.id,country_code:'pk'},reviewed_at:'2026-10-08T02:00:00Z',published_at:'2026-10-08T02:00:00Z',intake_from:r.id.startsWith('pakistan-current-')?4053:null,intake_until:r.id.startsWith('pakistan-current-')?4056:null}));
const context={evaluatedAt:'2026-10-08T03:00:00Z',engineRevision:ENGINE_REVISION};
it('strict actual assessment and protected original retain direct route, current comparison and literal source evidence',()=>{
 const profile=buildProfile(AnswersSchema.parse(currentPakistanAnswers));const versions=pakistanVersions();const original=evaluateAssessment(profile,versions,context);
 expect(original.result.path).toBe('subject_restricted');expect(original.result.citations.map(c=>c.sourceUrl)).toEqual(expect.arrayContaining(['https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang','https://www.daad.pk/files/2022/11/Study-in-Germany-Undergraduate-Degree-Courses_2022.pdf']));
 const saved=parseStoredAssessment({assessment_metadata:original.metadata,result:original.result,answers:currentPakistanAnswers},versions);expect(saved.kind).toBe('authoritative');if(saved.kind==='authoritative')expect(saved.original.result).toEqual(original.result);
 expect(evaluateAssessment({...profile,schoolGradePercent:49.99},versions,context).result.path).toBe('unknown');expect(original.metadata.engineRevision).toBe(ENGINE_REVISION);
 expect(buildVerdicts(original.result,profile)[0].label).toMatch(/reported.*not independently verified/i);
 expect(visibleUnknowns(original.result,profile).join(' ')).toMatch(/two successful years|two successfully completed years/);
 expect(generateGlobalTasks(original.result).some(t=>/intended institution/i.test(t.title))).toBe(true);
});
it('current immutable KB discards cache prose and exposes both sources with reported/nonbinding/current scope',()=>{
 const versions=pakistanVersions();const kb=projectVersionedKbMatches([{rule_id:versions[0].rule_id,content:'UNSAFE cache',slug:'renamed'}],versions,{evaluatedAt:context.evaluatedAt,intake:currentPakistanProfile.intake});
 expect(JSON.stringify(kb)).not.toContain('UNSAFE');const content=kb.chunks.map(c=>c.content).join(' ');expect(content).toMatch(/reported/);expect(content).toContain('two successful years');expect(content).toContain('not a source effective date');expect(kb.chunks.every(c=>c.versionId&&c.ruleId)).toBe(true);
 const old={...versions[0],raw_snapshot:{...versions[0].raw_snapshot,slug:'renamed',conditions:{certificate_country:'pk'},outcomes:{path:'direct',note:'UNSAFE'},source_quote:'UNSAFE'}};
 expect(JSON.stringify(projectVersionedKbMatches([], [old], {evaluatedAt:context.evaluatedAt}))).not.toContain('UNSAFE');
 expect(projectDmatKbMatches([{slug:'old',title:'old',content:'UNSAFE',source_url:'https://www.daad.pk/en/study-research-in-germany/eight-steps-to-germany/getting-started/',last_verified_at:null,country_code:'pk',source_type:'snippet'}],[])[0].content).not.toContain('UNSAFE');
});

it('missing/historical/noncovered immutable KB intake cannot authorize current direct prose',()=>{
 for(const intake of [undefined,{term:'summer',year:2026},{term:'summer',year:2028}] as const){const kb=projectVersionedKbMatches([],pakistanVersions(),{evaluatedAt:context.evaluatedAt,intake});expect(kb.chunks.some(c=>c.slug.startsWith('pakistan-current-year-'))).toBe(false);}
});
