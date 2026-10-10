import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Explicit disposable gate: never fall back to the project's linked credentials.
const url = process.env.AI_TASK_LOCAL_URL;
const key = process.env.AI_TASK_LOCAL_ANON_KEY;
const secret = process.env.AI_TASK_LOCAL_SERVICE_KEY;
if (url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || !["54321","55321","56321"].includes(parsed.port)) {
    throw new Error("AI task integration tests require a dedicated disposable loopback instance");
  }
}

describe.skipIf(!url && !key && !secret)("personal task disposable database", () => {
  let service: SupabaseClient;
  let owner: SupabaseClient;
  let other: SupabaseClient;
  let admin: SupabaseClient;
  const users: string[] = [];
  const definitions: string[] = [];
  let foreignApplication: string;
  let ownApplication: string;
  let courseId: string;
  const task = { title: "My reminder", description: "Personal plan", dueDate: "2028-02-29", sourceUrl: "https://example.com/source", applicationId: null };
  const rpc = (client: SupabaseClient, id = randomUUID(), instruction = "Remind me", payload: unknown = task) => client.rpc("create_personal_task", { p_operation_id: id, p_instruction: instruction, p_task: payload });

  beforeAll(async () => {
    if (!url || !key || !secret) throw new Error("Supply all AI_TASK_LOCAL_* credentials");
    service = createClient(url, secret, { auth: { persistSession: false } });
    async function user(isAdmin = false) {
      const email = `ai60-${randomUUID()}@example.com`;
      const password = randomUUID();
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: isAdmin ? { role: "admin" } : {} });
      if (created.error) throw created.error;
      users.push(created.data.user.id);
      const client = createClient(url!, key!, { auth: { persistSession: false } });
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
      return client;
    }
    owner = await user(); other = await user(); admin = await user(true);
    const course = await service.from("courses").insert({ source_url: "https://example.com", normalized_url: `ai60-${randomUUID()}` }).select("id").single();
    if (course.error) throw course.error;
    courseId = course.data.id;
    for (const [index, client] of [owner, other].entries()) {
      const app = await client.from("applications").insert({ user_id: users[index], course_id: courseId }).select("id").single();
      if (app.error) throw app.error;
      if (index === 0) ownApplication = app.data.id; else foreignApplication = app.data.id;
    }
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
    if (definitions.length) expect((await service.from("admin_audit_events").delete().in("row_id", definitions).is("rule_publication", null)).error).toBeNull();
    if (courseId) expect((await service.from("courses").delete().eq("id", courseId)).error).toBeNull();
  });

  it("serializes concurrent retries and preserves deleted receipts", async () => {
    const id = randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => rpc(owner, id)));
    for (const result of responses) expect(result.error).toBeNull();
    expect(responses.filter(result => result.data.status === "created")).toHaveLength(1);
    const receipt = responses[0].data.task;
    expect(new Set(responses.map(result => result.data.task.id)).size).toBe(1);
    expect((await owner.from("tasks").select("id,task_key").eq("id", receipt.id)).data).toEqual([{ id: receipt.id, task_key: null }]);
    expect((await rpc(owner, id, "Different command")).error).not.toBeNull();
    expect((await rpc(owner, id, "Remind me", { ...task, title: "Different" })).error).not.toBeNull();
    expect((await owner.from("tasks").delete().eq("id", receipt.id)).error).toBeNull();
    expect((await rpc(owner, id)).data).toEqual({ status: "already_exists", task: receipt });
    expect((await owner.from("tasks").select("id").eq("id", receipt.id)).data).toEqual([]);
  });

  it("allows distinct commands with identical titles and owned applications", async () => {
    const a = await rpc(owner); const b = await rpc(owner);
    expect(a.error).toBeNull(); expect(b.error).toBeNull();
    expect(a.data.task.id).not.toBe(b.data.task.id);
    expect((await rpc(owner, randomUUID(), "Remind me", { ...task, applicationId: ownApplication })).error).toBeNull();
  });

  it("denies foreign links, forged ledger writes and admin private reads", async () => {
    expect((await rpc(owner, randomUUID(), "Remind me", { ...task, applicationId: foreignApplication })).error).not.toBeNull();
    expect((await owner.from("tasks").insert({ user_id: users[0], title: "Forged", application_id: foreignApplication })).error).not.toBeNull();
    const created = await rpc(owner);
    expect(created.error).toBeNull();
    const definition = await admin.from("course_task_definitions").insert({ course_id: courseId, kind: "custom", title_template: "Shared template", due_mode: "none" }).select("id").single();
    expect(definition.error).toBeNull();
    definitions.push(definition.data!.id);
    const generated = await service.from("tasks").insert({ user_id: users[0], application_id: ownApplication,
      course_task_definition_id: definition.data!.id, task_key: `app:${ownApplication}:course-task:${definition.data!.id}`,
      title: "Private edited title", description: "Private student edit", has_personal_edits: true, done: true }).select("id").single();
    expect(generated.error).toBeNull();
    expect((await admin.from("course_task_definitions").select("id").eq("id", definition.data!.id)).data).toHaveLength(1);
    expect((await owner.from("tasks").update({ application_id: foreignApplication }).eq("id", created.data.task.id)).error).not.toBeNull();
    expect((await owner.from("personal_task_operations").insert({ user_id: users[0], operation_id: randomUUID(), instruction: "forged", request_task: task, task_receipt: created.data.task })).error).not.toBeNull();
    expect((await owner.from("personal_task_operations").update({ instruction: "forged" }).eq("user_id", users[0])).error).not.toBeNull();
    expect((await owner.from("personal_task_operations").delete().eq("user_id", users[0])).error).not.toBeNull();
    for (const client of [other, admin]) {
      expect((await client.from("tasks").select("id").eq("user_id", users[0])).data).toEqual([]);
      expect((await client.from("personal_task_operations").select("operation_id").eq("user_id", users[0])).data).toEqual([]);
    }
    expect((await admin.from("tasks").select("title,description,done").eq("id", generated.data!.id)).data).toEqual([]);
    expect((await owner.from("personal_task_operations").select("operation_id")).data?.length).toBeGreaterThan(0);
  });

  it("rejects malformed SQL boundary inputs", async () => {
    for (const payload of [null, [], {}, { ...task, title: " " }, { ...task, title: "x".repeat(241) }, { ...task, description: "x".repeat(2001) }, { ...task, dueDate: "2027-02-29" }, { ...task, dueDate: "2028-2-29" }, { ...task, sourceUrl: "javascript:alert(1)" }, { ...task, sourceUrl: "https://" }, { ...task, applicationId: 123 }, { ...task, extra: true }, { ...task, dueDate: 123 }]) {
      expect((await rpc(owner, randomUUID(), "Remind me", payload)).error).not.toBeNull();
    }
    expect((await rpc(owner, randomUUID(), " ")).error).not.toBeNull();
    expect((await rpc(owner, randomUUID(), "x".repeat(20001))).error).not.toBeNull();
    expect((await rpc(createClient(url!, key!), randomUUID())).error).not.toBeNull();
  });
});

