import { PAKISTAN_PREP_ACCEPTANCE, reviewedPakistanRules } from "./pakistan.fixture";
// UP-TEST-01 harness runner: CURRENT rows are green acceptance on the
// baseline (no skips/todo); FUTURE rows are data only, never executed.
// Pure: evaluate() + fixture data. Zero I/O.
import { GCE_ACCEPTANCE } from "./gce.fixture";
import { describe, expect, it } from "vitest";

import { evaluate, type Result } from "../evaluate";
import { INDIA_STUDY_ACCEPTANCE, reviewedIndiaStudyRules } from "./india-study.fixture";
import { reviewedDmatRules } from "./dmat.fixture";
import { officialApsRules, officialIndianProfile } from "./aps-scopes.fixture";
import { fixtureRules } from "./rules.fixture";
import {
  IB_ACCEPTANCE,
  CURRENT,
  DMAT_ACCEPTANCE,
  APS_TRANSITION_ACCEPTANCE,
  FUTURE,
  HARNESS_BASELINE_SHA,
  HARNESS_VERSION,
  type CurrentExpectation,
} from "./up-test-01.harness-spec";

export function assertExpected(c: CurrentExpectation, r: Result): void {
  if (c.path !== undefined) expect(r.path, `${c.id}: path`).toBe(c.path);
  if (c.aps !== undefined) expect(r.aps, `${c.id}: aps`).toBe(c.aps);
  if (c.testAS !== undefined)
    expect(r.testAS, `${c.id}: testAS`).toBe(c.testAS);
  if (c.dMAT !== undefined) expect(r.dMAT, `${c.id}: dMAT`).toBe(c.dMAT);
  for (const url of c.citedUrls ?? [])
    expect(
      r.citations.map((citation) => citation.sourceUrl),
      `${c.id}: citation`,
    ).toContain(url);
  for (const pattern of c.unknownsMatch ?? [])
    expect(
      r.unknowns.some((u) => pattern.test(u)),
      `${c.id}: unknowns match ${pattern}`,
    ).toBe(true);
  for (const doc of c.documentSubstrings ?? [])
    expect(
      r.documents.some((d) => d.includes(doc)),
      `${c.id}: document`,
    ).toBe(true);
  for (const step of c.stepSubstrings ?? [])
    expect(
      r.stepsDetailed.some((s) => s.text.includes(step)),
      `${c.id}: step`,
    ).toBe(true);
  if (c.minUnknowns !== undefined)
    expect(r.unknowns.length, `${c.id}: unknowns`).toBeGreaterThanOrEqual(
      c.minUnknowns,
    );
}

describe(`UP-TEST-01 harness ${HARNESS_VERSION}`, () => {
  it.each(PAKISTAN_PREP_ACCEPTANCE)('UP-ELIG-08 bounded official $id',c=>{const r=evaluate(c.profile,reviewedPakistanRules());expect(r.path).toBe(c.path);expect(r.citations.map(s=>s.sourceUrl)).toContain('https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=6&ad-layerId='+c.sourceId);});
  it.each(IB_ACCEPTANCE)('UP-ELIG-02 official $id',c=>{const r=evaluate(c.profile,fixtureRules);expect(r.path).toBe(c.path);if(c.reason)expect(r.unknowns.join(' ')).toMatch(c.reason)});
  it.each(GCE_ACCEPTANCE)('UP-ELIG-01 accepted $id',c=>{const r=evaluate(c.profile,fixtureRules);expect(r.path).toBe(c.path);if(c.reason)expect(r.unknowns.some(n=>c.reason!.test(n))).toBe(true)});
  it.each(INDIA_STUDY_ACCEPTANCE)("UP-ELIG-03 accepted $id [$kind]", c => {
    const r = evaluate(c.profile, reviewedIndiaStudyRules());
    expect(r.path).toBe(c.path);
    if (c.reason) expect(r.unknowns.some(n => c.reason!.test(n))).toBe(true);
  });
  for (const c of APS_TRANSITION_ACCEPTANCE) {
    it(`UP-ELIG-06 official confirmed submission ${c.date}`, () => {
      const profile = {...officialIndianProfile, curriculumType: "national" as const,
        board: "cbse", schoolGradePercent: 65, jeeAdvanced: false,
        intake: {term: "winter" as const, year: 2026},
        apsProcedure: {status: "pending" as const, submissionConfirmation: "confirmed" as const, submissionDate: c.date}};
      const rules = fixtureRules.map(r => r.id.startsWith("aps-transition-") ? {...r, status: "verified"} : r);
      const result = evaluate(profile, rules);
      expect(result.path).toBe(c.path);
      expect(result.citations.find(x => x.ruleId === c.ruleId)?.sourceUrl).toBe("https://aps-india.de/news/");
    });
  }
  for (const c of CURRENT) {
    it(`${c.id} [${c.family}/${c.kind}]`, () => {
      assertExpected(c, evaluate(c.profile, fixtureRules));
    });
  }

  it("UP-ELIG-05 activates official scoped APS expectations on draft copies only", () => {
    const r = evaluate(officialIndianProfile, officialApsRules());
    expect(r.apsScopes).toEqual({qualification: "required", application: "required", visa: "not_listed"});
    expect(evaluate({...officialIndianProfile, schoolQualification: undefined}, officialApsRules()).apsScopes?.application).toBe("unknown");
    expect(evaluate({...officialIndianProfile, visaMissionContext: undefined}, officialApsRules()).apsScopes?.visa).toBe("unknown");
  });

  it("version, cited sources, and future-spec index", () => {
    expect(HARNESS_VERSION).toBe("up-test-01/v1-current-behavior.4-pk-bounded");
    expect(HARNESS_BASELINE_SHA).toBe(
      "951ab821920497443cd66dfc7917d044a1f00159",
    );
    for (const c of CURRENT) {
      expect(c.assertedIn.length).toBeGreaterThan(0);
      for (const url of c.citedUrls ?? []) {
        const rule = fixtureRules.find((r) => r.source_url === url);
        expect(rule, `${c.id}: fixture rule`).toBeDefined();
        expect(rule?.last_verified_at, `${c.id}: verified date`).not.toBeNull();
      }
    }
    expect(new Set(FUTURE.map((s) => s.family))).toEqual(
      new Set(["India", "Pakistan", "Saudi"]),
    );
    const currentIds = new Set(CURRENT.map((c) => c.id));
    for (const s of FUTURE) {
      expect(s.verified, s.id).toBe(false);
      expect(s.issue, s.id).toMatch(/^UP-ELIG-\d+$/);
      expect(currentIds.has(s.id), s.id).toBe(false);
    }
  });

  it("mutation sensitivity: a modified rule fails on a disposable copy", () => {
    const mutated = structuredClone(fixtureRules);
    const target = mutated.find(
      (r) => r.id === "in-school-studienkolleg-ws2026",
    );
    if (!target) throw new Error("fixture rule missing");
    target.outcomes = { ...target.outcomes, path: "direct" as const };
    const c = CURRENT.find((x) => x.id === "IN-positive-studienkolleg");
    if (!c) throw new Error("harness case missing");
    expect(() =>
      assertExpected(c, evaluate(c.profile, mutated)),
    ).toThrow();
    // approved facts untouched: the shared fixture still passes
    assertExpected(c, evaluate(c.profile, fixtureRules));
  });
  it.each(DMAT_ACCEPTANCE)("UP-ELIG-07 activates $id on reviewed draft copies", c => {
    const result = evaluate(c.profile, reviewedDmatRules());
    expect(result.dMAT).toBe(c.dMAT);
    expect(result.citations.some(citation => citation.supports.includes("dMAT") && citation.sourceUrl === c.sourceUrl)).toBe(true);
  });
});
