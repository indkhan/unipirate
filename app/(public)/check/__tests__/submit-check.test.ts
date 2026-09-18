import { describe, expect, it } from "vitest";

import { submitCheck } from "@/app/(public)/check/actions";
import { AnswersSchema } from "@/app/(public)/check/steps";

const validAnswers = {
  targetDegree: "bachelor",
  nationality: "DE",
  certificateCountry: "in",
  visaApplicationCountry: "de",
  curriculumType: "national",
  board: "cbse",
  schoolGradePercent: 82,
  jeeAdvanced: false,
  hasExistingApsCertificate: false,
  targetField: "cs",
  intake: { term: "winter", year: 2025 },
};

// Test 1: Zod schema expects answers object directly, not wrapped in { answers }
const zodValidInput = validAnswers as any;
const zodInvalidInput = {
  ...validAnswers,
  targetDegree: "" as any,
} as any;

describe("submitCheck & AnswersSchema", () => {
  it("AnswersSchema validates valid answers directly", () => {
    const parsed = AnswersSchema.safeParse(validAnswers);
    expect(parsed.success).toBe(true);
  });

  it("AnswersSchema rejects invalid answers", () => {
    const parsed = AnswersSchema.safeParse(zodInvalidInput);
    expect(parsed.success).toBe(false);
  });

  it("submitCheck with valid Zod-validated input", async () => {
    // This tests the action's Zod validation passes when answers are valid
    // Note: full action test requires Supabase client, so we just verify Zod passes
    const result = await submitCheck(validAnswers as any);
    // If we get here without a Zod error, the action's first validation passed
    // (Full DB flow test would need proper Supabase setup)
    expect(result.error).toBeUndefined();
  });

  it("submitCheck returns error for invalid Zod input", async () => {
    const result = await submitCheck(zodInvalidInput);
    expect(result.error).toBeDefined();
  });
});