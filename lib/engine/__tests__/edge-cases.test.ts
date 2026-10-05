import { describe, expect, it } from "vitest";

import { EngineRuleSchema, evaluate, type EngineRule } from "@/lib/engine/evaluate";
import { fixtureRules } from "./rules.fixture";
import { p1CbseNoJee } from "./personas";

const rule = (id: string, path: "direct" | "studienkolleg"): EngineRule => ({
  id, status: "verified", conditions: { class12_percent: { op: "eq", value: 80 } },
  outcomes: { path }, source_url: `https://example.com/${id}`, source_quote: "Test rule evidence",
  last_verified_at: "2026-07-02T00:00:00Z",
});

describe("Engine edge cases", () => {
  it("missing grades cannot satisfy a grade-dependent rule", () => {
    const profile = { ...p1CbseNoJee, schoolGradePercent: undefined };
    const result = evaluate(profile, fixtureRules);
    expect(result.path).toBe("unknown");
    expect(result.unknowns.some((unknown) => /confirm/i.test(unknown))).toBe(true);
  });
  it("equal specificity disagreement resolves to unknown and cites both valid rules", () => {
    const rules = [rule("test-1", "direct"), rule("test-2", "studienkolleg")];
    for (const candidate of rules) expect(EngineRuleSchema.safeParse(candidate).success).toBe(true);
    const result = evaluate({ ...p1CbseNoJee, schoolGradePercent: 80 }, rules);
    expect(result.path).toBe("unknown");
    expect(result.citations.map((citation) => citation.ruleId)).toEqual(expect.arrayContaining(["test-1", "test-2"]));
    expect(result.unknowns.some((unknown) => /conflict/i.test(unknown))).toBe(true);
  });
  it("no matching rule produces unknown with a confirmation entry", () => {
    const result = evaluate({ ...p1CbseNoJee, schoolGradePercent: 79 }, [rule("only-rule", "direct")]);
    expect(result.path).toBe("unknown");
    expect(result.citations).toHaveLength(0);
    expect(result.unknowns.some((unknown) => /confirm/i.test(unknown))).toBe(true);
  });
  it("empty rules produce honest unknowns", () => {
    const result = evaluate(p1CbseNoJee, []);
    expect(result.path).toBe("unknown");
    expect(result.unknowns.length).toBeGreaterThan(0);
  });
});
