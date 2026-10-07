import { afterEach, describe, expect, it, vi } from "vitest";
import { researchCourse, COURSE_EXTRACTION_MODEL } from "../research-course";

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
});
