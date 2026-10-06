import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), get: vi.fn(), review: vi.fn(), resolve: vi.fn(), publish: vi.fn(), edit: vi.fn(), saveDraft: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/admin-queries", () => ({ getAdminCourse: mocks.get, updateCourseReviewStatus: mocks.review, resolveCourseConflict: mocks.resolve, publishAdminCourseResearch: mocks.publish, updateAdminCourse: mocks.edit, saveAdminCourseResearchDraft: mocks.saveDraft }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
import { reviewCourseAction, resolveConflictAction, publishCourseResearchAction, updateCourseAction, saveCourseResearchDraftAction } from "../actions";
const id = "11111111-1111-4111-8111-111111111111";
const metadata = { core: "library", research: { format: "up-course-01/v1", status: "incomplete", identity: { name: "Synthetic", university: "Synthetic", source_url: "https://www.daad.de/example" }, observations: [], offerings: [], conflicts: [], issues: [] } };
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
beforeEach(() => { vi.resetAllMocks(); mocks.requireAdmin.mockResolvedValue({ db: {}, user: { id } }); mocks.get.mockResolvedValue({ id, field_extraction: metadata, conflicts_with: null }); });
it("allows an admin to save manual research recovery without publishing or supplying reviewer metadata", async () => {
  await expect(saveCourseResearchDraftAction(form({ id, draft: JSON.stringify(metadata.research) }))).rejects.toThrow("redirect");
  expect(mocks.saveDraft).toHaveBeenCalledWith({}, id, metadata.research);
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("rejects forged manual recovery review metadata before writes", async () => {
  await expect(saveCourseResearchDraftAction(form({ id, draft: JSON.stringify({ ...metadata.research, reviewed_by: id }) }))).rejects.toThrow();
  expect(mocks.saveDraft).not.toHaveBeenCalled();
});
it("blocks generic course approval of research even after manual edits", async () => {
  await expect(reviewCourseAction(form({ id, review_status: "approved" }))).rejects.toThrow(/research/i);
  expect(mocks.review).not.toHaveBeenCalled();
});
it("blocks accepting research through the legacy conflict button", async () => {
  await expect(resolveConflictAction(form({ id, keep_new: "true" }))).rejects.toThrow(/research/i);
  expect(mocks.resolve).not.toHaveBeenCalled();
});
it.each([null, "student"])("rejects unauthorized review/publication (%s) before writes", async role => {
  mocks.requireAdmin.mockRejectedValue(new Error(role ? "Non-admin" : "Anonymous"));
  await expect(publishCourseResearchAction(form({ id, attest: "yes" }))).rejects.toThrow();
  await expect(reviewCourseAction(form({ id, review_status: "approved" }))).rejects.toThrow();
  expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled();
});
it("requires explicit source/scope attestation before publication", async () => {
  await expect(publishCourseResearchAction(form({ id }))).rejects.toThrow();
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("publishes selected review keys through the caller-scoped helper", async () => {
  mocks.publish.mockResolvedValue(undefined);
  await expect(publishCourseResearchAction(form({ id, attest: "yes", accepted: "0:english" }))).rejects.toThrow("redirect");
  expect(mocks.publish).toHaveBeenCalledWith({}, id, ["0:english"], id);
});
it("retains research provenance when editing the legacy manual fallback", async () => {
  const data = form({ id, source_url: "https://www.daad.de/example", name: "Synthetic", university_name: "Synthetic", tuition: "null", deadlines: "[]", requirements: "[]" });
  await expect(updateCourseAction(data)).rejects.toThrow("redirect");
  expect(mocks.edit).toHaveBeenCalledWith({}, id, expect.objectContaining({ field_extraction: expect.objectContaining({ research: metadata.research }) }));
});
