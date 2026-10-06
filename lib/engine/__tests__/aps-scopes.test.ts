import { describe, expect, it } from "vitest";
import { evaluate, EngineRuleSchema } from "../evaluate";
import { buildVerdicts, buildRoute } from "@/app/(public)/result/[id]/result-model";
import { generateGlobalTasks } from "@/lib/tasks/generate";
import { ruleData } from "@/scripts/rules.bootstrap";
import { buildProfile, visibleSteps, withAnswer, type PartialAnswers } from "@/app/(public)/check/steps";

import { legacyPublishedAps } from "./aps-legacy-published.fixture";
import { officialApsRules, officialIndianProfile } from "./aps-scopes.fixture";

describe("UP-ELIG-05 official scoped APS acceptance", () => {
  it("retains application/recognition APS when the Saudi checklist omits it", () => {
    const result = evaluate(officialIndianProfile, officialApsRules());
    expect(result.apsScopes).toEqual({ qualification: "required", application: "required", visa: "not_listed" });
    expect(result.aps).toBe("required");
    const verdicts = buildVerdicts(result, officialIndianProfile);
    expect(verdicts.find(v => v.key === "aps:visa")?.label).toContain("not an exemption");
    expect(verdicts.find(v => v.key === "aps:application")?.citations.length).toBeGreaterThan(0);
    expect(result.documents.filter(d => d === "APS India certificate")).toHaveLength(1);
    expect(result.citations.some(c => c.supports.includes("aps:application") && c.sourceUrl.includes("uni-assist.de"))).toBe(true);
    expect(generateGlobalTasks(result).map(t => t.key)).toContain("rule:aps-scoped-acquisition:step:10");
  });
  it("never infers an Indian issuer from nationality, school location, or board", () => {
    for (const profile of [
      { ...officialIndianProfile, nationality: "in", schoolQualification: undefined, certificateCountry: "in", board: "cbse" },
      { ...officialIndianProfile, nationality: "in", schoolQualification: { country: "sa", context: "national" as const } },
    ]) {
      const result = evaluate(profile, officialApsRules());
      expect(result.apsScopes?.application).toBe("unknown");
      expect(generateGlobalTasks(result).some(t => t.key.includes("aps-scoped"))).toBe(false);
    }
    expect(evaluate({ ...officialIndianProfile, nationality: "pk" }, officialApsRules()).apsScopes?.application).toBe("required");
  });
  it("uses the master's tertiary issuer rather than school facts", () => {
    expect(evaluate({ ...officialIndianProfile, targetDegree: "master", schoolQualification: undefined,
      tertiaryQualification: { issuer: "Indian university", country: "in", context: "national" } }, officialApsRules()).apsScopes?.application).toBe("required");
    expect(evaluate({ ...officialIndianProfile, targetDegree: "master",
      tertiaryQualification: { issuer: "Saudi university", country: "sa", context: "national" } }, officialApsRules()).apsScopes?.application).toBe("unknown");
  });
  it("keeps missing mission, missing published rules, and drafts honest", () => {
    expect(evaluate({ ...officialIndianProfile, visaMissionContext: undefined }, officialApsRules()).apsScopes?.visa).toBe("unknown");
    expect(evaluate(officialIndianProfile, []).apsScopes?.application).toBe("unknown");
    expect(evaluate(officialIndianProfile, ruleData).apsScopes?.application).toBe("unknown");
  });
  it("resolves same-scope conflicts before projecting mandatory documents/tasks", () => {
    const required = officialApsRules().find(r => r.id === "aps-scoped-application")!;
    const conflict = { ...required, id: "conflict", outcomes: { aps_scopes: { application: { value: "not_required" } } } };
    const result = evaluate(officialIndianProfile, [required, conflict]);
    expect(result.apsScopes?.application).toBe("unknown");
    expect(result.documents).toEqual([]);
    expect(generateGlobalTasks(result)).toEqual([]);
    expect(result.citations.map(c => c.ruleId)).toEqual(expect.arrayContaining([required.id, "conflict"]));
  });
  it("separates holding the certificate from requirement existence", () => {
    const result = evaluate({ ...officialIndianProfile, hasExistingApsCertificate: true }, officialApsRules());
    expect(result.apsScopes?.application).toBe("required");
    expect(result.apsCertificate).toBe("held");
    expect(buildVerdicts(result, officialIndianProfile).find(v => v.key === "aps:application")?.label).toContain("certificate already held");
    expect(buildRoute({...result, path: "direct"}).some(s => s.label === "APS")).toBe(false);
    expect(generateGlobalTasks(result).some(t => t.key.includes("aps-scoped-acquisition"))).toBe(false);
    expect(generateGlobalTasks(evaluate({ ...officialIndianProfile, hasExistingApsCertificate: undefined }, officialApsRules())).some(t => t.key.includes("aps-scoped-acquisition"))).toBe(false);
  });
  it("preserves certificate answers and acquisition task keys through IN-SA-IN", () => {
    let answers: PartialAnswers = { targetDegree: "bachelor", curriculumType: "national", certificateCountry: "in", hasExistingApsCertificate: false };
    const keys = [];
    for (const country of ["in", "sa", "in"]) {
      answers = withAnswer(answers, "visaApplicationCountry", country);
      expect(answers.hasExistingApsCertificate).toBe(false);
      keys.push(generateGlobalTasks(evaluate({ ...officialIndianProfile, visaApplicationCountry: country }, officialApsRules())).filter(t => t.key.includes("aps-scoped-acquisition")).map(t => t.key));
    }
    expect(keys[0]).toEqual(keys[1]); expect(keys[1]).toEqual(keys[2]);
  });
  it("keeps exceptional or unknown qualification context unresolved", () => {
    for (const context of ["international", "unknown"] as const) {
      const r = evaluate({...officialIndianProfile, schoolQualification: {country: "in", context}}, officialApsRules());
      expect(r.apsScopes?.application).toBe("unknown");
      expect(generateGlobalTasks(r).some(t => t.key.includes("aps-scoped"))).toBe(false);
    }
    expect(evaluate({...officialIndianProfile, targetDegree: "master", tertiaryQualification: {country: "in", context: "national"}}, officialApsRules()).apsScopes?.application).toBe("unknown");
  });
  it("validates omission as visa-only and rejects unsupported scope values", () => {
    const rule = officialApsRules().find(r => r.id === "aps-scoped-application")!;
    expect(EngineRuleSchema.safeParse({...rule, outcomes: {aps_scopes: {application: {value: "not_listed"}}}}).success).toBe(false);
    expect(EngineRuleSchema.safeParse({...rule, outcomes: {aps_scopes: {}}}).success).toBe(false);
  });
  it("asks explicit bachelor issuer before its certificate and maps it without aliases", () => {
    const answers: PartialAnswers = {apsScopeVersion: 1, targetDegree: "bachelor", curriculumType: "national", certificateCountry: "sa", schoolQualificationCountry: "in", schoolQualificationContext: "national", visaApplicationCountry: "sa"};
    const steps = visibleSteps(answers);
    expect(steps.indexOf("schoolQualificationCountry")).toBeLessThan(steps.indexOf("hasExistingApsCertificate"));
    expect(steps).toContain("visaMissionContext");
    const profile = buildProfile(answers as Parameters<typeof buildProfile>[0]);
    expect(profile.schoolQualification).toEqual({country: "in", context: "national"});
    expect(profile.visaMissionContext).toBeUndefined();
  });
  it("backs an independently published acquisition requirement with uni-assist evidence", () => {
    const rule = officialApsRules().find(r => r.id === "aps-scoped-acquisition")!;
    const result = evaluate(officialIndianProfile, [rule]);
    expect(result.apsScopes?.application).toBe("required");
    expect(result.citations.find(c => c.supports.includes("aps:application"))?.sourceUrl).toContain("uni-assist.de");
    expect(rule.source_quote).toContain("APS certificate");
  });
  it("preserves checklist evidence alongside additional-document uncertainty", () => {
    const rule = officialApsRules().find(r => r.id === "aps-scoped-visa-sa")!;
    expect(rule.source_quote).toContain("high school graduation certificate");
    expect(rule.source_quote).toContain("request additional documents");
  });
  it("keeps supplied published UUIDs separate from slugs and does not infer scope", () => {
    const result = evaluate(officialIndianProfile, legacyPublishedAps);
    expect(result.apsScopes).toEqual({qualification: "unknown", application: "unknown", visa: "unknown"});
    expect(result.apsRuleIds).toContain("f5361a7c-bddf-45fd-9c8d-a23e736f16cc");
    expect(result.apsRuleIds).not.toContain("aps-india-national");
    expect(result.citations.some(c => c.ruleId === "2bf1bdf4-a0a3-4116-b905-fb2c164a6504")).toBe(true);
    const candidate = officialApsRules().find(r => r.id === "aps-scoped-acquisition")!;
    const reviewedCopy = {...candidate, id: "f5361a7c-bddf-45fd-9c8d-a23e736f16cc", slug: "separate-readable-slug"};
    const task = generateGlobalTasks(evaluate(officialIndianProfile, [reviewedCopy]))[0];
    expect(task.key).toBe("rule:f5361a7c-bddf-45fd-9c8d-a23e736f16cc:step:10");
    expect(task.ruleId).toBe(reviewedCopy.id);
  });
  it("does not expand a legacy Saudi scalar into any exemption", () => {
    const legacy = ruleData.find(r => r.id === "aps-not-required-visa-from-sa")!;
    const result = evaluate(officialIndianProfile, [legacy]);
    expect(result.aps).toBe("unknown");
    expect(result.apsScopes).toEqual({ qualification: "unknown", application: "unknown", visa: "unknown" });
  });
});
