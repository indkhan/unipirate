// Real caller-scoped DB/RLS; only the Next cookie/client transport is replaced.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { DAAD_PAGE_TEXT } from "@/lib/courses/__tests__/fixtures";
import { ResearchDraftSchema } from "@/lib/courses/research";
import { normalizeUrl } from "@/lib/courses/import";
import { planningLocalConfig } from "@/lib/db/__tests__/planning-local-config";
import type { Database } from "@/lib/db/database.types";
const transport = vi.hoisted(() => ({ db: null as SupabaseClient<Database> | null }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => transport.db }));
import { POST } from "../route";
const config = planningLocalConfig(process.env.PLANNING_LOCAL_API, process.env.PLANNING_LOCAL_PUBLIC_KEY, process.env.PLANNING_LOCAL_SERVICE_KEY);
function must<T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> {
  expect(result.error?.message ?? null).toBeNull(); expect(result.data).not.toBeNull(); return result.data as NonNullable<T["data"]>;
}
const request = (body: unknown) => new Request("http://localhost/api/courses/import", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
describe.skipIf(!config.enabled)("DAAD import real disposable database", () => {
  it("preserves source/IDs/edits, deduplicates retry, keeps updates pending and isolates two users", async () => {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const service = createClient<Database>(config.api!, config.serviceKey!, options);
    const owner = createClient<Database>(config.api!, config.publicKey!, options);
    const other = createClient<Database>(config.api!, config.publicKey!, options);
    const users: string[] = [], courses: string[] = [];
    const numericId = String(Date.now());
    const url = `https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/${numericId}/?utm_source=fixture#overview`;
    const text = ` \n${DAAD_PAGE_TEXT}\n `;
    try {
      for (const client of [owner, other]) {
        const email = `issue57-${randomUUID()}@example.invalid`, password = randomUUID() + "Aa1!";
        users.push(must(await service.auth.admin.createUser({ email, password, email_confirm: true })).user!.id);
        expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
      }
      transport.db = owner;
      for (const body of [{ url, text: "x".repeat(200) }, { url, text: `${text}\nOther course\nOther University • Berlin` }, { url: "https://daad.de.evil.example/course", text }]) {
        expect([400, 422]).toContain((await POST(request(body))).status);
      }
      expect(must(await service.from("courses").select("id").eq("imported_by", users[0]))).toHaveLength(0);
      const saved = await POST(request({ url, text })); expect(saved.status).toBe(201);
      const receipt = await saved.json(); courses.push(receipt.course.id);
      expect(receipt.researchQueued).toBe(true);
      const stored = must(await owner.from("courses").select("*").eq("id", receipt.course.id).single());
      expect(stored.source_url).toBe(url); expect(stored.normalized_url).toBe(normalizeUrl(url));
      expect(stored.name).toBe("Computer Science – Master of Science"); expect(stored.university_name).toBe("Leibniz University Hannover");
      expect(stored.review_status).toBe("pending"); expect(stored.deadlines).toEqual([]); expect(stored.tuition).toBeNull();
      const draft = ResearchDraftSchema.parse((stored.field_extraction as { research: unknown }).research);
      expect(draft.paste).toBe(text); expect(draft.identity.source_url).toBe(url);
      const app = must(await owner.from("applications").select("*").eq("id", receipt.applicationId).single());
      expect(app).toMatchObject({ user_id: users[0], course_id: stored.id });
      const task = must(await owner.from("tasks").insert({ user_id: users[0], application_id: app.id, title: "Personal edited reminder", done: true, task_key: null }).select("*").single());
      // Own fixture only: reproduce a saved import with no durable research job.
      expect((await service.from("planning_jobs").delete().eq("application_id", app.id).eq("event", "research")).error).toBeNull();
      const retry = await POST(request({ url, text })); expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ course: { id: stored.id }, applicationId: app.id, deduped: true, researchQueued: true, researchState: "queued" });
      expect(must(await owner.from("tasks").select("*").eq("id", task.id).single())).toEqual(task);
      expect(must(await owner.from("applications").select("id").eq("course_id", stored.id))).toHaveLength(1);
      expect(must(await owner.from("planning_jobs").select("id").eq("application_id", app.id).eq("event", "research"))).toHaveLength(1);
      const update = await POST(request({ url, text, conflictsWith: stored.id })); expect(update.status).toBe(201);
      const updateReceipt = await update.json(); courses.push(updateReceipt.course.id);
      expect(updateReceipt.course.conflicts_with).toBe(stored.id);
      expect(must(await owner.from("tasks").select("*").eq("id", task.id).single())).toEqual(task);
      transport.db = other;
      expect(must(await other.from("courses").select("id").eq("id", stored.id))).toEqual([]);
      expect(must(await other.from("applications").select("id").eq("id", app.id))).toEqual([]);
      expect(must(await other.from("tasks").select("id").eq("id", task.id))).toEqual([]);
      expect((await POST(request({ url, text, conflictsWith: stored.id }))).status).toBe(404);
      expect((await POST(request({ url, text }))).status).toBe(409);
      expect(must(await other.from("applications").select("id").eq("user_id", users[1]))).toEqual([]);
      const legacyUrl = `https://example.edu/issue57-${randomUUID()}`;
      const legacy = must(await service.from("courses").insert({ imported_by: users[0], source_url: legacyUrl, normalized_url: legacyUrl, review_status: "approved", name: "Synthetic saved legacy course", university_name: "Synthetic University" }).select("*").single()); courses.push(legacy.id);
      const existing = await POST(request({ url: legacyUrl, text })); expect(existing.status).toBe(200);
      const existingReceipt = await existing.json(); expect(existingReceipt.course.id).toBe(legacy.id);
      expect(must(await other.from("applications").select("*").eq("id", existingReceipt.applicationId).single()).user_id).toBe(users[1]);
      expect((await POST(request({ url: legacyUrl }))).status).toBe(200);
    } finally {
      transport.db = null;
      for (const user of users) expect((await service.auth.admin.deleteUser(user)).error).toBeNull();
      for (const id of [...courses].reverse()) expect((await service.from("courses").delete().eq("id", id)).error).toBeNull();
    }
  }, 30_000);
});
