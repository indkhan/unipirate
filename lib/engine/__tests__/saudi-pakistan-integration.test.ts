import { expect, it } from "vitest";
import { evaluate, isQuarantinedPakistanRule } from "../evaluate";
import { reviewedSaudiRules, nationalProfile, industrialProfile, completedSaudiProfile } from "./saudi.fixture";
import { reviewedPakistanRules, currentPakistanProfile } from "./pakistan.fixture";
import { projectVersionedKbMatches } from "@/lib/ai/versioned-kb";
import { raw, ruleId, version } from "@/lib/rules/__tests__/assessment-fixtures";
const rules = () => [...reviewedSaudiRules(), ...reviewedPakistanRules()];
it("shared Anabin authority preserves actual scoped Saudi and Pakistan winning routes", () => {
 for (const r of reviewedSaudiRules()) expect(isQuarantinedPakistanRule(r)).toBe(false);
 for (const [profile, path, fh] of [[nationalProfile("Science Section"), "studienkolleg", false], [nationalProfile("Science Section", 1), "subject_restricted", false], [{ ...industrialProfile, qualificationHistory: { ...industrialProfile.qualificationHistory!, completedYears: 1 } }, "subject_restricted", true], [completedSaudiProfile, "direct", false], [currentPakistanProfile, "subject_restricted", false]] as const) {
  const result = evaluate(profile, rules());
  expect(result.path).toBe(path); expect(result.institutionRestriction === "fachhochschule").toBe(fh);
  if (fh) expect(result.stepsDetailed.map(s => s.text).join(" ")).not.toMatch(/Studienkolleg/);
 }
});
it("selected immutable sources for both countries override cache without cross-country quarantine", () => {
 const ids = [ruleId, "00000000-0000-4000-8000-000000000098"];
 const candidates = [reviewedSaudiRules().find(r => r.id === "sa-reviewed-completed-bachelor")!, reviewedPakistanRules().find(r => r.outcomes.path === "subject_restricted")!];
 const versions = candidates.map((r, i) => ({ ...version(i + 1, { rule_id: ids[i], reviewed_at: "2026-10-08T12:00:00Z", published_at: "2026-10-08T12:00:00Z", raw_snapshot: { ...raw, ...r, id: ids[i], slug: r.id, country_code: i ? "pk" : "sa", status: "verified" } }), id: i ? "00000000-0000-4000-8000-000000000099" : version(1).id }));
 const result = projectVersionedKbMatches(ids.map(rule_id => ({ rule_id, content: "Fabricated cache entitlement" })), versions, { evaluatedAt: "2026-10-08T12:00:00Z", intake: { term: "winter", year: 2026 } });
 expect(result.chunks).toHaveLength(2);
 for (const chunk of result.chunks) { expect(chunk.content).toContain("Official source says:"); expect(chunk.content).not.toContain("Fabricated"); }
});
it("shared source URL alone and incomplete country scope still grant no admission", () => {
 const sa = reviewedSaudiRules().find(r => r.id === "sa-reviewed-national-science-prep")!;
 const unscoped = { ...sa, conditions: { target_degree: "bachelor" }, id: "renamed-unscoped" };
 expect(isQuarantinedPakistanRule(unscoped)).toBe(true);
 expect(evaluate(nationalProfile("Science Section"), [unscoped]).path).toBe("unknown");
 const pk = reviewedPakistanRules().find(r => r.outcomes.path === "subject_restricted")!;
 for (const key of ["aps_issuer_country", "pk_current_assessment", "intake_index"] as const) {
  const conditions = { ...pk.conditions }; delete conditions[key];
  expect(evaluate(currentPakistanProfile, [{ ...pk, conditions, id: "renamed-current" }]).path).toBe("unknown");
 }
});
