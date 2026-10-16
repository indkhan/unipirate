import { describe, expect, it, vi } from "vitest";
import { researchCourse } from "../research-course";

const seed = { url: "https://www.daad.de/example", name: "Synthetic Computing", university: "Synthetic University", text: "Synthetic Computing Synthetic University ".repeat(8) };
const content = "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants Apply by 31 May. [University](https://uni-example.de/computing) [PDF](https://uni-example.de/rules.pdf)";
const output = { offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: { source_url: seed.url, source_quote: "Winter 2027 Non-EU applicants" }, facts: [{ key: "application", kind: "deadline", verbatim: "Apply by 31 May.", applicability: "Non-EU applicants", route: null, deadline_kind: "application_closing", evidence: [{ source_url: "https://uni-example.de/rules.pdf", source_quote: "Apply by 31 May." }] }] }] };
describe("bounded research shell (synthetic providers)", () => {
  it("deduplicates canonical source URLs and prioritizes programme admissions and regulations over navigation", async () => {
    const admissions = "https://uni-example.de/computing/admission";
    const pdf = "https://uni-example.de/computing/regulations.pdf";
    const nav = "https://uni-example.de/home";
    const fetched: string[] = [];
    const generate = vi.fn<NonNullable<NonNullable<Parameters<typeof researchCourse>[1]>["generate"]>>(async () => output);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", generate, fetcher: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith("search")) return Response.json({ results: [{ url: `${seed.url}/` }, { url: "https://www.daad.de/different" }] });
      fetched.push(...body.urls);
      const navigation = Array.from({ length: 7 }, (_, i) => `[Home career ${i}](https://uni-example.de/home/${i})`).join(" ");
      return Response.json({ results: body.urls.map((url: string) => ({ url, raw_content: url.includes("different") ? "Different Programme Other University" : `${content} [Home](${nav}) ${navigation} [Admission requirements](${admissions}) [Regulations PDF](${pdf})` })) });
    } });
    expect(fetched.filter(u => u.replace(/\/$/, "") === seed.url)).toHaveLength(1);
    expect(fetched).toContain(admissions); expect(fetched).toContain(pdf);
    expect(fetched.indexOf(admissions)).toBeLessThan(fetched.indexOf(nav) < 0 ? fetched.length : fetched.indexOf(nav));
    expect(draft.observations.some(o => o.origin === "web" && o.url.includes("different"))).toBe(false);
    expect(generate.mock.calls[0][1].some((o: { url: string }) => o.url === admissions)).toBe(true);
    expect(draft.offerings[0].facts.find(f => f.key === "application")?.evidence.map(e => e.source_url)).toEqual(expect.arrayContaining([seed.url, "https://uni-example.de/rules.pdf"]));
  });
  it("searches official sources, retrieves linked PDFs, and sends observations beyond the paste to AI", async () => {
    const calls: { endpoint: string; body: Record<string, unknown> }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)); calls.push({ endpoint: String(url), body });
      return Response.json(String(url).endsWith("search") ? { results: [{ url: seed.url }] }
        : { results: (body.urls as string[]).map(url => ({ url, raw_content: content })), failed_results: [] });
    });
    const model = vi.fn(async () => output);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", generate: model, fetcher });
    expect(calls.filter(c => c.endpoint.endsWith("search"))).toHaveLength(3);
    expect(calls.some(c => (c.body.urls as string[] | undefined)?.includes("https://uni-example.de/rules.pdf"))).toBe(true);
    expect(model).toHaveBeenCalledWith(seed, expect.arrayContaining([expect.objectContaining({ url: "https://uni-example.de/rules.pdf", origin: "web" })]), expect.any(AbortSignal));
    expect(draft.offerings[0].facts.find(f => f.key === "application")).toMatchObject({ status: "pending", date: null });
    expect(calls.every(c => !c.body.include_answer)).toBe(true);
  });
  it("keeps paste and explicit incomplete status when web is unavailable", async () => {
    const draft = await researchCourse(seed, { generate: vi.fn(), fetcher: vi.fn() });
    expect(draft.status).toBe("incomplete");
    expect(draft.observations[0]).toMatchObject({ origin: "paste", content: seed.text });
    expect(draft.issues.join(" ")).toContain("Tavily");
  });
  it("keeps retrieved observations and manual recovery when AI fails", async () => {
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", generate: async () => { throw new Error("secret provider body"); }, fetcher: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json(String(url).endsWith("search") ? { results: [{ url: seed.url }] } : { results: body.urls.map((url: string) => ({ url, raw_content: content })) });
    } });
    expect(draft.status).toBe("incomplete");
    expect(draft.observations.some(o => o.origin === "web")).toBe(true);
    expect(JSON.stringify(draft)).not.toContain("secret provider body");
    expect(draft.issues.join(" ")).toContain("invalid response or unavailable");
  });
  it("reports source capture limits and never treats omitted literal text as retrieved evidence", async () => {
    const absentQuote = "A late fee assertion outside the captured source.";
    const result = structuredClone(output); result.offerings[0].facts[0].verbatim = absentQuote;
    result.offerings[0].facts[0].evidence = [{ source_url: seed.url, source_quote: absentQuote }];
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", generate: async () => result, fetcher: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json(String(url).endsWith("search") ? { results: [] }
        : { results: body.urls.map((url: string) => ({ url, raw_content: `${content}${" ".repeat(20_000)}${absentQuote}` })) });
    } });
    expect(draft.issues.join(" ")).toContain("omitted text is unresolved");
    expect(draft.offerings.flatMap(o => o.facts).some(f => f.verbatim === absentQuote)).toBe(false);
  });
  it("discards search snippets and off-domain extraction results", async () => {
    const generate = vi.fn(async () => output);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", generate, fetcher: async url => Response.json(String(url).endsWith("search")
      ? { results: [{ url: "https://evil.invalid/foo", content }, { url: seed.url, content }] }
      : { results: [{ url: "https://evil.invalid/foo", raw_content: content }] }) });
    expect(draft.offerings).toEqual([]);
    expect(draft.observations).toHaveLength(1);
  });
  it("bounds response bytes and call counts on oversized web responses", async () => {
    const fetcher = vi.fn(async () => new Response("x".repeat(2_000_001)));
    const generate = vi.fn(async () => output);
    const draft = await researchCourse(seed, { tavilyKey: "synthetic", fetcher, generate });
    expect(fetcher).toHaveBeenCalledTimes(4); // three searches, one seed extraction
    expect(generate).toHaveBeenCalledOnce();
    expect(draft.observations).toHaveLength(1);
    expect(draft.status).toBe("incomplete");
    expect(draft.issues.join(" ")).toContain("bounds");
  });
  it("stops the workflow at the shared time bound and keeps the paste", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Synthetic abort")), { once: true });
      }));
      const generate = vi.fn(async () => { throw new Error("Synthetic aborted model"); });
      const pending = researchCourse(seed, { tavilyKey: "synthetic", fetcher, generate });
      await vi.advanceTimersByTimeAsync(90_001);
      const draft = await pending;
      expect(fetcher).toHaveBeenCalledOnce();
      expect(draft.status).toBe("incomplete");
      expect(draft.paste).toBe(seed.text);
      expect(generate).not.toHaveBeenCalled();
      expect(draft.issues.join(" ")).toContain("timeout");
    } finally { vi.useRealTimers(); }
  });
  it("validates invalid input before any provider call", async () => {
    const fetcher = vi.fn();
    await expect(researchCourse({ ...seed, url: "https://127.0.0.1/" }, { fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
