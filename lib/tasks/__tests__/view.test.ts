import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(), getPublishedRules: vi.fn(), listApplicationsWithCourses: vi.fn(), listTasks: vi.fn(),
}));
vi.mock("@/lib/db/queries", () => mocks);

import { buildDashboardView } from "../view";

const task = {
  id: "task", task_key: "app:application:course-task:definition", title: "Submit application",
  application_id: "application", course_task_definition_id: "definition", done: false,
  due_date: "2026-10-15", verbatim_due: "15 October 2026", preferred_bucket: null,
  sort_order: 30, source_url: null, description: null, admin_change_state: "current", admin_snapshot: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getProfile.mockResolvedValue(null);
  mocks.listTasks.mockResolvedValue([task]);
});

describe("application task visibility", () => {
  it.each(["applied", "admitted", "rejected"])("hides pending preparation tasks for %s applications", async (status) => {
    mocks.listApplicationsWithCourses.mockResolvedValue([{ id: "application", status, courses: null }]);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect([...view.buckets.now, ...view.buckets.next, ...view.buckets.later]).toEqual([]);
    expect(view.calendarEvents).toEqual([]);
    expect(view.nextDeadline).toBeNull();
  });
  it("preserves completed work and manual reminders on submitted applications", async () => {
    mocks.listApplicationsWithCourses.mockResolvedValue([{ id: "application", status: "applied", courses: null }]);
    mocks.listTasks.mockResolvedValue([
      { ...task, done: true },
      { ...task, id: "manual", task_key: null, course_task_definition_id: null },
    ]);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect(view.doneTasks.map((task) => task.id)).toEqual(["task"]);
    expect(view.buckets.now.map((task) => task.id)).toEqual(["manual"]);
  });
  it("shows preparation tasks again when the application returns to planning", async () => {
    mocks.listApplicationsWithCourses.mockResolvedValue([{ id: "application", status: "planning", courses: null }]);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect(view.buckets.now.map((task) => task.id)).toEqual(["task"]);
  });
});
