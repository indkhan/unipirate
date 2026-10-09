import {createClient} from "@supabase/supabase-js";
import {expect, it} from "vitest";
import type {Database} from "../database.types";
import {insertAdminRuleCandidate} from "../admin-queries";

const id = "11111111-1111-4111-8111-111111111111";
const candidate = {slug: "academic-candidate", country_code: "in", status: "draft", conditions: {certificate_country: "in"}, outcomes: {path: "unknown", note: " Exact source note. "}, source_url: "https://www.daad.de/en/", source_quote: "  Exact source quote.\n", last_verified_at: "2026-10-08T10:00:00Z", notes: null};
const draft = {rule_id: id, revision: 1, raw_snapshot: {...candidate, id, created_at: "2026-10-09T10:00:00Z", updated_at: "2026-10-09T10:00:00Z"}, edited_by: id, edited_at: "2026-10-09T10:00:00Z", effective_from: null, effective_until: null, intake_from: null, intake_until: null};
function client(duplicate = false) {
 const requests: {url: URL; method: string; body: unknown; prefer: string | null}[] = [];
 const db = createClient<Database>("http://127.0.0.1:54321", "synthetic-key", {auth: {persistSession: false, autoRefreshToken: false}, global: {fetch: async (url, init) => {
  const request = {url: new URL(String(url)), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null, prefer: new Headers(init?.headers).get("prefer")}; requests.push(request);
  return new Response(JSON.stringify(duplicate ? {code: "23505", message: "duplicate slug"} : request.method === "POST" ? {id} : draft), {status: duplicate ? 409 : 200, headers: {"Content-Type": "application/json"}});
 }}});
 return {db, requests};
}
it("inserts exact source-backed draft content and returns the actual database-initialized workspace", async () => {
 const {db, requests} = client();
 expect(await insertAdminRuleCandidate(db, candidate)).toEqual(draft);
 expect(requests.map(r => [r.method, r.url.pathname])).toEqual([["POST", "/rest/v1/rules"], ["GET", "/rest/v1/rule_drafts"]]);
 expect(requests[0].body).toEqual(candidate);
 expect(requests[0].prefer).not.toContain("resolution=");
 expect(requests[1].url.searchParams.get("rule_id")).toBe(`eq.${id}`);
});
it.each([
 {status: "beta"}, {status: "verified"}, {source_url: "javascript:alert(1)"}, {source_url: "https://user:password@example.com"}, {source_url: "http://127.0.0.1/"}, {source_quote: " \n"}, {last_verified_at: null}, {last_verified_at: undefined}, {last_verified_at: "2026-02-30T10:00:00Z"}, {conditions: {invented_fact: true}}, {conditions: null}, {outcomes: {}}, {outcomes: {path: "invented"}}, {outcomes: {path: "unknown", override: true}}, {slug: " "}, {country_code: "IN"}, {country: "in"}, {id}, {created_at: "2026-10-08T10:00:00Z"}, {updated_at: "2026-10-08T10:00:00Z"}, {approval_status: "verified"}, {effective_from: "2026-01-01"}, {published_at: "2026-10-08T10:00:00Z"}, {unknown: true},
])("rejects invalid content and caller authority before I/O: %j", async extra => {
 const {db, requests} = client();
 await expect(insertAdminRuleCandidate(db, {...candidate, ...extra})).rejects.toThrow();
 expect(requests).toEqual([]);
});
it("propagates a duplicate slug without reads, overwrites, version writes or publication", async () => {
 const {db, requests} = client(true);
 await expect(insertAdminRuleCandidate(db, candidate)).rejects.toThrow("duplicate slug");
 expect(requests).toHaveLength(1);
 expect(requests[0].method).toBe("POST"); expect(requests[0].body).toEqual(candidate);
 expect(requests[0].prefer).not.toContain("resolution=");
});
it.each(["conditions", "outcomes", "source_url", "source_quote", "last_verified_at", "slug", "country_code"])("requires explicit %s before I/O", async field => {
 const input: Record<string, unknown> = {...candidate}; delete input[field];
 const {db, requests} = client();
 await expect(insertAdminRuleCandidate(db, input)).rejects.toThrow(); expect(requests).toEqual([]);
});
