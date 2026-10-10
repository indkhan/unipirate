import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAAD_PAGE_TEXT } from "@/lib/courses/__tests__/fixtures";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getCourseById: vi.fn(), getCourseByNormalizedUrl: vi.fn(), hasApplicationForCourse: vi.fn(), insertCourse: vi.fn(), trackCourse: vi.fn(), enqueueResearch: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/db/queries", () => mocks);
vi.mock("@/lib/tasks/materialize", () => ({ trackCourse: mocks.trackCourse }));
vi.mock("@/lib/planning/enqueue", () => ({ enqueueResearch: mocks.enqueueResearch }));
import { POST } from "../route";
const url = "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/12345/?utm_source=test#overview";
const request = (body: unknown) => new Request("http://localhost/api/courses/import", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "student" } } });
  mocks.getCourseByNormalizedUrl.mockResolvedValue(null);
  mocks.insertCourse.mockResolvedValue({ id: "course" });
  mocks.trackCourse.mockResolvedValue("application");
  mocks.enqueueResearch.mockResolvedValue({ id: "job", state: "queued" });
});
describe("DAAD import boundary", () => {
  it("saves exact identity/source before queueing without requirement guesses", async () => {
    const text = ` \n${DAAD_PAGE_TEXT}\n `;
    const response = await POST(request({ url, text }));
    expect(response.status).toBe(201);
    expect(mocks.insertCourse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source_url: url, name: "Computer Science – Master of Science", university_name: "Leibniz University Hannover", review_status: "pending", deadlines: [], requirements: [], tuition: null, field_extraction: expect.objectContaining({ research: expect.objectContaining({ paste: text }) }) }));
    expect(mocks.enqueueResearch).toHaveBeenCalledWith(expect.anything(), "student", { courseId: "course", applicationId: "application" });
    expect(mocks.insertCourse.mock.invocationCallOrder[0]).toBeLessThan(mocks.enqueueResearch.mock.invocationCallOrder[0]);
    expect(await response.json()).toMatchObject({ applicationId: "application", researchQueued: true });
  });
  it.each(["x".repeat(200), `${DAAD_PAGE_TEXT}\nOther course\nOther University • Berlin\nOverview`])("rejects missing/ambiguous identity without writes", async text => {
    const response = await POST(request({ url, text }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/Return to the DAAD course page/);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
    expect(mocks.trackCourse).not.toHaveBeenCalled();
  });
  it.each(["https://example.edu/course", "https://daad.de.evil.com/en/detail/123", "https://evil-daad.de/en/detail/123", "https://www2.daad.de/arbitrary/detail/123", "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/123/extra", "ftp://www2.daad.de/", "https://127.0.0.1/", "https://user:pass@www2.daad.de/", "https://www2.daad.de:8080/"])("rejects new entry %s", async url => {
    expect((await POST(request({ url, text: DAAD_PAGE_TEXT }))).status).toBe(400);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
    expect(mocks.enqueueResearch).not.toHaveBeenCalled();
  });
  it.each([{ text: "short" }, { text: "x".repeat(200_001) }, { text: {} }, { identity: { name: "spoof", university: "spoof" } }, { review_status: "approved" }])("rejects malformed or spoofed input", async extra => {
    expect((await POST(request({ url, ...extra }))).status).toBe(400);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
  });
  it("rejects malformed/oversized JSON", async () => {
    for (const body of ["{", " ".repeat(850_001)]) expect((await POST(new Request("http://localhost/api/courses/import", { method: "POST", body }))).status).toBe(400);
  });
  it("preserves existing non-DAAD lookup and tracking identities", async () => {
    const course = { id: "legacy", review_status: "approved" };
    mocks.getCourseByNormalizedUrl.mockResolvedValue(course);
    mocks.hasApplicationForCourse.mockResolvedValue(true);
    expect(await (await POST(request({ url: "https://example.edu/course" }))).json()).toEqual({ course, deduped: true, onDashboard: true });
    expect((await POST(request({ url: "https://example.edu/course", text: DAAD_PAGE_TEXT }))).status).toBe(200);
    expect(mocks.trackCourse).toHaveBeenCalledWith(expect.anything(), "student", "legacy");
    expect(mocks.insertCourse).not.toHaveBeenCalled();
  });
  it("rejects unapproved DAAD paths even when normalization finds an existing course", async () => {
    mocks.getCourseByNormalizedUrl.mockResolvedValue({ id: "saved", source_url: url });
    const response = await POST(request({ url: "https://www2.daad.de/arbitrary/detail/12345" }));
    expect(response.status).toBe(400);
    expect(mocks.trackCourse).not.toHaveBeenCalled();
  });
  it("retains saved course on enqueue failure without blaming paste", async () => {
    mocks.enqueueResearch.mockRejectedValue(new Error("provider unavailable"));
    const response = await POST(request({ url, text: DAAD_PAGE_TEXT }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ course: { id: "course" }, researchQueued: false, researchError: expect.stringMatching(/saved.*research/i) });
  });
  it("recovers enqueue failure on retry of the same pending course", async () => {
    mocks.enqueueResearch.mockRejectedValueOnce(new Error("enqueue unavailable"));
    const first = await POST(request({ url, text: DAAD_PAGE_TEXT }));
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ course: { id: "course" }, applicationId: "application", researchQueued: false });
    mocks.getCourseByNormalizedUrl.mockResolvedValue({ id: "course", review_status: "pending", source_url: url });
    const response = await POST(request({ url, text: DAAD_PAGE_TEXT }));
    expect(response.status).toBe(200);
    expect(mocks.enqueueResearch).toHaveBeenCalledWith(expect.anything(), "student", { courseId: "course", applicationId: "application" });
    expect(mocks.insertCourse).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueResearch).toHaveBeenCalledTimes(2);
    expect(await response.json()).toMatchObject({ researchQueued: true, deduped: true });
  });
  it.each(["running", "succeeded", "failed"])("reports the actual existing %s job without another insert", async state => {
    mocks.getCourseByNormalizedUrl.mockResolvedValue({ id: "course", review_status: "pending", source_url: url });
    mocks.enqueueResearch.mockResolvedValue({ id: "existing-job", state });
    const response = await POST(request({ url, text: DAAD_PAGE_TEXT }));
    expect(await response.json()).toMatchObject({ researchJobId: "existing-job", researchState: state, researchQueued: state === "running" });
    expect(mocks.insertCourse).not.toHaveBeenCalled();
  });
  it("preserves update target and rejects unrelated URL", async () => {
    const conflictsWith = "00000000-0000-4000-8000-000000000001";
    mocks.getCourseById.mockResolvedValue({ id: conflictsWith, source_url: url });
    expect((await POST(request({ url, text: DAAD_PAGE_TEXT, conflictsWith }))).status).toBe(201);
    expect(mocks.insertCourse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ conflicts_with: conflictsWith }));
    expect((await POST(request({ url: url.replace("12345", "99999"), text: DAAD_PAGE_TEXT, conflictsWith }))).status).toBe(400);
  });
  it("returns 409 for invisible pending collision", async () => {
    mocks.insertCourse.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    expect((await POST(request({ url, text: DAAD_PAGE_TEXT }))).status).toBe(409);
    expect(mocks.trackCourse).not.toHaveBeenCalled();
  });
  it("reports persistence failure separately from copying", async () => {
    mocks.insertCourse.mockRejectedValue(new Error("database unavailable"));
    const response = await POST(request({ url, text: DAAD_PAGE_TEXT }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/saving/i);
  });
  it("requires auth before lookup", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({ url }))).status).toBe(401);
    expect(mocks.getCourseByNormalizedUrl).not.toHaveBeenCalled();
  });
  it("rejects the captured DAAD 6909 header with its programme title missing", async () => {
    // Captured 2026-10-10: https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/6909/
    const text = `INTERNATIONAL PROGRAMMES 2026/2027
©
pagination
HOME BACK
FH Aachen University of Applied Sciences • Geilenkirchen
Gallery
Previous
Next
Overview
Course details
Costs / Requirements / Registration
Services
About the university
Course location
Geilenkirchen`;
    const response = await POST(request({ url: url.replace("12345", "6909"), text }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/Return to the DAAD course page/);
    expect(mocks.insertCourse).not.toHaveBeenCalled();
    expect(mocks.trackCourse).not.toHaveBeenCalled();
    expect(mocks.enqueueResearch).not.toHaveBeenCalled();
  });
});
