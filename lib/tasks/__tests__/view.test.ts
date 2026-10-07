import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(), listRuleVersions: vi.fn(), listApplicationsWithCourses: vi.fn(), listTasks: vi.fn(),
}));
vi.mock("@/lib/db/queries", () => mocks);



import { legacyPublishedAps } from "@/lib/engine/__tests__/aps-legacy-published.fixture";
import { version } from "@/lib/rules/__tests__/assessment-fixtures";
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
  it("hides obsolete pending APS work without rewriting saved edits or completion", async () => {
    mocks.getProfile.mockResolvedValue({ answers: { targetDegree: "bachelor", certificateCountry: "in", nationality: "in", curriculumType: "national", board: "cbse", schoolGradePercent: 82, jeeAdvanced: false, visaApplicationCountry: "sa", targetField: "cs", intake: null } });
    mocks.listRuleVersions.mockResolvedValue(legacyPublishedAps.map((rule, index) => version(index+1, {rule_id: rule.id, raw_snapshot: rule})));
    mocks.listApplicationsWithCourses.mockResolvedValue([]);
    const pending = { ...task, id: "old", task_key: "rule:f5361a7c-bddf-45fd-9c8d-a23e736f16cc:step:10", course_task_definition_id: null, application_id: null, title: "My certificate reminder", has_personal_edits: true };
    const completed = { ...pending, id: "completed", done: true };
    const manual = { ...pending, id: "manual", task_key: null };
    const course = {...task, id: "course", title: "My APS course reminder", has_personal_edits: true};
    mocks.listApplicationsWithCourses.mockResolvedValue([{id: "application", status: "planning", courses: null}]);
    const rows = [pending, completed, manual, course];
    const snapshot = structuredClone(rows);
    mocks.listTasks.mockResolvedValue(rows);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect([...view.buckets.now, ...view.buckets.next, ...view.buckets.later].map(t => t.id)).toEqual(["manual", "course"]);
    expect(view.doneTasks.map(t => t.id)).toEqual(["completed"]);
    expect(rows[0].title).toBe("My certificate reminder");
    expect(rows).toEqual(snapshot);
    expect(rows[0].done).toBe(false);
  });
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
    expect(view.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
