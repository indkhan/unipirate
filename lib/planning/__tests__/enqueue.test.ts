import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
const mocks = vi.hoisted(() => ({ getApplicationWithCourse: vi.fn(), getApplicationOfferingCatalogue: vi.fn(), enqueuePlanningJob: vi.fn(), listPlanningJobs: vi.fn(), retryPlanningJob: vi.fn(), resolveOfferingProcess: vi.fn() }));
vi.mock("@/lib/db/queries", () => mocks);
vi.mock("@/lib/tasks/offering-process", () => ({ resolveOfferingProcess: mocks.resolveOfferingProcess }));
import { enqueueResearch } from "../enqueue";
const db = {} as SupabaseClient<Database>;
const userId = randomUUID(), applicationId = randomUUID(), courseId = randomUUID();
beforeEach(() => { vi.resetAllMocks(); });
it("enqueues research only for the owned saved pending course", async () => {
  mocks.getApplicationWithCourse.mockResolvedValue({ id: applicationId, course_id: courseId, courses: { review_status: "pending" } });
  await enqueueResearch(db, userId, { applicationId, courseId });
  expect(mocks.enqueuePlanningJob).toHaveBeenCalledWith(db, "research", applicationId);
});
it("reuses an approved selected reviewed offering without research", async () => {
  const versionId = randomUUID();
  mocks.getApplicationWithCourse.mockResolvedValue({ id: applicationId, course_id: courseId, courses: { review_status: "approved" }, offering_id: randomUUID(), offering_applicant_context: "non_eu" });
  mocks.getApplicationOfferingCatalogue.mockResolvedValue({ programme: {}, offerings: [], versions: [] });
  mocks.resolveOfferingProcess.mockReturnValue({ route: "direct", version: { id: versionId } });
  await enqueueResearch(db, userId, { applicationId, courseId });
  expect(mocks.enqueuePlanningJob).toHaveBeenCalledWith(db, "verified", applicationId, versionId);
});
it("uses preliminary verification for an approved course with unresolved scope", async () => {
  mocks.getApplicationWithCourse.mockResolvedValue({ id: applicationId, course_id: courseId, courses: { review_status: "approved" }, offering_id: null, offering_applicant_context: null });
  mocks.getApplicationOfferingCatalogue.mockResolvedValue({ programme: null, offerings: [], versions: [] });
  mocks.resolveOfferingProcess.mockReturnValue({ route: "unresolved" });
  await enqueueResearch(db, userId, { applicationId, courseId });
  expect(mocks.enqueuePlanningJob).toHaveBeenCalledWith(db, "preliminary", applicationId);
});
it("rejects foreign or mismatched applications before enqueue", async () => {
  mocks.getApplicationWithCourse.mockResolvedValue(null);
  await expect(enqueueResearch(db, userId, { applicationId, courseId })).rejects.toThrow("Application not found");
  mocks.getApplicationWithCourse.mockResolvedValue({ course_id: randomUUID() });
  await expect(enqueueResearch(db, userId, { applicationId, courseId })).rejects.toThrow("Application not found");
  expect(mocks.enqueuePlanningJob).not.toHaveBeenCalled();
});
