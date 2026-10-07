import {describe,it,expect} from 'vitest';
import {evaluateAssessment,parseStoredAssessment,compareAssessments,AssessmentMetadataSchema,AssessmentResultSchema} from '../assessment';
import {evaluate} from '@/lib/engine/evaluate';
import {AnswersSchema} from '@/app/(public)/check/steps';
import {profile,answers,context,version,raw,ruleId} from './assessment-fixtures';
const original=()=>evaluateAssessment(profile,[version(1)],context);
const stored=()=>({assessment_metadata:original().metadata,result:original().result,answers});
describe('authoritative assessment',()=>{
 it('fixture passes actual answers boundary',()=>expect(AnswersSchema.safeParse(answers).success).toBe(true));
 it('retains all selected inputs, unmatched included, and logical citation identity',()=>{
  const v2=version(2,{raw_snapshot:{...raw,conditions:{target_degree:'master'}}});
  const a=evaluateAssessment(profile,[version(1),v2],context);
  expect(a.metadata.selectedVersionIds).toEqual([v2.id]);expect(a.result.path).toBe('unknown');
  expect(original().result.citations[0].ruleId).toBe(ruleId);
 });
 it('excludes future publication before conditions and records captured instant',()=>{
  const a=evaluateAssessment(profile,[version(1),version(2,{published_at:'2026-10-07T12:00:00.000001Z'})],context);
  expect(a.metadata.selectedVersionIds).toEqual([version(1).id]);expect(a.metadata.evaluatedAt).toBe(context.evaluatedAt);
 });
 it('zero inputs is valid unknown',()=>{const a=evaluateAssessment(profile,[],context);expect(a.metadata.selectedVersionIds).toEqual([]);expect(a.result.path).toBe('unknown');});
 it('preserves honest missing-intake and legacy diagnostics',()=>{
  const missing=evaluateAssessment({...profile,intake:undefined},[version(1,{intake_from:4053})],context);
  expect(missing.metadata.selectionIssues[0].reason).toBe('missing_intake');expect(missing.result.path).toBe('unknown');
  const legacy=evaluateAssessment(profile,[version(1,{provenance:'legacy_capture',published_at:null,reviewed_at:null,reviewed_by:null,draft_revision:null,captured_at:context.evaluatedAt})],context);
  expect(legacy.metadata.selectionIssues[0].reason).toBe('legacy_scope_unknown');
 });
 it.each(['', '   ','current','latest'])('rejects nonmeaningful revision %j',engineRevision=>expect(()=>evaluateAssessment(profile,[],{...context,engineRevision})).toThrow());
 it.each(['2026-02-30T00:00:00Z','2026-10-07T12:00:00+00:00','bad'])('rejects invalid UTC instant %s',evaluatedAt=>expect(()=>evaluateAssessment(profile,[],{...context,evaluatedAt})).toThrow());
 it('does not mutate input objects',()=>{const vs=[version(1)];const token=JSON.stringify({profile,vs});evaluateAssessment(profile,vs,context);expect(JSON.stringify({profile,vs})).toBe(token);});
});
describe('protected stored assessment parsing',()=>{
 it('NULL authority ignores forged result and answer markers',()=>expect(parseStoredAssessment({assessment_metadata:null,result:{...original().result,assessment_metadata:original().metadata},answers:{...answers,formatVersion:1}},[])).toEqual({kind:'legacy',original:null}));
 it('returns persisted verdict without replaying current engine and exact literal source objects',()=>{
  const row={...stored(),result:{...original().result,path:'insufficient'}};
  const r=parseStoredAssessment(row,[version(1),version(2,{raw_snapshot:{...raw,source_quote:'new'}})]);
  expect(r.kind).toBe('authoritative');if(r.kind==='authoritative'){expect(r.original.result.path).toBe('insufficient');expect(r.original.selectedVersions[0].raw_snapshot).toEqual(raw);expect(r.original.answers).toEqual(answers);}
 });
 it.each([{}, {formatVersion:2}])('malformed protected metadata is unavailable',assessment_metadata=>expect(parseStoredAssessment({...stored(),assessment_metadata},[version(1)]).kind).toBe('invalid'));
 it('missing ID never substitutes latest',()=>expect(parseStoredAssessment(stored(),[version(2)]).kind).toBe('invalid'));
 it('malformed version never supplies explanation',()=>expect(parseStoredAssessment(stored(),[version(1,{raw_snapshot:null})]).kind).toBe('invalid'));
 it('future selected publication is invalid',()=>expect(parseStoredAssessment(stored(),[version(1,{published_at:'2026-10-07T12:00:01Z'})]).kind).toBe('invalid'));
 it('duplicate selected IDs and extra envelope fields reject',()=>{const m=original().metadata;expect(AssessmentMetadataSchema.safeParse({...m,selectedVersionIds:[version(1).id,version(1).id]}).success).toBe(false);expect(AssessmentMetadataSchema.safeParse({...m,forged:true}).success).toBe(false);});
 it('rejects invalid stored answers and verdict',()=>{expect(parseStoredAssessment({...stored(),answers:{}},[version(1)]).kind).toBe('invalid');expect(parseStoredAssessment({...stored(),result:{path:'direct'}},[version(1)]).kind).toBe('invalid');});
 it('result schema matches actual engine output',()=>expect(AssessmentResultSchema.safeParse(evaluate(profile,[])).success).toBe(true));
});
describe('consequential comparison',()=>{
 it('counts new coverage without previous match',()=>{const diff=compareAssessments(evaluateAssessment(profile,[],context),original());expect(diff.newCoverage).toBe(true);expect(diff.policyChanged).toBe(true);});
 it('distinguishes source-only change from policy',()=>{const after=evaluateAssessment(profile,[version(2,{raw_snapshot:{...raw,source_quote:' New literal quote '}})],context);const diff=compareAssessments(original(),after);expect(diff.policyChanged).toBe(false);expect(diff.explanationChanged).toBe(true);});
 it('uses stable logical identity, ignoring server clocks and version UUID alone',()=>{const after=evaluateAssessment(profile,[version(2)],context);expect(compareAssessments(original(),after)).toMatchObject({policyChanged:false,explanationChanged:false,newCoverage:false});});
 it('recognizes condition change even when this result is unchanged',()=>{const after=evaluateAssessment(profile,[version(2,{raw_snapshot:{...raw,conditions:{target_degree:'bachelor'}}})],context);expect(compareAssessments(original(),after).policyChanged).toBe(true);});
 it('preserves array order but ignores object key order',()=>{const before=original();const after={...before,result:{...before.result,documents:['b','a']}};expect(compareAssessments({...before,result:{...before.result,documents:['a','b']}},after).policyChanged).toBe(true);expect(compareAssessments(before,{...before,result:{...before.result}}).policyChanged).toBe(false);});
});

it('scoped malformed publication cannot bypass historical validation via missing intake',()=>expect(parseStoredAssessment(stored(),[version(1,{intake_from:4053,raw_snapshot:null})]).kind).toBe('invalid'));
it('original intake outside selected scope is invalid',()=>expect(parseStoredAssessment(stored(),[version(1,{intake_from:4054})]).kind).toBe('invalid'));
it('preserved diagnostic must resolve its exact version',()=>{const a=evaluateAssessment({...profile,intake:undefined},[version(1,{intake_from:4053})],context);expect(parseStoredAssessment({assessment_metadata:a.metadata,result:a.result,answers:{...answers,intake:null}},[]).kind).toBe('invalid');});

it('returns exact diagnostic snapshots for an honest unavailable legacy scope',()=>{const v=version(1,{provenance:'legacy_capture',published_at:null,reviewed_at:null,reviewed_by:null,draft_revision:null,captured_at:context.evaluatedAt});const a=evaluateAssessment(profile,[v],context);const r=parseStoredAssessment({assessment_metadata:a.metadata,result:a.result,answers},[v]);expect(r.kind).toBe('authoritative');if(r.kind==='authoritative')expect(r.original.diagnosticVersions).toEqual([v]);});
it('citation source must resolve the exact immutable publication',()=>expect(parseStoredAssessment({...stored(),result:{...original().result,citations:original().result.citations.map(c=>({...c,sourceUrl:'https://example.invalid/forged'}))}},[version(1)]).kind).toBe('invalid'));
it('replacement applies only within original intake and assessment half-open scope',()=>{const vs=[version(1),version(2,{intake_from:4053,intake_until:4054,effective_from:'2026-10-07',effective_until:'2026-10-08',raw_snapshot:{...raw,conditions:{target_degree:'master'}}})];expect(evaluateAssessment({...profile,intake:{term:'summer',year:2026}},vs,context).result.path).toBe('direct');expect(evaluateAssessment(profile,vs,context).result.path).toBe('unknown');expect(evaluateAssessment(profile,vs,{...context,evaluatedAt:'2026-10-08T00:00:00Z'}).result.path).toBe('direct');});
it('original and current evaluations use distinct instants, not applicant event dates',()=>{const vs=[version(1),version(2,{published_at:'2026-10-08T00:00:00Z',raw_snapshot:{...raw,outcomes:{path:'insufficient'}}})];const p={...profile,apsProcedure:{status:'pending' as const,submissionConfirmation:'confirmed' as const,submissionDate:'2028-01-01'}};const before=evaluateAssessment(p,vs,context);const after=evaluateAssessment(p,vs,{...context,evaluatedAt:'2026-10-08T00:00:00Z'});expect(before.result.path).toBe('direct');expect(after.result.path).toBe('insufficient');expect(before.metadata.evaluatedAt).toBe(context.evaluatedAt);});
