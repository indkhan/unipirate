// Pure immutable-version knowledge projection. Stored embeddings are hints only.
import { z } from "zod";
import {legacyProcessRuleIds} from "@/lib/engine/process-identity";
import {assessProcess} from "@/lib/rules/process-assessment";
import {ProcessContextSchema} from "@/lib/engine/process";
import type {Profile} from "@/lib/engine/evaluate";
import { EngineRuleSchema } from "@/lib/engine/evaluate";
import { RuleIdSchema, RuleVersionSchema, selectRuleVersions, assessmentDateUtc } from "@/lib/rules/versioning";
import { AssessmentInstantSchema } from "@/lib/rules/assessment";
import { ruleToChunk } from "./kb";

const ContextSchema = z.object({evaluatedAt: AssessmentInstantSchema, profile: z.custom<Profile>(value=>z.object({targetDegree:z.enum(["bachelor","master"]),curriculumType:z.enum(["national","ib","gce","other"]),visaApplicationCountry:z.union([z.string().regex(/^[a-z]{2}$/),z.enum(["other","unknown"])]).optional(),processContext:ProcessContextSchema.optional()}).passthrough().safeParse(value).success).optional(), intake: z.object({term: z.enum(["summer", "winter"]), year: z.number().int().min(1).max(9999)}).optional()}).strict();
const KbSnapshotSchema = EngineRuleSchema.innerType().extend({slug: z.string().min(1), country_code: z.string().nullable()});
export function selectedKnowledge(versions: unknown, input: unknown) {
  const context = ContextSchema.parse(input);
  const selection = selectRuleVersions(versions, {evaluatedAt:context.evaluatedAt,intake:context.profile?.intake??context.intake, assessmentDate: assessmentDateUtc(context.evaluatedAt)});
  const process=assessProcess(context.profile??{targetDegree:"bachelor",curriculumType:"other",intake:context.intake},versions,context.evaluatedAt);
  const legacy=legacyProcessRuleIds(z.array(RuleVersionSchema).parse(versions));
  const chunks = selection.selected.flatMap(({version}) => {
    const rule = KbSnapshotSchema.safeParse(version.raw_snapshot);
    if (!rule.success) return [];
    if(legacy.has(version.rule_id)&&!rule.data.outcomes.process)return [];
    if(rule.data.outcomes.process){
      const guidance=process.guidance.find(g=>g.ruleId===version.rule_id);
      const current=guidance?.status==="current";
      const content=current?JSON.stringify({amounts:guidance.amounts,alternatives:guidance.alternatives,additional:guidance.additional,steps:guidance.steps,sourceDateAnnotation:guidance.evidence.observation.source_date_annotation,sourceQuote:guidance.evidence.source_quote}):"Process applicability or source review unresolved. [[unknown]] Confirm purpose, responsible mission and exceptions with "+rule.data.source_url;
      return [{slug:rule.data.slug,title:rule.data.slug,content,source_url:rule.data.source_url,last_verified_at:current?rule.data.last_verified_at??null:null,country_code:rule.data.country_code,ruleId:version.rule_id,versionId:version.id,effectiveFrom:version.effective_from,effectiveUntil:version.effective_until,intakeFrom:version.intake_from,intakeUntil:version.intake_until,status:version.status}];
    }
    return [{...ruleToChunk({...rule.data, last_verified_at: rule.data.last_verified_at ?? null}, {includeLegacyDmatQuote: false}),
      ruleId: version.rule_id, versionId: version.id,
      effectiveFrom: version.effective_from, effectiveUntil: version.effective_until,
      intakeFrom: version.intake_from, intakeUntil: version.intake_until, status: version.status}];
  });
  // Ambiguous citation slugs cannot identify a unique immutable source.
  return {chunks: chunks.filter(chunk => chunks.filter(other => other.slug === chunk.slug).length === 1), diagnostics: selection.diagnostics, processUnknowns:process.unknowns};
}
export function projectVersionedKbMatches(matches: unknown, versions: unknown, context: unknown) {
  const hints = z.array(z.object({rule_id: RuleIdSchema.nullable()})).parse(matches);
  const knowledge = selectedKnowledge(versions, context);
  const ids = new Set(hints.flatMap(hint => hint.rule_id ? [hint.rule_id] : []));
  // Trade-off: include remaining selected rules so scoped/new publications are
  // discoverable before embeddings are rebuilt. The current corpus is small.
  return {...knowledge, chunks: [...knowledge.chunks.filter(c => ids.has(c.ruleId)), ...knowledge.chunks.filter(c => !ids.has(c.ruleId))]};
}
/** Index only currently applicable, unambiguous inputs without guessing intake. */
export function versionedEmbeddingChunks(versions: unknown, evaluatedAt: unknown) {
  const available = z.array(RuleVersionSchema).parse(versions);
  return selectedKnowledge(available, {evaluatedAt}).chunks;
}
