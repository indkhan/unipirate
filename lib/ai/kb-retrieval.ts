// Pure retrieval projection. Persisted text is never parsed to infer policy.
import { z } from "zod";
import { EngineRuleSchema } from "@/lib/engine/evaluate";
import { DMAT_SOURCE, DMAT_FIELD_SOURCE } from "@/lib/engine/dmat";
import { ruleToChunk, type KbChunk } from "./kb";

const MatchSchema = z.object({
  slug: z.string().min(1), title: z.string(), content: z.string(), source_url: z.string().url(),
  last_verified_at: z.string().nullable(), country_code: z.string().nullable(),
  source_type: z.enum(["rule", "snippet"]),
});
const RuleIdentitySchema = z.object({ slug: z.string(), outcomes: z.object({ dmat: z.unknown().optional() }).passthrough() });
const PublishedKbRuleSchema = EngineRuleSchema.innerType().extend({
  slug: z.string().min(1), country_code: z.string().nullable(),
  status: z.enum(["beta", "verified"]), last_verified_at: z.string().datetime({ offset: true }),
});

/** RULES01 reuse boundary: raw RPC matches + caller-visible current rule rows
 * (null means unavailable) -> model-visible chunks. No writes, clock or I/O.
 * Unmatched/invalid rule metadata fails closed; only validated unrelated rules
 * and unrelated curated snippets may retain persisted text.
 * This does not certify freshness of unrelated chunks or synthesize verification.
 */
export function projectDmatKbMatches(matches: readonly unknown[], publishedRules: readonly unknown[] | null): KbChunk[] {
  const identities = (publishedRules ?? []).map(row => ({ row, identity: RuleIdentitySchema.safeParse(row) }));
  return matches.map(raw => {
    const { source_type, ...match } = MatchSchema.parse(raw);
    const rows = identities.filter(r => r.identity.success && r.identity.data.slug === match.slug);
    const dmat = match.slug === "snippet-dmat-details" || match.slug === "dmat-india-existing-aps-exempt" ||
      match.source_url === DMAT_SOURCE || match.source_url === DMAT_FIELD_SOURCE ||
      rows.some(r => r.identity.success && r.identity.data.outcomes.dmat !== undefined);
    const unresolved = (): KbChunk => ({ ...match, title: "Rule applicability unresolved",
      content: "Rule applicability: unknown. [[unknown]] Current structured metadata cannot establish applicability; check the cited official source.",
      last_verified_at: null });
    // No trusted structured snippet metadata exists in this interface. Even a
    // rebuilt snippet must not silently acquire authority from its stored text.
    if (source_type !== "rule") return dmat ? unresolved() : match;
    // Without valid current metadata a renamed rule cannot prove unrelatedness.
    if (match.slug === "snippet-dmat-details" || rows.length !== 1) return unresolved();
    const rule = PublishedKbRuleSchema.safeParse(rows[0].row);
    if (!rule.success) return unresolved();
    if (!dmat) return match;
    return ruleToChunk(rule.data, { includeLegacyDmatQuote: false });
  });
}
