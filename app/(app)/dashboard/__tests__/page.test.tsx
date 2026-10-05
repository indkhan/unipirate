import { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ db: {}, user: { id: "student", app_metadata: {} } }) }));
vi.mock("@/lib/db/queries", () => ({ countTodayAssistantQuestions: async () => 0, hasGeneratedTasksMissingMetadata: async () => false }));
vi.mock("@/lib/tasks/view", () => ({ buildDashboardView: mocks.view }));
vi.mock("../dashboard-views", () => ({ DashboardViews: () => null }));

import DashboardPage from "../page";
import { DashboardViews } from "../dashboard-views";

function viewKey(node: ReactNode): string | null {
  if (Array.isArray(node)) return node.map(viewKey).find((key) => key !== null) ?? null;
  if (!node || typeof node !== "object" || !("props" in node)) return null;
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === DashboardViews ? element.key : viewKey(element.props.children);
}

describe("dashboard refresh", () => {
  it("refreshes task cards when only notes, sources or admin state change", async () => {
    const task = { id: "task", title: "Reminder", done: false, dueDate: null, description: "First note", source: null, adminChangeState: "current" };
    const view = { buckets: { now: [task], next: [], later: [] }, doneTasks: [], rail: [], calendarEvents: [], hasProfile: false, result: null, checkedAt: "2026-10-05" };
    mocks.view.mockResolvedValue(view);
    const original = viewKey(await DashboardPage());
    for (const change of [{ description: "Second note" }, { source: { url: "https://example.com" } }, { adminChangeState: "update_pending" }]) {
      mocks.view.mockResolvedValue({ ...view, buckets: { ...view.buckets, now: [{ ...task, ...change }] } });
      expect(viewKey(await DashboardPage())).not.toBe(original);
    }
  });
});
