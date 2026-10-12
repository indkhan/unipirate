import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ view: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ db: {}, user: { id: "student", app_metadata: {} } }) }));
vi.mock("@/lib/db/queries", () => ({ countTodayAssistantQuestions: async () => 0, hasGeneratedTasksMissingMetadata: async () => true }));
vi.mock("@/lib/tasks/materialize", () => ({materializeAllTasksForUser: mocks.materialize}));
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

function containsText(node: ReactNode, text: string): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (typeof node === "string" || typeof node === "number") return String(node).includes(text);
  if (Array.isArray(node)) return node.some((child) => containsText(child, text));
  if (isValidElement<{ children?: ReactNode }>(node)) return containsText(node.props.children, text);
  return false;
}

describe("dashboard refresh", () => {
  it("refreshes task cards when only notes, sources or admin state change", async () => {
    const task = { id: "task", title: "Reminder", done: false, dueDate: null, description: "First note", source: null, adminChangeState: "current" };
    const view = { buckets: { now: [task], next: [], later: [] }, doneTasks: [], rail: [], calendarEvents: [], hasProfile: false, result: null, checkedAt: "2026-10-05" };
    mocks.view.mockResolvedValue(view);
    const original = viewKey(await DashboardPage());
    expect(mocks.materialize).not.toHaveBeenCalled();
    for (const change of [{ description: "Second note" }, { source: { url: "https://example.com" } }, { adminChangeState: "update_pending" }]) {
      mocks.view.mockResolvedValue({ ...view, buckets: { ...view.buckets, now: [{ ...task, ...change }] } });
      expect(viewKey(await DashboardPage())).not.toBe(original);
    }
  });

  it("confirms a fresh save and shows the persisted review state on the card", async () => {
    const rail = [{ id: "application", status: "planning", courseId: "course", courseName: "Course", universityName: "University", detail: "", sourceUrl: "https://example.invalid/course", nextDeadline: { iso: null, verbatim: null }, reviewStatus: "pending", researchStatus: "incomplete" }];
    mocks.view.mockResolvedValue({ buckets: { now: [], next: [], later: [] }, doneTasks: [], rail, calendarEvents: [], hasProfile: true, result: null, checkedAt: "2026-10-05" });
    const saved = await DashboardPage({ searchParams: Promise.resolve({ saved: "1" }) });
    expect(containsText(saved, "Course saved")).toBe(true);
    expect(containsText(saved, "research incomplete")).toBe(true);
    const plain = await DashboardPage({});
    expect(containsText(plain, "Course saved")).toBe(false);
  });
});
