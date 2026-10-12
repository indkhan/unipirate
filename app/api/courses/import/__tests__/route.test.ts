import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getCourseById: vi.fn(), getCourseByNormalizedUrl: vi.fn(),
  hasApplicationForCourse: vi.fn(), insertCourse: vi.fn(), updateCourseResearch: vi.fn(),
  extractCourse: vi.fn(), trackCourse: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/db/queries", () => mocks);
vi.mock("@/lib/ai/extract-course", () => ({ extractCourse: mocks.extractCourse }));
vi.mock("@/lib/tasks/materialize", () => ({ trackCourse: mocks.trackCourse }));
vi.mock("next/server", async (original) => {
  const mod = await original<typeof import("next/server")>();
  return { ...mod, after: (task: () => unknown) => { void task(); } };
});

import { POST } from "../route";

const url = "https://example.com/course";
const identity = { name: "Synthetic Course", university: "Synthetic University" };
const request = (body: unknown) => new Request("http://localhost/api/courses/import", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "student" } } });
  mocks.getCourseByNormalizedUrl.mockResolvedValue(null);
  mocks.trackCourse.mockResolvedValue("application");
});

describe("POST /api/courses/import", () => {
  it("saves first with the typed identity and researches after the response", async () => {
    const research = { format: "up-course-01/v1", status: "incomplete", identity: { name: "Synthetic Course", university: "Synthetic University", source_url: url }, observations: [], offerings: [], conflicts: [], issues: ["Web unavailable"] };
    mocks.extractCourse.mockResolvedValue({ facts: { name: "Synthetic Course", university: "Synthetic University", location: null, degree: null, language: null, description: null, deadlines: [], requirements: [], tuition: null }, fieldExtraction: { core: "library" }, extractionMethod: "library", research });
    mocks.insertCourse.mockResolvedValue({ id: "course", review_status: "pending", field_extraction: { core: "library" } });
    const response = await POST(request({ url, text: "x".repeat(200), identity }));
    expect(response.status).toBe(201);
    // Saved with identity before research ran: no research draft stored yet,
    // and the insert precedes any extraction call.
    expect(mocks.insertCourse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ review_status: "pending", name: "Synthetic Course", university_name: "Synthetic University" }));
    expect(mocks.insertCourse.mock.invocationCallOrder[0]).toBeLessThan(mocks.extractCourse.mock.invocationCallOrder[0]);
    const payload = await response.json();
    expect(payload).toMatchObject({ applicationId: "application", deduped: false, researchPending: true });
    expect(mocks.trackCourse).toHaveBeenCalledWith(expect.anything(), "student", "course");
    // Background research then fills the saved row without duplicating it.
    await vi.waitFor(() => expect(mocks.updateCourseResearch).toHaveBeenCalled());
    expect(mocks.updateCourseResearch).toHaveBeenCalledWith(expect.anything(), "course", "student", expect.objectContaining({ field_extraction: expect.objectContaining({ research }) }));
    expect(mocks.insertCourse).toHaveBeenCalledTimes(1);
  });
  it("keeps the saved course when background research fails", async () => {
    mocks.extractCourse.mockRejectedValue(new Error("provider down"));
    mocks.insertCourse.mockResolvedValue({ id: "course", review_status: "pending", field_extraction: { core: "library" } });
    const response = await POST(request({ url, text: "x".repeat(200), identity }));
    expect(response.status).toBe(201);
    expect((await response.json()).researchPending).toBe(true);
    await vi.waitFor(() => expect(mocks.extractCourse).toHaveBeenCalled());
    expect(mocks.updateCourseResearch).not.toHaveBeenCalled();
    expect(mocks.insertCourse).toHaveBeenCalledTimes(1);
  });
  it("asks for names when neither typed identity nor pasted identity exists", async () => {
    const response = await POST(request({ url, text: "x".repeat(200) }));
    expect(response.status).toBe(422);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
    expect(mocks.extractCourse).not.toHaveBeenCalled();
  });
  it.each(["ftp://example.com/course", "https://127.0.0.1/", "https://user:pass@example.com/", "https://example.com:8080/"])("rejects unsafe URL %s before extraction", async url => {
    expect((await POST(request({ url, text: "x".repeat(200), identity }))).status).toBe(400);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
  });
  it("rejects spoofed status metadata", async () => {
    expect((await POST(request({ url, review_status: "approved" }))).status).toBe(400);
  });
  it("returns 401 when user is not signed in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({ url }))).status).toBe(401);
    expect(mocks.getCourseByNormalizedUrl).not.toHaveBeenCalled();
  });
  it("returns 400 when url is invalid", async () => {
    expect((await POST(request({ url: "not-a-valid-url" }))).status).toBe(400);
  });
  it("returns 400 when text is too short", async () => {
    expect((await POST(request({ url, text: "short", identity }))).status).toBe(400);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
  });
  it("lookup mode returns course when existing and on dashboard", async () => {
    const course = { id: "course", name: "Test Course" };
    mocks.getCourseByNormalizedUrl.mockResolvedValue(course);
    mocks.hasApplicationForCourse.mockResolvedValue(true);
    const res = await POST(request({ url }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ course, deduped: true, onDashboard: true });
    expect(mocks.hasApplicationForCourse).toHaveBeenCalledWith(expect.anything(), "student", "course");
    expect(mocks.trackCourse).not.toHaveBeenCalled();
  });
  it("tracks an existing course and refreshes missing research in the background", async () => {
    mocks.getCourseByNormalizedUrl.mockResolvedValue({ id: "course", review_status: "pending", field_extraction: {}, name: "Old", university_name: "Old U" });
    mocks.extractCourse.mockResolvedValue({ facts: { name: "Old" }, fieldExtraction: {}, extractionMethod: "library", research: { status: "draft" } });
    const res = await POST(request({ url, text: "x".repeat(200), identity }));
    expect(res.status).toBe(200);
    expect(mocks.trackCourse).toHaveBeenCalledWith(expect.anything(), "student", "course");
    expect(await res.json()).toMatchObject({ deduped: true, applicationId: "application", researchPending: true });
    await vi.waitFor(() => expect(mocks.updateCourseResearch).toHaveBeenCalled());
  });
  it("skips background research for an existing course with a completed draft", async () => {
    mocks.getCourseByNormalizedUrl.mockResolvedValue({ id: "course", review_status: "pending", field_extraction: { research: { status: "draft" } } });
    const res = await POST(request({ url, text: "x".repeat(200), identity }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ researchPending: false });
    expect(mocks.extractCourse).not.toHaveBeenCalled();
    expect(mocks.updateCourseResearch).not.toHaveBeenCalled();
  });
  it("saves an update submission first and researches after", async () => {
    mocks.getCourseById.mockResolvedValue({ id: "old" });
    mocks.insertCourse.mockResolvedValue({ id: "course", review_status: "pending", field_extraction: { core: "library" } });
    mocks.extractCourse.mockResolvedValue({ facts: {}, fieldExtraction: {}, extractionMethod: "library", research: { status: "draft" } });
    const response = await POST(request({ url, text: "x".repeat(200), identity, conflictsWith: "00000000-0000-4000-8000-000000000001" }));
    expect(response.status).toBe(201);
    expect(mocks.insertCourse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ conflicts_with: "00000000-0000-4000-8000-000000000001" }));
    await vi.waitFor(() => expect(mocks.updateCourseResearch).toHaveBeenCalled());
  });
  it("reports an invisible pending import collision as 409", async () => {
    mocks.insertCourse.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    expect((await POST(request({ url, text: "x".repeat(200), identity }))).status).toBe(409);
    expect(mocks.trackCourse).not.toHaveBeenCalled();
  });
});
