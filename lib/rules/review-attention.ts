import {ProcessOutcomeSchema,processReviewReasons,processObservationsConflict} from "@/lib/engine/process";
import {legacyProcessRuleIds,isLegacyProcessIdentity} from "@/lib/engine/process-identity";
import {z} from "zod";
const rowSchema=z.object({id:z.string().optional(),slug:z.string().nullable().optional(),notes:z.string().nullable().optional(),outcomes:z.record(z.unknown()),last_verified_at:z.string().nullable()}).passthrough();
export function ruleReviewReasons(input:unknown,asOfIso:string,others:readonly unknown[]=[]):string[] {
 const row=rowSchema.safeParse(input);if(!row.success)return ["Malformed rule requires review."];
 const history=z.object({versions:z.array(z.object({rule_id:z.string(),raw_snapshot:z.unknown()}))}).safeParse(input);
 const legacy=isLegacyProcessIdentity(row.data)||(history.success&&legacyProcessRuleIds(history.data.versions.map(v=>({rule_id:v.rule_id,raw_snapshot:v.raw_snapshot}))).has(row.data.id??""));
 if(legacy&&!Object.hasOwn(row.data.outcomes,"process"))return ["Legacy static process guidance requires separate scoped review."];
 if(Object.hasOwn(row.data.outcomes,"process")){
  const reasons=processReviewReasons(row.data,asOfIso),a=ProcessOutcomeSchema.safeParse(row.data.outcomes.process);
  if(a.success && others.some(other=>{if(other===input)return false;const b=rowSchema.safeParse(other);const o=b.success?ProcessOutcomeSchema.safeParse(b.data.outcomes.process):null;return o?.success&&processObservationsConflict(a.data,o.data);} ))reasons.push("Conflicting process observations require review.");
  return reasons;
 }
 const verified=row.data.last_verified_at?Date.parse(row.data.last_verified_at):NaN;
 return !Number.isFinite(verified)||Date.parse(asOfIso)-verified>183*86400000?["Source verification requires review."]:[];
}
