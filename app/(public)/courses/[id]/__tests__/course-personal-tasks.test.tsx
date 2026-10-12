// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DashboardTask } from "@/lib/tasks/view";

const mocks = vi.hoisted(() => ({ createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), toggleTask: vi.fn(), addCourseToDashboard: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/dashboard/actions", () => mocks);
vi.mock("@/app/(app)/courses/actions", () => mocks);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
import { CoursePersonalTasks } from "../course-personal-tasks";

const courseId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const task: DashboardTask = { id: "33333333-3333-4333-8333-333333333333", key: "manual:task", kind: "manual", title: "Saved reminder", description: "Student notes", done: false, dueDate: null, verbatimDue: null, applicationId, source: null, scope: "university", order: 25, preferredBucket: null, adminChangeState: "current", adminSnapshot: null };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  for (const action of [mocks.createTask, mocks.updateTask, mocks.deleteTask, mocks.toggleTask, mocks.addCourseToDashboard]) action.mockResolvedValue(undefined);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); });
async function render(app: string | null = applicationId, tasks: DashboardTask[] = []) {
  await act(() => root.render(<CoursePersonalTasks courseId={courseId} applicationId={app} tasks={tasks} signedIn />));
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(b => b.getAttribute("aria-label") === label || b.textContent === label)!;
  expect(button).toBeTruthy(); await act(async () => { button.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
}
async function submit(title: string) {
  const input = container.querySelector<HTMLInputElement>('input[name="title"]')!; input.value = title;
  await act(() => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

it.each([
  { verbatimDue: "Applications must arrive by 15 July 2027 at 12:00 noon (local time).", dueDate: "2027-07-15" },
  { verbatimDue: "Applications must arrive by 15 July 2027 at 12:00 noon (local time).", dueDate: null },
  { verbatimDue: null, dueDate: "2027-07-15" },
])("preserves literal wording independently of parsed date with an unverified source ($dueDate, $verbatimDue)", async ({ verbatimDue, dueDate }) => {
  await render(applicationId, [{ ...task, dueDate, verbatimDue, source: { url: "https://example.invalid/personal", verifiedAt: null } }]);
  expect(container.querySelector("article")!.textContent).toContain(verbatimDue ?? `Personal reminder date: ${dueDate}`);
  if (verbatimDue) expect(container.querySelector("article")!.textContent).not.toContain("2027-07-15");
  expect(container.querySelector("article a")!.textContent).toBe("Personal source · unverified");
});

it("keeps creation locked after tracking failure and until the saved application arrives", async () => {
  mocks.addCourseToDashboard.mockRejectedValueOnce(new Error("Tracking failed"));
  await render(null); await click("Add course to dashboard");
  expect(container.textContent).toContain("Tracking failed");
  expect(container.querySelector('input[name="title"]')).toBeNull();
  await click("Add course to dashboard");
  expect(mocks.addCourseToDashboard).toHaveBeenCalledWith(courseId);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(container.querySelector('input[name="title"]')).toBeNull();
  await render();
  expect(container.querySelector('input[name="title"]')).toBeTruthy();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("creates directly for the owned application; retries retain intent ID, changed content and new tasks get new IDs", async () => {
  mocks.createTask.mockRejectedValueOnce(new Error("Receipt not confirmed"));
  await render(); await submit("Prepare documents");
  expect(container.textContent).toContain("Receipt not confirmed");
  const first = mocks.createTask.mock.calls[0][0];
  expect(first).toMatchObject({ title: "Prepare documents", applicationId });
  await submit("Prepare documents");
  expect(mocks.createTask.mock.calls[1][0].operationId).toBe(first.operationId);
  await submit("Prepare documents");
  expect(mocks.createTask.mock.calls[2][0].operationId).not.toBe(first.operationId);
  mocks.createTask.mockRejectedValueOnce(new Error("Retry"));
  await submit("Another reminder");
  const failed = mocks.createTask.mock.calls[3][0];
  await submit("Changed reminder");
  expect(mocks.createTask.mock.calls[4][0].operationId).not.toBe(failed.operationId);
  expect(mocks.addCourseToDashboard).not.toHaveBeenCalled();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("edits, completes, undoes and deletes the same saved row through shared dashboard actions", async () => {
  await render(applicationId, [task]); await click("Edit task");
  const dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog).toBeTruthy();
  const title = dialog.querySelector<HTMLInputElement>('input[aria-label="Task title"]')!;
  // Use React's native input setter so the controlled edit state receives the event.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "My edited reminder");
  await act(() => title.dispatchEvent(new Event("input", { bubbles: true })));
  await act(async () => { dialog.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(mocks.updateTask).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, applicationId, title: "My edited reminder" }));
  await click("Mark task done");
  expect(mocks.toggleTask).toHaveBeenLastCalledWith({ id: task.id, done: true });
  await render(applicationId, [{ ...task, done: true }]);
  const disclosure = container.querySelector("details")!;
  expect(disclosure.open).toBe(false);
  await click("Mark task not done");
  expect(mocks.toggleTask).toHaveBeenLastCalledWith({ id: task.id, done: false });
  await click("Delete task"); expect(mocks.deleteTask).toHaveBeenCalledWith({ id: task.id });
});
