import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { CourseCatalogueDatabase } from "../course-catalogue.types";
import { listReviewedOfferingVersions } from "../queries";
import { insertAdminOfferingVersion, updateAdminProgramme } from "../admin-queries";
const id = "00000000-0000-4000-8000-000000000001";
it.each([
  ["supabase/migrations/20261006000100_course_offerings.sql", 10],
  ["supabase/tests/course_offerings.sql", 16],
] as const)("preserves every literal SQL dollar delimiter in %s", (file, expected) => {
  // Ignore SQL string literals (including regex end anchors) and line comments.
  const sql = readFileSync(file, "utf8").replace(/'(?:''|[^'])*'|--[^\r\n]*/g, "");
  const delimiters = sql.match(/\$+/g) ?? [];
  expect(delimiters).toHaveLength(expected);
  expect(delimiters.every((delimiter) => delimiter === "$$")).toBe(true);
});
function client(body: unknown, status = 200) {
  const requests: string[] = [];
  const db = createClient<CourseCatalogueDatabase>("http://127.0.0.1:54321", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url) => { requests.push(String(url)); return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); } },
  });
  return { db, requests };
}
describe("offering queries", () => {
  it("reads only reviewed history for the selected offering, newest first", async () => {
    const { db, requests } = client([]);
    expect(await listReviewedOfferingVersions(db, id)).toEqual([]);
    expect(requests[0]).toContain(`offering_id=eq.${id}`);
    expect(requests[0]).toContain("review_status=eq.verified");
    expect(requests[0]).toContain("order=version.desc");
  });
  it("rejects invalid ids before I/O", async () => {
    const { db, requests } = client([]);
    await expect(listReviewedOfferingVersions(db, "bad")).rejects.toThrow();
    expect(requests).toEqual([]);
  });
  it("propagates database failures without inventing empty history", async () => {
    const { db } = client({ message: "database unavailable" }, 400);
    await expect(listReviewedOfferingVersions(db, id)).rejects.toThrow("database unavailable");
  });
  it("rejects malformed stored evidence", async () => {
    const { db } = client([{ offering_id: id, version: 1, facts: "bad" }]);
    await expect(listReviewedOfferingVersions(db, id)).rejects.toThrow();
  });
  it("rejects an unsupported verified fact before insert", async () => {
    const { db, requests } = client(null);
    await expect(insertAdminOfferingVersion(db, { offering_id: id, version: 1, review_status: "verified", reviewed_at: null, reviewed_by: null, facts: [] })).rejects.toThrow();
    expect(requests).toEqual([]);
  });
});

describe('programme corrections', () => {
  const row = { id, created_at: '2026-10-06T12:00:00Z', legacy_course_id: id, name: 'Corrected programme', university_name: 'Synthetic institution', degree: null, source_url: 'https://example.edu/programme' };
  it('corrects a name on the existing canonical ID and preserves its legacy link', async () => {
    const { db, requests } = client(row);
    expect(await updateAdminProgramme(db, id, { name: row.name })).toEqual(row);
    expect(requests[0]).toContain('programmes');
    expect(requests[0]).toContain('id=eq.' + id);
  });
  it.each([{ legacy_course_id: null }, { id: 'changed' }, { review_status: 'verified' }, { name: ' ' }, {}])('rejects identity changes, review elevation and invalid corrections: %j', async (input) => {
    const { db, requests } = client(row);
    await expect(updateAdminProgramme(db, id, input)).rejects.toThrow();
    expect(requests).toEqual([]);
  });
  it('propagates missing/unauthorized correction failures', async () => {
    const { db } = client({ message: 'No visible programme' }, 406);
    await expect(updateAdminProgramme(db, id, { name: row.name })).rejects.toThrow('No visible programme');
  });
});
