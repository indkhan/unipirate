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
      expect(body).not.toHaveProperty("response_format");
      const prompt = JSON.parse(body.messages.at(-1).content);
      expect(prompt.sources).toHaveLength(1);
      expect(prompt.sources[0].excerpts).toContain(content);
      expect(prompt).not.toHaveProperty("observations");
      return response();
    });
    vi.stubGlobal("fetch", fetcher);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher: web });
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
