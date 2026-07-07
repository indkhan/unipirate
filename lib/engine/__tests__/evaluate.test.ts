import { describe, expect, it } from "vitest";

import {
  EngineRuleSchema,
  evaluate,
  intakeIndex,
  type EngineRule,
  type Profile,
} from "../evaluate";
import * as p from "./personas";
import { fixtureRules } from "./rules.fixture";

const run = (profile: Profile) => evaluate(profile, fixtureRules);

const citedUrls = (r: ReturnType<typeof run>) =>
  r.citations.map((c) => c.sourceUrl);

describe("Part E personas", () => {
  it("1. CBSE 82%, no JEE → Studienkolleg + APS; TestAS remains unverified", () => {
    const r = run(p.p1CbseNoJee);
    expect(r.path).toBe("studienkolleg");
    expect(r.aps).toBe("required");
    expect(r.testAS).toBe("unknown");
    expect(r.dMAT).toBe("not_required");
    expect(citedUrls(r)).toContain("https://aps-india.de/news/");
    expect(r.documents.some((d) => d.includes("APS"))).toBe(true);
  });

  it("2. CBSE + JEE Advanced → direct subject-specific", () => {
    const r = run(p.p2CbseJeeAdvanced);
    expect(r.path).toBe("subject_restricted");
    expect(r.aps).toBe("required");
    expect(r.testAS).toBe("unknown");
  });

  it("3. Indian 3-yr B.Sc → Master's: unknown path + APS + dMAT", () => {
    const r = run(p.p3Indian3yrBsc);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("required");
    expect(r.dMAT).toBe("required");
    expect(r.testAS).toBe("unknown");
    expect(citedUrls(r)).toContain("https://aps-india.de/dmat/");
  });

  it("4. Indian 4-yr B.Tech → Master's: APS required, no dMAT for WS 2026/27", () => {
    const r = run(p.p4Indian4yrBtech);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("required");
    expect(r.dMAT).toBe("not_required");
  });

  it("5. Pakistani FSc → path and APS remain honest unknowns", () => {
    const r = run(p.p5PakistaniFsc);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("unknown");
    expect(r.dMAT).toBe("not_required");
    expect(r.unknowns.some((u) => /official|confirm/i.test(u))).toBe(true);
    expect(r.steps.some((s) => /Consular Services Portal/.test(s))).toBe(true);
  });

  it("6. Pakistani 2-yr B.Com → Master's: honest unknown", () => {
    const r = run(p.p6Pakistani2yrBcom);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("unknown");
    expect(r.dMAT).toBe("unknown");
    expect(r.unknowns.some((u) => /confirm/i.test(u))).toBe(true);
  });

  it("7. Pakistani 4-yr BS(CS) → Master's: no verified rule yet → honest unknown path", () => {
    const r = run(p.p7Pakistani4yrBs);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("unknown");
    expect(r.dMAT).toBe("unknown");
    expect(r.unknowns.some((u) => /confirm/i.test(u))).toBe(true);
  });

  it("8. Saudi Tawjihiyah 92% → Studienkolleg; no APS when visa filed from Saudi", () => {
    const r = run(p.p8SaudiTawjihiyah);
    expect(r.path).toBe("studienkolleg");
    expect(r.aps).toBe("not_required");
    expect(citedUrls(r)).toContain(
      "https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436",
    );
  });

  it("9. Indian passport, CBSE in Riyadh → CBSE tree (Studienkolleg), no APS from Riyadh", () => {
    const r = run(p.p9CbseInRiyadh);
    expect(r.path).toBe("studienkolleg");
    expect(r.aps).toBe("not_required");
    expect(citedUrls(r)).toContain(
      "https://www.vfsglobal.com/Germany/SaudiArabia/pdf/Checklist_Student_Visa.pdf",
    );
    expect(r.testAS).toBe("unknown");
  });

  it("10. Saudi bachelor (KFUPM) → Master's: no global admission rule, no APS from Saudi", () => {
    const r = run(p.p10SaudiBachelor);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("not_required");
    expect(r.dMAT).toBe("unknown");
    expect(citedUrls(r)).toContain("https://www.goethe.de/ins/sa/en/spr/klg.html");
  });

  it("11. A-Levels in Saudi, visa from Saudi → direct subject-restricted; no APS", () => {
    const r = run(p.p11ALevelsInSaudi);
    expect(r.path).toBe("subject_restricted");
    expect(r.aps).toBe("not_required");
    expect(citedUrls(r)).toContain(
      "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    );
  });

  it("12. Pakistan GCE profile → unknown pending country-specific anabin check", () => {
    const r = run(p.p12ALevelsInPakistan);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("unknown");
    // open anabin-proposal question surfaces honestly
    expect(r.unknowns.some((u) => /anabin/i.test(u))).toBe(true);
  });

  it("13. IB in India, Math SL, 28 pts → Mech Eng: SL math blocks STEM direct entry; APS unknown", () => {
    const r = run(p.p13IbInIndia);
    expect(r.path).toBe("studienkolleg");
    expect(r.aps).toBe("unknown");
    expect(r.unknowns.some((u) => /APS/.test(u))).toBe(true);
    expect(citedUrls(r)).toContain(
      "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    );
  });
});

describe("engine behavior", () => {
  const baseRule = (over: Partial<EngineRule>): EngineRule => ({
    id: "r1",
    conditions: {},
    outcomes: {},
    status: "verified",
    source_url: "https://example.org/",
    source_quote: "quote",
    last_verified_at: "2026-07-02T00:00:00Z",
    ...over,
  });
  const minimalProfile: Profile = {
    targetDegree: "bachelor",
    curriculumType: "national",
  };

  it("every bootstrap candidate satisfies the production rule schema", () => {
    for (const rule of fixtureRules) {
      expect(EngineRuleSchema.safeParse(rule).success, rule.id).toBe(true);
    }
  });

  it("rejects malformed or undated published rules", () => {
    expect(
      EngineRuleSchema.safeParse({
        ...baseRule({ outcomes: { path: "direct" } }),
        conditions: { board: { op: "in", value: "cbse" } },
      }).success,
    ).toBe(false);
    expect(
      EngineRuleSchema.safeParse({
        ...baseRule({ outcomes: { path: "direct" } }),
        conditions: { certificate_county: "in" },
      }).success,
    ).toBe(false);
    expect(
      EngineRuleSchema.safeParse({
        ...baseRule({}),
        outcomes: { testAS: "required" },
      }).success,
    ).toBe(false);
    expect(
      EngineRuleSchema.safeParse({
        ...baseRule({ outcomes: { path: "direct" } }),
        status: "beta",
        last_verified_at: null,
      }).success,
    ).toBe(false);
  });

  it("accepts PostgreSQL timestamps with an explicit UTC offset", () => {
    expect(
      EngineRuleSchema.safeParse({
        ...baseRule({ outcomes: { path: "direct" } }),
        last_verified_at: "2026-07-04T00:00:00+00:00",
      }).success,
    ).toBe(true);
  });

  it("intakeIndex orders semesters (SS 2026 < WS 2026/27 < SS 2027)", () => {
    expect(intakeIndex("summer", 2026)).toBeLessThan(intakeIndex("winter", 2026));
    expect(intakeIndex("winter", 2026)).toBeLessThan(intakeIndex("summer", 2027));
  });

  it("empty rules → everything unknown, with confirm-with messages", () => {
    const r = evaluate(minimalProfile, []);
    expect(r.path).toBe("unknown");
    expect(r.aps).toBe("unknown");
    expect(r.testAS).toBe("unknown");
    expect(r.dMAT).toBe("unknown");
    expect(r.citations).toEqual([]);
    expect(r.unknowns.length).toBeGreaterThanOrEqual(4);
    expect(r.unknowns.every((u) => /confirm/i.test(u))).toBe(true);
  });

  it("a condition on a missing fact never matches", () => {
    const rule = baseRule({
      conditions: { class12_percent: { op: "lt", value: 70 } },
      outcomes: { path: "insufficient" },
    });
    expect(evaluate(minimalProfile, [rule]).path).toBe("unknown");
  });

  it("nin matches facts outside the list, but never a missing fact", () => {
    const rule = baseRule({
      conditions: { board: { op: "nin", value: ["cbse", "cisce"] } },
      outcomes: { path: "direct" },
    });
    expect(
      evaluate({ ...minimalProfile, board: "fsc" }, [rule]).path,
    ).toBe("direct");
    expect(
      evaluate({ ...minimalProfile, board: "cbse" }, [rule]).path,
    ).toBe("unknown");
    expect(evaluate(minimalProfile, [rule]).path).toBe("unknown");
  });

  it("neq on a missing fact does not match either", () => {
    const rule = baseRule({
      conditions: { certificate_country: { op: "neq", value: "in" } },
      outcomes: { path: "direct" },
    });
    expect(evaluate(minimalProfile, [rule]).path).toBe("unknown");
  });

  it("draft rules are skipped", () => {
    const rule = baseRule({ status: "draft", outcomes: { path: "direct" } });
    expect(evaluate(minimalProfile, [rule]).path).toBe("unknown");
  });

  it("invalid rule rows are skipped without throwing", () => {
    const good = baseRule({ outcomes: { path: "direct" } });
    const r = evaluate(minimalProfile, [null, {}, { id: 42 }, good]);
    expect(r.path).toBe("direct");
  });

  it("more specific rule wins on conflicting path", () => {
    const generic = baseRule({
      id: "generic",
      conditions: { target_degree: "bachelor" },
      outcomes: { path: "studienkolleg" },
    });
    const specific = baseRule({
      id: "specific",
      conditions: { target_degree: "bachelor", curriculum: "national" },
      outcomes: { path: "direct" },
    });
    const r = evaluate(minimalProfile, [generic, specific]);
    expect(r.path).toBe("direct");
    expect(r.citations.map((c) => c.ruleId)).toEqual(["specific"]);
  });

  it("equal-specificity conflict → unknown, both rules cited", () => {
    const a = baseRule({
      id: "a",
      conditions: { target_degree: "bachelor" },
      outcomes: { path: "direct" },
    });
    const b = baseRule({
      id: "b",
      conditions: { curriculum: "national" },
      outcomes: { path: "studienkolleg" },
    });
    const r = evaluate(minimalProfile, [a, b]);
    expect(r.path).toBe("unknown");
    expect(r.citations.map((c) => c.ruleId).sort()).toEqual(["a", "b"]);
    expect(r.unknowns.some((u) => /conflict/i.test(u))).toBe(true);
  });

  it("India 70% cutoff: 65% for WS 2026/27 → insufficient; same for SS 2026 → studienkolleg", () => {
    const at65 = { ...p.p1CbseNoJee, schoolGradePercent: 65 };
    expect(run(at65).path).toBe("insufficient");
    const beforeCutoff: Profile = {
      ...at65,
      intake: { term: "summer", year: 2026 },
    };
    expect(run(beforeCutoff).path).toBe("studienkolleg");
  });

  it("India ≥70% + 1 year of bachelor study → direct subject-restricted", () => {
    const oneYear: Profile = {
      ...p.p1CbseNoJee,
      yearsOfUniversityStudy: 1,
      universityStudyField: "cs",
      universityStudyInstitutionRecognized: true,
    };
    expect(run(oneYear).path).toBe("subject_restricted");
  });

  it("dMAT out-of-scope field at SS 2027 → not required (affected-fields list is exhaustive)", () => {
    const outOfScope: Profile = {
      ...p.p3Indian3yrBsc,
      priorDegree: { years: 3, field: "biology" },
    };
    const r = run(outOfScope);
    expect(r.dMAT).toBe("not_required");
    expect(r.citations.some((c) => /affected fields/i.test(c.claim))).toBe(true);
  });

  it("dMAT with unstated prior-degree field at SS 2027 → honest unknown", () => {
    const noField: Profile = {
      targetDegree: "master",
      intake: { term: "summer", year: 2027 },
      nationality: "in",
      certificateCountry: "in",
      curriculumType: "national",
    };
    const r = run(noField);
    expect(r.dMAT).toBe("unknown");
    expect(r.unknowns.some((u) => /dMAT/i.test(u))).toBe(true);
  });

  it("dMAT transition and completed-APS exemptions override the general rule", () => {
    const registeredBeforeCutoff: Profile = {
      ...p.p3Indian3yrBsc,
      apsRegistrationCompletedAt: "2026-06-28",
    };
    expect(run(registeredBeforeCutoff).dMAT).toBe("not_required");

    const existingAps: Profile = {
      ...p.p3Indian3yrBsc,
      hasExistingApsCertificate: true,
    };
    expect(run(existingAps).dMAT).toBe("not_required");
  });

  it("an Indian passport with a Saudi degree does not enter the India dMAT tree", () => {
    const r = run({
      targetDegree: "master",
      intake: { term: "summer", year: 2027 },
      nationality: "in",
      certificateCountry: "sa",
      curriculumType: "national",
      priorDegree: { years: 4, field: "engineering" },
      hasExistingApsCertificate: false,
      isExchangeOrPartnershipProgram: false,
      apsRegistrationCompletedAt: "2026-07-01",
      apsDocumentsShippedAt: "2026-07-02",
    });
    expect(r.dMAT).toBe("unknown");
  });

  it("JEE Advanced with <70% Class XII at WS 2026/27 → still direct subject-restricted", () => {
    const jeeAdvLowScore: Profile = {
      ...p.p2CbseJeeAdvanced,
      schoolGradePercent: 65,
    };
    expect(run(jeeAdvLowScore).path).toBe("subject_restricted");
  });

  it("steps merge sorted by order and de-duplicated", () => {
    const s1 = baseRule({
      id: "s1",
      outcomes: { steps: [{ order: 30, text: "later" }, { order: 10, text: "first" }] },
    });
    const s2 = baseRule({
      id: "s2",
      outcomes: { steps: [{ order: 10, text: "first" }, { order: 20, text: "middle" }] },
    });
    const r = evaluate(minimalProfile, [s1, s2]);
    expect(r.steps).toEqual(["first", "middle", "later"]);
    expect(r.citations.find((c) => c.ruleId === "s1")?.supports).toEqual([
      "steps",
    ]);
  });

  it("citations retain verification status and merge supported result keys", () => {
    const rule = baseRule({
      id: "multi-outcome",
      status: "beta",
      outcomes: {
        path: "direct",
        aps: "required",
        documents: ["APS certificate"],
      },
    });
    const r = evaluate(minimalProfile, [rule]);
    expect(r.citations).toContainEqual(
      expect.objectContaining({
        ruleId: "multi-outcome",
        status: "beta",
        supports: ["path", "aps", "documents"],
      }),
    );
  });

  it("conflicting verdict citations identify the disputed result key", () => {
    const a = baseRule({ id: "a", outcomes: { path: "direct" } });
    const b = baseRule({ id: "b", outcomes: { path: "studienkolleg" } });
    const r = evaluate(minimalProfile, [a, b]);
    expect(r.path).toBe("unknown");
    expect(r.citations.map((c) => c.supports)).toEqual([["path"], ["path"]]);
    expect(r.unknowns.some((unknown) => /conflicting rules/i.test(unknown))).toBe(
      true,
    );
  });

  it("unknown results without a matching rule never receive a verified citation", () => {
    const r = evaluate(minimalProfile, []);
    expect(r.path).toBe("unknown");
    expect(r.citations).toEqual([]);
  });

  it("IB without full diploma → honest unknown for alternative routes", () => {
    const noDiploma: Profile = {
      ...p.p13IbInIndia,
      ib: {
        ...p.p13IbInIndia.ib!,
        fullDiploma: false,
        totalPoints: 20,
      },
    };
    expect(run(noDiploma).path).toBe("unknown");
  });

  it("IB does not return direct admission when the required HL structure is missing", () => {
    const invalidIb: Profile = {
      ...p.p13IbInIndia,
      certificateCountry: "sa",
      targetField: "humanities",
      ib: {
        ...p.p13IbInIndia.ib!,
        mathLevel: "HL",
        subjects: p.p13IbInIndia.ib!.subjects.map((subject, index) => ({
          ...subject,
          level: index === 0 ? "HL" : "SL",
        })),
      },
    };
    expect(run(invalidIb).path).toBe("unknown");
  });

  it("current GCE rules accept three qualifying A-Levels without an AS subject", () => {
    const currentGce: Profile = {
      ...p.p11ALevelsInSaudi,
      gce: {
        ...p.p11ALevelsInSaudi.gce!,
        subjects: p.p11ALevelsInSaudi.gce!.subjects.filter(
          (subject) => subject.level === "AL",
        ),
      },
    };
    expect(run(currentGce).path).toBe("subject_restricted");
  });

  it("GCE grades below C never produce direct admission", () => {
    const lowGrades: Profile = {
      ...p.p11ALevelsInSaudi,
      gce: {
        ...p.p11ALevelsInSaudi.gce!,
        subjects: p.p11ALevelsInSaudi.gce!.subjects
          .filter((subject) => subject.level === "AL")
          .map((subject) => ({ ...subject, grade: "D" as const })),
      },
    };
    expect(run(lowGrades).path).toBe("unknown");
  });
});
