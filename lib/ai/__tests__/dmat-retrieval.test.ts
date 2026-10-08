import {beforeEach, expect, it, vi} from "vitest";
import type {ToolSet} from "ai";
import jeeLegacy from "@/lib/engine/__tests__/jee-legacy.fixture.json";
import {ruleData} from "@/scripts/rules.bootstrap";
import {version, ruleId, answers} from "@/lib/rules/__tests__/assessment-fixtures";
const mocks = vi.hoisted(() => ({embed: vi.fn(), streamText: vi.fn(), listRuleVersions: vi.fn(), matchKbRuleHints: vi.fn(), getProfile: vi.fn()}));
vi.mock("ai", async original => ({...await original<typeof import("ai")>(), embed: mocks.embed, streamText: mocks.streamText, convertToModelMessages: async () => []}));
vi.mock("@openrouter/ai-sdk-provider", () => ({createOpenRouter: () => Object.assign(() => "mock-chat", {textEmbeddingModel: () => "mock-embedding"})}));
vi.mock("@/lib/db/queries", () => mocks);
import {runAssistant} from "../assistant";
const legacy = ruleData.find(rule => rule.id === "dmat-india-existing-aps-exempt")!;
const row = {...legacy, id: ruleId, status: "verified", slug: legacy.id, country_code: "in"};
const stored = {rule_id: ruleId, content: "dMAT: not required. Exempt: already-issued APS certificates"};
beforeEach(() => {vi.resetAllMocks(); mocks.embed.mockResolvedValue({embedding: [0, 1]}); mocks.streamText.mockReturnValue({}); mocks.listRuleVersions.mockResolvedValue([version(1, {raw_snapshot: row})]); mocks.matchKbRuleHints.mockResolvedValue([stored, {rule_id: null, content: "STALE SNIPPET"}]); mocks.getProfile.mockResolvedValue({answers});});
async function search() {
 await runAssistant({db: {from: vi.fn(), rpc: vi.fn()}, userId: "synthetic", countryCode: "in", messages: [], openrouterApiKey: "synthetic-not-used"});
 const tools = mocks.streamText.mock.calls[0][0].tools as ToolSet;
 return await tools.search_rules.execute!({query: "Does an old APS certificate exempt a new procedure?"}, {toolCallId: "synthetic", messages: [], context: {}}) as {chunks: {slug: string; content: string; source_url: string; last_verified_at: string | null; ruleId: string; versionId: string}[]; note?: string};
}
it("withholds stored certificate-only quote and snippets after immutable selection", async () => {
 const results = await search(); expect(results.chunks).toHaveLength(1);
 expect(results.chunks[0].content).toContain("dMAT: unknown");
 expect(results.chunks[0].content).not.toContain("already-issued APS certificates");
 expect(results.chunks[0].content).not.toContain(legacy.source_quote);
 expect(JSON.stringify(results)).not.toContain("STALE SNIPPET");
 expect(results.chunks[0]).toMatchObject({ruleId, versionId: version(1).id});
});
it.each([{status: "draft"}, {raw_snapshot: {...row, source_quote: ""}}, {reviewed_by: null}, {raw_snapshot: {...row, last_verified_at: "bad"}}])("no stored-claim fallback on invalid replacement %j", async extra => {
 mocks.listRuleVersions.mockResolvedValue([version(1, {raw_snapshot: row}), version(2, extra)]);
 expect((await search()).chunks).toEqual([]);
});
it.each([{versions: []}, {versions: [{...version(1), raw_snapshot: null}]}])("missing/invalid immutable sources cannot reach the model %j", async ({versions}) => {
 mocks.listRuleVersions.mockResolvedValue(versions); expect((await search()).chunks).toEqual([]);
});
it("structured metadata read failure yields honest unavailable", async () => {mocks.listRuleVersions.mockRejectedValue(new Error("synthetic failure")); const r = await search(); expect(r.chunks).toEqual([]); expect(r.note).toContain("[[unknown]]");});
it("profile read failure cannot select an unbounded fallback", async () => {mocks.getProfile.mockRejectedValue(new Error("synthetic failure")); expect((await search()).chunks).toEqual([]);});
it("renders current procedure-scoped exemption from its exact raw source", async () => {
 const completed = ruleData.find(rule => rule.id === "dmat-reviewed-completed")!;
 mocks.listRuleVersions.mockResolvedValue([version(2, {raw_snapshot: {...completed, id: ruleId, slug: completed.id, status: "verified", country_code: "in"}})]);
 const r = (await search()).chunks[0]; expect(r.content).toContain("dMAT: not required"); expect(r.content).toContain("relevant_completed"); expect(r.content).toContain(completed.source_quote); expect(r.content).not.toContain("already-issued APS certificates");
});
it("reconstructs unrelated rules too, never retaining old text", async () => {
 mocks.listRuleVersions.mockResolvedValue([version(2, {raw_snapshot: {...row, slug: "testas-other", outcomes: {testas: "required"}}})]);
 const r = (await search()).chunks[0]; expect(r.content).toContain("TestAS: required"); expect(r.content).not.toContain(stored.content);
});
it("snippets alone cannot authorize facts or source verification dates", async () => {mocks.matchKbRuleHints.mockResolvedValue([{rule_id: null, content: "old"}]); mocks.listRuleVersions.mockResolvedValue([]); expect((await search()).chunks).toEqual([]);});
it.each(["unknown", "required", "not_required"])("renamed certificate-only outcome %s still withholds exemption quote", async dmat => {
 mocks.listRuleVersions.mockResolvedValue([version(2, {raw_snapshot: {...row, slug: "renamed", source_url: "https://aps-india.de/faqs/", outcomes: {dmat, testas: "required"}}})]);
 const r = (await search()).chunks[0]; expect(r.content).toContain("dMAT: unknown"); expect(r.content).toContain("TestAS: required"); expect(r.content).not.toContain(legacy.source_quote);
});
it("future publication cannot supply a current model fact", async () => {mocks.listRuleVersions.mockResolvedValue([version(2, {published_at: "2099-01-01T00:00:00Z", raw_snapshot: row})]); expect((await search()).chunks).toEqual([]);});
it("missing intake is unresolved rather than newest-snapshot authority", async () => {mocks.getProfile.mockResolvedValue(null); mocks.listRuleVersions.mockResolvedValue([version(2, {intake_from: 4053, raw_snapshot: row})]); expect((await search()).chunks).toEqual([]);});
it("newly applicable sources remain discoverable before KB rebuild", async () => {mocks.matchKbRuleHints.mockResolvedValue([]); expect((await search()).chunks).toHaveLength(1);});

it("withholds the exact legacy JEE path, note and fabricated quote through immutable search_rules", async () => {
 const jee = {...jeeLegacy[0], id: ruleId};
 mocks.listRuleVersions.mockResolvedValue([version(1, {raw_snapshot: jee})]);
 mocks.matchKbRuleHints.mockResolvedValue([{rule_id: ruleId, content: jee.outcomes.note + ' Official source says: "' + jee.source_quote + '"'}]);
 const r = (await search()).chunks[0];
 expect(r.content).toContain("[[unknown]]");
 expect(r.content).not.toContain(jee.outcomes.note); expect(r.content).not.toContain(jee.source_quote);
 expect(r.content).toContain("https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/");
 expect(r.last_verified_at).toBeNull(); expect(mocks.listRuleVersions).toHaveBeenCalledOnce();
});
it("renamed lost-family legacy metadata and cached generic positive prose cannot acquire immutable authority", async () => {
 const jee = jeeLegacy[0];
 const revised = {...jee, id: ruleId, slug: "renamed-academic-rule", source_url: "https://www.uni-assist.de/",
 conditions: {target_degree: "bachelor"}, outcomes: {testas: "required"}};
 const content = 'Admission path: direct admission restricted to related subjects.\nNote: ' + jee.outcomes.note + '\nOfficial source says: "' + jee.source_quote + '"';
 // Exact old row is a legacy capture, never a newly attested human publication.
 mocks.listRuleVersions.mockResolvedValue([version(2, {raw_snapshot: revised, provenance: "legacy_capture", reviewed_by: null, reviewed_at: null, published_at: null, captured_at: "2026-10-08T00:00:00Z"})]);
 mocks.matchKbRuleHints.mockResolvedValue([{rule_id: ruleId, slug: revised.slug, source_url: revised.source_url, content}]);
 const result = await search(); expect(result.chunks).toEqual([]);
 expect(JSON.stringify(result)).not.toContain(content); expect(JSON.stringify(result)).not.toContain(jee.source_quote);
});
it("renamed current human-reviewed independent version never inherits old JEE cached claims", async () => {
 const revised = {...row, slug: "renamed-academic-rule", source_url: "https://www.uni-assist.de/",
 conditions: {target_degree: "bachelor"}, outcomes: {testas: "required"}, source_quote: "Artificial current independent control; not official admission evidence."};
 mocks.listRuleVersions.mockResolvedValue([version(2, {raw_snapshot: revised})]);
 mocks.matchKbRuleHints.mockResolvedValue([{rule_id: ruleId, content: jeeLegacy[0].outcomes.note + jeeLegacy[0].source_quote}]);
 const r = (await search()).chunks[0]; expect(r.content).toContain("TestAS: required");
 expect(r.source_url).toBe(revised.source_url); expect(r.content).not.toContain(jeeLegacy[0].source_quote);
 expect(r.content).not.toContain(jeeLegacy[0].outcomes.note); expect(r.versionId).toBe(version(2).id);
});

it("ordinary source-backed JEE selected version replaces unsafe hints and carries provenance", async () => {
 const draft = ruleData.find(r=>r.id === "in-jee-qualifying-pass-review")!;
 const current = {...draft,id:ruleId,slug:draft.id,country_code:"in",status:"verified"};
 mocks.listRuleVersions.mockResolvedValue([version(2,{raw_snapshot:current,intake_from:4053,intake_until:4056})]);
 mocks.matchKbRuleHints.mockResolvedValue([{rule_id:ruleId,content:jeeLegacy[0].source_quote+jeeLegacy[0].outcomes.note}]);
 const r=(await search()).chunks[0]; expect(r.content).toContain("Admission path: direct admission restricted");
 expect(r.content).toContain("applicant-reported"); expect(r.content).toContain("source effective intake is not stated");
 expect(r.content).not.toContain(jeeLegacy[0].source_quote); expect(r.content).not.toContain(jeeLegacy[0].outcomes.note);
 expect(r).toMatchObject({ruleId,versionId:version(2).id,source_url:current.source_url,last_verified_at:"2026-10-08T00:00:00Z"});
});
it("a selected source-backed JEE replacement without certificate scope cannot resurrect prior positive content",async()=>{
 const draft=ruleData.find(r=>r.id==="in-jee-qualifying-pass-review")!;
 const current={...draft,id:ruleId,slug:draft.id,country_code:"in",status:"verified"};
 const conditions={...current.conditions}; delete conditions.jee_school_certificate;
 mocks.listRuleVersions.mockResolvedValue([version(1,{raw_snapshot:current}),version(2,{raw_snapshot:{...current,conditions}})]);
 mocks.matchKbRuleHints.mockResolvedValue([{rule_id:ruleId,content:"Admission path: direct admission. Official source says fabricated cached quote"}]);
 const r=(await search()).chunks[0];expect(r.versionId).toBe(version(2).id);expect(r.content).toContain("[[unknown]]");
 expect(r.content).not.toContain("Admission path: direct");expect(r.content).not.toContain(current.source_quote);expect(r.last_verified_at).toBeNull();
});
