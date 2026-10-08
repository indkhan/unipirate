// Pure immutable rule boundaries, selection and publication diff. Zero I/O.
import { z } from "zod";
import {instantOrder} from "@/lib/engine/instant";
import { EngineRuleSchema, evaluate, intakeIndex, type EngineRule, type Profile } from "@/lib/engine/evaluate";
import { CalendarDateSchema } from "@/lib/engine/calendar-day";
import type { Json } from "@/lib/db/database.types";
export const RuleIdSchema = z.string().uuid();
export const JsonSchema: z.ZodType<Json> = z.lazy(() => z.union([z.string(),z.number().finite(),z.boolean(),z.null(),z.array(JsonSchema),z.record(z.string().refine(key=>key!=="__proto__", "Reserved JSON key is not supported."),JsonSchema)]));
export const RawRuleSchema = z.object({
 id: RuleIdSchema, conditions: JsonSchema, outcomes: JsonSchema,
 status: z.enum(["draft","beta","verified"]), source_url:z.string(),source_quote:z.string(),
 last_verified_at:z.string().nullable(),notes:z.string().nullable(),
 slug:z.string().nullable(),country_code:z.string().nullable(),created_at:z.string(),updated_at:z.string(),
}).passthrough();
export const RuleScopeSchema = z.object({
 effective_from:CalendarDateSchema.nullable(),effective_until:CalendarDateSchema.nullable(),
 intake_from:z.number().int().min(2).max(19999).nullable(),intake_until:z.number().int().min(2).max(20000).nullable(),
}).superRefine((scope,ctx)=>{
 if (scope.effective_from!==null && scope.effective_until!==null && scope.effective_from>=scope.effective_until) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Assessment end must follow start."});
 if (scope.intake_from!==null && scope.intake_until!==null && scope.intake_from>=scope.intake_until) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Intake end must follow start."});
});
const scopeFields = { effective_from:CalendarDateSchema.nullable(),effective_until:CalendarDateSchema.nullable(),intake_from:z.number().int().min(2).max(19999).nullable(),intake_until:z.number().int().min(2).max(20000).nullable() };
const timestamp=z.string().datetime({offset:true});
export const RuleVersionSchema = z.object({
 id:RuleIdSchema,rule_id:RuleIdSchema,version_number:z.number().int().positive(),supersedes_version_id:RuleIdSchema.nullable(),
 raw_snapshot:JsonSchema,status:z.enum(["draft","beta","verified"]).nullable(),...scopeFields,
 reviewed_by:RuleIdSchema.nullable(),reviewed_at:timestamp.nullable(),published_at:timestamp.nullable(),captured_at:timestamp.nullable(),
 draft_revision:z.number().int().positive().safe().nullable(),provenance:z.enum(["human_publication","legacy_capture"]),
}).superRefine((row,ctx)=>{const scope=RuleScopeSchema.safeParse(row);if(!scope.success) for(const issue of scope.error.issues) ctx.addIssue(issue);});
export type RuleVersion = z.infer<typeof RuleVersionSchema>;
export const RuleDraftSchema=z.object({rule_id:RuleIdSchema,raw_snapshot:JsonSchema,revision:z.number().int().positive().safe(),edited_by:RuleIdSchema.nullable(),edited_at:timestamp,...scopeFields}).superRefine((row,ctx)=>{const scope=RuleScopeSchema.safeParse(row);if(!scope.success) for(const issue of scope.error.issues) ctx.addIssue(issue);});
export type RuleDraft=z.infer<typeof RuleDraftSchema>;
export const ReviewTokenSchema=z.object({rule_id:RuleIdSchema,revision:z.number().int().positive().safe(),raw_snapshot:JsonSchema,predecessor_id:RuleIdSchema.nullable()}).strict();
export const PublicationApprovalSchema=ReviewTokenSchema.extend({approval_status:z.enum(["beta","verified"]),confirmed:z.literal(true)});
export const DraftSaveSchema=ReviewTokenSchema.omit({predecessor_id:true}).extend({next_snapshot:JsonSchema,...scopeFields}).strict().superRefine((row,ctx)=>{
 const scope=RuleScopeSchema.safeParse(row);if(!scope.success) for(const issue of scope.error.issues) ctx.addIssue(issue);
 const raw=RawRuleSchema.safeParse(row.next_snapshot);
 if(!raw.success) for(const issue of raw.error.issues) ctx.addIssue(issue);
 else if(raw.data.status!=="draft" || raw.data.id!==row.rule_id) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Workspace saves require draft status and the same logical ID."});
});
/** Validate the exact equality token; never replace it with Zod's parsed output. */
export function preflightPublication(input:unknown) {
 const approval=PublicationApprovalSchema.parse(input);
 const raw=RawRuleSchema.parse(approval.raw_snapshot);
 const policy=EngineRuleSchema.parse(approval.raw_snapshot);
 if(policy.outcomes.process && Object.keys(policy.outcomes).some(key=>key!=="process"))throw new Error("Process and academic outcomes must be published separately.");
 if(raw.id!==approval.rule_id || raw.status!=="draft" || !raw.last_verified_at) throw new Error("Review requires the saved draft and an explicit source verification date.");
 // Validate the approved state too; this copy is validation-only, never the RPC token.
 EngineRuleSchema.parse({...raw,status:approval.approval_status});
 return approval;
}
export function jsonEqual(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>jsonEqual(v,b[i]));
 if(a!==null&&b!==null&&typeof a==="object"&&typeof b==="object"){
  const left=Object.keys(a),right=Object.keys(b);return left.length===right.length&&left.every(k=>Object.hasOwn(b,k)&&jsonEqual((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
 }
 return false;
}
export type SelectionDiagnostic={ruleId:string;versionId:string;reason:"missing_intake"|"legacy_scope_unknown"|"invalid_publication"};
export function selectRuleVersions(input:unknown,context:unknown):{selected:{version:RuleVersion;rule:EngineRule}[];diagnostics:SelectionDiagnostic[]} {
 const {assessmentDate,intake,evaluatedAt}=z.object({evaluatedAt:timestamp.optional(),assessmentDate:CalendarDateSchema,intake:z.object({term:z.enum(["summer","winter"]),year:z.number().int().min(1).max(9999)}).optional()}).strict().parse(context);
 if(evaluatedAt && assessmentDateUtc(evaluatedAt)!==assessmentDate)throw new Error("Assessment day must match evaluatedAt.");
 const versions=z.array(RuleVersionSchema).parse(input).sort((a,b)=>a.rule_id.localeCompare(b.rule_id)||b.version_number-a.version_number);
 const target=intake?intakeIndex(intake.term,intake.year):undefined;
 const selected:{version:RuleVersion;rule:EngineRule}[]=[],diagnostics:SelectionDiagnostic[]=[];
 const resolved=new Set<string>();
 for(const version of versions){
  // Availability precedes supersession, status, applicability and conditions.
  if(evaluatedAt && version.published_at && instantOrder(version.published_at)>instantOrder(evaluatedAt))continue;
  if(resolved.has(version.rule_id))continue;
  if(version.effective_from!==null&&assessmentDate<version.effective_from || version.effective_until!==null&&assessmentDate>=version.effective_until)continue;
  if(target!==undefined && (version.intake_from!==null&&target<version.intake_from || version.intake_until!==null&&target>=version.intake_until))continue;
  resolved.add(version.rule_id);
  const diagnostic=(reason:SelectionDiagnostic["reason"])=>diagnostics.push({ruleId:version.rule_id,versionId:version.id,reason});
  if(version.provenance==="legacy_capture"){diagnostic("legacy_scope_unknown");continue;}
  if(target===undefined&&(version.intake_from!==null||version.intake_until!==null)){diagnostic("missing_intake");continue;}
  // Applicability and supersession are resolved before status or conditions.
  const raw=EngineRuleSchema.safeParse(version.raw_snapshot);
  if(!raw.success || raw.data.id!==version.rule_id || raw.data.status!==version.status || (version.status!=="beta"&&version.status!=="verified") || !version.reviewed_by || !version.reviewed_at || !version.published_at || !version.draft_revision || version.captured_at!==null){diagnostic("invalid_publication");continue;}
  selected.push({version,rule:raw.data});
 }
 return {selected,diagnostics};
}
export type RuleDiff={field:string;before:unknown;after:unknown};
/** Compare literal content, evidence and scope, excluding server identity clocks. */
export function meaningfulRuleDiff(before:unknown,after:unknown):RuleDiff[]{
 const body=(input:unknown):Record<string,unknown>=>{
  if(!input)return {};
  const row=z.object({raw_snapshot:z.record(z.unknown()),status:z.string().nullable().optional(),provenance:z.enum(["human_publication","legacy_capture"]).optional(),...scopeFields}).parse(input);
  const raw={...row.raw_snapshot};delete raw.id;delete raw.created_at;delete raw.updated_at;delete raw.status;
  return {...raw,scope_review:row.provenance==="legacy_capture"?"unknown historical scope":"explicitly reviewed bounds",status:row.status??row.raw_snapshot.status,effective_from:row.effective_from,effective_until:row.effective_until,intake_from:row.intake_from,intake_until:row.intake_until};
 };
 const a=body(before),b=body(after);
 return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(key=>!jsonEqual(a[key],b[key])).map(field=>({field,before:a[field],after:b[field]}));
}

/** Explicit assessment instant only: no current clock and no applicant-event inference. */
export function assessmentDateUtc(instant:unknown):string {
 return CalendarDateSchema.parse(new Date(timestamp.parse(instant)).toISOString().slice(0,10));
}
/** Caller-provided, already-selected rules. Preview only; performs no reads or writes. */
export function previewRuleImpact(cases:readonly {before:{profile:Profile;rules:EngineRule[]};after:{profile:Profile;rules:EngineRule[]}}[]):{changed:number;newCoverage:number} {
 let changed=0,newCoverage=0;
 for(const item of cases){
  const before=evaluate(item.before.profile,item.before.rules),after=evaluate(item.after.profile,item.after.rules);
  if(!jsonEqual(before,after))changed++;
  if((["path","aps","testAS","dMAT"] as const).some(key=>before[key]==="unknown"&&after[key]!=="unknown"))newCoverage++;
 }
 return {changed,newCoverage};
}

export {instantOrder} from "@/lib/engine/instant";
