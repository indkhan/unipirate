// Pure research contracts and evidence/review decisions. No provider or DB I/O.
import { z } from "zod";
import { ProgrammeSchema, OfferingFactSchema, OfferingSchema, OfferingVersionSchema } from "./offerings";

const label = z.string().trim().min(1).max(240);
export const ResearchUrlSchema = ProgrammeSchema.shape.source_url.refine(value => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.port; }
  catch { return false; }
}, "Use an HTTPS source URL without a custom port");
export const ResearchSeedSchema = z.object({
  url: ResearchUrlSchema, text: z.string().min(200).max(200_000), name: label, university: label,
}).strict();
export type ResearchSeed = z.infer<typeof ResearchSeedSchema>;
export const ObservationSchema = z.object({
  url: ResearchUrlSchema, content: z.string().min(1).max(20_000),
  retrieved_at: z.string().datetime(), origin: z.enum(["web", "paste", "manual"]),
}).strict();
export type Observation = z.infer<typeof ObservationSchema>;
const ref = z.object({ source_url: ResearchUrlSchema, source_quote: z.string().min(1).max(4000) }).strict();
const fact = z.object({
  key: label, kind: z.enum(["route", "deadline", "language", "prerequisite", "fee", "document", "description"]),
  verbatim: z.string().min(1).max(4000), applicability: label,
  route: z.enum(["direct", "uni_assist", "vpd_then_university", "unresolved"]).nullable(),
  deadline_kind: z.enum(["application_opening", "application_closing", "document_supplement", "enrolment", "vpd_preparation_target"]).nullable(),
  evidence: z.array(ref).min(1).max(4),
}).strict();
export const ResearchOutputSchema = z.object({ offerings: z.array(z.object({
  intake_term: z.enum(["summer", "winter"]).nullable(), intake_year: z.number().int().min(1).max(9999).nullable(),
  applicant_group: label.nullable(), scope: ref.nullable(), facts: z.array(fact).max(40),
}).strict()).max(8) }).strict();
const scope = OfferingSchema.omit({ programme_id: true });
export const ResearchDraftSchema = z.object({
  format: z.literal("up-course-01/v1"), status: z.enum(["draft", "incomplete"]),
  identity: z.object({ name: label, university: label, source_url: ResearchUrlSchema }).strict(),
  paste: z.string().max(200_000).optional(),
  observations: z.array(ObservationSchema).max(12),
  unscoped: z.array(OfferingFactSchema).max(320).optional(),
  offerings: z.array(scope.extend({ scope: ref, facts: z.array(OfferingFactSchema).max(50) }).strict()).max(8),
  conflicts: z.array(z.object({ offering: z.number().int(), key: label, alternatives: z.array(fact).max(40) }).strict()).max(320),
  issues: z.array(z.string().max(300)).max(30),
}).strict().superRefine((draft, ctx) => {
  // Manual observations represent an admin's own source capture. They expand
  // review provenance through the same DAAD identity/link rule, never AI trust.
  const domains = officialDomains(draft.identity, draft.observations.map(o => o.origin === "manual" ? { ...o, origin: "web" as const } : o));
  for (const o of draft.offerings) {
    const source = draft.observations.find(s => s.origin !== "paste" && s.url === o.scope.source_url && s.content.includes(o.scope.source_quote));
    if (!source || !identifies(source, draft.identity) || !(o.intake_term === "winter" ? /winter/i : /summer|sommer/i).test(o.scope.source_quote)
      || !new RegExp(`\\b${o.intake_year}\\b`).test(o.scope.source_quote) || !literalGroup(o.scope.source_quote, o.applicant_group)) ctx.addIssue({ code: "custom", message: "Draft offering needs captured identity/intake/applicant scope" });
  }
  for (const offering of [...draft.offerings, { facts: draft.unscoped ?? [] }]) {
    if (new Set(offering.facts.map(f => f.key)).size !== offering.facts.length) ctx.addIssue({ code: "custom", message: "Duplicate draft field key" });
    for (const f of offering.facts) {
      if (!["pending", "unresolved"].includes(f.status) || f.date !== null || f.time !== null || f.timezone !== null
        || f.evidence.some(e => e.verified_by !== null || e.last_verified_at !== null)) ctx.addIssue({ code: "custom", message: "Research cannot carry review or planning metadata" });
      if (f.status === "pending" && (!f.verbatim || !f.evidence.length || !f.evidence.some(e => e.source_quote.includes(f.verbatim!)))) ctx.addIssue({ code: "custom", message: "Pending assertion needs literal evidence" });
      for (const e of f.evidence) {
        if (!domains.some(d => onDomain(e.source_url, d)) || !draft.observations.some(o => o.origin !== "paste" && o.url === e.source_url && o.retrieved_at === e.retrieved_at && o.content.includes(e.source_quote))) ctx.addIssue({ code: "custom", message: "Evidence must match an official retrieved observation" });
      }
    }
  }
});
export type ResearchDraft = z.infer<typeof ResearchDraftSchema>;
export function onDomain(url: string, domain: string): boolean {
  const parsed = ResearchUrlSchema.safeParse(url);
  if (!parsed.success) return false;
  const host = new URL(parsed.data).hostname;
  return host === domain || host.endsWith(`.${domain}`);
}
export function links(content: string): string[] {
  return [...content.matchAll(/https:\/\/[^\s<>"\])]+/g)].map(m => m[0]).filter(url => ResearchUrlSchema.safeParse(url).success);
}
function identifies(source: Observation, seed: Pick<ResearchSeed, "name" | "university">): boolean {
  return source.content.includes(seed.name) && source.content.includes(seed.university);
}
// University domains are admitted only through a retrieved DAAD identity page's
// outbound links, never a model recommendation or a user's claimed domain.
export function officialDomains(seed: Pick<ResearchSeed, "name" | "university">, observations: Observation[]): string[] {
  const domains = new Set(["daad.de", "uni-assist.de"]);
  for (const source of observations) {
    if (source.origin !== "web" || !onDomain(source.url, "daad.de") || !identifies(source, seed)) continue;
    const endorsed = [...source.content.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)]
      .filter(m => m[1].includes(seed.university) || /university|hochschule|homepage|website|application|bewerbung/i.test(m[1])).map(m => m[2]);
    for (const link of endorsed.filter(u => ResearchUrlSchema.safeParse(u).success)) {
      const host = new URL(link).hostname.replace(/^www\./, "");
      // Trade-off: German university domains only; other hosts remain unresolved
      // until a future reviewed domain registry establishes their provenance.
      if (host.endsWith(".de") && !onDomain(link, "daad.de") && !onDomain(link, "uni-assist.de")) domains.add(host);
    }
  }
  return [...domains].slice(0, 8);
}
function literalGroup(content: string, group: string): boolean {
  const escaped = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_-])${escaped}($|[^\\p{L}\\p{N}_-])`, "u").test(content);
}
export function buildResearchDraft(seed: ResearchSeed, observations: Observation[], output: unknown, issues: string[]): ResearchDraft {
  seed = ResearchSeedSchema.parse(seed);
  observations = z.array(ObservationSchema).max(12).parse(observations);
  const draft: ResearchDraft = { format: "up-course-01/v1", status: "draft", identity: { name: seed.name, university: seed.university, source_url: seed.url }, paste: seed.text, observations, offerings: [], unscoped: [], conflicts: [], issues: issues.slice(0, 20) };
  const parsed = ResearchOutputSchema.safeParse(output);
  if (!parsed.success) {
    draft.status = "incomplete";
    draft.issues.push("AI output missing or invalid; pasted/manual information retained.");
    return ResearchDraftSchema.parse(draft);
  }
  const domains = officialDomains(seed, observations);
  const eligible = observations.filter(s => s.origin === "web" && domains.some(d => onDomain(s.url, d)));
  const sourceFor = (reference: z.infer<typeof ref>) => eligible.find(s => s.url === reference.source_url && s.content.includes(reference.source_quote));
  const capture = (reference: z.infer<typeof ref>) => ({ ...reference, retrieved_at: sourceFor(reference)!.retrieved_at, last_verified_at: null, verified_by: null, source_hash: null });
  type CandidateOffering = z.infer<typeof ResearchOutputSchema>["offerings"][number];
  const scopeSource = (o: CandidateOffering) => {
    if (!o.scope || o.intake_term === null || o.intake_year === null || o.applicant_group === null) return undefined;
    const observed = sourceFor(o.scope);
    const season = o.intake_term === "winter" ? /winter/i : /summer|sommer/i;
    return observed && identifies(observed, seed) && season.test(o.scope.source_quote)
      && new RegExp(`\\b${o.intake_year}\\b`).test(o.scope.source_quote)
      && literalGroup(o.scope.source_quote, o.applicant_group) ? observed : undefined;
  };
  const merged: CandidateOffering[] = [];
  const candidateScopes = new Map<z.infer<typeof fact>, z.infer<typeof ref>>();
  for (const offering of parsed.data.offerings) {
    const supported = scopeSource(offering);
    if (supported) for (const candidate of offering.facts) candidateScopes.set(candidate, offering.scope!);
    const existing = supported && merged.find(o => scopeSource(o) && o.intake_term === offering.intake_term && o.intake_year === offering.intake_year && o.applicant_group === offering.applicant_group);
    if (existing) existing.facts.push(...offering.facts);
    else merged.push({ ...offering, facts: [...offering.facts] });
  }
  for (const offering of merged) {
    const source = offering.scope ? sourceFor(offering.scope) : undefined;
    if (offering.intake_year === null || offering.intake_term === null || offering.applicant_group === null || offering.scope === null) {
      draft.issues.push("Effective intake/applicant scope is unknown; sourced captures require scope review before publication.");
      for (const [index, candidate] of offering.facts.entries()) {
        if (!candidate.evidence.every(e => {
          const observed = sourceFor(e);
          return observed && e.source_quote.includes(candidate.verbatim) && (identifies(observed, seed) || (source && identifies(source, seed) && links(source.content).includes(observed.url)));
        })) continue;
        const checked = OfferingFactSchema.safeParse({ ...candidate, applicability: "Unresolved effective intake/applicant scope", key: `unscoped:${draft.unscoped!.length}:${index}:${candidate.key}`, status: "pending", date: null, time: null, timezone: null, evidence: candidate.evidence.map(capture) });
        if (checked.success) draft.unscoped!.push(checked.data);
      }
      continue;
    }
    const season = offering.intake_term === "winter" ? /winter/i : /summer|sommer/i;
    if (!source || !scopeSource(offering)) {
      draft.issues.push("Offering identity, effective intake or applicant scope lacks retrieved literal support.");
      continue;
    }
    const facts: z.infer<typeof OfferingFactSchema>[] = [];
    const applicantGroup = offering.applicant_group;
    const grouped = new Map<string, z.infer<typeof fact>[]>();
    for (const candidate of offering.facts) {
      const candidateSource = sourceFor(candidateScopes.get(candidate)!);
      const supported = candidate.applicability === offering.applicant_group && candidate.evidence.every(e => {
        const observed = sourceFor(e);
        return observed && e.source_quote.includes(candidate.verbatim)
          && (identifies(observed, seed) || links(candidateSource!.content).includes(observed.url))
          && ((season.test(observed.content) && new RegExp(`\\b${offering.intake_year}\\b`).test(observed.content)
            && literalGroup(observed.content, applicantGroup)) || links(candidateSource!.content).includes(observed.url));
      });
      const validated = OfferingFactSchema.safeParse({ ...candidate, status: "pending", date: null, time: null, timezone: null, evidence: candidate.evidence.filter(e => sourceFor(e)).map(capture) });
      if (!supported || !validated.success) {
        draft.issues.push("A candidate lacked source, wording or applicability support and was left unresolved.");
        continue;
      }
      const field = candidate.kind === "route" ? "route" : candidate.kind === "deadline" ? `deadline:${candidate.deadline_kind}` : candidate.key;
      grouped.set(field, [...(grouped.get(field) ?? []), candidate]);
    }
    for (const alternatives of grouped.values()) {
      const first = alternatives[0];
      const key = first.key;
      const conflict = alternatives.some(f => f.verbatim !== first.verbatim || f.kind !== first.kind || f.route !== first.route || f.deadline_kind !== first.deadline_kind);
      if (conflict) draft.conflicts.push({ offering: draft.offerings.length, key, alternatives });
      facts.push(OfferingFactSchema.parse({ ...first, status: conflict ? "unresolved" : "pending", verbatim: conflict ? null : first.verbatim,
        route: conflict && first.kind === "route" ? "unresolved" : first.route,
        date: null, time: null, timezone: null,
        evidence: alternatives.flatMap(f => [...f.evidence.map(capture), capture(candidateScopes.get(f)!)]),
      }));
    }
    // Each essential research topic has a visible gap, rather than an absent key.
    const topics = ["route", "deadline", "prerequisite", "language", "language_exemption", "tuition", "semester_fee", "document", "application_link"] as const;
    for (const topic of topics) {
      const kind = topic === "language_exemption" ? "language" : topic === "tuition" || topic === "semester_fee" ? "fee" : topic === "application_link" ? "description" : topic;
      const covered = topic === "language_exemption" || topic === "tuition" || topic === "semester_fee" || topic === "application_link"
        ? facts.some(f => f.key === topic) : facts.some(f => f.kind === kind);
      if (!covered) facts.push(OfferingFactSchema.parse({ key: `unknown:${topic}`, kind, status: "unresolved", verbatim: null, applicability: offering.applicant_group,
        evidence: [], route: kind === "route" ? "unresolved" : null, deadline_kind: kind === "deadline" ? "application_closing" : null, date: null, time: null, timezone: null }));
    }
    draft.offerings.push({ intake_term: offering.intake_term, intake_year: offering.intake_year, applicant_group: offering.applicant_group, applicability: { source_scope: offering.scope.source_quote }, scope: offering.scope, facts });
  }
  draft.issues = [...new Set(draft.issues)].slice(0, 30);
  if (draft.issues.length || !draft.offerings.length || draft.conflicts.length || draft.offerings.some(o => o.facts.some(f => f.status === "unresolved"))) draft.status = "incomplete";
  return ResearchDraftSchema.parse(draft);
}
export function prepareResearchReview(draft: ResearchDraft, index: number, selected: string[], reviewer: string, now: string): z.infer<typeof OfferingFactSchema>[] {
  draft = ResearchDraftSchema.parse(draft);
  z.string().uuid().parse(reviewer); z.string().datetime().parse(now);
  const offering = draft.offerings[z.number().int().min(0).parse(index)];
  if (!offering || new Set(selected).size !== selected.length) throw new Error("Invalid offering or duplicate review selection");
  for (const key of selected) {
    const fact = offering.facts.find(f => f.key === key);
    if (!fact || fact.status !== "pending" || !fact.verbatim || !fact.evidence.length || draft.conflicts.some(c => c.offering === index && c.key === key)) throw new Error("Only supported pending facts can be accepted; conflicts require resolution");
  }
  const facts = offering.facts.map(f => selected.includes(f.key)
    ? { ...f, status: "verified" as const, evidence: f.evidence.map(e => ({ ...e, verified_by: reviewer, last_verified_at: now })) }
    : { ...f, status: "unresolved" as const, verbatim: null, route: f.kind === "route" ? "unresolved" as const : null });
  return OfferingVersionSchema.parse({ offering_id: reviewer, version: 1, review_status: "verified", reviewed_by: reviewer, reviewed_at: now, facts }).facts;
}

export function hasResearch(metadata: unknown): boolean {
  return !!metadata && typeof metadata === "object" && Object.prototype.hasOwnProperty.call(metadata, "research");
}
export function readResearch(metadata: unknown): ResearchDraft | null {
  if (!hasResearch(metadata)) return null;
  return ResearchDraftSchema.parse((metadata as Record<string, unknown>).research);
}
