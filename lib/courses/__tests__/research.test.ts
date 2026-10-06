import { describe, expect, it } from "vitest";
import { buildResearchDraft, prepareResearchReview, officialDomains, ResearchDraftSchema, ResearchOutputSchema, ResearchSeedSchema } from "../research";

export const seed = { url: "https://www.daad.de/example", name: "Synthetic Computing", university: "Synthetic University", text: "Synthetic Computing Synthetic University ".repeat(8) };
export const observations = [
  { url: seed.url, content: "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants Apply by 31 May. [University](https://uni-example.de/computing)", retrieved_at: "2026-10-07T12:00:00Z", origin: "web" as const },
  { url: "https://uni-example.de/computing", content: "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants Apply by 30 June. IELTS 6.5. [Regulations](https://uni-example.de/rules.pdf)", retrieved_at: "2026-10-07T12:00:00Z", origin: "web" as const },
  { url: "https://uni-example.de/rules.pdf", content: "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants IELTS 6.5.", retrieved_at: "2026-10-07T12:00:00Z", origin: "web" as const },
];
const reference = (source_url: string, source_quote: string) => ({ source_url, source_quote });
export const output = { offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: reference(seed.url, "Winter 2027 Non-EU applicants"), facts: [
  { key: "application", kind: "deadline", verbatim: "Apply by 31 May.", applicability: "Non-EU applicants", route: null, deadline_kind: "application_closing", evidence: [reference(seed.url, "Apply by 31 May.")] },
  { key: "application", kind: "deadline", verbatim: "Apply by 30 June.", applicability: "Non-EU applicants", route: null, deadline_kind: "application_closing", evidence: [reference(observations[1].url, "Apply by 30 June.")] },
  { key: "english", kind: "language", verbatim: "IELTS 6.5.", applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [reference(observations[2].url, "IELTS 6.5.")] },
] }] };

describe("research evidence boundary", () => {
  it("preserves opposing IELTS requirements despite arbitrary model keys, while TOEFL remains a separate alternative", () => {
    const sources = observations.map((s, i) => i === 2 ? { ...s, content: `${s.content} IELTS 7.0. TOEFL 90.` } : s);
    const language = output.offerings[0].facts[2];
    const facts = [language, { ...language, key: "language_requirement", verbatim: "IELTS 7.0.", evidence: [reference(sources[2].url, "IELTS 7.0.")] },
      { ...language, key: "other", verbatim: "TOEFL 90.", evidence: [reference(sources[2].url, "TOEFL 90.")] }];
    const draft = buildResearchDraft(seed, sources, { offerings: [{ ...output.offerings[0], facts }] }, []);
    expect(draft.conflicts).toHaveLength(1);
    expect(draft.conflicts[0].alternatives).toHaveLength(2);
    expect(draft.offerings[0].facts.find(f => f.key === "other")?.status).toBe("pending");
    expect(() => prepareResearchReview(draft, 0, ["english"], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z")).toThrow();
    expect(prepareResearchReview(draft, 0, ["other"], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z").find(f => f.key === "other")?.status).toBe("verified");
    const edited = buildResearchDraft(seed, sources, { offerings: [{ ...output.offerings[0], facts: [language] }] }, []);
    edited.offerings[0].facts.push({ ...edited.offerings[0].facts[0], key: "bypass", verbatim: "IELTS 7.0.", evidence: [{ ...edited.offerings[0].facts[0].evidence[0], source_quote: "IELTS 7.0." }] });
    expect(ResearchDraftSchema.safeParse(edited).success).toBe(false);
  });
  it("accepts identical source-named requirements without false conflicts and rejects field evidence unrelated to offering scope", () => {
    const language = output.offerings[0].facts[2];
    const draft = buildResearchDraft(seed, observations, { offerings: [{ ...output.offerings[0], facts: [language, { ...language, key: "language_requirement" }] }] }, []);
    expect(draft.conflicts).toEqual([]);
    expect(draft.offerings[0].facts.filter(f => f.status === "pending")).toHaveLength(1);
    expect(ResearchDraftSchema.safeParse(draft).success).toBe(true);
    const edited = structuredClone(draft);
    edited.observations.push({ url: "https://uni-example.de/unrelated", origin: "manual", content: "Unrelated programme Summer 2030 EU applicants IELTS 6.5.", retrieved_at: observations[0].retrieved_at });
    edited.offerings[0].facts[0].evidence[0].source_url = "https://uni-example.de/unrelated";
    expect(ResearchDraftSchema.safeParse(edited).success).toBe(false);
  });
  it("requires literal stage and portal evidence before reviewing application links", () => {
    const portal = "https://uni-example.de/portal";
    const candidate = { ...output.offerings[0].facts[2], key: "application_link:university", kind: "description", verbatim: portal,
      evidence: [reference(observations[1].url, `University application: ${portal}`)] };
    const sources = observations.map((s, i) => i === 1 ? { ...s, content: `${s.content} University application: ${portal}` } : s);
    const draft = buildResearchDraft(seed, sources, { offerings: [{ ...output.offerings[0], facts: [candidate] }] }, []);
    const reviewer = "11111111-1111-4111-8111-111111111111";
    expect(prepareResearchReview(draft, 0, [candidate.key], reviewer, "2026-10-07T13:00:00Z")[0].status).toBe("verified");
    const vague = structuredClone(draft);
    vague.offerings[0].facts[0].evidence[0].source_quote = portal;
    expect(() => prepareResearchReview(vague, 0, [candidate.key], reviewer, "2026-10-07T13:00:00Z")).toThrow();
    const generic = structuredClone(draft); generic.offerings[0].facts[0].key = "application_link";
    expect(() => prepareResearchReview(generic, 0, ["application_link"], reviewer, "2026-10-07T13:00:00Z")).toThrow();
  });
  it("keeps university and VPD closing dates separate instead of creating a false conflict", () => {
    const offering = structuredClone(output.offerings[0]);
    offering.facts = offering.facts.slice(0, 2).map((f, i) => ({ ...f, key: `deadline:${i ? "vpd" : "university"}:application_closing` }));
    const draft = buildResearchDraft(seed, observations, { offerings: [offering] }, []);
    expect(draft.conflicts).toEqual([]);
    expect(draft.offerings[0].facts.filter(f => f.kind === "deadline")).toHaveLength(2);
    expect(() => prepareResearchReview(draft, 0, [offering.facts[0].key], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z")).toThrow();
  });
  it("does not admit domains from paste, unrelated DAAD identities, or unlabelled third-party links", () => {
    expect(officialDomains(seed, [{ ...observations[0], origin: "paste" }])).toEqual(["daad.de", "uni-assist.de"]);
    expect(officialDomains(seed, [{ ...observations[0], content: observations[0].content.replace("Synthetic Computing", "Unrelated") }])).toEqual(["daad.de", "uni-assist.de"]);
    expect(officialDomains(seed, [{ ...observations[0], content: "Synthetic Computing Synthetic University [Sponsor](https://evil.de)" }])).toEqual(["daad.de", "uni-assist.de"]);
  });
  it("rejects reviewer/status spoofing in a stored research envelope", () => {
    const draft = buildResearchDraft(seed, observations, output, []);
    draft.offerings[0].facts[0].status = "verified";
    expect(ResearchDraftSchema.safeParse(draft).success).toBe(false);
    draft.offerings[0].facts[0].status = "unresolved";
    draft.offerings[0].facts[0].evidence[0].verified_by = "11111111-1111-4111-8111-111111111111";
    draft.offerings[0].facts[0].evidence[0].last_verified_at = "2026-10-07T13:00:00Z";
    expect(ResearchDraftSchema.safeParse(draft).success).toBe(false);
  });
  it("merges repeated offering scopes and preserves competing closing dates even with different model keys", () => {
    const first = structuredClone(output.offerings[0]); first.facts = [first.facts[0]];
    const second = structuredClone(output.offerings[0]); second.facts = [{ ...second.facts[1], key: "different-closing-key" }];
    const draft = buildResearchDraft(seed, observations, { offerings: [first, second] }, []);
    expect(draft.offerings).toHaveLength(1);
    expect(draft.offerings[0].facts.find(f => f.kind === "deadline")).toMatchObject({ status: "unresolved", verbatim: null });
    expect(draft.conflicts[0].alternatives).toHaveLength(2);
  });
  it("retains sourced captures when the effective intake year is unknown, without inventing an offering", () => {
    const sources = observations.map(s => ({ ...s, content: s.content.replaceAll("Winter 2027", "Winter semester") }));
    const offering = { ...output.offerings[0], intake_year: null, scope: { source_url: seed.url, source_quote: "Winter semester Non-EU applicants" } };
    const draft = buildResearchDraft(seed, sources, { offerings: [offering] }, []);
    expect(draft.offerings).toEqual([]);
    expect(draft.unscoped?.find(f => f.key.endsWith(":english"))).toMatchObject({ status: "pending", verbatim: "IELTS 6.5.", date: null });
    expect(draft.status).toBe("incomplete");
  });
  it("retains multiple sources and conflicts, with every essential topic unresolved or evidenced", () => {
    const draft = buildResearchDraft(seed, observations, output, []);
    expect(draft.offerings[0].facts.find(f => f.key === "application")).toMatchObject({ status: "unresolved", verbatim: null, evidence: expect.any(Array) });
    expect(draft.conflicts).toHaveLength(1);
    expect(draft.offerings[0].facts.find(f => f.key === "english")).toMatchObject({ status: "pending", date: null, evidence: expect.arrayContaining([expect.objectContaining({ last_verified_at: null, verified_by: null })]) });
    expect(draft.offerings[0].facts.map(f => f.kind)).toEqual(expect.arrayContaining(["route", "deadline", "language", "prerequisite", "fee", "document", "description"]));
  });
  it.each(["url", "quote", "identity", "applicant", "intake"])("rejects unsupported %s without inventing replacement facts", (mismatch) => {
    const changed = structuredClone(output);
    changed.offerings[0].facts = [changed.offerings[0].facts[2]];
    const sources = structuredClone(observations);
    if (mismatch === "url") changed.offerings[0].facts[0].evidence[0].source_url = "https://evil.invalid/fake";
    if (mismatch === "quote") changed.offerings[0].facts[0].evidence[0].source_quote = "Invented";
    if (mismatch === "identity") sources.forEach(s => s.content = s.content.replaceAll("Synthetic Computing", "Unrelated Medicine"));
    if (mismatch === "applicant") changed.offerings[0].applicant_group = "EU applicants";
    if (mismatch === "intake") changed.offerings[0].intake_year = 2028;
    const draft = buildResearchDraft(seed, sources, changed, []);
    expect(draft.offerings.flatMap(o => o.facts).filter(f => f.status === "pending")).toEqual([]);
    expect(draft.status).toBe("incomplete");
  });
  it.each([{ status: "verified" }, { verified_by: "11111111-1111-4111-8111-111111111111" }, { date: "2027-05-31" }])("rejects model review/planning metadata %j", (extra) => {
    const changed = structuredClone(output);
    Object.assign(changed.offerings[0].facts[0], extra);
    expect(ResearchOutputSchema.safeParse(changed).success).toBe(false);
  });
  it("does not use a paste as retrieved official evidence", () => {
    const draft = buildResearchDraft(seed, observations.map(s => ({ ...s, origin: "paste" })), output, []);
    expect(draft.offerings).toEqual([]);
  });
  it("requires explicit review, rejects conflict acceptance, binds reviewer on selected facts only", () => {
    const draft = buildResearchDraft(seed, observations, output, []);
    const reviewer = "11111111-1111-4111-8111-111111111111";
    expect(() => prepareResearchReview(draft, 0, ["application"], reviewer, "2026-10-07T13:00:00Z")).toThrow();
    expect(() => prepareResearchReview(draft, 0, ["invented"], reviewer, "2026-10-07T13:00:00Z")).toThrow();
    const facts = prepareResearchReview(draft, 0, ["english"], reviewer, "2026-10-07T13:00:00Z");
    expect(facts.find(f => f.key === "english")).toMatchObject({ status: "verified", evidence: expect.arrayContaining([expect.objectContaining({ verified_by: reviewer })]) });
    expect(facts.filter(f => f.status === "verified")).toHaveLength(1);
    expect(facts.every(f => f.date === null)).toBe(true);
  });
  it("rejects unsafe URLs and oversized or missing identity inputs", () => {
    for (const change of [{ url: "http://localhost/foo" }, { url: "https://user:pass@daad.de/foo" }, { name: "" }, { text: "x".repeat(200001) }]) {
      expect(ResearchSeedSchema.safeParse({ ...seed, ...change }).success).toBe(false);
    }
  });
});
