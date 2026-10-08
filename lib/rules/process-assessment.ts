// Pure trusted adapter: immutable selection and ordinary matching earn authority.
import {z} from "zod";
import {RuleVersionSchema} from "./versioning";
import {deriveFacts, EngineRuleSchema, ruleMatches, type Profile} from "@/lib/engine/evaluate";
import {projectProcess} from "@/lib/engine/process";
import {selectRuleVersions, assessmentDateUtc} from "./versioning";
export function assessProcess(profile:Profile, versions:unknown, evaluatedAt:string) {
 const selection=selectRuleVersions(versions,{evaluatedAt,assessmentDate:assessmentDateUtc(evaluatedAt),intake:profile.intake});
 const process=projectMatchedProcess(profile,selection.selected.map(x=>x.rule),evaluatedAt);
 const available=z.array(RuleVersionSchema).parse(versions);
 for(const diagnostic of selection.diagnostics){
  const raw=z.object({outcomes:z.record(z.unknown()),source_url:z.string().url().refine(s=>/^https?:\/\//.test(s))}).safeParse(available.find(v=>v.id===diagnostic.versionId)?.raw_snapshot);
  if(raw.success && Object.hasOwn(raw.data.outcomes,"process"))process.unknowns.push("Unavailable process publication requires review; confirm with "+raw.data.source_url);
 }
 return process;
}
/** Trusted already-selected inputs; preview callers use this only as a hypothetical operand. */
export function projectMatchedProcess(profile:Profile,rules:readonly unknown[],evaluatedAt:string){
 const facts=deriveFacts(profile);
 const candidates=rules.flatMap(rule=>{
  const parsed=EngineRuleSchema.parse(rule);
  return parsed.outcomes.process && ruleMatches(facts,parsed)?[{...parsed,matched:true}]:[];
 });
 return projectProcess(profile,candidates,evaluatedAt);
}
export type ProcessAssessment=ReturnType<typeof assessProcess>;

/** Model-facing evidence never exposes a noncurrent observation, quote or numeric payload. */
export function safeProcessKnowledge(profile:Profile|null,versions:unknown,evaluatedAt:string){
 const process=assessProcess(profile??{targetDegree:"bachelor",curriculumType:"other"},versions,evaluatedAt);
 return {assessedAt:process.assessedAt,unknowns:process.unknowns,guidance:process.guidance.map(g=>g.status==="current"?{ruleId:g.ruleId,status:g.status,amounts:g.amounts,alternatives:g.alternatives,additional:g.additional,steps:g.steps,source_url:g.evidence.source_url,source_quote:g.evidence.source_quote,last_verified_at:g.evidence.last_verified_at,source_date_annotation:g.evidence.observation.source_date_annotation}:{ruleId:g.ruleId,status:g.status,reasons:g.reasons,source_url:g.evidence.source_url})};
}
