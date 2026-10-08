import {createClient} from "@supabase/supabase-js";
import {expect, it} from "vitest";
import type {Database} from "../database.types";
import {getRuleVersionsByIds, insertCheck, getCheck, listRuleVersions, matchKbRuleHints, upsertGeneratedTasks} from "../queries";
import {listAdminImpactProfiles} from "../admin-queries";
import {evaluateAssessment} from "@/lib/rules/assessment";
import {answers, profile, context, version} from "@/lib/rules/__tests__/assessment-fixtures";
function client(handler: (url: URL, method: string, body: unknown) => Response) {
 const requests: {url: URL; method: string; body: unknown; prefer: string | null}[] = [];
 const db = createClient<Database>("http://127.0.0.1:54321", "synthetic-key", {auth: {persistSession: false, autoRefreshToken: false}, global: {fetch: async (url, init) => {const request = {prefer: new Headers(init?.headers).get("prefer"), url: new URL(String(url)), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null}; requests.push(request); return handler(request.url, request.method, request.body);}}});
 return {db, requests};
}
const response = (data: unknown, count?: number) => new Response(JSON.stringify(data), {status: 200, headers: {"Content-Type": "application/json", ...(count === undefined ? {} : {"content-range": "0-0/"+count})}});
it("reads selected and diagnostic IDs exactly, never newest/latest", async () => {
 const {db, requests} = client(() => response([version(1)]));
 expect(await getRuleVersionsByIds(db, [version(1).id, version(2).id])).toHaveLength(1);
 expect(requests[0].url.searchParams.get("id")).toBe('in.('+version(1).id+','+version(2).id+')');
 expect(requests[0].url.pathname).toContain("rule_versions");
});
it.each([{ids: []}, {ids: ["invalid"]}])("empty/invalid exact refs cause no I/O %j", async ({ids}) => {const {db, requests} = client(() => response([])); if(ids.length)await expect(getRuleVersionsByIds(db, ids)).rejects.toThrow();else expect(await getRuleVersionsByIds(db, ids)).toEqual([]);expect(requests).toEqual([]);});
it("validated original payload and protected metadata are in the same private INSERT", async () => {
 const a = evaluateAssessment(profile, [version(1)], context);
 const record = {answers, result: a.result, assessment_metadata: a.metadata, owner_token_hash: "a".repeat(64), claimed_at: null};
 const {db, requests} = client(() => response({id: version(1).id}));
 expect(await insertCheck(db, record)).toBe(version(1).id); expect(requests).toHaveLength(1); expect(requests[0].method).toBe("POST"); expect(requests[0].body).toEqual(record);
});
it.each([null, {}, {formatVersion: 2}])("missing/malformed authority rejected before private writer I/O %j", async metadata => {
 const {db, requests} = client(() => response({}));
 await expect(insertCheck(db, {answers, result: evaluateAssessment(profile, [], context).result, assessment_metadata: metadata, owner_token_hash: "a".repeat(64), claimed_at: null})).rejects.toThrow(); expect(requests).toEqual([]);
});
it("no caller-supplied ownership, timestamps or unexpected authority fields pass the insert boundary", async () => {
 const {db, requests} = client(() => response({})); const a = evaluateAssessment(profile, [], context);
 for(const extra of [{claimed_by: version(1).id, claimed_at: null}, {created_at: context.evaluatedAt}, {assessment_metadata: {...a.metadata, forged: true}}])await expect(insertCheck(db, {answers, result: a.result, assessment_metadata: a.metadata, owner_token_hash: "a".repeat(64), claimed_at: null, ...extra})).rejects.toThrow();
 expect(requests).toEqual([]);
});
it("sharing calls only UUID projection with actual protected column, no account query", async () => {
 const shared = {id: version(1).id, answers, result: {}, created_at: context.evaluatedAt, assessment_metadata: null};
 const {db, requests} = client(() => response([shared])); expect(await getCheck(db, shared.id)).toEqual(shared);
 expect(requests).toHaveLength(1); expect(requests[0].url.pathname).toContain("rpc/get_shared_check"); expect(requests[0].body).toEqual({p_check_id: shared.id});
});
it("missing shared UUID is empty and invalid UUID causes no account enumeration", async () => {const {db, requests} = client(() => response([])); expect(await getCheck(db, version(1).id)).toBeNull();await expect(getCheck(db,"bad")).rejects.toThrow();expect(requests).toHaveLength(1);});
it("impact reads the whole population despite a small server response cap, including invalid answers", async () => {
 const {db, requests} = client(url => {const offset=Number(url.searchParams.get("offset")??0); return response([{user_id: version(offset+1).id, answers: offset === 1 ? null : answers}], 3);});
 const rows = await listAdminImpactProfiles(db); expect(rows).toHaveLength(3);expect(rows[1].answers).toBeNull();
 expect(requests.every(r => r.method === "GET" && r.url.pathname.endsWith("profiles") && r.url.searchParams.get("select") === "user_id,answers" && !r.url.searchParams.has("user_id"))).toBe(true);
});
it("current history is complete despite response cap", async () => {const {db} = client(url => response([version(Number(url.searchParams.get("offset")??0)+1)], 3));expect(await listRuleVersions(db)).toHaveLength(3);});
it("stored rule identity is looked up explicitly, never inferred from prose or URLs", async () => {
 const {db, requests} = client(url => response(url.pathname.includes("rpc") ? [{slug: "old-version-slug", content: "spoof"}] : [{slug: "old-version-slug", rule_id: version(1).rule_id}]));
 expect(await matchKbRuleHints(db,"[0,1]")).toEqual([{slug: "old-version-slug", rule_id: version(1).rule_id}]); expect(requests[1].url.searchParams.get("select")).toBe("slug,rule_id");
});
it("insert-once materialization never overwrites a concurrent student's row", async () => {
 const {db, requests} = client(() => response(null));
 await upsertGeneratedTasks(db, [{user_id: version(1).id, task_key: "rule:key:step:1", title: "New", due_date: null, verbatim_due: null, sort_order: 1, source_url: null, source_verified_at: null, application_id: null, generated_active: true, course_task_definition_id: null, admin_snapshot: null}]);
 expect(requests).toHaveLength(1); expect(requests[0].prefer).toContain("resolution=ignore-duplicates");
});

it("share query projects only public payload even if an unexpected response carries account data", async () => {
 const {db} = client(() => response([{id: version(1).id, answers, result: {}, created_at: context.evaluatedAt, assessment_metadata: null, claimed_by: version(2).id, owner_token_hash: "private"}]));
 const shared = await getCheck(db, version(1).id); expect(shared).not.toHaveProperty("claimed_by"); expect(shared).not.toHaveProperty("owner_token_hash");
});
