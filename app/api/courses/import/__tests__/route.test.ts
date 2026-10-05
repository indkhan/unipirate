import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getCourseById: vi.fn(), getCourseByNormalizedUrl: vi.fn(),
  hasApplicationForCourse: vi.fn(), insertCourse: vi.fn(), extractCourse: vi.fn(), trackCourse: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/db/queries", () => mocks);
vi.mock("@/lib/ai/extract-course", () => ({ extractCourse: mocks.extractCourse }));
vi.mock("@/lib/tasks/materialize", () => ({ trackCourse: mocks.trackCourse }));

import { POST } from "../route";

const url = "https://example.com/course";
const request = (body: unknown) => new Request("http://localhost/api/courses/import", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "student" } } });
  mocks.getCourseByNormalizedUrl.mockResolvedValue(null);
});

describe("POST /api/courses/import", () => {
  it("returns 401 when user is not signed in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({ url }))).status).toBe(401);
    expect(mocks.getCourseByNormalizedUrl).not.toHaveBeenCalled();
  });
  it("returns 400 when url is invalid", async () => {
    expect((await POST(request({ url: "not-a-valid-url" }))).status).toBe(400);
  });
  it("returns 400 when text is too short", async () => {
    expect((await POST(request({ url, text: "short" }))).status).toBe(400);
    expect(mocks.extractCourse).not.toHaveBeenCalled();
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
  it("tracks an existing course without extracting it again", async () => {
    mocks.getCourseByNormalizedUrl.mockResolvedValue({ id: "course" });
    expect((await POST(request({ url, text: "x".repeat(200) }))).status).toBe(200);
    expect(mocks.trackCourse).toHaveBeenCalledWith(expect.anything(), "student", "course");
    expect(mocks.extractCourse).not.toHaveBeenCalled();
  });
  it("reports an invisible pending import collision as 409", async () => {
    mocks.extractCourse.mockResolvedValue({ facts: { name: "Course", deadlines: [] }, fieldExtraction: {}, extractionMethod: "deterministic" });
    mocks.insertCourse.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    expect((await POST(request({ url, text: "x".repeat(200) }))).status).toBe(409);
    expect(mocks.trackCourse).not.toHaveBeenCalled();
  });
});
