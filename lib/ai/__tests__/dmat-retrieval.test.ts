import { beforeEach, expect, it, vi } from "vitest";
import type { ToolSet } from "ai";
import jeeLegacy from "@/lib/engine/__tests__/jee-legacy.fixture.json";
import { ruleData } from "@/scripts/rules.bootstrap";

const mocks = vi.hoisted(() => ({ embed: vi.fn(), streamText: vi.fn(), getPublishedRules: vi.fn(), matchKbChunks: vi.fn() }));
vi.mock("ai", async importOriginal => ({ ...await importOriginal<typeof import("ai")>(),
  embed: mocks.embed, streamText: mocks.streamText, convertToModelMessages: async () => [] }));
vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: () => Object.assign(() => "mock-chat", { textEmbeddingModel: () => "mock-embedding" }) }));
vi.mock("@/lib/db/queries", () => ({ ...mocks }));
import { runAssistant } from "../assistant";
import { ruleToChunk } from "../kb";

const legacy = ruleData.find(r => r.id === "dmat-india-existing-aps-exempt")!;
const row = { ...legacy, slug: legacy.id, country_code: "in" };
const stored = { slug: legacy.id, source_type: "rule", title: "Old APS exemption",
  content: "dMAT: not required. Exempt: already-issued APS certificates",
  source_url: legacy.source_url, last_verified_at: legacy.last_verified_at, country_code: "in", similarity: 0.9 };
const snippet = { ...stored, slug: "snippet-dmat-details", source_type: "snippet" };
const unrelated = { ...stored, slug: "snippet-language", source_type: "snippet", content: "Unrelated language information", source_url: "https://www.uni-assist.de/" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.embed.mockResolvedValue({ embedding: [0, 1] });
  mocks.streamText.mockReturnValue({});
  mocks.getPublishedRules.mockResolvedValue([row]);
  mocks.matchKbChunks.mockResolvedValue([stored, snippet, unrelated]);
});

async function search() {
  await runAssistant({ db: { from: vi.fn(), rpc: vi.fn() }, userId: "synthetic", countryCode: "in",
    messages: [], openrouterApiKey: "synthetic-not-used" });
  const tools = mocks.streamText.mock.calls[0][0].tools as ToolSet;
  return await tools.search_rules.execute!({ query: "Does my old APS certificate exempt a new procedure?" },
    { toolCallId: "synthetic", messages: [], context: {} }) as { slug: string; content: string; source_url: string; last_verified_at: string | null }[];
}

it("projects persisted unscoped exemptions from current metadata and quarantines the stable curated slug", async () => {
  mocks.getPublishedRules.mockResolvedValue([{ ...row, outcomes: { ...row.outcomes, testas: "required" } }]);
  const results = await search();
  for (const result of results.slice(0, 2)) {
    expect(result.content).not.toContain("already-issued APS certificates");
    expect(result.content).not.toContain("dMAT: not required");
    expect(result.content).not.toContain(legacy.source_quote);
    expect(result.content).toContain("unknown");
    expect(result.source_url).toBe(legacy.source_url);
  }
  expect(results[0].content).toContain("TestAS: required");
  expect(results[0].last_verified_at).toBe(row.last_verified_at);
  expect(results[2].content).toBe(unrelated.content);
});

it.each([{ rows: [] }, { rows: [{ ...row, status: "draft" }] },
  { rows: [{ ...row, source_quote: "" }] }, { rows: [{ ...row, last_verified_at: null }] }])(
  "does not fall back to stored claims with unavailable/unpublished/invalid metadata %j", async ({ rows }) => {
    mocks.getPublishedRules.mockResolvedValue(rows);
    const result = (await search())[0];
    expect(result.content).toContain("unknown");
    expect(result.content).not.toContain(stored.content);
    expect(result.last_verified_at).toBeNull();
  });

it("fails closed for scoped dMAT when structured metadata cannot be read", async () => {
  mocks.getPublishedRules.mockRejectedValue(new Error("synthetic metadata failure"));
  const results = await search();
  expect(results[0].content).toContain("unknown");
  expect(results[0].content).not.toContain("already-issued");
  expect(results[2].content).toBe(unrelated.content);
});

it("renders the current procedure-scoped exemption instead of the stored text", async () => {
  const completed = ruleData.find(r => r.id === "dmat-reviewed-completed")!;
  const scoped = { ...completed, status: "verified", slug: completed.id, country_code: "in" };
  mocks.getPublishedRules.mockResolvedValue([scoped]);
  mocks.matchKbChunks.mockResolvedValue([{ ...stored, slug: scoped.slug }]);
  const result = (await search())[0];
  expect(result.content).toContain("dMAT: not required");
  expect(result.content).toContain("relevant_completed");
  expect(result.content).toContain(`Official source says: "${completed.source_quote}"`);
  expect(result.content).not.toContain("already-issued APS certificates");
  expect(result.last_verified_at).toBe(completed.last_verified_at);
});

it("preserves an unrelated rule chunk bound to its current structured rendering", async () => {
  const other = { ...row, slug: "testas-other", outcomes: { testas: "required" }, last_verified_at: row.last_verified_at ?? null };
  const chunk = { ...ruleToChunk(other), source_type: "rule" };
  mocks.getPublishedRules.mockResolvedValue([other]);
  mocks.matchKbChunks.mockResolvedValue([chunk]);
  expect((await search())[0].content).toBe(chunk.content);
});

it("quarantines the curated slug without loading rule metadata or copying its verification date", async () => {
  mocks.matchKbChunks.mockResolvedValue([snippet, unrelated]);
  const results = await search();
  expect(results[0].content).toContain("[[unknown]]");
  expect(results[0].last_verified_at).toBeNull();
  expect(results[0].content).not.toContain(snippet.content);
  expect(mocks.getPublishedRules).not.toHaveBeenCalled();
});

it("identifies unscoped dMAT by structured outcomes even under another slug/source", async () => {
  const renamed = { ...row, slug: "another-rule", source_url: "https://aps-india.de/faqs/" };
  mocks.getPublishedRules.mockResolvedValue([renamed]);
  mocks.matchKbChunks.mockResolvedValue([{ ...stored, slug: renamed.slug, source_url: renamed.source_url }]);
  const result = (await search())[0];
  expect(result.content).toContain("dMAT: unknown");
  expect(result.content).not.toContain(renamed.source_quote);
  expect(result.source_url).toBe(renamed.source_url);
});

it("uses current structured unknown applicability rather than the stored exemption", async () => {
  const review = ruleData.find(r => r.id === "dmat-reviewed-review")!;
  mocks.getPublishedRules.mockResolvedValue([{ ...review, slug: review.id, status: "verified", country_code: "in" }]);
  mocks.matchKbChunks.mockResolvedValue([{ ...stored, slug: review.id }]);
  const result = (await search())[0];
  expect(result.content).toContain("dMAT: unknown");
  expect(result.content).toContain(review.outcomes.note);
  expect(result.content).not.toContain("already-issued APS certificates");
});

it.each([
  { name: "null after read failure", rows: null },
  { name: "empty published rows", rows: [] },
  { name: "unmatched current rows", rows: [{ ...row, slug: "different-rule" }] },
  { name: "invalid current metadata", rows: [{ ...row, slug: "another-rule", conditions: { unsupported: true } }] },
  { name: "draft current metadata", rows: [{ ...row, slug: "another-rule", status: "draft" }] },
  { name: "ambiguous current metadata", rows: [{ ...row, slug: "another-rule" }, { ...row, slug: "another-rule" }] },
])("fails closed for renamed FAQ-source rule with $name", async ({ rows }) => {
  if (rows === null) mocks.getPublishedRules.mockRejectedValue(new Error("synthetic read failure"));
  else mocks.getPublishedRules.mockResolvedValue(rows);
  const renamed = { ...stored, slug: "another-rule", source_url: "https://aps-india.de/faqs/" };
  mocks.matchKbChunks.mockResolvedValue([renamed, unrelated]);
  const results = await search();
  expect(results[0].content).toContain("unknown");
  expect(results[0].content).not.toContain(stored.content);
  expect(results[0].content).not.toContain(legacy.source_quote);
  expect(results[0].last_verified_at).toBeNull();
  expect(results[0].source_url).toBe(renamed.source_url);
  expect(results[1].content).toBe(unrelated.content);
});

it.each(["unknown", "required", "not_required"] as const)("withholds certificate-only quote across structured dMAT outcome %s", async dmat => {
  const renamed = { ...row, slug: "another-rule", source_url: "https://aps-india.de/faqs/",
    outcomes: { ...row.outcomes, dmat, testas: "required" } };
  mocks.getPublishedRules.mockResolvedValue([renamed]);
  mocks.matchKbChunks.mockResolvedValue([{ ...stored, slug: renamed.slug, source_url: renamed.source_url }]);
  const result = (await search())[0];
  expect(result.content).toContain("dMAT: unknown");
  expect(result.content).toContain("TestAS: required");
  expect(result.content).not.toContain(legacy.source_quote);
  expect(result.content).not.toContain("Official source says");
  expect(result.source_url).toBe(renamed.source_url);
  expect(result.last_verified_at).toBe(renamed.last_verified_at);
});


it("keeps persisted JEE claims out of the actual assistant search_rules tool result", async () => {
  const jee = jeeLegacy[0];
  mocks.getPublishedRules.mockResolvedValue([jee]);
  mocks.matchKbChunks.mockResolvedValue([{ ...stored, slug: jee.slug, title: jee.outcomes.note,
    content: jee.outcomes.note + ' Official source says: "' + jee.source_quote + '"',
    source_url: jee.source_url, last_verified_at: jee.last_verified_at }]);
  const result = (await search())[0];
  expect(result.content).toContain("[[unknown]]");
  expect(result.content).not.toContain(jee.outcomes.note);
  expect(result.content).not.toContain(jee.source_quote);
  expect(result.content).toContain("https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/");
  expect(result.last_verified_at).toBeNull();
  expect(mocks.getPublishedRules).toHaveBeenCalledOnce();
});


it("fails closed through actual search_rules when a generic renamed JEE cache loses current family identity", async () => {
  const jee = jeeLegacy[0];
  const revised = { ...jee, slug: "renamed-academic-rule", source_url: "https://www.uni-assist.de/",
    conditions: { target_degree: "bachelor" }, outcomes: { testas: "required" } };
  const cached = { ...stored, slug: revised.slug, source_url: revised.source_url, title: jee.outcomes.note,
    content: 'Admission path: direct admission restricted to related subjects.\nNote: ' + jee.outcomes.note + '\nOfficial source says: "' + jee.source_quote + '"' };
  mocks.getPublishedRules.mockResolvedValue([revised]);
  mocks.matchKbChunks.mockResolvedValue([cached]);
  const result = (await search())[0];
  expect(result.content).toContain("[[unknown]]");
  expect(result.content).not.toContain("Admission path: direct");
  expect(result.content).not.toContain(jee.outcomes.note);
  expect(result.content).not.toContain(jee.source_quote);
  expect(result.content).not.toContain("Official source says");
  expect(result.source_url).toBe(revised.source_url);
  expect(result.last_verified_at).toBeNull();
  expect(mocks.getPublishedRules).toHaveBeenCalledOnce();
});
