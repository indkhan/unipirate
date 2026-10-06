// UP-TEST-01 harness milestone — executable runner for the versioned
// current-behavior corpus (./up-test-01.harness-spec.ts) against the shared
// fixtures (./personas.ts + ./rules.fixture.ts).
//
// - "current-behavior" block: every case restates an outcome ALREADY asserted
//   by the evaluate / edge-cases / steps suites. No skips, no it.todo: the
//   whole block is green acceptance on the baseline.
// - "checker-routing" block: the steps-suite outcomes (buildProfile parity +
//   IB branch routing) replayed under the harness version banner.
// - "future-spec-index" block: pending route-issue expectations are validated
//   as DATA only (shape, family coverage, disjoint IDs, no future-schema
//   keys). Nothing pending is executed against the engine as acceptance.
// - "mutation-sensitivity" block: proves the harness fails on disposable
//   in-memory rule copies — approved facts are never modified.
// Pure: evaluate() + fixture data + zod-validated specs. Zero I/O.
import { describe, expect, it } from "vitest";

import {
  AnswersSchema,
  buildProfile,
  visibleSteps,
  type Answers,
} from "@/app/(public)/check/steps";
import {
  evaluate,
  type EngineRule,
  type Profile,
  type Result,
} from "../evaluate";
import * as personas from "./personas";
import { fixtureRules } from "./rules.fixture";
import {
  CURRENT_BEHAVIOR_CASES,
  FUTURE_PENDING_SPECS,
  HARNESS_BASELINE_SHA,
  HARNESS_VERSION,
  KNOWN_PROFILE_KEYS,
  type CurrentCase,
} from "./up-test-01.harness-spec";

const citedUrls = (r: Result) => r.citations.map((c) => c.sourceUrl);

function assertExpected(
  c: CurrentCase,
  r: Result,
): void {
  const e = c.expected;
  if (e.path !== undefined) expect(r.path, `${c.id}: path`).toBe(e.path);
  if (e.aps !== undefined) expect(r.aps, `${c.id}: aps`).toBe(e.aps);
  if (e.testAS !== undefined)
    expect(r.testAS, `${c.id}: testAS`).toBe(e.testAS);
  if (e.dMAT !== undefined) expect(r.dMAT, `${c.id}: dMAT`).toBe(e.dMAT);
  for (const url of e.citedUrlContains ?? [])
    expect(citedUrls(r), `${c.id}: citation ${url}`).toContain(url);
  for (const pattern of e.unknownsMatch ?? [])
    expect(
      r.unknowns.some((u) => new RegExp(pattern, "i").test(u)),
      `${c.id}: unknowns match /${pattern}/`,
    ).toBe(true);
  for (const doc of e.documentsContain ?? [])
    expect(
      r.documents.some((d) => d.includes(doc)),
      `${c.id}: document contains ${doc}`,
    ).toBe(true);
  for (const step of e.stepsMatch ?? [])
    expect(
      r.stepsDetailed.some((s) => s.text.includes(step)),
      `${c.id}: step contains ${step}`,
    ).toBe(true);
  if (e.unknownsMinLength !== undefined)
    expect(r.unknowns.length, `${c.id}: unknowns length`).toBeGreaterThanOrEqual(
      e.unknownsMinLength,
    );
}

describe(`UP-TEST-01 harness ${HARNESS_VERSION} — current behavior`, () => {
  for (const c of CURRENT_BEHAVIOR_CASES) {
    it(`${c.id} [${c.family}/${c.kind}]`, () => {
      const r = evaluate(c.profile as unknown as Profile, fixtureRules);
      assertExpected(c, r);
    });
  }
});

// Checker-routing outcomes from app/(public)/check/__tests__/steps.test.ts,
// replayed here so the harness covers the full persona path (answers →
// profile → verdict). Constructions mirror that suite exactly.
const p1Answers: Answers = AnswersSchema.parse({
  targetDegree: "bachelor",
  nationality: "in",
  certificateCountry: "in",
  visaApplicationCountry: "in",
  curriculumType: "national",
  board: "cbse",
  schoolGradePercent: 82,
  jeeAdvanced: false,
  hasExistingApsCertificate: false,
  targetField: "cs",
  intake: { term: "winter", year: 2026 },
});

const p11Answers: Answers = AnswersSchema.parse({
  targetDegree: "bachelor",
  nationality: "pk",
  certificateCountry: "sa",
  visaApplicationCountry: "sa",
  curriculumType: "gce",
  gceAwardingBody: "caie",
  gceSubjects: [
    { subjectId: "mathematics", level: "AL", grade: "A" },
    { subjectId: "physics", level: "AL", grade: "A" },
    { subjectId: "computer_science", level: "AL", grade: "B" },
    { subjectId: "english_language", level: "AS", grade: "A" },
  ],
  targetField: "cs",
  intake: null,
});

function ibAnswers(overrides: {
  mathLevel: "HL" | "SL";
  targetField: string;
}): Answers {
  return AnswersSchema.parse({
    targetDegree: "bachelor",
    nationality: "in",
    certificateCountry: "in",
    visaApplicationCountry: "in",
    curriculumType: "ib",
    ibFullDiploma: true,
    ibExamYear: 2026,
    ibSchoolYears: 12,
    ibTotalPoints: 36,
    ibMathCourse: "AA",
    ibSubjects: [
      { subjectId: "language_a", level: "HL", grade: "5" },
      { subjectId: "german_b", level: "HL", grade: "5" },
      { subjectId: "history", level: "HL", grade: "5" },
      {
        subjectId: "physics",
        level: overrides.mathLevel === "HL" ? "SL" : "HL",
        grade: "5",
      },
      { subjectId: "mathematics", level: overrides.mathLevel, grade: "6" },
      { subjectId: "visual_arts", level: "SL", grade: "4" },
    ],
    hasExistingApsCertificate: false,
    targetField: overrides.targetField,
    intake: { term: "winter", year: 2026 },
  });
}

describe(`UP-TEST-01 harness ${HARNESS_VERSION} — checker routing`, () => {
  it("persona #1 answers rebuild the engine persona and its verdict", () => {
    expect(buildProfile(p1Answers)).toEqual(personas.p1CbseNoJee);
    const r = evaluate(buildProfile(p1Answers), fixtureRules);
    expect(r.path).toBe("studienkolleg");
    expect(r.aps).toBe("required");
    expect(r.testAS).toBe("unknown");
    expect(r.dMAT).toBe("not_required");
  });

  it("persona #11 answers rebuild the engine persona and its verdict", () => {
    expect(buildProfile(p11Answers)).toEqual(personas.p11ALevelsInSaudi);
    const r = evaluate(buildProfile(p11Answers), fixtureRules);
    expect(r.path).toBe("subject_restricted");
    expect(r.aps).toBe("not_required");
  });

  it("IB Mathematics at HL gives general direct admission", () => {
    const r = evaluate(
      buildProfile(ibAnswers({ mathLevel: "HL", targetField: "cs" })),
      fixtureRules,
    );
    expect(r.path).toBe("direct");
  });

  it("IB Mathematics at SL closes the direct route to a STEM target", () => {
    const r = evaluate(
      buildProfile(
        ibAnswers({ mathLevel: "SL", targetField: "mechanical_engineering" }),
      ),
      fixtureRules,
    );
    expect(r.path).toBe("studienkolleg");
  });

  it("IB Mathematics at SL still allows subject-restricted access outside STEM", () => {
    const r = evaluate(
      buildProfile(ibAnswers({ mathLevel: "SL", targetField: "humanities" })),
      fixtureRules,
    );
    expect(r.path).toBe("subject_restricted");
  });

  it("an IB Certificate short of the diploma stays an honest unknown", () => {
    const answers = AnswersSchema.parse({
      targetDegree: "bachelor",
      nationality: "in",
      certificateCountry: "in",
      visaApplicationCountry: "in",
      curriculumType: "ib",
      ibFullDiploma: false,
      hasExistingApsCertificate: false,
      targetField: "cs",
      intake: { term: "winter", year: 2026 },
    });
    expect(visibleSteps(answers)).not.toContain("ibSubjects");
    expect(evaluate(buildProfile(answers), fixtureRules).path).toBe("unknown");
  });
});

describe(`UP-TEST-01 harness ${HARNESS_VERSION} — future-spec index (data only)`, () => {
  it("pending specs are never executable acceptance and never verified claims", () => {
    expect(FUTURE_PENDING_SPECS.length).toBeGreaterThan(0);
    for (const s of FUTURE_PENDING_SPECS) {
      expect(s.acceptance).toBe("future-spec-NOT-acceptance");
      expect(s.verifiedOfficialClaim).toBe(false);
    }
  });

  it("all seven families have indexed pending cases", () => {
    const families = new Set(FUTURE_PENDING_SPECS.map((s) => s.family));
    for (const f of ["GCE", "IB", "India", "Pakistan", "Saudi", "APS", "dMAT"])
      expect(families.has(f as never), `pending family ${f}`).toBe(true);
  });

  it("pending IDs are disjoint from executable acceptance IDs", () => {
    const current = new Set(CURRENT_BEHAVIOR_CASES.map((c) => c.id));
    for (const s of FUTURE_PENDING_SPECS)
      expect(current.has(s.id), `overlap ${s.id}`).toBe(false);
  });

  it("pending profiles invent no future-schema keys", () => {
    const allowed = new Set<string>(KNOWN_PROFILE_KEYS);
    for (const s of FUTURE_PENDING_SPECS) {
      if (s.profile === null) continue;
      for (const key of Object.keys(s.profile))
        expect(allowed.has(key), `${s.id}: unexpected key ${key}`).toBe(true);
    }
  });

  it("every current case traces to the pre-existing suite it restates", () => {
    for (const c of CURRENT_BEHAVIOR_CASES) {
      expect(c.acceptance).toBe("current-behavior");
      expect(c.issueId).toBe("UP-TEST-01");
      expect(c.assertedIn.length).toBeGreaterThan(0);
    }
  });

  it("cited URLs resolve to fixture rules that keep their verification dates", () => {
    for (const c of CURRENT_BEHAVIOR_CASES) {
      for (const url of c.expected.citedUrlContains ?? []) {
        const rule = (fixtureRules as EngineRule[]).find(
          (r) => (r as { source_url?: string }).source_url === url,
        );
        expect(rule, `${c.id}: fixture rule for ${url}`).toBeDefined();
        expect(
          (rule as unknown as { last_verified_at: string | null })
            .last_verified_at,
          `${c.id}: verification date for ${url}`,
        ).not.toBeNull();
      }
    }
  });

  it("harness carries its baseline identity", () => {
    expect(HARNESS_VERSION).toBe("up-test-01/v1-current-behavior.1");
    expect(HARNESS_BASELINE_SHA).toBe(
      "951ab821920497443cd66dfc7917d044a1f00159",
    );
  });
});

describe(`UP-TEST-01 harness ${HARNESS_VERSION} — mutation sensitivity`, () => {
  const cloneRules = (): EngineRule[] =>
    JSON.parse(JSON.stringify(fixtureRules)) as EngineRule[];

  it("flipping an approved outcome on a disposable copy breaks acceptance", () => {
    const mutated = cloneRules();
    const target = mutated.find((r) => r.id === "in-school-studienkolleg-ws2026");
    expect(target).toBeDefined();
    target!.outcomes = { ...target!.outcomes, path: "direct" };
    const r = evaluate(personas.p1CbseNoJee, mutated);
    expect(r.path).not.toBe("studienkolleg");
    // approved facts untouched: the shared fixture still rules the baseline
    const baseline = evaluate(personas.p1CbseNoJee, fixtureRules);
    expect(baseline.path).toBe("studienkolleg");
    expect(
      (fixtureRules as EngineRule[]).find(
        (rule) => rule.id === "in-school-studienkolleg-ws2026",
      )?.outcomes,
    ).toMatchObject({ path: "studienkolleg" });
  });

  it("drafting an approved rule on a disposable copy breaks acceptance", () => {
    const mutated = cloneRules();
    const target = mutated.find((r) => r.id === "aps-india-national");
    expect(target).toBeDefined();
    target!.status = "draft";
    const r = evaluate(personas.p1CbseNoJee, mutated);
    expect(r.aps).not.toBe("required");
    const baseline = evaluate(personas.p1CbseNoJee, fixtureRules);
    expect(baseline.aps).toBe("required");
  });
});
