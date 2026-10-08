import { afterEach, describe, expect, it, vi } from "vitest";
import { researchCourse, COURSE_EXTRACTION_MODEL } from "../research-course";
import { ResearchOutputSchema, ResearchDraftSchema, prepareResearchReview } from "@/lib/courses/research";
import smoke14 from "@/lib/courses/__tests__/fixtures/smoke14-context.json";
import { OfferingFactSchema } from "@/lib/courses/offerings";

vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ OPENROUTER_API_KEY: "synthetic-test-only" }) }));
const seed = { url: "https://www.daad.de/synthetic", name: "Synthetic Computing", university: "Synthetic University", text: "Manual paste ".repeat(30) };
const content = "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants IELTS 6.5.";
const output = { offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: { source_url: seed.url, source_quote: "Winter 2027 Non-EU applicants" }, facts: [{ key: "english", kind: "language", verbatim: "IELTS 6.5.", applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [{ source_url: seed.url, source_quote: "IELTS 6.5." }] }] }] };
const web = async (url: string | URL | Request, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  return Response.json(String(url).endsWith("search") ? { results: [] } : { results: body.urls.map((url: string) => ({ url, raw_content: content })) });
};
function response(name = "submit_research", args = JSON.stringify(output), missing = false) {
  return Response.json({ id: "synthetic", created: 1, model: COURSE_EXTRACTION_MODEL, choices: [{ index: 0, finish_reason: missing ? "stop" : "tool_calls", message: { role: "assistant", content: null,
    tool_calls: missing ? [] : [{ id: "synthetic-call", type: "function", function: { name, arguments: args } }] } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } });
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("native research tool through installed SDK (synthetic HTTP only)", () => {
  it("forces one data-only native tool, disables reasoning and strictly retains pending literal facts", async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe(COURSE_EXTRACTION_MODEL);
      expect(body.reasoning).toEqual({ enabled: false });
      expect(body.tool_choice).toEqual({ type: "function", function: { name: "submit_research" } });
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0].function.parameters.properties).toHaveProperty("offerings");
      expect(body.max_tokens).toBe(6000);
      expect(body.temperature).toBe(0);
      return response();
    });
    vi.stubGlobal("fetch", fetcher);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher: web });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    const instruction = body.messages[0].content.map((part: { text: string }) => part.text).join("\n");
    expect(instruction).toContain("Submit exactly one submit_research call, without explanatory prose.");
    expect(instruction).toContain("Preserve every explicitly supported distinct intake/applicant scope");
    expect(instruction).toContain("never choose a winner to shorten output");
    expect(instruction).toContain("removing a consequential condition or exception");
    expect(instruction).toContain("Only route facts carry a non-null route; all other kinds use route null.");
    expect(instruction).toContain("Only deadline facts carry a non-null deadline_kind; all other kinds use deadline_kind null.");
    expect(body).not.toHaveProperty("response_format");
    const prompt = JSON.parse(body.messages.at(-1).content);
    expect(prompt.sources).toHaveLength(1);
    expect(prompt.sources[0].excerpts).toContain(content);
    expect(prompt).not.toHaveProperty("observations");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft.offerings[0].facts[0]).toMatchObject({ verbatim: "IELTS 6.5.", status: "pending", date: null });
    expect(draft.offerings[0].facts[0].evidence[0]).toMatchObject({ source_quote: "IELTS 6.5.", verified_by: null });
  });
  it.each(["missing", "wrong", "malformed", "spoof"])("retains incomplete manual recovery for %s tool output", async mode => {
    const spoof = structuredClone(output); Object.assign(spoof.offerings[0].facts[0], { status: "verified" });
    const fetcher = vi.fn(async () => response(mode === "wrong" ? "other_tool" : "submit_research", mode === "malformed" ? "{" : JSON.stringify(mode === "spoof" ? spoof : output), mode === "missing"));
    vi.stubGlobal("fetch", fetcher);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher: web });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft.status).toBe("incomplete"); expect(draft.offerings).toEqual([]);
    expect(draft.paste).toBe(seed.text);
    expect(draft.issues.join(" ")).toContain("invalid");
  });
  it("retains more than nine assertions across seasons, applicant groups and sources", async () => {
    const second = "https://www.daad.de/synthetic/regulations";
    const conditional = "Degree certificate required unless provisional admission applies.";
    const offerings = (["winter", "summer"] as const).flatMap(intake_term => ["Non-EU applicants", "EU applicants"].map(applicant_group => {
      const scope = (intake_term === "winter" ? "Winter" : "Summer") + " 2027 " + applicant_group;
      return { intake_term, intake_year: 2027, applicant_group, scope: { source_url: seed.url, source_quote: scope }, facts: [
        ...["Passport required.", "Transcript required.", conditional].map((verbatim, i) => ({ key: "document:" + i, kind: "document", verbatim, applicability: applicant_group, route: null, deadline_kind: null, evidence: [{ source_url: seed.url, source_quote: verbatim }] })),
        ...["IELTS 6.5.", "IELTS 7.0."].map((verbatim, i) => ({ key: "english", kind: "language", verbatim, applicability: applicant_group, route: null, deadline_kind: null, evidence: [{ source_url: i ? second : seed.url, source_quote: verbatim }] })),
      ] };
    }));
    const page = "Synthetic Computing Synthetic University " + offerings.map(o => o.scope.source_quote).join("; ") + " Passport required. Transcript required. " + conditional + " IELTS 6.5. IELTS 7.0. [Regulations](" + second + ")";
    const fetcher = vi.fn(async () => response("submit_research", JSON.stringify({ offerings })));
    vi.stubGlobal("fetch", fetcher);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json(String(url).endsWith("search") ? { results: [] } : { results: body.urls.map((url: string) => ({ url, raw_content: page })) });
    } });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft.offerings.map(o => [o.intake_term, o.applicant_group])).toEqual(offerings.map(o => [o.intake_term, o.applicant_group]));
    expect(draft.offerings.flatMap(o => o.facts).filter(f => f.status === "pending")).toHaveLength(12);
    expect(draft.conflicts).toHaveLength(4);
    expect(draft.conflicts.every(c => c.key === "english" && c.alternatives.map(a => a.verbatim).join("|") === "IELTS 6.5.|IELTS 7.0.")).toBe(true);
    for (const offering of draft.offerings) {
      expect(offering.facts.find(f => f.key === "document:2")).toMatchObject({ verbatim: conditional, status: "pending", evidence: expect.arrayContaining([expect.objectContaining({ source_quote: conditional })]) });
      expect(offering.facts.find(f => f.key === "unknown:tuition")).toMatchObject({ status: "unresolved", verbatim: null, evidence: [] });
      expect(offering.facts.every(f => f.date === null && f.evidence.every(e => e.verified_by === null && e.last_verified_at === null))).toBe(true);
    }
    expect(new Set(draft.conflicts.flatMap(c => c.alternatives.flatMap(a => a.evidence.map(e => e.source_url))))).toEqual(new Set([seed.url, second]));
  });
  it("uses the remaining shared deadline after retrieval when successful model headers have a stalled body", async () => {
    vi.useFakeTimers();
    const started = Date.now();
    let modelStarted = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      modelStarted = Date.now();
      return new Response(new ReadableStream({ start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Synthetic", "AbortError")), { once: true });
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetcher);
    const delayedWeb = async (url: string | URL | Request, init?: RequestInit) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return web(url, init);
    };
    const pending = researchCourse(seed, { tavilyKey: "synthetic", fetcher: delayedWeb });
    await vi.advanceTimersByTimeAsync(5000);
    expect(modelStarted - started).toBe(4000);
    await vi.advanceTimersByTimeAsync(84999);
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2);
    const draft = await pending;
    expect(Date.now() - started).toBe(90001);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft.paste).toBe(seed.text);
    expect(draft.observations).toEqual(expect.arrayContaining([expect.objectContaining({ origin: "paste", content: seed.text }), expect.objectContaining({ origin: "web", url: seed.url, content })]));
    expect(draft.offerings).toEqual([]);
    expect(draft.issues.join(" ")).toContain("timeout");
  });
  it("shares the existing timeout and falls back without retry or tool execution", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Synthetic", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetcher);
    const pending = researchCourse(seed, { tavilyKey: "synthetic", fetcher: web });
    await vi.advanceTimersByTimeAsync(90_001);
    const draft = await pending;
    expect(fetcher).toHaveBeenCalledOnce(); expect(draft.issues.join(" ")).toContain("timeout");
    expect(draft.paste).toBe(seed.text); expect(draft.offerings).toEqual([]);
  });

  it.each(["route", "deadline", "language", "prerequisite", "fee", "document", "description"] as const)("aligns %s metadata with the offering fact contract", kind => {
    const candidate = { ...output.offerings[0].facts[0], kind, route: kind === "route" ? "direct" : null, deadline_kind: kind === "deadline" ? "application_closing" : null };
    const submission = (fact: unknown) => ({ offerings: [{ ...output.offerings[0], facts: [fact] }] });
    const pending = (fact: typeof candidate) => ({ ...fact, status: "pending", date: null, time: null, timezone: null, evidence: fact.evidence.map(e => ({ ...e, retrieved_at: "2026-10-08T12:00:00Z", last_verified_at: null, verified_by: null, source_hash: null })) });
    expect(ResearchOutputSchema.safeParse(submission(candidate)).success).toBe(true);
    expect(OfferingFactSchema.safeParse(pending(candidate)).success).toBe(true);
    for (const invalid of [{ ...candidate, route: kind === "route" ? null : "direct" }, { ...candidate, deadline_kind: kind === "deadline" ? null : "application_closing" }]) {
      expect(OfferingFactSchema.safeParse(pending(invalid)).success).toBe(false);
      expect(ResearchOutputSchema.safeParse(submission(invalid)).success).toBe(false);
    }
  });
  it("advertises seven strict kind-specific metadata branches in actual SDK/provider tool parameters", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    vi.stubGlobal("fetch", fetcher);
    await researchCourse(seed, { tavilyKey: "synthetic", fetcher: web });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    const schema = body.tools[0].function.parameters;
    const branches = schema.properties.offerings.items.properties.facts.items.anyOf;
    expect(branches).toHaveLength(7);
    expect(branches.map((branch: { properties: { kind: { const: string } } }) => branch.properties.kind.const)).toEqual(["route", "deadline", "language", "prerequisite", "fee", "document", "description"]);
    for (const branch of branches) {
      const kind = branch.properties.kind.const;
      expect(branch.additionalProperties).toBe(false);
      expect(branch.required).toEqual(expect.arrayContaining(["key", "kind", "verbatim", "applicability", "route", "deadline_kind", "evidence"]));
      expect(branch.properties.route).toEqual(kind === "route" ? { type: "string", enum: ["direct", "uni_assist", "vpd_then_university", "unresolved"] } : { type: "null" });
      expect(branch.properties.deadline_kind).toEqual(kind === "deadline" ? { type: "string", enum: ["application_opening", "application_closing", "document_supplement", "enrolment", "vpd_preparation_target"] } : { type: "null" });
      expect(branch.properties.verbatim).toMatchObject({ type: "string", minLength: 1, maxLength: 4000 });
      expect(branch.properties.evidence).toMatchObject({ minItems: 1, maxItems: 4 });
    }
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(["fee", "deadline", "language", "description"])("rejects synthetic attempt13-shaped %s metadata through the SDK without losing captures or retrying", async kind => {
    // Synthetic metadata reproduction from the adopted audit; no private actual capture.
    const invalid = structuredClone(output);
    Object.assign(invalid.offerings[0], { intake_year: 2027, applicant_group: null, scope: null });
    Object.assign(invalid.offerings[0].facts[0], { kind, route: "direct", deadline_kind: kind === "fee" || kind === "deadline" ? "application_closing" : null });
    const fetcher = vi.fn(async () => response("submit_research", JSON.stringify(invalid)));
    vi.stubGlobal("fetch", fetcher);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher: web });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft).toMatchObject({ status: "incomplete", paste: seed.text, offerings: [], unscoped: [] });
    expect(draft.observations).toEqual([expect.objectContaining({ origin: "paste", url: seed.url, content: seed.text }), expect.objectContaining({ origin: "web", url: seed.url, content })]);
    expect(draft.issues.join(" ")).toContain("AI research invalid response or unavailable");
  });
  it("retains rich multi-source pending facts with wholly unknown scope through the actual SDK and unchanged builder", async () => {
    const second = "https://uni-example.de/regulations";
    const assertions = [
      { kind: "route", key: "route", verbatim: "Apply directly to the university.", route: "direct", deadline_kind: null },
      { kind: "deadline", key: "deadline:university:application_closing", verbatim: "University application closes 31 May.", route: null, deadline_kind: "application_closing" },
      { kind: "language", key: "language_exemption", verbatim: "IELTS 6.5 unless native English speaker.", route: null, deadline_kind: null },
      { kind: "prerequisite", key: "prerequisite", verbatim: "Degree required unless provisional admission applies.", route: null, deadline_kind: null },
      { kind: "fee", key: "tuition", verbatim: "Tuition EUR 100.", route: null, deadline_kind: null },
      { kind: "document", key: "document", verbatim: "Transcript required.", route: null, deadline_kind: null },
      { kind: "description", key: "application_link:university", verbatim: "https://uni-example.de/portal", route: null, deadline_kind: null },
    ];
    const facts = assertions.map((f, i) => ({ ...f, applicability: "Unknown scope", evidence: [{ source_url: i % 2 ? second : seed.url, source_quote: f.verbatim }] }));
    const page = seed.name + " " + seed.university + " [University](" + second + ") " + assertions.map(f => f.verbatim).join(" ");
    const fetcher = vi.fn(async () => response("submit_research", JSON.stringify({ offerings: [{ intake_term: null, intake_year: null, applicant_group: null, scope: null, facts }] })));
    vi.stubGlobal("fetch", fetcher);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json(String(url).endsWith("search") ? { results: [] } : { results: body.urls.map((url: string) => ({ url, raw_content: page })) });
    } });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft.status).toBe("incomplete");
    expect(draft.offerings).toEqual([]);
    expect(draft.unscoped?.map(f => f.verbatim)).toEqual(assertions.map(f => f.verbatim));
    expect(new Set(draft.unscoped?.flatMap(f => f.evidence.map(e => e.source_url)))).toEqual(new Set([seed.url, second]));
    expect(draft.unscoped?.every(f => f.status === "pending" && f.applicability === "Unresolved effective intake/applicant scope" && f.date === null && f.time === null && f.timezone === null && f.evidence.every(e => e.last_verified_at === null && e.verified_by === null))).toBe(true);
    expect(ResearchDraftSchema.safeParse(draft).success).toBe(true);
    expect(() => prepareResearchReview(draft, 0, [draft.unscoped![0].key], "11111111-1111-4111-8111-111111111111", "2026-10-08T13:00:00Z")).toThrow();
  });
});

it("supplies whole actual-14 paragraphs to the native SDK and retains literal multi-source unknown-scope captures", async () => {
  const captured = smoke14.observations;
  const fee = "Currently **394.30 EUR** per semester, including a semester ticket covering public transport in Germany";
  const language = "You need to provide proof of English language proficiency for the Olympiad and Aptitude track unless your are a native speaker. We accept the following English tests:";
  const facts = [{ key: "semester_fee", kind: "fee", verbatim: fee, url: smoke14.seed.url }, { key: "language_exemption", kind: "language", verbatim: language, url: captured[1].url }].map(({url, ...f}) => ({...f, applicability: "Unknown scope", route: null, deadline_kind: null, evidence: [{source_url: url, source_quote: f.verbatim}]}));
  let providerContext: { sources: {url: string; excerpts: string[]}[] } | undefined;
  const provider = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const context = JSON.parse(body.messages.at(-1).content);
    providerContext = context;
    return response("submit_research", JSON.stringify({offerings: [{intake_term: null, intake_year: null, applicant_group: null, scope: null, facts}]}));
  });
  vi.stubGlobal("fetch", provider);
  const draft = await researchCourse(smoke14.seed, {tavilyKey: "offline", fetcher: async (url, init) => {
    const body = JSON.parse(String(init?.body));
    return Response.json(String(url).endsWith("search") ? {results: []} : {results: body.urls.flatMap((url: string) => { const o = captured.find(o => o.url === url); return o ? [{url, raw_content:o.content}] : []; })});
  }});
  const context = providerContext!;
  for (const source of context.sources) {
    const original = captured.find(o => o.url === source.url)!;
    for (const paragraph of original.content.split(/\n\s*\n/)) {
      if (!paragraph.trim() || source.excerpts.includes(paragraph)) continue;
      if (source.excerpts.some(e => e.length > 0 && paragraph.startsWith(e))) {
        expect(source.excerpts.filter(e => paragraph.includes(e)).join("")).toBe(paragraph);
      }
    }
  }
  expect(context.sources.flatMap((s: {excerpts: string[]}) => s.excerpts)).toEqual(expect.arrayContaining([fee, language]));
  expect(provider).toHaveBeenCalledOnce();
  expect(draft.unscoped?.map(f => f.verbatim)).toEqual([fee, language]);
  expect(draft.offerings).toEqual([]);
  expect(draft.unscoped?.every(f => f.status === "pending" && f.evidence.every(e => e.last_verified_at === null && e.verified_by === null))).toBe(true);
});

it.each(["literal-mismatch", "daad-identity-mismatch"])("keeps actual-14 %s submission unsupported through native SDK", async mode => {
  const provider = vi.fn(async () => response("submit_research", JSON.stringify(smoke14.submission)));
  vi.stubGlobal("fetch", provider);
  const draft = await researchCourse(smoke14.seed, {tavilyKey: "offline", fetcher: async (url, init) => {
    const body = JSON.parse(String(init?.body));
    return Response.json(String(url).endsWith("search") ? {results: []} : {results: body.urls.flatMap((url: string) => {
      const o = smoke14.observations.find(o => o.url === url);
      return o ? [{url, raw_content: mode === "daad-identity-mismatch" && url === smoke14.seed.url ? o.content.replaceAll("Computer Science (BSc)", "Computer Science (MSc)") : o.content}] : [];
    })});
  }});
  expect(provider).toHaveBeenCalledOnce();
  expect(draft).toMatchObject({status: "incomplete", offerings: [], unscoped: [], paste: smoke14.seed.text});
  expect(draft.issues.join(" ")).toContain(mode === "daad-identity-mismatch" ? "did not match the programme identity" : "No factual capture");
});
