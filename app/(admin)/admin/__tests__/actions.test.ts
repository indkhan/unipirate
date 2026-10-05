import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: async () => ({ db: {} }) }));
vi.mock("@/lib/db/admin-queries", () => ({ getAdminCourse: async () => ({ id: "11111111-1111-4111-8111-111111111111", review_status: "approved" }), updateAdminCourseTaskDefinition: mocks.update, syncAdminCourseTaskDefinitions: mocks.sync }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));

import { saveCourseTaskAction } from "../actions";

beforeEach(() => vi.clearAllMocks());
it.each(["none", "source_deadline"])("clears the old fixed date when changing to %s", async (mode) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id: "22222222-2222-4222-8222-222222222222", course_id: "11111111-1111-4111-8111-111111111111", kind: "custom", title_template: "Reminder", due_mode: mode, due_date: "2026-10-15", sort_order: "30" })) form.set(key, value);
  await expect(saveCourseTaskAction(form)).rejects.toThrow("redirect");
  expect(mocks.update).toHaveBeenCalledWith(expect.anything(), expect.any(String), expect.objectContaining({ due_mode: mode, due_date: null }));
});
