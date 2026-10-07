import { describe, expect, it } from "vitest";
import { evaluate } from "../evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";
import { p8SaudiTawjihiyah } from "./personas";
import { ruleToChunk } from "@/lib/ai/kb";
import { projectDmatKbMatches } from "@/lib/ai/kb-retrieval";

const legacy = ruleData.find(r => r.id === "sa-tawjihiyah-studienkolleg")!;
describe("Saudi source boundary", () => {
  it("quarantines the blanket national school verdict without inventing subtype", () => {
    const r = evaluate(p8SaudiTawjihiyah, [{ ...legacy, status: "verified" }]);
    expect(r.path).toBe("unknown");
    expect(r.unknowns.join(" ")).toMatch(/subtype/i);
    expect(r.citations.some(c => c.supports.includes("path"))).toBe(false);
  });
  it("withholds unsupported national claims in fresh and persisted KB text", () => {
    const row = { ...legacy, status: "verified", slug: legacy.id, country_code: "sa", last_verified_at: legacy.last_verified_at ?? null };
    const fresh = ruleToChunk(row);
    expect(fresh.content).not.toContain("requires Studienkolleg");
    const persisted = projectDmatKbMatches([{ ...fresh, source_type: "rule", content: "Regular Saudi diploma requires Studienkolleg" }], [row])[0];
    expect(persisted.content).not.toContain("requires Studienkolleg");
    expect(persisted.content).toMatch(/unknown|unverified/i);
  });
});

import { SAUDI_ACCEPTANCE, saudiProfile, industrialProfile, reviewedSaudiRules } from "./saudi.fixture";
import { EngineRuleSchema, deriveFacts } from "../evaluate";
import { buildVerdicts, buildRoute } from "@/app/(public)/result/[id]/result-model";
import { generateGlobalTasks, newGeneratedTaskRows } from "@/lib/tasks/generate";

describe("verified Saudi clauses on disposable published draft copies", () => {
  it.each(SAUDI_ACCEPTANCE)("$id [$kind]", c => {
    const result = evaluate(c.profile, reviewedSaudiRules());
    expect(result.path).toBe(c.path);
    expect(result.institutionRestriction === "fachhochschule").toBe(c.fh ?? false);
    if (c.reason) expect(result.unknowns.join(" ")).toMatch(c.reason);
    if (c.path !== "unknown") expect(result.citations.some(x => x.supports.includes("path") && /uni-assist/.test(x.sourceUrl))).toBe(true);
  });
  it("keeps candidates draft and generic legacy conditions unsupported", () => {
    const drafts = ruleData.filter(r => r.id.startsWith("sa-reviewed-"));
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every(r => r.status === "draft" && r.published_at === null)).toBe(true);
    expect(evaluate(saudiProfile, drafts).path).toBe("unknown");
    for (const key of ["years_of_university_study", "school_certificate_requirements_met", "university_study_institution_recognized", "university_study_field_matches_target"]) {
      expect(EngineRuleSchema.safeParse({ ...drafts[0], conditions: { [key]: true } }).success).toBe(false);
    }
  });
  it("does not treat names, years elapsed, degree status or passports as evidence", () => {
    const p = { ...saudiProfile, saudiCertificate: undefined, qualificationHistory: { ...saudiProfile.qualificationHistory!, completedYears: undefined, degreeYears: 4, completion: "completed" as const, priorStudyRecognitionReference: undefined } };
    expect(evaluate(p, reviewedSaudiRules()).path).toBe("unknown");
    expect(deriveFacts(p).sa_successful_bachelor_years).toBe("unknown");
    for (const curriculumType of ["gce", "ib", "other"] as const) expect(deriveFacts({ ...saudiProfile, curriculumType })).not.toHaveProperty("sa_certificate_subtype");
    expect(deriveFacts({ ...saudiProfile, schoolQualification: { country: "in", context: "national" } })).not.toHaveProperty("sa_certificate_subtype");
  });
  it("preserves an independently scoped GCE rule and rejects malformed FH metadata at retrieval", () => {
    const gce = { ...legacy, status: "verified", conditions: { certificate_country: "sa", curriculum: "gce" as const, target_degree: "bachelor" as const, gce_evidence: "v1", gce_qualification_context: "british" }, outcomes: { path: "subject_restricted" as const } };
    // Quarantine is about Saudi national certificate rules, not international curricula.
    const chunk = ruleToChunk({ ...gce, slug: "synthetic-gce", country_code: "sa", last_verified_at: gce.last_verified_at ?? null });
    expect(chunk.content).toContain("Official source says:");
    const row = { ...reviewedSaudiRules()[0], outcomes: { path: "subject_restricted", institution_restriction: "fachhochschule" }, slug: "synthetic-malformed", country_code: "sa" };
    const match = { slug: row.slug, title: "Synthetic", content: "Unsafe FH Bachelor claim", source_url: row.source_url, last_verified_at: row.last_verified_at!, country_code: "sa", source_type: "rule" };
    expect(projectDmatKbMatches([match], [row])[0].content).toMatch(/unknown/);
  });
  it("ties FH restriction atomically to the winning path, including conflicts", () => {
    const rules = reviewedSaudiRules();
    const fh = rules.find(r => r.id === "sa-reviewed-industrial-enrollment")!;
    const conflict = { ...fh, id: "synthetic-conflict", outcomes: { ...fh.outcomes, institution_restriction: undefined } };
    const r = evaluate(industrialProfile, [fh, conflict]);
    expect(r.path).toBe("unknown");
    expect(r.institutionRestriction).toBeUndefined();
    expect(r.unknowns.join(" ")).toMatch(/conflicting/i);
    expect(r.citations.filter(c => c.supports.includes("path"))).toHaveLength(2);
    expect(evaluate(industrialProfile, [{ ...fh, outcomes: { ...fh.outcomes, institution_restriction: "all" } }]).path).toBe("unknown");
  });
  it("does not generate FH preparation tasks when the successful-year Bachelor clause wins", () => {
    const p = { ...industrialProfile, qualificationHistory: { ...industrialProfile.qualificationHistory!, completedYears: 1 } };
    const r = evaluate(p, reviewedSaudiRules());
    expect(r.path).toBe("subject_restricted");
    expect(generateGlobalTasks(r).some(t => /Fachhochschule|Studienkolleg/.test(t.title))).toBe(false);
    expect(generateGlobalTasks(r).some(t => /Bachelor admission/.test(t.title))).toBe(true);
  });
  it("shows FH and reported subject scope on result/route and existing source task renderer", () => {
    const r = evaluate(industrialProfile, reviewedSaudiRules());
    expect(buildVerdicts(r, industrialProfile)[0].label).toMatch(/Fachhochschule/);
    expect(buildVerdicts(r, industrialProfile)[0].label).toMatch(/reported/);
    expect(buildRoute(r).map(s => s.label).join(" ")).toMatch(/FH/);
    const tasks = generateGlobalTasks(r);
    expect(tasks.some(t => /Fachhochschule/.test(t.title))).toBe(true);
    expect(tasks.every(t => t.source?.url.includes("uni-assist"))).toBe(true);
    const saved = newGeneratedTaskRows("synthetic", tasks, []).map(t => ({ ...t, done: true, has_personal_edits: true }));
    expect(newGeneratedTaskRows("synthetic", tasks, saved)).toEqual([]);
  });
});
