// Pure retrieval projection. Persisted text is never parsed to infer policy.
import { isSaudiAdmissionRule, isScopedSaudiRule } from "@/lib/engine/saudi";
import { z } from "zod";
import { EngineRuleSchema, isJeeRule } from "@/lib/engine/evaluate";
import { JEE_SOURCE, JEE_FIELD_SOURCE, JEE_LEGACY_SLUG } from "@/lib/engine/jee";
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
}).refine(rule => !rule.outcomes.institution_restriction || rule.outcomes.path === "studienkolleg" || rule.outcomes.path === "subject_restricted" && isScopedSaudiRule(rule) && rule.conditions.sa_certificate_subtype !== "national" && rule.conditions.sa_certificate_subtype !== "private_school" && rule.conditions.sa_degree_evidence === undefined, { message: "FH restriction requires preparation or scoped industrial direct access" });

/** RULES01 reuse boundary: raw RPC matches + caller-visible current rule rows
 * (null means unavailable) -> model-visible chunks. No writes, clock or I/O.
 * Unmatched/invalid rule metadata fails closed. Unclassified rule caches must
 * exactly match current structured rendering; loss of family identity grants no
 * authority to old prose. Unrelated curated snippets retain their existing contract.
 */
export function projectDmatKbMatches(matches: readonly unknown[], publishedRules: readonly unknown[] | null): KbChunk[] {
  const identities = (publishedRules ?? []).map(row => ({ row, identity: RuleIdentitySchema.safeParse(row) }));
  return matches.map(raw => {
    const { source_type, ...match } = MatchSchema.parse(raw);
    const rows = identities.filter(r => r.identity.success && r.identity.data.slug === match.slug);
    const dmat = match.slug === "snippet-dmat-details" || match.slug === "dmat-india-existing-aps-exempt" ||
      match.source_url === DMAT_SOURCE || match.source_url === DMAT_FIELD_SOURCE ||
      rows.some(r => r.identity.success && r.identity.data.outcomes.dmat !== undefined);
    // Stable legacy identity/source links identify old JEE matches without
    // deriving policy from arbitrary stored prose. Current structured rows govern.
    const rule = rows.length === 1 ? PublishedKbRuleSchema.safeParse(rows[0].row) : undefined;
    const jee = match.slug === JEE_LEGACY_SLUG ||
      match.source_url === JEE_SOURCE || match.source_url === JEE_FIELD_SOURCE ||
      (rule?.success === true && isJeeRule(rule.data));
    const unresolved = (sourceUrl = match.source_url): KbChunk => ({ ...match, source_url: sourceUrl, title: "Rule applicability unresolved",
      content: "Rule applicability: unknown. [[unknown]] Current structured metadata cannot establish applicability; stored text/quotes are unverified and withheld. Check the cited official source." +
        (jee ? " Confirm JEE qualifying passage, qualification, field and intake with " + JEE_SOURCE + " and " + JEE_FIELD_SOURCE + "." : ""),
      last_verified_at: null });
    // No trusted structured snippet metadata exists in this interface. Even a
    // rebuilt snippet must not silently acquire authority from its stored text.
    const saudiSnippet = ["snippet-saudi-tawjihiyah", "snippet-saudi-private-school-ladder", "snippet-studienkolleg-middle-east"].includes(match.slug);
    if (source_type !== "rule") return dmat || jee || saudiSnippet ? unresolved() : match;
    // Without valid current metadata a renamed rule cannot prove unrelatedness.
    if (match.slug === "snippet-dmat-details" || rows.length !== 1) return unresolved();
    if (!rule?.success) return unresolved();
    const current = ruleToChunk(rule.data, { includeLegacyDmatQuote: false });
    // A rule may lose its JEE/dMAT identity. Without a structured family guard,
    // cached evidence must bind exactly to the current row, never just its slug.
    if (!isSaudiAdmissionRule(rule.data) && !isJeeRule(rule.data) && rule.data.slug !== JEE_LEGACY_SLUG && rule.data.outcomes.dmat === undefined &&
      Object.entries(current).some(([key, value]) =>
      match[key as keyof KbChunk] !== value)) return unresolved(current.source_url);
    return current;
  });
}
