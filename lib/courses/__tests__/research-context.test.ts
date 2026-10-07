import { describe, expect, it } from "vitest";
import { buildResearchContext } from "../research";
const seed = { url: "https://www.daad.de/example", name: "Synthetic Computing", university: "Synthetic University", text: "Paste ".repeat(50) };
const observation = (url: string, content: string) => ({ url, content, origin: "web" as const, retrieved_at: "2026-10-07T12:00:00Z" });
describe("bounded literal research context", () => {
  it("prioritizes actual programme and linked admission/fee evidence over unrelated search material", () => {
    const admission = "https://uni-example.de/admission"; const fee = "https://uni-example.de/semester-fee";
    const sources = [observation(seed.url, seed.name + " " + seed.university + " [University](https://uni-example.de/home) [Admission](" + admission + ") [Fees](" + fee + ")"),
      observation("https://uni-example.de/thesis.pdf", "Unrelated research thesis"), observation(admission, "Application deadline 15 July. Winter 2027. Non-EU applicants."), observation(fee, "Semester fee EUR 100.")];
    const context = buildResearchContext(seed, sources);
    expect(context.sources.map(s => s.url)).toEqual([seed.url, admission, fee]);
    expect(context.omitted_sources).toBe(1);
    expect(context.sources.flatMap(s => s.excerpts)).toContain("Semester fee EUR 100.");
    expect(sources[1].content).toBe("Unrelated research thesis");
  });
  it("bounds multi-source input, retains literal later requirements and discloses every omission", () => {
    const admission = "https://uni-example.de/admission";
    const source = observation(admission, "Navigation ".repeat(1300) + "\n\nApplication requirements: IELTS 6.5.\n\nWinter 2027 Non-EU applicants.");
    const sources = [observation(seed.url, seed.name + " " + seed.university + " [University](" + admission + ")"), source];
    const context = buildResearchContext(seed, sources);
    expect(context.sources.flatMap(s => s.excerpts).join(" ")).toContain("IELTS 6.5.");
    expect(context.sources.every(s => s.excerpts.reduce((n, p) => n + p.length, 0) <= 4000)).toBe(true);
    expect(context.sources.flatMap(s => s.excerpts).reduce((n, p) => n + p.length, 0)).toBeLessThanOrEqual(16000);
    expect(context.omitted_characters).toBeGreaterThan(0);
    for (const s of context.sources) for (const p of s.excerpts) expect(sources.find(o => o.url === s.url)!.content).toContain(p);
    expect(source.content.length).toBeGreaterThan(13000);
  });
  it("never turns paste or off-domain pages into model source evidence", () => {
    const context = buildResearchContext(seed, [{ ...observation(seed.url, seed.name + " " + seed.university), origin: "paste" }, observation("https://evil.invalid/fake", seed.name + " " + seed.university)]);
    expect(context.sources).toEqual([]);
  });
});
