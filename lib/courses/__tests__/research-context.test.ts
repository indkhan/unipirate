import { describe, expect, it } from "vitest";
import { buildResearchContext, buildResearchDraft, focusedResearchUrls, type Observation } from "../research";
import smoke10 from "./fixtures/smoke10-context.json";
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

// Public saved smoke 10 paragraphs, not a reconstruction of its missing tool input.
const saved = smoke10.observations as Observation[];
const contextText = (context: ReturnType<typeof buildResearchContext>, url: string) => context.sources.find(s => s.url === url)?.excerpts.join("\n\n") ?? "";
describe("saved smoke 10 source-context regression", () => {
  it("retains literal admission and programme topics ahead of university marketing", () => {
    const context = buildResearchContext(smoke10.seed, saved);
    const text = contextText(context, smoke10.seed.url);
    for (const key of ["identity", "university", "admission", "tracks", "teaching", "fee", "deadline"] as const) expect(text).toContain(smoke10.literals[key]);
  });
  it("retains the published 2026 / unpublished 2027 warning and late language appendix with its exception", () => {
    const context = buildResearchContext(smoke10.seed, saved);
    const text = contextText(context, saved[3].url);
    for (const key of ["warning", "language", "exemption"] as const) expect(text).toContain(smoke10.literals[key]);
    expect(text).not.toContain("IELTS 6.5");
  });
  it("puts a captured linked application portal and FAQ ahead of a generic scholarship PDF", () => {
    const context = buildResearchContext(smoke10.seed, saved);
    expect(context.sources.map(s => s.url)).toContain(saved[5].url);
    expect(context.sources.map(s => s.url)).not.toContain(saved[1].url);
    expect(focusedResearchUrls([saved[1].url, saved[5].url, saved[3].url], ["saarland-informatics-campus.de"], []))
      .toEqual([saved[5].url, saved[3].url, saved[1].url]);
  });
  it("preserves raw captures, omission accounting and deterministic literal excerpts within existing caps", () => {
    const before = structuredClone(saved);
    const context = buildResearchContext(smoke10.seed, saved);
    expect(buildResearchContext(smoke10.seed, saved)).toEqual(context);
    expect(saved).toEqual(before);
    const used = context.sources.flatMap(s => s.excerpts).reduce((n, p) => n + p.length, 0);
    expect(context.sources.length).toBeLessThanOrEqual(4);
    expect(used).toBeLessThanOrEqual(16000);
    expect(context.omitted_characters).toBe(saved.reduce((n, o) => n + o.content.length, 0) - used);
    expect(context.omitted_sources).toBe(2);
    for (const s of context.sources) {
      expect(s.excerpts.reduce((n, p) => n + p.length, 0)).toBeLessThanOrEqual(4000);
      for (const p of s.excerpts) { expect(p.length).toBeLessThanOrEqual(2000); expect(saved.find(o => o.url === s.url)!.content).toContain(p); }
    }
    // The bounded navigation capture cannot supply a fee answer. Do not restore it.
    expect(contextText(context, saved[2].url)).not.toMatch(/394\.30|EUR|€|semester contribution/i);
    const warning = "A retrieved source exceeded the 20,000-character capture bound; omitted text is unresolved and requires manual source review.";
    const draft = buildResearchDraft(smoke10.seed, saved, { offerings: [] }, [warning]);
    expect(draft.issues).toContain(warning);
    expect(draft.offerings).toEqual([]);
    expect(draft.unscoped).toEqual([]);
  });
  it("keeps a long availability paragraph including its ending intact as separate contiguous excerpts", () => {
    const warning = "Availability notice: " + "Notice ".repeat(270) + smoke10.literals.warning;
    const context = buildResearchContext(seed, [observation(seed.url, seed.name + " " + seed.university + "\n\n" + "Application details. ".repeat(220) + "\n\n" + warning)]);
    const excerpts = context.sources[0].excerpts;
    expect(excerpts.join("")).toContain(warning);
    expect(excerpts.some(p => p.includes("2027/28 winter semester"))).toBe(true);
  });
  it("ranks requirements PDFs by their actual topic, not their extension, and uses observed labels for opaque portals", () => {
    const generic = "https://uni-example.de/scholarship.pdf", requirements = "https://uni-example.de/requirements.pdf", portal = "https://uni-example.de/p";
    expect(focusedResearchUrls([generic, requirements, portal], ["uni-example.de"], [observation(seed.url, "[Programme application](" + portal + ")")])).toEqual([requirements, portal, generic]);
  });
  it("does not grant unrelated unlinked or cross-degree pages identity authority", () => {
    const urls = ["https://uni-example.de/admission", "https://evil.invalid/admission"];
    const sources = [observation(seed.url, "Synthetic Computing (MSc)" + " " + seed.university + " [University](https://uni-example.de/home)"), ...urls.map(u => observation(u, "IELTS 7.0."))];
    const degreeSeed = { ...seed, name: "Synthetic Computing (BSc)" };
    expect(buildResearchContext(degreeSeed, sources).sources).toEqual([]);
    expect(buildResearchContext(seed, [observation(seed.url, seed.name + " " + seed.university + " [University](https://uni-example.de/home)"), ...urls.map(u => observation(u, "IELTS 7.0."))]).sources.map(s => s.url)).toEqual([seed.url]);
  });
  it("honors exact source/total bounds and rejects captures above the unchanged raw bound", () => {
    const urls = ["https://uni-example.de/admission", "https://uni-example.de/requirements", "https://uni-example.de/semester-fee"];
    const identity = seed.name + " " + seed.university + " " + urls.map(u => "[University](" + u + ")").join(" ");
    const fill = (prefix: string) => prefix.padEnd(2000, "x") + "\n\n" + "Language requirements ".padEnd(2000, "x");
    const sources = [observation(seed.url, fill(identity)), ...urls.map(u => observation(u, fill("Application requirements ")))];
    const context = buildResearchContext(seed, sources);
    expect(context.sources.map(s => s.excerpts.reduce((n, p) => n + p.length, 0))).toEqual([4000, 4000, 4000, 4000]);
    expect(context.omitted_characters).toBe(8);
    expect(() => buildResearchContext(seed, [observation(seed.url, "x".repeat(20001))])).toThrow();
  });
});

describe("availability paragraph cap semantics", () => {
  const claim = "Application requirements: IELTS 6.5.";
  const negation = "These are not yet published for winter 2027 and cannot be used for the 2027 intake.";
  const paragraph = (length: number, position: "start" | "end") => position === "end"
    ? (claim + " ").padEnd(length - negation.length, "x") + negation
    : (negation + " ").padEnd(length - claim.length, "x") + claim;
  it.each(["start", "end"] as const)("omits the whole >4000 paragraph with controlling negation at %s", position => {
    const warning = paragraph(4702, position);
    const captures = [observation(seed.url, seed.name + " " + seed.university + "\n\n" + warning)];
    const original = structuredClone(captures);
    const context = buildResearchContext(seed, captures);
    expect(warning.length).toBe(4702);
    // Neither a detached assertion nor a fragment of its controlling caveat.
    expect(context.sources[0].excerpts).toEqual([seed.name + " " + seed.university]);
    expect(context.sources[0].excerpts.join("")).not.toContain(claim);
    expect(context.omitted_characters).toBe(warning.length + 2);
    expect(captures).toEqual(original);
  });
  it("omits a warning paragraph that fits 4000 alone but not the remaining source budget", () => {
    const preceding = "Availability notice: ".padEnd(2000, "y");
    const warning = paragraph(3000, "end");
    const captures = [observation(seed.url, seed.name + " " + seed.university + "\n\n" + preceding + "\n\n" + warning)];
    const context = buildResearchContext(seed, captures);
    expect(context.sources[0].excerpts).toEqual([preceding, seed.name + " " + seed.university]);
    expect(context.sources[0].excerpts.join("")).not.toContain(claim);
    expect(context.omitted_characters).toBe(warning.length + 4);
    expect(captures[0].content).toContain(warning);
  });
  it("retains a whole warning paragraph at exactly 4000 in separate literal slices", () => {
    const warning = paragraph(4000, "end");
    const context = buildResearchContext(seed, [observation(seed.url, seed.name + " " + seed.university + "\n\n" + warning)]);
    expect(context.sources[0].excerpts).toEqual([warning.slice(0, 2000), warning.slice(2000)]);
    expect(context.sources[0].excerpts.join("")).toBe(warning);
    expect(context.sources[0].excerpts[1]).toContain(negation);
    expect(context.omitted_characters).toBe(seed.name.length + seed.university.length + 3);
  });
});
