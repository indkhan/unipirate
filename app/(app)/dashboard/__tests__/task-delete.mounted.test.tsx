// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { DashboardTask } from "@/lib/tasks/view";
import { TaskActions } from "../manual-task";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), remove: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../actions", () => ({ createTask: vi.fn(), deleteTask: mocks.remove, updateTask: vi.fn(), updateCourseTask: vi.fn() }));

it("shows a rejected deletion and permits a successful retry without losing the task", async () => {
 Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
 mocks.remove.mockRejectedValueOnce(new Error("The task could not be deleted.")).mockResolvedValueOnce(undefined);
 const container = document.createElement("div"); document.body.append(container);
 const root = createRoot(container);
 try {
  await act(async () => root.render(<TaskActions task={{ id: "personal", kind: "manual" } as DashboardTask} applications={[]} />));
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete task"]')!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("The task could not be deleted.");
  expect(mocks.refresh).not.toHaveBeenCalled();
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete task"]')!.click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
 } finally { await act(async () => root.unmount()); container.remove(); }
});
