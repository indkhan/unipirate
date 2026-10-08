// Pure process projection. No clock, DB, questionnaire, task or publication I/O.
import { z } from "zod";
import {instantOrder} from "./instant";

const Text = z.string().refine(s => s.trim().length > 0);
const Utc = z.string().datetime().refine(s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,19) === s.slice(0,19), "Expected a real UTC timestamp with at most microsecond precision");
const ObservationInstant=z.string().datetime({offset:true}).refine(s=>Number.isFinite(Date.parse(s)) && Utc.safeParse(s.replace(/[+-]\d{2}:\d{2}$/, "Z")).success);
const Amount = z.object({ amount: Text, currency: Text, period: Text }).strict();
const Age = z.object({ min: z.number().int().nonnegative().nullable(), max: z.number().int().nonnegative().nullable() }).strict().refine(a => a.min === null || a.max === null || a.min <= a.max);
/** Add to existing outcomes JSON as process; does not validate academic outcomes. */
export const ProcessOutcomeSchema = z.object({
  kind: z.enum(["funding", "visa_fee", "uni_assist_fee", "appointment"]),
  fact_key: Text,
  jurisdiction: z.string().regex(/^[a-z]{2}$/).nullable(),
  mission: Text.optional(),
  purposes: z.array(Text).min(1),
  age: Age.optional(),
  amounts: z.array(Amount),
  alternatives: z.array(z.object({ method: Text, text: Text }).strict()),
  additional: z.array(Text),
  source_date_annotation: Text.nullable(),
  effective: z.object({ from: Utc.nullable(), through: Utc.nullable(), intake_indices: z.array(z.number().int()).min(1).nullable() }).strict().refine(e => !e.from || !e.through || instantOrder(e.from) <= instantOrder(e.through)),
  review_due: Utc,
  steps: z.array(z.object({ order: z.number().int().nonnegative(), text: Text }).strict()).refine(s => new Set(s.map(v=>v.order)).size === s.length),
  editorial_advice: z.array(Text),
  unresolved_observations:z.array(z.object({amounts:z.array(Amount),source_url:z.string().url(),source_quote:Text,last_verified_at:Utc.nullable(),note:Text}).strict()).optional(),
}).strict();
export type ProcessOutcome = z.infer<typeof ProcessOutcomeSchema>;

// Shared matching is owned by evaluate.ts. The caller must supply already matched,
// validated candidates; matched is an explicit adapter attestation, not a fact.
const Candidate = z.object({
  id: z.string().uuid(), matched: z.literal(true),
  status: z.enum(["draft", "beta", "verified"]),
  source_url: z.string().url().refine(s => /^https?:\/\//.test(s)), source_quote: Text,
  last_verified_at: ObservationInstant.nullable().optional(),
  outcomes: z.object({ process: ProcessOutcomeSchema }).passthrough(),
}).passthrough();
export const ProcessContextSchema=z.object({
 version:z.literal(1),kind:z.enum(["funding","visa_fee","appointment"]).optional(),
 purpose:Text.optional(),mission:Text.optional(),missionConfirmed:z.boolean().optional(),
 ageBracket:z.enum(["under18","exact18","over18","unknown"]).optional(),
 fundingMethod:z.enum(["blocked_account","scholarship","commitment","loan","other","unknown"]).optional(),
 exception:z.enum(["none","public_scholarship","other","unknown"]).optional(),
}).strict();
const Profile = z.object({
  visaApplicationCountry: z.union([z.string().regex(/^[a-z]{2}$/),z.enum(["other","unknown"])]).optional(),
  intake: z.object({ term: z.enum(["winter", "summer"]), year: z.number().int() }).optional(),
  processContext: z.object({
    version: z.literal(1).optional(), mission: Text.optional(),kind:z.enum(["funding","visa_fee","appointment"]).optional(),ageBracket:z.enum(["under18","exact18","over18","unknown"]).optional(),
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
 * Financial amounts are usable only for current guidance; other observations
 * stay verbatim review context. processRuleIds is all validated matched:true
 * non-draft inventory including ineligible/stale/conflicting rows, never authorization.
 */
export function projectProcess(profile: unknown, publishedRules: unknown[], asOfIso: string) {
  const asOf = instantOrder(Utc.parse(asOfIso));
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
    if(c.kind && o.kind!==c.kind)return false;
    if (o.jurisdiction !== null && o.jurisdiction !== p.visaApplicationCountry) return false;
    if (c.purpose && !o.purposes.includes(c.purpose)) return false;
    if (o.kind === "uni_assist_fee" && !["uni_assist", "vpd"].includes(c.applicationRoute ?? "")) return false;
    if (o.age && c.age !== undefined && ((o.age.min !== null && c.age < o.age.min) || (o.age.max !== null && c.age > o.age.max))) return false;
    const e = o.effective;
    if ((e.from && asOf < instantOrder(e.from)) || (e.through && asOf > instantOrder(e.through))) return false;
    if (e.intake_indices && p.intake && !e.intake_indices.includes(p.intake.year*2+(p.intake.term==="winter"?1:0))) return false;
    return true;
  });
  const guidance: ProcessGuidance[] = eligible.map(r => {
    const o = r.outcomes.process;
    const reasons: string[] = [];
    let status: ProcessGuidance["status"] = "current";
    const reviewReasons=processReviewReasons(r,asOfIso);
    if(reviewReasons.length){status="review_needed";reasons.push(...reviewReasons);}
    if(c.version===1 && (!c.mission || ["unknown","other"].includes(c.mission)))reasons.push("The specific responsible mission is unconfirmed.");
    if(o.mission && c.mission!==o.mission)reasons.push("The specific responsible mission is unconfirmed or differs from this source.");
    if (!c.purpose) reasons.push("Purpose is unconfirmed.");
    if (o.kind !== "uni_assist_fee" && (!p.visaApplicationCountry || c.missionConfirmed !== true)) reasons.push("Filing country does not establish competent mission or visa obligation.");
    if (o.effective.intake_indices && !p.intake) reasons.push("Effective intake scope is unconfirmed.");
    if (o.kind === "funding" && c.fundingMethod !== "blocked_account") reasons.push("Confirm applicable funding method and coverage; blocked account is one alternative.");
    const bracket=c.ageBracket==="under18"?{min:0,max:17}:c.ageBracket==="exact18"?{min:18,max:18}:c.ageBracket==="over18"?{min:19,max:Infinity}:undefined;
    if(o.age && bracket && ((o.age.min!==null && bracket.min<o.age.min)||(o.age.max!==null && bracket.max>o.age.max)))reasons.push("This reported age bracket does not establish the source age scope.");
    if (o.kind === "visa_fee" && ((c.age === undefined && !bracket) || !o.age)) reasons.push("Applicable age bracket is unconfirmed.");
    if (o.kind === "uni_assist_fee" && c.universityPays !== false) reasons.push("University-paid exception requires confirmation; no payment instruction.");
    if ((o.kind === "funding" || o.kind === "visa_fee") && c.exception !== "none") reasons.push("Applicable exceptions or waiver require mission confirmation.");
    if (status === "current" && reasons.length) status = "conditional";
    if (status !== "review_needed" && o.kind === "funding" && c.fundingMethod === "loan") status = "unknown";
    const conflicts = eligible.filter(other=>other!==r && processObservationsConflict(o,other.outcomes.process));
    if (conflicts.length || o.unresolved_observations?.length) { status = "unresolved"; reasons.push("Overlapping contradictory observations require source review; no latest or highest winner."); }
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
  return { guidance, unknowns, processRuleIds: [...new Set(live.map(r=>r.id))], assessedAt: asOfIso };
}

/** Editorial review attention is independent of applicant matching and generic age. */
export function processReviewReasons(row:unknown,asOfIso:string):string[] {
 const input=z.object({last_verified_at:z.unknown().optional(),outcomes:z.object({process:z.unknown()})}).safeParse(row);
 if(!input.success)return ["Malformed process observation requires review."];
 const outcome=ProcessOutcomeSchema.safeParse(input.data.outcomes.process);
 const verified=ObservationInstant.safeParse(input.data.last_verified_at);
 if(!outcome.success || !verified.success)return ["Missing or invalid process verification/review policy requires review."];
 const now=instantOrder(Utc.parse(asOfIso)),date=instantOrder(verified.data),due=instantOrder(outcome.data.review_due);
 const reasons=date>now || due<date || now>due?["Verification or review deadline cannot authorize current financial facts."]:[];
 if(outcome.data.unresolved_observations?.length)reasons.push("Unresolved source observations require review.");
 return reasons;
}
export function processObservationsConflict(a:ProcessOutcome,b:ProcessOutcome):boolean {
 if(a.kind!==b.kind || a.fact_key!==b.fact_key || (a.jurisdiction!==null&&b.jurisdiction!==null&&a.jurisdiction!==b.jurisdiction) ||
   (a.mission&&b.mission&&a.mission!==b.mission) || !a.purposes.some(p=>b.purposes.includes(p)))return false;
 if(Math.max(a.age?.min??0,b.age?.min??0)>Math.min(a.age?.max??Infinity,b.age?.max??Infinity))return false;
 if(a.effective.from && b.effective.through && instantOrder(a.effective.from)>instantOrder(b.effective.through) || b.effective.from && a.effective.through && instantOrder(b.effective.from)>instantOrder(a.effective.through))return false;
 if(a.effective.intake_indices && b.effective.intake_indices && !a.effective.intake_indices.some(i=>b.effective.intake_indices!.includes(i)))return false;
 return a.amounts.some(x=>b.amounts.some(y=>x.currency===y.currency&&x.period===y.period&&x.amount!==y.amount)) ||
   JSON.stringify(a.steps)!==JSON.stringify(b.steps) || JSON.stringify(a.alternatives)!==JSON.stringify(b.alternatives) || JSON.stringify(a.additional)!==JSON.stringify(b.additional);
}
