// Pure process projection. No clock, DB, questionnaire, task or publication I/O.
// Inventory contract (comments only, no runtime change):
// - processRuleIds is the inventory of all validated matched:true non-draft
//   candidate logical IDs, including ineligible jurisdiction/purpose/date,
//   stale (review_needed) and conflicting (unresolved) rows.
// - processRuleIds is NEVER authorization for payable amounts, evidence,
//   tasks, or current assistant claims.
// - Consumers authorize payable evidence/steps strictly from
//   guidance.filter(g => g.status === 'current'); other guidance entries and
//   literal observation/source_quote are review/conditional context only and
//   cannot render payable facts.
// - Future task display must preserve saved edits/completion/dates/bucket/
//   inactive state with no blanket hide/rewrite/reactivation.
// - No currentRuleIds field. Academic/APS resolution unchanged; parent PROC-02
//   stays OPEN until shell integration.
import { z } from "zod";

const Text = z.string().refine(s => s.trim().length > 0);
const Utc = z.string().datetime().refine(s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,19) === s.slice(0,19), "Expected a real UTC timestamp with at most millisecond precision");
const Amount = z.object({ amount: Text, currency: Text, period: Text }).strict();
const Age = z.object({ min: z.number().int().nonnegative().nullable(), max: z.number().int().nonnegative().nullable() }).strict().refine(a => a.min === null || a.max === null || a.min <= a.max);
/** Add to existing outcomes JSON as process; does not validate academic outcomes. */
export const ProcessOutcomeSchema = z.object({
  kind: z.enum(["funding", "visa_fee", "uni_assist_fee", "appointment"]),
  fact_key: Text,
  jurisdiction: z.string().regex(/^[a-z]{2}$/).nullable(),
  purposes: z.array(Text).min(1),
  age: Age.optional(),
  amounts: z.array(Amount),
  alternatives: z.array(z.object({ method: Text, text: Text }).strict()),
  additional: z.array(Text),
  source_date_annotation: Text.nullable(),
  effective: z.object({ from: Utc.nullable(), through: Utc.nullable(), intake_indices: z.array(z.number().int()).min(1).nullable() }).strict().refine(e => !e.from || !e.through || Date.parse(e.from) <= Date.parse(e.through)),
  review_due: Utc,
  steps: z.array(z.object({ order: z.number().int().nonnegative(), text: Text }).strict()).refine(s => new Set(s.map(v=>v.order)).size === s.length),
  editorial_advice: z.array(Text),
}).strict();
export type ProcessOutcome = z.infer<typeof ProcessOutcomeSchema>;

// Matcher is private in evaluate.ts. The caller must supply already matched,
// validated candidates; matched is an explicit adapter attestation, not a fact.
// Inventory note: every validated matched:true non-draft candidate enters the
// live set and therefore processRuleIds, even when later filtered as ineligible
// (jurisdiction/purpose/date) or projected as stale/conflicting. Eligibility
// filtering never removes an ID from the inventory; only draft/malformed rows
// are excluded before the inventory is built.
const Candidate = z.object({
  id: z.string().uuid(), matched: z.literal(true),
  status: z.enum(["draft", "beta", "verified"]),
  source_url: z.string().url().refine(s => /^https?:\/\//.test(s)), source_quote: Text,
  last_verified_at: Utc.nullable().optional(),
  outcomes: z.object({ process: ProcessOutcomeSchema }).passthrough(),
}).passthrough();
const Profile = z.object({
  visaApplicationCountry: z.string().regex(/^[a-z]{2}$/).optional(),
  intake: z.object({ term: z.enum(["winter", "summer"]), year: z.number().int() }).optional(),
  processContext: z.object({
    purpose: Text.optional(), missionConfirmed: z.boolean().optional(), age: z.number().int().nonnegative().optional(),
    fundingMethod: z.enum(["blocked_account", "scholarship", "commitment", "loan", "other", "unknown"]).optional(),
    exception: z.enum(["none", "public_scholarship", "other", "unknown"]).optional(),
    applicationRoute: z.enum(["direct", "uni_assist", "vpd", "unknown"]).optional(),
    universityPays: z.boolean().optional(),
  }).strict().optional(),
});
export type ProcessProfile = z.input<typeof Profile>;
export type ProcessGuidance = {
  ruleId: string; kind: ProcessOutcome["kind"]; status: "current" | "conditional" | "unknown" | "review_needed" | "unresolved";
  reasons: string[]; amounts: ProcessOutcome["amounts"]; alternatives: ProcessOutcome["alternatives"];
  additional: string[]; steps: { key: string; order: number; text: string }[];
  editorialAdvice: { label: "Editorial planning advice"; text: string }[];
  evidence: { source_url: string; source_quote: string; last_verified_at: string | null; observation: ProcessOutcome };
};
const official = "https://www.auswaertiges-amt.de/en/sperrkonto-388600";

/** asOfIso is assessment time, never intake or source publication time.
 * Financial amounts are usable only for current guidance. Evidence observations
 * remain verbatim for review and must never be rendered as payable amounts.
 *
 * Authorization contract: only guidance entries with status === 'current'
 * authorize payable amounts/steps (consumers use
 * guidance.filter(g => g.status === 'current')). Entries with
 * conditional/unknown/review_needed/unresolved status, and the literal
 * observation/source_quote inside evidence, are review/conditional context
 * only. processRuleIds is the full validated inventory described above and
 * must never be read as authorization.
 */
export function projectProcess(profile: unknown, publishedRules: unknown[], asOfIso: string) {
  const asOf = Date.parse(Utc.parse(asOfIso));
  const p = Profile.parse(profile), c = p.processContext ?? {};
  const raw = z.array(z.unknown()).parse(publishedRules);
  const unknowns: string[] = [];
  const live = raw.flatMap(r => {
    const parsed = Candidate.safeParse(r);
    if (!parsed.success) { unknowns.push("Invalid or unmatched process candidate — confirm with " + official); return []; }
    return parsed.data.status === "draft" ? [] : [parsed.data];
  });
  const eligible = live.filter(r => {
    const o = r.outcomes.process;
    if (o.jurisdiction !== null && o.jurisdiction !== p.visaApplicationCountry) return false;
    if (c.purpose && !o.purposes.includes(c.purpose)) return false;
    if (o.kind === "uni_assist_fee" && !["uni_assist", "vpd"].includes(c.applicationRoute ?? "")) return false;
    if (o.age && c.age !== undefined && ((o.age.min !== null && c.age < o.age.min) || (o.age.max !== null && c.age > o.age.max))) return false;
    const e = o.effective;
    if ((e.from && asOf < Date.parse(e.from)) || (e.through && asOf > Date.parse(e.through))) return false;
    if (e.intake_indices && p.intake && !e.intake_indices.includes(p.intake.year*2+(p.intake.term==="winter"?1:0))) return false;
    return true;
  });
  const guidance: ProcessGuidance[] = eligible.map(r => {
    const o = r.outcomes.process;
    const reasons: string[] = [];
    let status: ProcessGuidance["status"] = "current";
    const verified = r.last_verified_at ? Date.parse(r.last_verified_at) : NaN;
    if (!Number.isFinite(verified) || verified > asOf || Date.parse(o.review_due) < verified || asOf > Date.parse(o.review_due)) {
      status = "review_needed"; reasons.push("Verification or review deadline cannot authorize current financial facts.");
    }
    if (!c.purpose) reasons.push("Purpose is unconfirmed.");
    if (o.kind !== "uni_assist_fee" && (!p.visaApplicationCountry || c.missionConfirmed !== true)) reasons.push("Filing country does not establish competent mission or visa obligation.");
    if (o.effective.intake_indices && !p.intake) reasons.push("Effective intake scope is unconfirmed.");
    if (o.kind === "funding" && c.fundingMethod !== "blocked_account") reasons.push("Confirm applicable funding method and coverage; blocked account is one alternative.");
    if (o.kind === "visa_fee" && (c.age === undefined || !o.age)) reasons.push("Applicable age bracket is unconfirmed.");
    if (o.kind === "uni_assist_fee" && c.universityPays !== false) reasons.push("University-paid exception requires confirmation; no payment instruction.");
    if (o.kind !== "uni_assist_fee" && c.exception !== "none") reasons.push("Applicable exceptions or waiver require mission confirmation.");
    if (status === "current" && reasons.length) status = "conditional";
    if (status !== "review_needed" && o.kind === "funding" && c.fundingMethod === "loan") status = "unknown";
    const conflicts = eligible.filter(other => {
      const b = other.outcomes.process;
      const ageOverlaps = !o.age || !b.age || Math.max(o.age.min ?? 0,b.age.min ?? 0) <= Math.min(o.age.max ?? Infinity,b.age.max ?? Infinity);
      return other !== r && b.kind === o.kind && b.fact_key === o.fact_key && ageOverlaps && b.purposes.some(s=>o.purposes.includes(s)) &&
        o.amounts.some(a=>b.amounts.some(v=>a.currency===v.currency && a.period===v.period && a.amount!==v.amount));
    });
    if (conflicts.length) { status = "unresolved"; reasons.push("Overlapping contradictory observations require source review; no latest or highest winner."); }
    return {
      ruleId: r.id, kind: o.kind, status, reasons,
      amounts: status === "current" ? o.amounts : [], alternatives: o.alternatives, additional: o.additional,
      steps: status === "current" ? o.steps.map(s=>({...s,key:"rule:"+r.id+":step:"+s.order})) : [],
      editorialAdvice: o.editorial_advice.map(text=>({label:"Editorial planning advice" as const,text})),
      evidence: {source_url:r.source_url,source_quote:r.source_quote,last_verified_at:r.last_verified_at ?? null,observation:o},
    };
  });
  if (!guidance.length) unknowns.push("No published matched process coverage — confirm purpose, mission and application route with " + official + " or https://www.uni-assist.de/en/how-to-apply/pay-all-fees/handling-fees/");
  for (const g of guidance) if (g.status !== "current") unknowns.push(g.reasons.join(" ") + " Confirm with " + g.evidence.source_url);
  // processRuleIds is the validated non-draft inventory only (see header): it
  // includes ineligible/stale/conflicting IDs and never authorizes amounts,
  // evidence, tasks, or current assistant claims. No currentRuleIds is emitted.
  return { guidance, unknowns, processRuleIds: [...new Set(live.map(r=>r.id))], assessedAt: asOfIso };
}
