import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), listRuleVersions: vi.fn(), insertCheck: vi.fn(),
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
import { dmatAnswers } from "./dmat.fixture";
import { RuleVersionSchema } from "@/lib/rules/versioning";
import { reviewedDmatRules } from "@/lib/engine/__tests__/dmat.fixture";

const validAnswers = {
  targetDegree: "bachelor", nationality: "in", certificateCountry: "in", visaApplicationCountry: "in",
  curriculumType: "national", board: "cbse", schoolGradePercent: 82, jeeAdvanced: false,
  hasExistingApsCertificate: false, targetField: "cs", intake: { term: "winter", year: 2026 },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.listRuleVersions.mockResolvedValue([]);
  mocks.insertCheck.mockResolvedValue("check-id");
});

describe("submitCheck", () => {
  it.each([null, { id: "student" }])("preserves dMAT reports and normalization for anonymous/authenticated submission: %j", async user => {
    mocks.getUser.mockResolvedValue({ data: { user } });
    mocks.listRuleVersions.mockResolvedValue(reviewedDmatRules().map((rule, index) => RuleVersionSchema.parse({id: "00000000-0000-4000-8000-" + String(index+100).padStart(12,"0"), rule_id: "00000000-0000-4000-8000-" + String(index+200).padStart(12,"0"), version_number: 1, supersedes_version_id: null, raw_snapshot: {...rule, id: "00000000-0000-4000-8000-" + String(index+200).padStart(12,"0")}, status: rule.status, effective_from: null, effective_until: null, intake_from: null, intake_until: null, reviewed_by: "00000000-0000-4000-8000-000000000002", reviewed_at: "2026-01-01T00:00:00Z", published_at: "2026-01-01T00:00:00Z", captured_at: null, draft_revision: 1, provenance: "human_publication"})));
    expect(await submitCheck(JSON.parse(JSON.stringify(dmatAnswers)))).toEqual({ id: "check-id" });
    const expected = AnswersSchema.parse(dmatAnswers);
    expect(mocks.insertCheck).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answers: expected,
      result: expect.objectContaining({ dMAT: "required", path: "unknown" }) }));
    if (user) expect(mocks.upsertProfile).toHaveBeenCalledWith(expect.anything(), { user_id: "student", answers: expected });
    else expect(mocks.upsertProfile).not.toHaveBeenCalled();
  });
  it("rejects an impossible dMAT date before auth or persistence I/O", async () => {
    expect(await submitCheck({ ...dmatAnswers, dmatRegistrationStatus: "completed", dmatRegistrationDate: "2026-02-29" })).toEqual({ error: expect.any(String) });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.insertCheck).not.toHaveBeenCalled();
  });
  it("returns a retryable error when saving fails instead of leaving the form submitting", async () => {
    mocks.insertCheck.mockRejectedValueOnce(new Error("Database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(submitCheck(validAnswers)).resolves.toEqual({ error: "Could not save your check. Please try again." });
    log.mockRestore();
  });
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
    expect(mocks.materializeAllTasksForUser).toHaveBeenCalledWith(expect.anything(), "student", expect.objectContaining({metadata: expect.any(Object)}));
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});

it("normalizes hidden versioned history before saving a check and account profile", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "student" } } });
  const input = { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: false, certificateCountry: "in", curriculumType: "national", priorQualificationType: "bachelor", priorStudyInstitution: "Old University", priorStudyCountry: "in", priorQualificationContext: "national", priorStudyField: "cs", priorDegreeYears: 4, yearsOfUniversityStudy: 4, priorStudyCompletion: "completed", hasExistingApsCertificate: true };
  const expected = { qualificationHistoryVersion: 1, targetDegree: "master", nationality: "pk", visaApplicationCountry: "in", targetField: "cs", intake: null, hasPriorUniversityStudy: false };
  const parsed = AnswersSchema.parse(input);
  expect(parsed).toEqual(expected);
  expect(await submitCheck(input)).toEqual({ id: "check-id" });
  expect(mocks.insertCheck).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answers: expected }));
  expect(mocks.upsertProfile).toHaveBeenCalledWith(expect.anything(), { user_id: "student", answers: expected });
});

it("captures protected assessment authority from the server, ignoring client markers", async () => {
  const input = validAnswers;
  expect(await submitCheck(input)).toEqual({id: "check-id"});
  const record = mocks.insertCheck.mock.calls[0][1];
  expect(record.assessment_metadata).toMatchObject({formatVersion: 1, selectedVersionIds: [], selectionIssues: []});
  expect(record.assessment_metadata.evaluatedAt).not.toBe("2099-01-01T00:00:00Z");
  expect(record.assessment_metadata.engineRevision).not.toBe("forged");
});

it("rejects client authority rather than accepting an evaluation instant or engine revision", async () => {
 expect(await submitCheck({...validAnswers, assessment_metadata: {evaluatedAt: "2099-01-01T00:00:00Z", engineRevision: "forged"}})).toEqual({error: expect.any(String)});
 expect(mocks.insertCheck).not.toHaveBeenCalled();
});
