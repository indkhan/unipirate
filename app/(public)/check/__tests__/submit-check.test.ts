import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getPublishedRules: vi.fn(), insertCheck: vi.fn(),
  upsertProfile: vi.fn(), materializeAllTasksForUser: vi.fn(), setCookie: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
  createCheckWriter: () => ({ privileged: true }),
}));
vi.mock("@/lib/db/queries", () => mocks);
vi.mock("@/lib/tasks/materialize", () => ({ materializeAllTasksForUser: mocks.materializeAllTasksForUser }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));

import { submitCheck } from "../actions";
import { AnswersSchema } from "../steps";
import { hashOwnerToken, ownerCookieName } from "@/lib/checks/ownership";

const validAnswers = {
  targetDegree: "bachelor", nationality: "in", certificateCountry: "in", visaApplicationCountry: "in",
  curriculumType: "national", board: "cbse", schoolGradePercent: 82, jeeAdvanced: false,
  hasExistingApsCertificate: false, targetField: "cs", intake: { term: "winter", year: 2026 },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.getPublishedRules.mockResolvedValue([]);
  mocks.insertCheck.mockResolvedValue("check-id");
});

describe("submitCheck", () => {
  it("validates the answers directly, rejecting the old wrapped shape", () => {
    expect(AnswersSchema.safeParse(validAnswers).success).toBe(true);
    expect(AnswersSchema.safeParse({ answers: validAnswers }).success).toBe(false);
  });
  it("rejects invalid answers before accessing the database", async () => {
    expect(await submitCheck({ ...validAnswers, targetDegree: "" })).toEqual({ error: expect.any(String) });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.insertCheck).not.toHaveBeenCalled();
  });
  it("saves an anonymous check with a hashed ownership token and HttpOnly cookie", async () => {
    expect(await submitCheck(validAnswers)).toEqual({ id: "check-id" });
    const [name, token, options] = mocks.setCookie.mock.calls[0];
    expect(name).toBe(ownerCookieName("check-id"));
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(mocks.insertCheck).toHaveBeenCalledWith({ privileged: true }, expect.objectContaining({
      answers: validAnswers, owner_token_hash: hashOwnerToken(token), result: expect.objectContaining({ path: "unknown" }),
    }));
    expect(mocks.upsertProfile).not.toHaveBeenCalled();
  });
  it("saves signed-in answers and materializes tasks without an anonymous cookie", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "student" } } });
    expect(await submitCheck(validAnswers)).toEqual({ id: "check-id" });
    expect(mocks.upsertProfile).toHaveBeenCalledWith(expect.anything(), { user_id: "student", answers: validAnswers });
    expect(mocks.materializeAllTasksForUser).toHaveBeenCalledWith(expect.anything(), "student");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
