// Pure immutable-version knowledge projection. Stored embeddings are hints only.
import { z } from "zod";
import { EngineRuleSchema } from "@/lib/engine/evaluate";
import { RuleIdSchema, RuleVersionSchema, selectRuleVersions, assessmentDateUtc } from "@/lib/rules/versioning";
import { AssessmentInstantSchema } from "@/lib/rules/assessment";
import { ruleToChunk } from "./kb";

const ContextSchema = z.object({evaluatedAt: AssessmentInstantSchema, intake: z.object({term: z.enum(["summer", "winter"]), year: z.number().int().min(1).max(9999)}).optional()}).strict();
const KbSnapshotSchema = EngineRuleSchema.innerType().extend({slug: z.string().min(1), country_code: z.string().nullable()});
export function selectedKnowledge(versions: unknown, input: unknown) {
  const context = ContextSchema.parse(input);
  const selection = selectRuleVersions(versions, {...context, assessmentDate: assessmentDateUtc(context.evaluatedAt)});
  const chunks = selection.selected.flatMap(({version}) => {
    const rule = KbSnapshotSchema.safeParse(version.raw_snapshot);
    if (!rule.success) return [];
    return [{...ruleToChunk({...rule.data, last_verified_at: rule.data.last_verified_at ?? null}, {includeLegacyDmatQuote: false}),
      ruleId: version.rule_id, versionId: version.id,
      effectiveFrom: version.effective_from, effectiveUntil: version.effective_until,
      intakeFrom: version.intake_from, intakeUntil: version.intake_until, status: version.status}];
  });
  // Ambiguous citation slugs cannot identify a unique immutable source.
  return {chunks: chunks.filter(chunk => chunks.filter(other => other.slug === chunk.slug).length === 1), diagnostics: selection.diagnostics};
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
