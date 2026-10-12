import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/db/database.types";

const session = vi.hoisted(() => ({ db: null as SupabaseClient<Database> | null, user: null as User | null }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ db: session.db!, user: session.user! }) }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => session.db! }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("Not found"); } }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

import CoursePage from "@/app/(public)/courses/[id]/page";
import { createTask, updateTask, toggleTask, deleteTask, setApplicationStatus } from "@/app/(app)/dashboard/actions";
import { addCourseToDashboard } from "@/app/(app)/courses/actions";
import { approveTaskProposals, ensureApplication, listApplications, listTasks, insertTask } from "@/lib/db/queries";
import { createPersonalTask } from "../personal";
import { buildDashboardView, coursePersonalTasks } from "../view";

const api = process.env.AI_TASK_LOCAL_URL;
const publicKey = process.env.AI_TASK_LOCAL_ANON_KEY;
const secret = process.env.AI_TASK_LOCAL_SERVICE_KEY;
if (api) {
  const parsed = new URL(api);
  if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || !["54321", "55321", "56321"].includes(parsed.port))
    throw new Error("#59 requires a dedicated disposable loopback instance");
}

describe.skipIf(!api && !publicKey && !secret)("course/dashboard personal tasks (actual local DB, RLS and action writes)", () => {
  let service: SupabaseClient<Database>;
  const clients: SupabaseClient<Database>[] = [];
  const users: User[] = [];
  const courses: string[] = [];
  let applicationId: string;
  let otherApplicationId: string;
  let unrelatedApplicationId: string;
  const input = { title: "Synthetic personal reminder", description: "Private student notes", sourceUrl: "https://example.invalid/personal", dueDate: "2028-02-29", applicationId: null as string | null };
  const activate = (index: number) => { session.db = clients[index]; session.user = users[index]; };
  const html = async () => renderToStaticMarkup(await CoursePage({ params: Promise.resolve({ id: courses[0] }) }));
  async function surfaces() {
    const view = await buildDashboardView(session.db!, session.user!.id);
    return { dashboard: [...view.buckets.now, ...view.buckets.next, ...view.buckets.later, ...view.doneTasks], course: coursePersonalTasks(await listTasks(session.db!, session.user!.id), session.user!.id, applicationId) };
  }
  beforeAll(async () => {
    if (!api || !publicKey || !secret) throw new Error("Supply all AI_TASK_LOCAL_* credentials");
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    service = createClient<Database>(api, secret, options);
    expect((await service.from("planning_settings").select("enabled").eq("id", true).single()).data?.enabled).toBe(false);
    for (const role of ["student", "student", "admin"]) {
      const email = `issue59-${randomUUID()}@example.invalid`, password = randomUUID() + "Aa1!";
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
      expect(created.error).toBeNull(); users.push(created.data.user!);
      const client = createClient<Database>(api, publicKey, options);
      expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull(); clients.push(client);
    }
    for (let index = 0; index < 2; index++) {
      const url = `https://example.invalid/SYNTHETIC-issue59-${randomUUID()}`;
      const created = await service.from("courses").insert({ source_url: url, normalized_url: url, name: `Synthetic #59 course ${index}`, university_name: "Synthetic local university", review_status: "approved" }).select("id").single();
      expect(created.error).toBeNull(); courses.push(created.data!.id);
    }
    activate(0);
    expect(await html()).toContain("Add course to dashboard");
    await addCourseToDashboard(courses[0]);
    applicationId = (await listApplications(clients[0], users[0].id)).find(a => a.course_id === courses[0])!.id;
    otherApplicationId = (await ensureApplication(clients[1], users[1].id, courses[0])).id;
    unrelatedApplicationId = (await ensureApplication(clients[0], users[0].id, courses[1])).id;
    expect(await html()).not.toContain("Add course to dashboard");
  }, 120_000);
  afterAll(async () => {
    if (!service) return;
    for (const user of users) expect((await service.auth.admin.deleteUser(user.id)).error).toBeNull();
    for (const course of courses) expect((await service.from("courses").delete().eq("id", course)).error).toBeNull();
  }, 120_000);

  it("preserves the same row through create/edit/complete/undo/delete/reload in every application status", async () => {
    activate(0);
    const general = await insertTask(clients[0], { user_id: users[0].id, title: "General untouched", task_key: null });
    const unrelated = await insertTask(clients[0], { user_id: users[0].id, application_id: unrelatedApplicationId, title: "Other course untouched", task_key: null });
    for (const status of ["planning", "applied", "admitted", "rejected"] as const) {
      await setApplicationStatus({ id: applicationId, status });
      const payload = { ...input, applicationId, title: `${input.title} ${status}` }, operationId = randomUUID();
      await createTask({ ...payload, operationId }); await createTask({ ...payload, operationId });
      const initial = await surfaces();
      const saved = initial.course.find(t => t.title === payload.title)!;
      expect(initial.course.filter(t => t.title === payload.title)).toHaveLength(1);
      expect(saved).toMatchObject({ kind: "manual", source: { url: input.sourceUrl, verifiedAt: null } });
      expect(initial.dashboard.find(t => t.id === saved.id)).toEqual(saved);
      await updateTask({ ...payload, id: saved.id, title: `Edited ${status}` });
      await toggleTask({ id: saved.id, done: true });
      const completed = await surfaces();
      expect(completed.course.find(t => t.id === saved.id)).toMatchObject({ title: `Edited ${status}`, done: true });
      expect(completed.dashboard.find(t => t.id === saved.id)).toEqual(completed.course.find(t => t.id === saved.id));
      expect(await html()).toContain("Completed (1)");
      await toggleTask({ id: saved.id, done: false });
      expect((await surfaces()).course.find(t => t.id === saved.id)?.done).toBe(false);
      await deleteTask({ id: saved.id });
      const deleted = await surfaces();
      expect(deleted.course.find(t => t.id === saved.id)).toBeUndefined();
      expect(deleted.dashboard.find(t => t.id === saved.id)).toBeUndefined();
      expect(await html()).not.toContain(`Edited ${status}`);
    }
    const rows = await listTasks(clients[0], users[0].id);
    expect(rows.find(t => t.id === general.id)).toEqual(general);
    expect(rows.find(t => t.id === unrelated.id)).toEqual(unrelated);
    expect(await html()).not.toContain("General untouched");
    expect(await html()).not.toContain("Other course untouched");
  }, 60_000);

  it("shared explicit-chat receipts use the same visibility; two accounts and admin cannot read or forge personal links", async () => {
    activate(0);
    const receipt = await createPersonalTask(clients[0], users[0].id, { ...input, applicationId, title: "Synthetic explicit chat reminder" }, { operationId: randomUUID(), instruction: "Create a task Synthetic explicit chat reminder" });
    expect(receipt.status).toBe("created");
    if (receipt.status === "failed") throw new Error(receipt.error);
    const rows = await surfaces();
    expect(rows.course.find(t => t.id === receipt.task.id)).toEqual(rows.dashboard.find(t => t.id === receipt.task.id));
    expect(await html()).toContain("Synthetic explicit chat reminder");
    await expect(createTask({ ...input, applicationId: otherApplicationId, operationId: randomUUID() })).rejects.toThrow("Application not found");
    expect((await clients[0].from("tasks").insert({ user_id: users[0].id, application_id: otherApplicationId, title: "Forged association" })).error).not.toBeNull();
    expect((await clients[0].from("tasks").update({ application_id: otherApplicationId }).eq("id", receipt.task.id)).error).not.toBeNull();
    for (const index of [1, 2]) {
      expect((await clients[index].from("tasks").select("id").eq("id", receipt.task.id)).data).toEqual([]);
      activate(index); expect(await html()).not.toContain("Synthetic explicit chat reminder");
    }
    expect((await service.from("planning_settings").select("enabled").eq("id", true).single()).data?.enabled).toBe(false);
  }, 60_000);

  it("an existing proposal becomes a visible manual row only after actual student approval, without inference or rollout changes", async () => {
    activate(0);
    await setApplicationStatus({ id: applicationId, status: "planning" });
    const fingerprint = await clients[0].rpc("get_planning_context_fingerprint", { p_application_id: applicationId });
    expect(fingerprint.error).toBeNull();
    // Seed only this isolated persisted suggestion; exercise the real owner approval RPC.
    const suggestion = await service.from("task_proposals").insert({ user_id: users[0].id, application_id: applicationId, course_id: courses[0], semantic_action_key: `synthetic:${randomUUID()}`, stage: "preliminary", title: "Synthetic approved planning reminder", reason: "Synthetic persisted preparation suggestion; no official claim", input_fingerprint: fingerprint.data!, material_fingerprint: "f".repeat(64) }).select("id,revision").single();
    expect(suggestion.error).toBeNull();
    expect(await html()).not.toContain("Synthetic approved planning reminder");
    await approveTaskProposals(clients[0], [suggestion.data!]);
    const rows = await surfaces();
    const saved = rows.course.find(t => t.title === "Synthetic approved planning reminder")!;
    expect(saved.kind).toBe("manual");
    expect(rows.dashboard.find(t => t.id === saved.id)).toEqual(saved);
    expect(await html()).toContain(saved.title);
    activate(1); expect(await html()).not.toContain(saved.title);
    expect((await service.from("planning_settings").select("enabled").eq("id", true).single()).data?.enabled).toBe(false);
  }, 60_000);
});
