// Pure assessment envelopes and historical explanations. No clock, reads or writes.
import { z } from "zod";
import { evaluate, EngineRuleSchema, type Profile, type Result } from "@/lib/engine/evaluate";
import { CalendarDateSchema } from "@/lib/engine/calendar-day";
import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import { RuleIdSchema, RuleVersionSchema, selectRuleVersions, assessmentDateUtc, jsonEqual, meaningfulRuleDiff, type RuleVersion } from "./versioning";

const canonicalId=RuleIdSchema.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const AssessmentInstantSchema=z.string().datetime().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/).refine(value=>CalendarDateSchema.safeParse(value.slice(0,10)).success);
const revision=z.string().min(1).max(200).refine(value=>value===value.trim() && /[a-zA-Z0-9]/.test(value) && !['current','latest','unknown'].includes(value.toLowerCase()),'Explicit evaluation revision required.');
export const AssessmentContextSchema=z.object({evaluatedAt:AssessmentInstantSchema,engineRevision:revision}).strict();
export const SelectionIssueSchema=z.object({ruleId:canonicalId,versionId:canonicalId,reason:z.enum(['missing_intake','legacy_scope_unknown','invalid_publication'])}).strict();
export const AssessmentMetadataSchema=z.object({
 formatVersion:z.literal(1),evaluatedAt:AssessmentInstantSchema,engineRevision:revision,
 selectedVersionIds:z.array(canonicalId).refine(ids=>new Set(ids).size===ids.length,'Duplicate version IDs.'),
 selectionIssues:z.array(SelectionIssueSchema).refine(issues=>new Set(issues.map(x=>x.ruleId)).size===issues.length,'Duplicate selection diagnostics.'),
}).strict();
export type AssessmentMetadata=z.infer<typeof AssessmentMetadataSchema>;
const flag=z.enum(['required','not_required','unknown']);
const scope=z.enum(['qualification','application','visa']);
const support=z.enum(['aps:qualification','aps:application','aps:visa','path','aps','testAS','dMAT','documents','steps','unknowns']);
/** Mirrors the actual exported engine Result, including optional legacy APS fields. */
export const AssessmentResultSchema:z.ZodType<Result>=z.object({
 path:z.enum(['direct','subject_restricted','studienkolleg','insufficient','unknown']),aps:flag,
 institutionRestriction:z.literal('fachhochschule').optional(),
 apsScopes:z.object({qualification:flag,application:flag,visa:z.enum(['required','not_required','unknown','not_listed'])}).strict().optional(),
 apsCertificate:z.enum(['held','missing','unknown']).optional(),apsRuleIds:z.array(canonicalId).optional(),
 testAS:flag,dMAT:flag,documents:z.array(z.string()),
 stepsDetailed:z.array(z.object({order:z.number().int().nonnegative(),text:z.string(),ruleId:canonicalId,apsScope:scope.optional(),acquisition:z.boolean().optional()}).strict()),
 citations:z.array(z.object({ruleId:canonicalId,sourceUrl:z.string().url(),verifiedAt:z.string().datetime({offset:true}).nullable(),claim:z.string(),status:z.enum(['beta','verified']),supports:z.array(support)}).strict()),
 unknowns:z.array(z.string()),
}).strict();
export type Assessment={result:Result;metadata:AssessmentMetadata;selectedVersions:RuleVersion[];diagnosticVersions:RuleVersion[]};

export function evaluateAssessment(profile:Profile,versions:unknown,context:unknown):Assessment {
 const {evaluatedAt,engineRevision}=AssessmentContextSchema.parse(context);
 const available=z.array(RuleVersionSchema).parse(versions);
 const selection=selectRuleVersions(available,{evaluatedAt,assessmentDate:assessmentDateUtc(evaluatedAt),intake:profile.intake});
 const metadata=AssessmentMetadataSchema.parse({formatVersion:1,evaluatedAt,engineRevision,selectedVersionIds:selection.selected.map(x=>x.version.id),selectionIssues:selection.diagnostics});
 return {result:AssessmentResultSchema.parse(evaluate(profile,selection.selected.map(x=>x.rule))),metadata,selectedVersions:selection.selected.map(x=>x.version),diagnosticVersions:selection.diagnostics.map(x=>available.find(v=>v.id===x.versionId)!)};
}
export type StoredAssessment={kind:'authoritative';original:Assessment & {answers:unknown}}|{kind:'legacy'|'invalid';original:null};
/** Protected DB column is the only authority. Never replay or substitute latest inputs. */
export function parseStoredAssessment(row:unknown,versions:unknown):StoredAssessment {
 const input=z.object({assessment_metadata:z.unknown(),result:z.unknown(),answers:z.unknown()}).safeParse(row);
 if(!input.success)return {kind:'invalid',original:null};
 if(input.data.assessment_metadata===null)return {kind:'legacy',original:null};
 try {
  const metadata=AssessmentMetadataSchema.parse(input.data.assessment_metadata);
  const result=AssessmentResultSchema.parse(input.data.result);
  const profile=buildProfile(AnswersSchema.parse(input.data.answers)); // Never replace original payload.
  const available=z.array(RuleVersionSchema).parse(versions);
  if(new Set(available.map(v=>v.id)).size!==available.length)throw new Error('Ambiguous version identity.');
  const required=[...metadata.selectedVersionIds,...metadata.selectionIssues.map(x=>x.versionId)];
  if(new Set(required).size!==required.length)throw new Error('Duplicate selected/diagnostic identity.');
  const exact=required.map(id=>{const version=available.find(v=>v.id===id);if(!version)throw new Error('Historical version unavailable.');return version;});
  const selection=selectRuleVersions(exact,{evaluatedAt:metadata.evaluatedAt,assessmentDate:assessmentDateUtc(metadata.evaluatedAt),intake:profile.intake});
  if(!jsonEqual(selection.selected.map(x=>x.version.id),metadata.selectedVersionIds) || !jsonEqual(selection.diagnostics,metadata.selectionIssues))throw new Error('Historical selection context invalid.');
  const selectedVersions=metadata.selectedVersionIds.map(id=>exact.find(v=>v.id===id)!);
  if(new Set(selectedVersions.map(v=>v.rule_id)).size!==selectedVersions.length)throw new Error('Duplicate logical rule.');
  const ids=new Set(selectedVersions.map(v=>v.rule_id));
  if(result.citations.some(c=>!ids.has(c.ruleId)) || result.stepsDetailed.some(s=>!ids.has(s.ruleId)) || result.apsRuleIds?.some(id=>!ids.has(id)))throw new Error('Unresolved result support.');
  for(const citation of result.citations){
   const rule=EngineRuleSchema.parse(selectedVersions.find(v=>v.rule_id===citation.ruleId)!.raw_snapshot);
   if(citation.sourceUrl!==rule.source_url || citation.verifiedAt!==(rule.last_verified_at??null) || citation.status!==rule.status)throw new Error('Historical citation does not identify its source.');
  }
  const diagnosticVersions=metadata.selectionIssues.map(x=>exact.find(v=>v.id===x.versionId)!);
  return {kind:'authoritative',original:{result,metadata,selectedVersions,diagnosticVersions,answers:input.data.answers}};
 } catch {return {kind:'invalid',original:null};}
}
/** Stable logical identity; policy and literal explanation changes are independent. */
export function compareAssessments(before:Assessment,after:Assessment) {
 const withoutSources=({citations,...result}:Result)=>({...result,citations:citations.map(c=>({ruleId:c.ruleId,status:c.status,supports:c.supports}))});
 const ruleIds=[...new Set([...before.selectedVersions,...after.selectedVersions].map(v=>v.rule_id))].sort();
 const changes=ruleIds.flatMap(ruleId=>meaningfulRuleDiff(before.selectedVersions.find(v=>v.rule_id===ruleId),after.selectedVersions.find(v=>v.rule_id===ruleId)).map(diff=>({ruleId,...diff})));
 const sourceFields=new Set(['source_url','source_quote','last_verified_at','notes']);
 return {
  policyChanged:!jsonEqual(withoutSources(before.result),withoutSources(after.result)) || changes.some(c=>!sourceFields.has(c.field)),
  explanationChanged:!jsonEqual(before.result.citations,after.result.citations) || changes.some(c=>sourceFields.has(c.field)) || !jsonEqual(before.metadata.selectionIssues,after.metadata.selectionIssues),
  newCoverage:(['path','aps','testAS','dMAT'] as const).some(key=>before.result[key]==='unknown'&&after.result[key]!=='unknown'),
  ruleChanges:changes,
 };
}
