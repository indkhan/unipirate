import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../database.types";
import { publishAdminCourseResearch, resolveCourseConflict, updateCourseReviewStatus, saveAdminCourseResearchDraft, updateAdminCourse, listAdminCourseResearchHistory } from "../admin-queries";
import { auditFixture } from "@/lib/courses/__tests__/fixtures/research-audit";
import { buildResearchDraft } from "@/lib/courses/research";
const id = "11111111-1111-4111-8111-111111111111";
const original = "22222222-2222-4222-8222-222222222222";
const programmeId = "33333333-3333-4333-8333-333333333333";
const offeringId = "44444444-4444-4444-8444-444444444444";
const decision = [{ key: "0:english", reason: "Compared complete captured sources and confirmed the actual field applicability." }];
const url = "https://www.daad.de/synthetic";
const seed = { url, name: "Synthetic Computing", university: "Synthetic University", text: "Synthetic manual paste ".repeat(12) };
const draft = buildResearchDraft(seed, [{ url, origin: "web", retrieved_at: "2026-10-07T12:00:00Z", content: "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants IELTS 6.5." }], {
  offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: { source_url: url, source_quote: "Winter 2027 Non-EU applicants" }, facts: [{ key: "english", kind: "language", verbatim: "IELTS 6.5.", applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [{ source_url: url, source_quote: "IELTS 6.5." }] }] }],
}, []);
type Write = { table: string; method: string; body: Record<string, unknown>; url: string };
function client(conflict = false, failure?: string, changes: Record<string, unknown> = {}, canonicalChanges: Record<string, unknown> = {}, options: { failRpcAt?: number; malformedRpc?: boolean; markerRace?: boolean; versions?: number[]; unexpectedRpc?: boolean; maxUrlLength?: number; metadataResult?: unknown } = {}) {
  const writes: Write[] = [];
  let rpcCount = 0;
  let catalogue: unknown = null;
  const offeringRows: Record<string, unknown>[] = [];
  const publishedRows: Record<string, unknown>[] = [];
  const course = { id, review_status: "pending", conflicts_with: conflict ? original : null, degree: "Synthetic degree", name: seed.name, university_name: seed.university, field_extraction: { research: draft }, deadlines: ["Unreviewed closing date"], requirements: ["Unreviewed"], tuition: "Unreviewed fee", ...changes };
  const db = createClient<Database>("http://127.0.0.1:54321", "synthetic", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (request, init) => {
      const requestUrl = new URL(String(request)); const table = requestUrl.pathname.split("/").at(-1)!;
      const method = init?.method ?? "GET"; const body = JSON.parse(String(init?.body ?? "{}"));
      if (method !== "GET") writes.push({ table, method, body, url: requestUrl.href });
      if (options.maxUrlLength && requestUrl.href.length > options.maxUrlLength) return Response.json({ message: "URI too long" }, { status: 414 });
      if (table === failure) return Response.json({ message: "Synthetic DB failure" }, { status: 403 });
      let result: unknown = [];
      const generated = { id: table === "programmes" ? programmeId : offeringId, created_at: "2026-10-07T13:00:00Z" };
      if (table === "courses") result = requestUrl.searchParams.get("id") === `eq.${original}` ? { ...course, id: original, conflicts_with: null, review_status: "approved", ...canonicalChanges } : { ...course, ...body };
      if (table === "programmes") { if (method === "GET") result = catalogue; else { result = { ...body, ...generated }; catalogue = result; } }
      if (table === "course_offerings") { if (method === "GET") result = offeringRows; else { const row = { ...body, ...generated, id: offeringRows.length ? "55555555-5555-4555-8555-555555555555" : offeringId }; offeringRows.push(row); result = row; } }
      if (table === "course_offering_versions" && method === "GET") result = [...(options.versions ?? []).map(version => ({ id: offeringId, offering_id: offeringId, created_at: "2026-10-07T13:00:00Z", version, review_status: "pending", reviewed_at: null, reviewed_by: null, facts: draft.offerings[0].facts })), ...publishedRows.filter(row => requestUrl.searchParams.get("offering_id") === "eq." + row.offering_id)];
      if (table === "courses" && method === "PATCH" && requestUrl.searchParams.get("select") === "id") result = options.markerRace ? [] : [{ id: original }];
      if (table === "compare_and_set_course_research_metadata") {
        if (options.markerRace) return Response.json({ message: "Course metadata changed; reload and review again" }, { status: 400 });
        result = { ...course, ...(body.p_course_id === original ? { id: original, conflicts_with: null, review_status: "approved", ...canonicalChanges } : {}), field_extraction: body.p_next_metadata };
        if (Object.prototype.hasOwnProperty.call(options, "metadataResult")) result = options.metadataResult;
      }
      if (table === "publish_course_research_version") {
        rpcCount++;
        if (rpcCount === options.failRpcAt) return Response.json({ message: "research changed; reload and review again" }, { status: 400 });
        result = options.malformedRpc ? { review_status: "verified" } : { id: offeringId, offering_id: body.p_offering_id, created_at: "2026-10-07T13:00:00Z", version: body.p_version, review_status: options.unexpectedRpc ? "pending" : "verified", reviewed_at: options.unexpectedRpc ? null : "2026-10-07T13:00:00Z", reviewed_by: options.unexpectedRpc ? null : id, facts: [] };
        if (!options.malformedRpc && !options.unexpectedRpc) publishedRows.push(result as Record<string, unknown>);
      }
      if (table === "resolve_course_conflict") result = null;
      return Response.json(result);
    } },
  });
  return { db, writes };
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-07T13:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("research publication helpers (synthetic HTTP, no RLS claim)", () => {
  it("saves eleven complete large captures through a bounded POST URL with the raw metadata in its body", async () => {
    const large = structuredClone(draft);
    large.paste = "Synthetic complete paste ".repeat(8000);
    large.observations = Array.from({ length: 11 }, (_, index) => ({ ...draft.observations[0], content: (draft.observations[0].content + "\nSynthetic captured navigation " + index + " ").padEnd(20_000, "x") }));
    const metadata = { research: large, sibling: { literal: ["  retain whitespace  ", null, false], capture: "Synthetic sibling ".repeat(1000) } };
    const { db, writes } = client(false, undefined, { field_extraction: metadata }, {}, { maxUrlLength: 8192 });
    const saved = await saveAdminCourseResearchDraft(db, id, large);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "compare_and_set_course_research_metadata", method: "POST", body: { p_course_id: id, p_mode: "recovery", p_expected_metadata: metadata, p_expected_sql_null: false, p_next_metadata: metadata } });
    expect(writes[0].url.length).toBeLessThan(256);
    expect(new URL(writes[0].url).searchParams.has("field_extraction")).toBe(false);
    expect(JSON.stringify(writes[0].body).length).toBeGreaterThan(800_000);
    expect(saved.field_extraction).toEqual(metadata);
  });


  it("adds the canonical marker with large sibling metadata through a bounded POST URL", async () => {
    const raw = structuredClone(draft); raw.identity.name = "  " + raw.identity.name + "  ";
    const metadata = { sibling: "Synthetic complete canonical capture ".repeat(6000), literal: [null, false, " retain "], research_reconciliations: [{ forged: true }] };
    const { db, writes } = client(true, undefined, { field_extraction: { research: raw } }, { field_extraction: metadata }, { maxUrlLength: 8192 });
    await publishAdminCourseResearch(db, id, ["0:english"], id, decision);
    const marker = writes.find(w => w.table === "compare_and_set_course_research_metadata")!;
    expect(marker).toMatchObject({ method: "POST", body: { p_course_id: original, p_mode: "marker", p_expected_metadata: metadata, p_expected_sql_null: false, p_next_metadata: { ...metadata, research: raw } } });
    expect(marker.url.length).toBeLessThan(256);
    expect(new URL(marker.url).searchParams.has("field_extraction")).toBe(false);
    expect(writes.find(w => w.table === "publish_course_research_version")?.body.p_expected_research).toEqual(raw);
  });

  it.each([ ["absent", null], ["wrong ID", { id: original, review_status: "pending", field_extraction: { research: draft } }], ["wrong lifecycle", { id, review_status: "approved", field_extraction: { research: draft } }], ["missing metadata", { id, review_status: "pending", field_extraction: {} }] ])("rejects an absent or unexpected metadata RPC result (%s)", async (_label, metadataResult) => {
    const { db, writes } = client(false, undefined, {}, {}, { metadataResult });
    await expect(saveAdminCourseResearchDraft(db, id, draft)).rejects.toThrow(/metadata result/i);
    expect(writes).toHaveLength(1);
  });

  it("preserves the SQL-null marker expectation and the exact raw research value", async () => {
    const raw = structuredClone(draft); raw.identity.name = "  " + raw.identity.name + "  ";
    const { db, writes } = client(true, undefined, { field_extraction: { research: raw } }, { field_extraction: null });
    await publishAdminCourseResearch(db, id, ["0:english"], id, decision);
    expect(writes.find(w => w.table === "compare_and_set_course_research_metadata")?.body).toEqual({ p_course_id: original, p_expected_metadata: null, p_expected_sql_null: true, p_next_metadata: { research: raw }, p_mode: "marker" });
  });
  it("sends the raw recovery expectation even when draft parsing trims identity labels", async () => {
    const raw = structuredClone(draft); raw.identity.name = "  " + raw.identity.name + "  ";
    const metadata = { sibling: [false, null, " keep "], research: raw };
    const { db, writes } = client(false, undefined, { field_extraction: metadata });
    await saveAdminCourseResearchDraft(db, id, raw);
    expect(writes[0].body.p_expected_metadata).toEqual(metadata);
    expect(writes[0].body.p_next_metadata).toMatchObject({ sibling: [false, null, " keep "], research: { identity: { name: "Synthetic Computing" } } });
  });
  it.each(["stale", "authorization"])("propagates recovery %s errors without another mutation", async failure => {
    const { db, writes } = failure === "stale" ? client(false, undefined, {}, {}, { markerRace: true }) : client(false, "compare_and_set_course_research_metadata");
    await expect(saveAdminCourseResearchDraft(db, id, draft)).rejects.toThrow(failure === "stale" ? /metadata changed/ : /Synthetic DB failure/);
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("compare_and_set_course_research_metadata");
    expect(writes.some(w => w.table === "publish_course_research_version")).toBe(false);
  });
  it.each(["bad-id", "missing-draft", "forged-review"])("validates recovery %s before any I/O", async invalid => {
    const fetch = vi.fn(() => { throw new Error("Unexpected I/O"); });
    const db = createClient<Database>("http://127.0.0.1:54321", "synthetic", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
    await expect(saveAdminCourseResearchDraft(db, invalid === "bad-id" ? "bad-id" : id, invalid === "missing-draft" ? undefined : invalid === "forged-review" ? { ...draft, reviewed_by: id } : draft)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([["language", "IELTS 6.5.", "IELTS 7.0."], ["fee", "Tuition EUR 0; semester fee EUR 100.", "Semester fee EUR 200."]] as const)("rejects recovered %s conflict aliases before any save or publication", async (kind, first, second) => {
    const observations = [{ ...draft.observations[0], content: draft.observations[0].content + "\n\n" + first + "\n\n" + second }];
    const candidate = (verbatim: string) => ({ key: "known", kind, verbatim, applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [{ source_url: url, source_quote: verbatim }] });
    const offering = { intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: { source_url: url, source_quote: "Winter 2027 Non-EU applicants" }, facts: [candidate(first), candidate(second)] };
    const conflicted = buildResearchDraft(seed, observations, { offerings: [offering] }, []);
    const single = buildResearchDraft(seed, observations, { offerings: [{ ...offering, facts: [candidate(first)] }] }, []);
    conflicted.offerings[0].facts.push({ ...single.offerings[0].facts.find(f => f.key === "known")!, key: "arbitrary-copy" });
    const recovery = client();
    await expect(saveAdminCourseResearchDraft(recovery.db, id, conflicted)).rejects.toThrow(/conflict/i);
    expect(recovery.writes).toEqual([]);
    const publication = client(false, undefined, { field_extraction: { research: conflicted } });
    await expect(publishAdminCourseResearch(publication.db, id, ["0:arbitrary-copy"], id, [{ key: "0:arbitrary-copy", reason: "Omission reconciliation cannot resolve this known semantic disagreement." }])).rejects.toThrow(/conflict/i);
    expect(publication.writes).toEqual([]);
  });
  it("requires field reconciliation, audits it server-side, and prevents JSON from removing captured omissions", async () => {
    const omitted = structuredClone(draft); omitted.observations[0].content += "\n\n" + "Application navigation ".repeat(220) + "\n\nIELTS 7.0.";
    const failed = client(false, undefined, { field_extraction: { research: omitted } });
    await expect(publishAdminCourseResearch(failed.db, id, ["0:english"], id)).rejects.toThrow(/reconcil/i); expect(failed.writes).toEqual([]);
    const recovered = structuredClone(omitted); recovered.observations[0].content = draft.observations[0].content;
    await saveAdminCourseResearchDraft(failed.db, id, recovered);
    const saved = failed.writes[0].body.p_next_metadata as { research: typeof draft };
    expect(saved.research.observations.some(o => o.content.includes("IELTS 7.0."))).toBe(true);
    const published = client(false, undefined, { field_extraction: { research: omitted } });
    await publishAdminCourseResearch(published.db, id, ["0:english"], id, [{ key: "0:english", reason: "Compared full captured official sources and reconciled actual scope and requirements." }]);
    const rpc = published.writes.find(w => w.table === "publish_course_research_version")!;
    expect(rpc.body).toMatchObject({ p_submitted_course_id: id, p_offering_id: offeringId, p_offering_index: 0, p_version: 1, p_accepted_keys: ["english"], p_decisions: [expect.objectContaining({ key: "english" })], p_expected_research: omitted });
    expect(published.writes.some(w => w.table === "course_offering_versions")).toBe(false);
    expect(published.writes.some(w => JSON.stringify(w.body).includes("research_reconciliations"))).toBe(false);
    const legacy = client(true, undefined, { field_extraction: { research: omitted } }, { field_extraction: {} });
    await publishAdminCourseResearch(legacy.db, id, ["0:english"], id, [{ key: "0:english", reason: "Compared full captured sources and reconciled applicability for this assertion." }]);
    const guarded = legacy.writes.find(w => w.table === "compare_and_set_course_research_metadata")!.body.p_next_metadata;
    const replacement = client(true, undefined, { field_extraction: {} }, { field_extraction: guarded });
    await expect(resolveCourseConflict(replacement.db, id, true)).rejects.toThrow(/research/i);
    expect(replacement.writes).toEqual([]);
  });
  it("cannot publish unscoped recovery captures even with an empty selection", async () => {
    const recovery = structuredClone(draft);
    recovery.unscoped = recovery.offerings[0].facts.filter(f => f.status === "pending").map(f => ({ ...f, applicability: "Unresolved effective intake/applicant scope" }));
    recovery.offerings = [];
    const { db, writes } = client(false, undefined, { field_extraction: { research: recovery } });
    await expect(publishAdminCourseResearch(db, id, [], id)).rejects.toThrow(/scope/i);
    expect(writes).toEqual([]);
    const pending = client();
    await saveAdminCourseResearchDraft(pending.db, id, recovery);
    expect(pending.writes[0].body).toMatchObject({ p_next_metadata: { research: { offerings: [], unscoped: expect.arrayContaining([expect.objectContaining({ status: "pending", applicability: "Unresolved effective intake/applicant scope" })]) } } });
    expect(pending.writes[0].body).not.toHaveProperty("review_status");
  });
  it("blocks a legacy incoming update to research canonical without reaching the RPC", async () => {
    const { db, writes } = client(true, undefined, { field_extraction: {} }, { field_extraction: { research: draft } });
    await expect(resolveCourseConflict(db, id, true)).rejects.toThrow(/research/i);
    expect(writes).toEqual([]);
  });
  it("retains normal legacy resolution and keep-original research tracking flow", async () => {
    const legacy = client(true, undefined, { field_extraction: {} });
    await resolveCourseConflict(legacy.db, id, true);
    expect(legacy.writes.at(-1)?.body.p_keep_new).toBe(true);
    const research = client(true);
    await resolveCourseConflict(research.db, id, false);
    expect(research.writes.at(-1)?.body.p_keep_new).toBe(false);
  });
  it.each(["scope", "applicant", "year", "missing"])("rejects fabricated or missing %s during recovery and publication before writes", async change => {
    const edited = structuredClone(draft);
    if (change === "scope") edited.offerings[0].applicability.source_scope = "Winter 2030 EU applicants";
    if (change === "missing") delete edited.offerings[0].applicability.source_scope;
    if (change === "applicant") edited.offerings[0].facts[0].applicability = "EU applicants";
    if (change === "year") edited.offerings[0].intake_year = 2030;
    const { db, writes } = client(false, undefined, { field_extraction: { research: edited } });
    await expect(saveAdminCourseResearchDraft(db, id, edited)).rejects.toThrow();
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id)).rejects.toThrow();
    expect(writes).toEqual([]);
  });
  it("saves pending manual recovery and relabels newly entered captures without verification", async () => {
    const { db, writes } = client();
    const edited = structuredClone(draft); edited.observations[0].content += " Human source capture.";
    await saveAdminCourseResearchDraft(db, id, edited);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatchObject({ p_next_metadata: { research: { observations: expect.arrayContaining([expect.objectContaining({ origin: "manual" })]) } } });
    expect(writes[0].body).not.toHaveProperty("review_status");
  });
  it("blocks legacy edits and recovery on published research before mutations", async () => {
    const { db, writes } = client(false, undefined, { review_status: "approved" });
    await expect(updateAdminCourse(db, id, { deadlines: ["Unreviewed replacement"] })).rejects.toThrow(/reviewed offering/i);
    await expect(saveAdminCourseResearchDraft(db, id, draft)).rejects.toThrow(/pending/i);
    expect(writes).toEqual([]);
  });
  it("rejects publication under mismatching course identity before mutation", async () => {
    const { db, writes } = client(false, undefined, { name: "Unrelated" });
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id, decision)).rejects.toThrow(/identity/i);
    expect(writes).toEqual([]);
  });
  it("blocks both generic publication helpers before writes", async () => {
    const { db, writes } = client();
    await expect(updateCourseReviewStatus(db, id, "approved")).rejects.toThrow(/research/i);
    await expect(resolveCourseConflict(db, id, true)).rejects.toThrow(/research/i);
    expect(writes).toEqual([]);
  });
  it("validates all review selections before mutation", async () => {
    const { db, writes } = client();
    await expect(publishAdminCourseResearch(db, id, ["0:invented"], id)).rejects.toThrow();
    expect(writes).toEqual([]);
  });
  it("calls one protected publication RPC, clears broad unreviewed assertions, and never touches applications/tasks", async () => {
    const { db, writes } = client();
    await publishAdminCourseResearch(db, id, ["0:english"], id, decision);
    expect(writes.find(w => w.table === "courses")?.body).toMatchObject({ review_status: "approved", degree: null, location: null, deadlines: [], requirements: [], tuition: null, language: null });
    expect(writes.filter(w => w.table === "publish_course_research_version")).toHaveLength(1);
    expect(writes.some(w => w.table === "course_offering_versions")).toBe(false);
    expect(writes.some(w => ["tasks", "applications", "course_task_definitions"].includes(w.table))).toBe(false);
  });
  it("publishes updates against the original canonical course and preserves its facts/progress", async () => {
    const { db, writes } = client(true);
    await publishAdminCourseResearch(db, id, [], id);
    expect(writes.find(w => w.table === "programmes")?.body.legacy_course_id).toBe(original);
    expect(writes.some(w => w.table === "courses")).toBe(false);
    expect(writes.at(-1)).toMatchObject({ table: "resolve_course_conflict", body: { p_new_course_id: id, p_keep_new: false } });
  });
  it("propagates rejected catalogue writes rather than claiming publication", async () => {
    const { db } = client(false, "publish_course_research_version");
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id, decision)).rejects.toThrow("Synthetic DB failure");
  });
  it("preflights a bad later offering before identity approval or any catalogue write", async () => {
    const multi = structuredClone(draft); multi.offerings.push(structuredClone(multi.offerings[0])); multi.offerings[1].facts[0].status = "unresolved"; multi.offerings[1].facts[0].verbatim = null;
    const { db, writes } = client(false, undefined, { field_extraction: { research: multi } });
    await expect(publishAdminCourseResearch(db, id, ["0:english", "1:english"], id, [...decision, { ...decision[0], key: "1:english" }])).rejects.toThrow(); expect(writes).toEqual([]);
  });
  it("passes original raw JSON rather than trimmed Zod output and appends max actual version + 1", async () => {
    const raw = structuredClone(draft); raw.identity.name = "  " + raw.identity.name + "  ";
    const { db, writes } = client(false, undefined, { field_extraction: { research: raw } }, {}, { versions: [2, 7, 4] });
    await publishAdminCourseResearch(db, id, ["0:english"], id, decision);
    expect(writes.find(w => w.table === "publish_course_research_version")?.body).toMatchObject({ p_version: 8, p_expected_research: raw, p_decisions: [{ key: "english", reason: decision[0].reason }] });
  });
  it("requires a decision for every accepted field even without context omissions", async () => {
    const { db, writes } = client(); await expect(publishAdminCourseResearch(db, id, ["0:english"], id)).rejects.toThrow(/decision|reconcil/i); expect(writes).toEqual([]);
  });
  it.each([1, 2])("never resolves after RPC failure on offering %s; prior successes are not cross-request atomic", async failRpcAt => {
    const multi = structuredClone(draft); multi.offerings.push(structuredClone(multi.offerings[0]));
    const { db, writes } = client(true, undefined, { field_extraction: { research: multi } }, { field_extraction: { sibling: "retain", research_reconciliations: [{ forged: true }] } }, { failRpcAt });
    await expect(publishAdminCourseResearch(db, id, ["0:english", "1:english"], id, [...decision, { ...decision[0], key: "1:english" }])).rejects.toThrow(/research changed/);
    expect(writes.filter(w => w.table === "publish_course_research_version")).toHaveLength(failRpcAt);
    expect(writes.some(w => w.table === "resolve_course_conflict" || w.table === "course_offering_versions")).toBe(false);
    const marker = writes.find(w => w.table === "compare_and_set_course_research_metadata")?.body.p_next_metadata;
    expect(marker).toEqual({ sibling: "retain", research_reconciliations: [{ forged: true }], research: multi });
    expect(writes.find(w => w.table === "compare_and_set_course_research_metadata")?.body.p_expected_metadata).toEqual({ sibling: "retain", research_reconciliations: [{ forged: true }] });
    const generic = client(true, undefined, { field_extraction: {} }, { field_extraction: marker });
    await expect(resolveCourseConflict(generic.db, id, true)).rejects.toThrow(/research/i); expect(generic.writes).toEqual([]);
  });
  it("fails a conditional canonical marker race before any verified publication", async () => {
    const { db, writes } = client(true, undefined, {}, { field_extraction: { sibling: "original" } }, { markerRace: true });
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id, decision)).rejects.toThrow(/reload|changed/i);
    expect(writes.some(w => w.table === "publish_course_research_version" || w.table === "resolve_course_conflict")).toBe(false);
  });
  it("rejects a malformed RPC row without resolving the submission", async () => {
    const { db, writes } = client(true, undefined, {}, {}, { malformedRpc: true });
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id, decision)).rejects.toThrow();
    expect(writes.some(w => w.table === "resolve_course_conflict")).toBe(false);
  });
  it("recovery retains complete paste and all original captures plus metadata siblings", async () => {
    const previous = structuredClone(draft); previous.observations.push({ ...previous.observations[0], origin: "paste", content: "Original complete pasted observation" });
    const edited = structuredClone(previous); edited.observations = []; edited.paste = "replacement paste";
    const { db, writes } = client(false, undefined, { field_extraction: { research: previous, sibling: "retain" } });
    // Retained captures must be merged before final evidence validation.
    await saveAdminCourseResearchDraft(db, id, edited);
    expect(writes[0].body.p_next_metadata).toMatchObject({ sibling: "retain", research: { paste: previous.paste, observations: previous.observations } });
  });
  it("rejects recovery capacity overflow instead of truncating original captures", async () => {
    const previous = structuredClone(draft); previous.observations = Array.from({ length: 12 }, (_, i) => ({ ...draft.observations[0], content: draft.observations[0].content + i }));
    const edited = structuredClone(draft); edited.observations[0].content += " new manual capture";
    const { db, writes } = client(false, undefined, { field_extraction: { research: previous } });
    await expect(saveAdminCourseResearchDraft(db, id, edited)).rejects.toThrow(); expect(writes).toEqual([]);
  });

  it("queries protected history by canonical envelope with bounds and fails closed for malformed records", async () => {
    const requests: URL[] = [];
    const db = createClient<Database>("http://127.0.0.1:54321", "synthetic", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async request => {
      requests.push(new URL(String(request))); return Response.json([auditFixture, { ...auditFixture, course_reconciliation: { forged: true } }]);
    } } });
    const history = await listAdminCourseResearchHistory(db, original, 30);
    expect(requests).toHaveLength(1); expect(requests[0].pathname).toBe("/rest/v1/admin_audit_events");
    expect(requests[0].searchParams.get("row_id")).toBe("eq." + original);
    expect(requests[0].searchParams.get("course_reconciliation")).toBe("not.is.null"); expect(requests[0].searchParams.get("limit")).toBe("30");
    expect(history.map(r => r.status)).toEqual(["available", "unavailable"]);
    await expect(listAdminCourseResearchHistory(db, original, 101)).rejects.toThrow(); expect(requests).toHaveLength(1);
  });
  it("propagates history authorization/read failure instead of inventing protected records", async () => {
    const db = createClient<Database>("http://127.0.0.1:54321", "synthetic", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async () => Response.json({ message: "Synthetic permission denied" }, { status: 403 }) } });
    await expect(listAdminCourseResearchHistory(db, original)).rejects.toThrow("Synthetic permission denied");
  });

  it("rejects a valid but unpublished RPC return without claiming verified publication or cleanup", async () => {
    const { db, writes } = client(true, undefined, {}, {}, { unexpectedRpc: true });
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id, decision)).rejects.toThrow("Unexpected research publication result");
    expect(writes.some(w => w.table === "resolve_course_conflict")).toBe(false);
  });

  it("reuses catalogue on explicit retry and appends from actual per-offering versions after partial failure", async () => {
    const multi = structuredClone(draft);
    multi.observations[0].content += " Synthetic Computing Synthetic University Winter 2027 EU applicants IELTS 6.5.";
    const second = structuredClone(multi.offerings[0]); second.applicant_group = "EU applicants";
    second.scope.source_quote = "Winter 2027 EU applicants"; second.applicability.source_scope = second.scope.source_quote;
    second.facts = second.facts.map(f => ({ ...f, applicability: "EU applicants" })); multi.offerings.push(second);
    const { db, writes } = client(true, undefined, { field_extraction: { research: multi } }, {}, { failRpcAt: 2 });
    const selected = ["0:english", "1:english"]; const reasons = [...decision, { ...decision[0], key: "1:english" }];
    await expect(publishAdminCourseResearch(db, id, selected, id, reasons)).rejects.toThrow(/research changed/);
    expect(writes.some(w => w.table === "resolve_course_conflict")).toBe(false);
    await publishAdminCourseResearch(db, id, selected, id, reasons);
    const calls = writes.filter(w => w.table === "publish_course_research_version");
    expect(calls.map(w => [w.body.p_offering_index, w.body.p_version])).toEqual([[0, 1], [1, 1], [0, 2], [1, 1]]);
    expect(writes.filter(w => w.table === "programmes")).toHaveLength(1);
    expect(writes.filter(w => w.table === "course_offerings")).toHaveLength(2);
    expect(writes.filter(w => w.table === "resolve_course_conflict")).toHaveLength(1);
  });

});
