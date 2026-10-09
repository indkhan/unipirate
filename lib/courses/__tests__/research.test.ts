import { describe, expect, it } from "vitest";
import { buildResearchDraft, prepareResearchReview, officialDomains, ResearchDraftSchema, ResearchOutputSchema, ResearchSeedSchema, patchResearchDraft } from "../research";

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
  it.each(["year", "term", "group", "quote", "missing"])("retains source-supported multi-source captures with unsupported %s scope, never a publishable offering", mismatch => {
    const offering = structuredClone(output.offerings[0]);
    if (mismatch === "year") offering.intake_year = 2030;
    if (mismatch === "term") offering.intake_term = "summer";
    if (mismatch === "group") offering.applicant_group = "EU applicants";
    if (mismatch === "quote") offering.scope.source_quote = "Invented scope";
    const draft = buildResearchDraft(seed, observations, { offerings: [{ ...offering, scope: mismatch === "missing" ? null : offering.scope }] }, []);
    expect(draft.offerings).toEqual([]);
    expect(draft.unscoped?.map(f => f.verbatim)).toEqual(expect.arrayContaining(["Apply by 31 May.", "Apply by 30 June.", "IELTS 6.5."]));
    expect(new Set(draft.unscoped?.flatMap(f => f.evidence.map(e => e.source_url))).size).toBe(3);
    expect(draft.unscoped?.every(f => f.status === "pending" && f.applicability === "Unresolved effective intake/applicant scope" && f.date === null && f.evidence.every(e => !e.verified_by && !e.last_verified_at))).toBe(true);
    expect(() => prepareResearchReview(draft, 0, [draft.unscoped![0].key], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z")).toThrow();
    expect(draft.status).toBe("incomplete");
  });
  it("excludes fabricated wording and wrong identities when recovering unsupported scope", () => {
    const offering = structuredClone(output.offerings[0]); offering.intake_year = 2030;
    offering.facts[0].evidence[0].source_quote = "Fabricated deadline";
    const draft = buildResearchDraft(seed, observations, { offerings: [offering] }, []);
    expect(draft.unscoped?.map(f => f.verbatim)).not.toContain("Apply by 31 May.");
    offering.facts[0].evidence[0] = reference("https://evil.invalid/fabricated", "Apply by 31 May.");
    expect(buildResearchDraft(seed, observations, { offerings: [offering] }, []).unscoped?.flatMap(f => f.evidence.map(e => e.source_url))).not.toContain("https://evil.invalid/fabricated");
    const wrong = observations.map(s => ({ ...s, content: s.content.replaceAll(seed.name, "Unrelated Programme") }));
    expect(buildResearchDraft(seed, wrong, { offerings: [offering] }, []).unscoped).toEqual([]);
  });
  it("recovers a linked regulation without invented scope, rejecting unlinked sources and fabricated recovery labels", () => {
    const sources = observations.map((s, i) => i === 2 ? { ...s, content: "IELTS 6.5." } : s);
    sources.push({ ...sources[2], url: "https://uni-example.de/unrelated.pdf" });
    const offering = structuredClone(output.offerings[0]); offering.intake_year = 2030;
    offering.facts = [offering.facts[2], { ...offering.facts[2], key: "unrelated", evidence: [reference(sources[3].url, "IELTS 6.5.")] }];
    const draft = buildResearchDraft(seed, sources, { offerings: [offering] }, []);
    expect(draft.unscoped).toHaveLength(1);
    expect(draft.unscoped![0].evidence[0].source_url).toBe(sources[2].url);
    const edited = structuredClone(draft); edited.unscoped![0].applicability = "Winter 2030 EU applicants";
    expect(ResearchDraftSchema.safeParse(edited).success).toBe(false);
    edited.unscoped![0].applicability = "Unresolved effective intake/applicant scope";
    edited.unscoped![0].evidence[0].source_url = sources[3].url;
    expect(ResearchDraftSchema.safeParse(edited).success).toBe(false);
  });
  it.each([
    ["IELTS 6.5 or TOEFL 90.", "IELTS 7.0.", true],
    ["IELTS 7.0.", "IELTS 6.5 or TOEFL 90.", true],
    ["IELTS 6.5.", "TOEFL 90.", false],
    ["IELTS 6.5 or TOEFL 90.", "IELTS 6.5 or TOEFL 90.", false],
    ["Unknown test score 60.", "Unknown test score 70.", true],
  ])("checks overlapping instrument assertions %s / %s", (first, second, conflict) => {
    const sources = observations.map((s, i) => i === 2 ? { ...s, content: `${s.content} ${first} ${second}` } : s);
    const language = output.offerings[0].facts[2];
    const candidates = [first, second].map((verbatim, i) => ({ ...language, key: i ? "language_requirement" : "english", verbatim, evidence: [reference(sources[2].url, verbatim)] }));
    const draft = buildResearchDraft(seed, sources, { offerings: [{ ...output.offerings[0], facts: candidates }] }, []);
    expect(draft.conflicts).toHaveLength(conflict ? 1 : 0);
    const stored = buildResearchDraft(seed, sources, { offerings: [{ ...output.offerings[0], facts: [candidates[0]] }] }, []);
    stored.offerings[0].facts.push({ ...stored.offerings[0].facts[0], key: "language_requirement", verbatim: second, evidence: [{ ...stored.offerings[0].facts[0].evidence[0], source_quote: second }] });
    expect(ResearchDraftSchema.safeParse(stored).success).toBe(!conflict);
    if (conflict) expect(() => prepareResearchReview(stored, 0, ["english", "language_requirement"], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z")).toThrow();
    else expect(prepareResearchReview(stored, 0, ["english", "language_requirement"], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z").filter(f => f.status === "verified")).toHaveLength(2);
  });
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
  it("recognizes DAAD's literal topical angle-bracket links without endorsing bare navigation links", () => {
    const source = { ...observations[0], content: "Synthetic Computing Synthetic University\nApplication deadlines: <https://campus-example.de/computing/admission>\nNavigation: <https://other-example.de/home>" };
    expect(officialDomains(seed, [source])).toContain("campus-example.de");
    expect(officialDomains(seed, [source])).not.toContain("other-example.de");
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


describe("guided field decisions", () => {
  const reason = "Compared captured official wording and actual applicability.";
  it("patches precisely one field and retains every unrelated raw sibling", () => {
    const raw = buildResearchDraft(seed, observations, output, []);
    raw.identity.name = "  Synthetic Computing  ";
    const before = structuredClone(raw);
    const replacement = { ...raw.offerings[0].facts.find(f => f.key === "english")! };
    const next = patchResearchDraft(raw, { kind: "edit", offering: 0, key: "english", reason, replacement });
    expect(next.identity).toEqual(before.identity);
    expect(next.observations).toEqual(before.observations);
    expect(next.paste).toBe(before.paste);
    expect(next.conflicts).toEqual(before.conflicts);
    expect(next.offerings[0].facts.filter(f => f.key !== "english")).toEqual(before.offerings[0].facts.filter(f => f.key !== "english"));
    expect(next.review?.changes[0]).toMatchObject({ before: replacement, reason, kind: "edit" });
    expect(next.offerings[0].facts.find(f => f.key === "english")?.status).toBe("pending");
    expect(raw).toEqual(before);
  });
  it("retains rejected originals privately, blocks acceptance and restores only pending", () => {
    const raw = buildResearchDraft(seed, observations, output, []);
    const rejected = patchResearchDraft(raw, { kind: "reject", entries: [{ offering: 0, key: "english" }], reason });
    expect(rejected.offerings).toEqual(raw.offerings);
    expect(() => prepareResearchReview(rejected, 0, ["english"], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z")).toThrow(/rejected/i);
    expect(prepareResearchReview(rejected, 0, [], "11111111-1111-4111-8111-111111111111", "2026-10-07T13:00:00Z").find(f => f.key === "english")?.verbatim).toBeNull();
    const restored = patchResearchDraft(rejected, { kind: "restore", offering: 0, key: "english" });
    expect(restored.review?.rejected).toEqual([]);
    expect(restored.offerings[0].facts.find(f => f.key === "english")?.status).toBe("pending");
  });
  it("requires explicit conflict correction and retains original alternatives", () => {
    const raw = buildResearchDraft(seed, observations, output, []);
    const original = raw.offerings[0].facts[0];
    const replacement = { ...original, status: "pending" as const, verbatim: "Apply by 31 May.", evidence: [original.evidence[0]] };
    expect(() => patchResearchDraft(raw, { kind: "edit", offering: 0, key: original.key, reason, replacement })).toThrow(/conflict/i);
    const next = patchResearchDraft(raw, { kind: "resolve_conflict", offering: 0, key: original.key, reason, replacement });
    expect(next.conflicts).toEqual([]);
    expect(next.review?.changes[0]).toMatchObject({ before: original, conflict: raw.conflicts[0] });
    expect(next.offerings[0].facts.slice(1)).toEqual(raw.offerings[0].facts.slice(1));
  });
  it.each(["", "x".repeat(19), "x".repeat(2001)])("rejects invalid trimmed reason length", reason => {
    expect(() => patchResearchDraft(buildResearchDraft(seed, observations, output, []), { kind: "reject", entries: [{ offering: 0, key: "english" }], reason })).toThrow();
  });
  it.each([20, 2000])("accepts bounded reason length %s", length => {
    expect(patchResearchDraft(buildResearchDraft(seed, observations, output, []), { kind: "reject", entries: [{ offering: 0, key: "english" }], reason: "  " + "x".repeat(length) + "  " }).review?.rejected[0].reason).toHaveLength(length);
  });
  it("fails missing, duplicate and unknown identities without changing input", () => {
    const raw = buildResearchDraft(seed, observations, output, []);
    for (const entries of [[], [{ offering: 7, key: "english" }], [{ offering: 0, key: "missing" }], [{ offering: 0, key: "english" }, { offering: 0, key: "english" }]])
      expect(() => patchResearchDraft(raw, { kind: "reject", entries, reason })).toThrow();
    expect(() => patchResearchDraft(raw, { kind: "restore", offering: 0, key: "english" })).toThrow();
  });
});

it("validates chronological original snapshots and resolves only one of two independent conflicts", () => {
  const sources = observations.map((o, i) => i === 2 ? { ...o, content: o.content + " IELTS 7.0." } : o);
  const second = { ...output.offerings[0].facts[2], verbatim: "IELTS 7.0.", evidence: [{ source_url: sources[2].url, source_quote: "IELTS 7.0." }] };
  const raw = buildResearchDraft(seed, sources, { offerings: [{ ...output.offerings[0], facts: [...output.offerings[0].facts, second] }] }, []);
  expect(raw.conflicts).toHaveLength(2);
  const original = raw.offerings[0].facts.find(f => f.key === "english")!;
  const replacement = { ...original, status: "pending", verbatim: "IELTS 6.5.", evidence: [original.evidence[0]] };
  const next = patchResearchDraft(raw, { kind: "resolve_conflict", offering: 0, key: "english", reason: "Compared both captured sources and resolved this field only.", replacement });
  expect(next.conflicts).toEqual(raw.conflicts.filter(c => c.key !== "english"));
  expect(next.review?.changes[0].conflict).toEqual(raw.conflicts.find(c => c.key === "english"));
  const edited = patchResearchDraft(next, { kind: "edit", offering: 0, key: "english", reason: "Compared the pending correction once more against capture.", replacement });
  expect(edited.review?.changes.map(c => c.kind)).toEqual(["resolve_conflict", "edit"]);
  for (const mutate of [
    (d: typeof edited) => { d.review!.changes[0].before.status = "verified"; },
    (d: typeof edited) => { delete d.review!.changes[0].conflict; },
    (d: typeof edited) => { d.review!.changes[1].conflict = raw.conflicts[0]; },
    (d: typeof edited) => { d.review!.changes[0].before.evidence[0].source_quote = "Forged original capture"; },
  ]) {
    const forged = structuredClone(edited); mutate(forged); expect(ResearchDraftSchema.safeParse(forged).success).toBe(false);
  }
});

it("rejects fabricated ordinary edit before evidence even when it contains the old literal value", () => {
  const raw = buildResearchDraft(seed, observations, output, []);
  const replacement = raw.offerings[0].facts.find(f => f.key === "english")!;
  const next = patchResearchDraft(raw, { kind: "edit", offering: 0, key: "english", reason: "Compared complete original capture before correction.", replacement });
  next.review!.changes[0].before.evidence[0].source_quote = "Fabricated original prefix IELTS 6.5.";
  expect(ResearchDraftSchema.safeParse(next).success).toBe(false);
});
