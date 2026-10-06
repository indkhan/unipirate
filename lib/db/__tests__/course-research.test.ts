import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../database.types";
import { publishAdminCourseResearch, resolveCourseConflict, updateCourseReviewStatus, saveAdminCourseResearchDraft, updateAdminCourse } from "../admin-queries";
import { buildResearchDraft } from "@/lib/courses/research";
const id = "11111111-1111-4111-8111-111111111111";
const original = "22222222-2222-4222-8222-222222222222";
const programmeId = "33333333-3333-4333-8333-333333333333";
const offeringId = "44444444-4444-4444-8444-444444444444";
const url = "https://www.daad.de/synthetic";
const seed = { url, name: "Synthetic Computing", university: "Synthetic University", text: "Synthetic manual paste ".repeat(12) };
const draft = buildResearchDraft(seed, [{ url, origin: "web", retrieved_at: "2026-10-07T12:00:00Z", content: "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants IELTS 6.5." }], {
  offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: { source_url: url, source_quote: "Winter 2027 Non-EU applicants" }, facts: [{ key: "english", kind: "language", verbatim: "IELTS 6.5.", applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [{ source_url: url, source_quote: "IELTS 6.5." }] }] }],
}, []);
type Write = { table: string; method: string; body: Record<string, unknown> };
function client(conflict = false, failure?: string, changes: Record<string, unknown> = {}, canonicalChanges: Record<string, unknown> = {}) {
  const writes: Write[] = [];
  const course = { id, review_status: "pending", conflicts_with: conflict ? original : null, degree: "Synthetic degree", name: seed.name, university_name: seed.university, field_extraction: { research: draft }, deadlines: ["Unreviewed closing date"], requirements: ["Unreviewed"], tuition: "Unreviewed fee", ...changes };
  const db = createClient<Database>("http://127.0.0.1:54321", "synthetic", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (request, init) => {
      const requestUrl = new URL(String(request)); const table = requestUrl.pathname.split("/").at(-1)!;
      const method = init?.method ?? "GET"; const body = JSON.parse(String(init?.body ?? "{}"));
      if (method !== "GET") writes.push({ table, method, body });
      if (table === failure) return Response.json({ message: "Synthetic DB failure" }, { status: 403 });
      let result: unknown = [];
      const generated = { id: table === "programmes" ? programmeId : offeringId, created_at: "2026-10-07T13:00:00Z" };
      if (table === "courses") result = requestUrl.searchParams.get("id") === `eq.${original}` ? { ...course, id: original, conflicts_with: null, review_status: "approved", ...canonicalChanges } : { ...course, ...body };
      if (table === "programmes") result = method === "GET" ? null : { ...body, ...generated };
      if (table === "course_offerings" || table === "course_offering_versions") result = method === "GET" ? [] : { ...body, ...generated };
      if (table === "resolve_course_conflict") result = null;
      return Response.json(result);
    } },
  });
  return { db, writes };
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-07T13:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("research publication helpers (synthetic HTTP, no RLS claim)", () => {
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
    expect(writes[0].body).toMatchObject({ field_extraction: { research: { observations: [expect.objectContaining({ origin: "manual" })] } } });
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
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id)).rejects.toThrow(/identity/i);
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
  it("appends pending and reviewed snapshots, clears broad unreviewed assertions, and never touches applications/tasks", async () => {
    const { db, writes } = client();
    await publishAdminCourseResearch(db, id, ["0:english"], id);
    expect(writes.find(w => w.table === "courses")?.body).toMatchObject({ review_status: "approved", degree: null, location: null, deadlines: [], requirements: [], tuition: null, language: null });
    const versions = writes.filter(w => w.table === "course_offering_versions").map(w => w.body);
    expect(versions.map(v => v.review_status)).toEqual(["pending", "verified"]);
    expect(versions[0]).toMatchObject({ reviewed_by: null, reviewed_at: null });
    expect(versions[1]).toMatchObject({ reviewed_by: id, facts: expect.arrayContaining([expect.objectContaining({ key: "english", status: "verified" })]) });
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
    const { db } = client(false, "course_offering_versions");
    await expect(publishAdminCourseResearch(db, id, ["0:english"], id)).rejects.toThrow("Synthetic DB failure");
  });
});
