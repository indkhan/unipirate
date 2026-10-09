import { createClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import type { Database } from "../database.types";
import { syncAdminCourseTaskDefinitions } from "../admin-queries";
import { resolveCourseTaskAssignment } from "../queries";

const worker = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createBackgroundWorker: worker.create }));
const courseId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const definitionId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const taskId = "55555555-5555-4555-8555-555555555555";
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
function client(handle: (path: string, method: string, body: Record<string, unknown> | null) => Response) {
  return createClient<Database>("http://127.0.0.1:56321", "synthetic", { auth: { persistSession: false }, global: { fetch: async (url, init) => handle(new URL(String(url)).pathname, init?.method ?? "GET", init?.body ? JSON.parse(String(init.body)) : null) } });
}
beforeEach(() => vi.resetAllMocks());

it.each([false, null, "true"])("never creates a privileged worker for a caller lacking authenticated admin authority (%j)", async authority => {
  const caller = client(path => {
    expect(path).toBe("/rest/v1/rpc/is_admin");
    return json(authority);
  });
  await expect(syncAdminCourseTaskDefinitions(caller, courseId)).rejects.toThrow("Administrator required");
  expect(worker.create).not.toHaveBeenCalled();
});
it("never creates a privileged worker when the admin authentication RPC fails", async () => {
  const caller = client(() => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }));
  await expect(syncAdminCourseTaskDefinitions(caller, courseId)).rejects.toThrow();
  expect(worker.create).not.toHaveBeenCalled();
});
it("queues approval-first template reconciliation without reading or mutating private copies", async () => {
  const requests: { path: string; body: unknown }[] = [];
  const caller = client((path, _method, body) => {
    requests.push({ path, body });
    if (path.endsWith("is_admin")) return json(true);
    if (path.endsWith("planning_settings")) return json({ enabled: true });
    if (path.endsWith("enqueue_course_template_planning")) return json(null);
    throw new Error(`Unexpected caller I/O ${path}`);
  });
  expect(await syncAdminCourseTaskDefinitions(caller, courseId)).toBeUndefined();
  expect(requests.at(-1)).toEqual({ path: "/rest/v1/rpc/enqueue_course_template_planning", body: { p_course_id: courseId } });
  expect(worker.create).not.toHaveBeenCalled();
});

it.each(["keep", "adopt"] as const)("shared-template sync followed by student %s retains task identity/completion and protects edits until explicit adoption", async resolution => {
  const previous = { title: "Original template", description: "Original description", source_url: "https://example.com/old", due_date: "2028-01-01", verbatim_due: "2028-01-01", sort_order: 30 };
  let task: Record<string, unknown> = { id: taskId, user_id: userId, application_id: applicationId,
    task_key: `app:${applicationId}:course-task:${definitionId}`, course_task_definition_id: definitionId,
    title: "My private title", description: "My private notes", source_url: "https://example.com/private", due_date: "2028-03-03",
    verbatim_due: "My date", sort_order: 30, source_verified_at: null, done: true,
    has_personal_edits: true, generated_active: true, admin_change_state: "current", admin_snapshot: previous };
  const serviceRequests: string[] = [];
  const definition = { id: definitionId, course_id: courseId, kind: "custom", source_key: null,
    title_template: "New shared task for {{course}}", description: "New shared description", source_url: "https://example.com/new",
    due_mode: "fixed_date", due_date: "2028-07-15", sort_order: 40, source_snapshot: null, retired_at: null };
  worker.create.mockReturnValue(client((path, method, body) => {
    serviceRequests.push(path);
    if (path.endsWith("applications")) return json([{ id: applicationId, user_id: userId, status: "planning", courses: { id: courseId, name: "Course", university_name: "University", review_status: "approved", source_url: "https://example.com", created_at: "2026-01-01T00:00:00Z" } }]);
    if (path.endsWith("profiles")) return json([]);
    if (path.endsWith("course_task_definitions")) return json([definition]);
    if (path.endsWith("tasks")) {
      if (method === "GET") return json([task]);
      expect(method).toBe("PATCH");
      task = { ...task, ...body }; return json(null);
    }
    throw new Error(`Unexpected service I/O ${path}`);
  }));
  const callerPaths: string[] = [];
  const caller = client(path => {
    callerPaths.push(path);
    if (path.endsWith("is_admin")) return json(true);
    if (path.endsWith("planning_settings")) return json({ enabled: false });
    throw new Error(`Admin requested private data ${path}`);
  });
  expect(await syncAdminCourseTaskDefinitions(caller, courseId)).toBeUndefined();
  expect(callerPaths).toEqual(["/rest/v1/rpc/is_admin", "/rest/v1/planning_settings"]);
  expect(serviceRequests).toContain("/rest/v1/tasks");
  expect(task).toMatchObject({ id: taskId, done: true, title: "My private title", description: "My private notes", due_date: "2028-03-03", has_personal_edits: true, admin_change_state: "update_pending" });
  expect(task.admin_snapshot).toMatchObject({ title: "New shared task for University", due_date: "2028-07-15", source_url: "https://example.com/new" });
  const student = client((path, method, body) => {
    expect(path).toBe("/rest/v1/tasks");
    if (method === "GET") return json(task);
    expect(method).toBe("PATCH"); task = { ...task, ...body }; return json(null);
  });
  await resolveCourseTaskAssignment(student, userId, taskId, resolution);
  expect(task).toMatchObject({ id: taskId, done: true, admin_change_state: "current" });
  expect(task).toMatchObject(resolution === "keep"
    ? { title: "My private title", description: "My private notes", due_date: "2028-03-03", has_personal_edits: true }
    : { title: "New shared task for University", description: "New shared description", due_date: "2028-07-15", has_personal_edits: false });
});
