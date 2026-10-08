import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), rules: vi.fn(), pending: vi.fn(), conflicts: vi.fn(), courses: vi.fn(),
  definitions: vi.fn(), history: vi.fn(), rule: vi.fn(), profiles: vi.fn(), versions: vi.fn(),
  context: vi.fn(), impact: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/db/admin-queries", () => ({
  listAdminRules: mocks.rules, listPendingCourses: mocks.pending, listConflictCourses: mocks.conflicts,
  listAdminCourses: mocks.courses, listAdminCourseTaskDefinitions: mocks.definitions,
  listAdminCourseResearchHistory: mocks.history, getAdminRule: mocks.rule,
  listAdminImpactProfiles: mocks.profiles,
}));
vi.mock("@/lib/db/queries", () => ({ listRuleVersions: mocks.versions }));
vi.mock("@/lib/rules/current", () => ({ currentAssessmentContext: mocks.context }));
vi.mock("@/lib/rules/consumer-impact", () => ({ previewDraftImpact: mocks.impact }));
vi.mock("../course-queue", () => ({ CourseQueue: () => null, ConflictQueue: () => null, CourseTaskLibrary: () => null }));
vi.mock("../rules-panel", () => ({ RuleEditor: () => null, RulesTable: () => null }));
import AdminPage from "../page";
import { CourseQueue, ConflictQueue } from "../course-queue";
import { RuleEditor } from "../rules-panel";

const id = "00000000-0000-4000-8000-000000000001";
const canonicalId = "00000000-0000-4000-8000-000000000002";
const db = { callerScoped: true };
function propsFor(node: ReactNode, component: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(node)) return node.map(child => propsFor(child, component)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === component) return node.props;
  return propsFor(node.props.children, component);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.guard.mockResolvedValue({ db });
  for (const read of [mocks.rules, mocks.pending, mocks.conflicts, mocks.courses, mocks.definitions, mocks.history, mocks.profiles, mocks.versions]) read.mockResolvedValue([]);
});
it.each(["pending", "conflicts"])("retains canonical Course history in the %s selection", async queue => {
  const course = { id, conflicts_with: canonicalId, name: "Synthetic programme", university_name: "Synthetic university" };
  const history = [{ status: "unavailable", id: "synthetic-record" }];
  mocks.pending.mockResolvedValue([course]);
  mocks.conflicts.mockResolvedValue([course]);
  mocks.history.mockResolvedValue(history);
  const tree = await AdminPage({ searchParams: Promise.resolve({ view: "reviews", queue, course: id }) });
  expect(mocks.history).toHaveBeenCalledWith(db, canonicalId);
  const props = propsFor(tree, queue === "pending" ? CourseQueue : ConflictQueue);
  expect(props?.researchHistoryByCourse).toEqual(new Map([[id, history]]));
  expect(mocks.profiles).not.toHaveBeenCalled();
});
it("retains both Rule34 impact choices with caller population and actual context", async () => {
  const draft = { synthetic: "draft" }, population = [{ synthetic: "profile" }], versions = [{ synthetic: "version" }], context = { synthetic: "instant and revision" };
  mocks.rule.mockResolvedValue({ draft }); mocks.profiles.mockResolvedValue(population);
  mocks.versions.mockResolvedValue(versions); mocks.context.mockReturnValue(context);
  mocks.impact.mockReturnValue({ changed: 1 });
  const tree = await AdminPage({ searchParams: Promise.resolve({ view: "rules", rule: id }) });
  expect(mocks.profiles).toHaveBeenCalledWith(db);
  expect(mocks.versions).toHaveBeenCalledWith(db);
  expect(mocks.impact.mock.calls).toEqual([ [population, versions, draft, "beta", context], [population, versions, draft, "verified", context] ]);
  expect(propsFor(tree, RuleEditor)?.impacts).toEqual([{ status: "beta", changed: 1 }, { status: "verified", changed: 1 }]);
  expect(mocks.history).not.toHaveBeenCalled();
});
it("rejects an unauthorized page before either workspace reads", async () => {
  mocks.guard.mockRejectedValue(new Error("admin required"));
  await expect(AdminPage({ searchParams: Promise.resolve({ view: "rules", rule: id }) })).rejects.toThrow("admin required");
  for (const read of [mocks.rules, mocks.pending, mocks.conflicts, mocks.courses, mocks.profiles, mocks.history, mocks.versions]) expect(read).not.toHaveBeenCalled();
});
