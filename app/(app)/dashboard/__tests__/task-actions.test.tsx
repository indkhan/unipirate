import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DashboardTask } from "@/lib/tasks/view";

import { TaskActions } from "../manual-task";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  resolveCourseTaskUpdate: vi.fn(),
  toggleTask: vi.fn(),
  updateCourseTask: vi.fn(),
  updateTask: vi.fn(),
}));

function task(overrides: Partial<DashboardTask>): DashboardTask {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    key: "manual-key",
    kind: "manual",
    title: "Manual task",
    description: null,
    done: false,
    dueDate: null,
    verbatimDue: null,
    order: 0,
    preferredBucket: null,
    applicationId: null,
    source: null,
    scope: "global",
    adminChangeState: "current",
    adminSnapshot: null,
    ...overrides,
  };
}

describe("TaskActions", () => {
  it("renders edit and delete for manual tasks", () => {
    const html = renderToStaticMarkup(
      <TaskActions task={task({ kind: "manual" })} applications={[]} />,
    );

    expect(html).toContain('aria-label="Edit task"');
    expect(html).toContain('aria-label="Delete task"');
  });

  it("renders edit without delete for course tasks", () => {
    const html = renderToStaticMarkup(
      <TaskActions
        task={task({ kind: "course_task", key: "app:1:course-task:1" })}
        applications={[]}
      />,
    );

    expect(html).toContain('aria-label="Edit task"');
    expect(html).not.toContain('aria-label="Delete task"');
  });

  it("renders no controls for generated tasks", () => {
    const html = renderToStaticMarkup(
      <TaskActions
        task={task({ kind: "generated", key: "rule:slug:step:1" })}
        applications={[]}
      />,
    );

    expect(html).toBe("");
  });
});
