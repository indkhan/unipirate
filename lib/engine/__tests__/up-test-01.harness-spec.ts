// UP-TEST-01 harness milestone — versioned CURRENT-BEHAVIOR acceptance corpus.
//
// What this file is:
// - A frozen index of engine outcomes ALREADY asserted by the existing
//   evaluate / edge-cases / steps suites, run against the same personas
//   (./personas.ts) and rule snapshot (./rules.fixture.ts). Every
//   `current-behavior` case below restates an expectation that passes on the
//   baseline; the executable runner is ./up-test-01.harness.test.ts.
// - `acceptance: "current-behavior"` means "the shipped engine does this
//   today, and CI fails if a rule change alters it without review". It does
//   NOT mean "this is the officially correct outcome".
//
// What this file is NOT:
// - `acceptance: "future-spec-NOT-acceptance"` entries are backlog
//   expectations for the route issues (UP-ELIG-01…09). They are specification
//   data only: never executed as green coverage, never asserted against the
//   engine, and explicitly NOT verified official claims
//   (`verifiedOfficialClaim: false`). They exist so route sessions can promote
//   them into real acceptance once the official rules land.
// - No educational, visa, or fee fact is introduced here. Cited URLs and the
//   fixture's `last_verified_at` dates are preserved verbatim from
//   scripts/rules.bootstrap.ts; applicability and effective intake come from
//   the listed personas. Parent UP-TEST-01 stays open until orchestrator merge.
//
// Pure module: zero I/O. Records are zod-validated at load.
import { z } from "zod";

import type { Profile } from "../evaluate";
import * as personas from "./personas";

export const HARNESS_VERSION = "up-test-01/v1-current-behavior.1" as const;
export const HARNESS_BASELINE_SHA =
  "951ab821920497443cd66dfc7917d044a1f00159" as const;

export const FamilySchema = z.enum([
  "GCE",
  "IB",
  "India",
  "Pakistan",
  "Saudi",
  "APS",
  "dMAT",
  "engine",
]);
export type Family = z.infer<typeof FamilySchema>;

export const CaseKindSchema = z.enum([
  "positive",
  "negative",
  "boundary",
  "missing",
  "exception",
  "routing",
]);
export type CaseKind = z.infer<typeof CaseKindSchema>;

// Boundary for the embedded profiles: required engine keys are checked, the
// rest passes through untouched so applicability/intake stay verbatim.
const ProfileBoundarySchema = z
  .object({
    targetDegree: z.enum(["bachelor", "master"]),
    curriculumType: z.enum(["national", "ib", "gce", "other"]),
  })
  .passthrough();

const PathSchema = z.enum([
  "direct",
  "subject_restricted",
  "studienkolleg",
  "insufficient",
  "unknown",
]);
const FlagSchema = z.enum(["required", "not_required", "unknown"]);

const ExpectedSchema = z
  .object({
    path: PathSchema.optional(),
    aps: FlagSchema.optional(),
    testAS: FlagSchema.optional(),
    dMAT: FlagSchema.optional(),
    citedUrlContains: z.array(z.string().min(1)).optional(),
    unknownsMatch: z.array(z.string().min(1)).optional(),
    documentsContain: z.array(z.string().min(1)).optional(),
    stepsMatch: z.array(z.string().min(1)).optional(),
    unknownsMinLength: z.number().int().nonnegative().optional(),
  })
  .strict();

export const CurrentCaseSchema = z
  .object({
    acceptance: z.literal("current-behavior"),
    id: z.string().min(1),
    family: FamilySchema,
    kind: CaseKindSchema,
    issueId: z.literal("UP-TEST-01"),
    routesTo: z.array(z.string().min(1)).optional(),
    profile: ProfileBoundarySchema,
    expected: ExpectedSchema,
    assertedIn: z.string().min(1),
  })
  .strict();
export type CurrentCase = z.infer<typeof CurrentCaseSchema>;

export const FutureSpecSchema = z
  .object({
    acceptance: z.literal("future-spec-NOT-acceptance"),
    id: z.string().min(1),
    family: z.enum(["GCE", "IB", "India", "Pakistan", "Saudi", "APS", "dMAT"]),
    kind: CaseKindSchema,
    issueId: z.string().min(1),
    summary: z.string().min(1),
    wantedOutcomeNote: z.string().min(1),
    profile: ProfileBoundarySchema.nullable(),
    needsFutureSchema: z.boolean(),
    blockedBy: z.array(z.string().min(1)).optional(),
    verifiedOfficialClaim: z.literal(false),
  })
  .strict();
export type FutureSpec = z.infer<typeof FutureSpecSchema>;

const gceP11 = personas.p11ALevelsInSaudi;
const gceP12 = personas.p12ALevelsInPakistan;
const ibP13 = personas.p13IbInIndia;

const gceThreeAlOnly: Profile = {
  ...gceP11,
  gce: {
    ...gceP11.gce!,
    subjects: gceP11.gce!.subjects.filter((s) => s.level === "AL"),
  },
};

const gceGradesBelowC: Profile = {
  ...gceP11,
  gce: {
    ...gceP11.gce!,
    subjects: gceP11.gce!.subjects
      .filter((s) => s.level === "AL")
      .map((s) => ({ ...s, grade: "D" as const })),
  },
};

const ibNoDiploma: Profile = {
  ...ibP13,
  ib: { ...ibP13.ib!, fullDiploma: false, totalPoints: 20 },
};

const ibMissingHlStructure: Profile = {
  ...ibP13,
  certificateCountry: "sa",
  targetField: "humanities",
  ib: {
    ...ibP13.ib!,
    mathLevel: "HL",
    subjects: ibP13.ib!.subjects!.map((s, i) => ({
      ...s,
      level: (i === 0 ? "HL" : "SL") as "HL" | "SL",
    })),
  },
};

const noPriorDegreeField: Profile = {
  targetDegree: "master",
  intake: { term: "summer", year: 2027 },
  nationality: "in",
  certificateCountry: "in",
  curriculumType: "national",
};

const indianPassportSaudiDegree: Profile = {
  targetDegree: "master",
  intake: { term: "summer", year: 2027 },
  nationality: "in",
  certificateCountry: "sa",
  curriculumType: "national",
  hasExistingApsCertificate: false,
};

const missingGrade: Profile = {
  ...personas.p1CbseNoJee,
  schoolGradePercent: undefined,
};

type RawCurrent = Omit<CurrentCase, "acceptance" | "issueId"> & {
  profile: Profile;
};

const RAW_CURRENT: RawCurrent[] = [
  {
    id: "IN-positive-studienkolleg",
    family: "India",
    kind: "positive",
    routesTo: ["UP-ELIG-03", "UP-ELIG-04"],
    profile: personas.p1CbseNoJee,
    expected: {
      path: "studienkolleg",
      aps: "required",
      testAS: "unknown",
      dMAT: "not_required",
      citedUrlContains: ["https://aps-india.de/news/"],
      documentsContain: ["APS"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 1",
  },
  {
    id: "IN-positive-jee-direct",
    family: "India",
    kind: "positive",
    routesTo: ["UP-ELIG-04"],
    profile: personas.p2CbseJeeAdvanced,
    expected: {
      path: "subject_restricted",
      aps: "required",
      testAS: "unknown",
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 2",
  },
  {
    id: "IN-boundary-65pct-ws2026-insufficient",
    family: "India",
    kind: "boundary",
    profile: { ...personas.p1CbseNoJee, schoolGradePercent: 65 },
    expected: { path: "insufficient" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: India 70% cutoff (WS 2026/27)",
  },
  {
    id: "IN-boundary-65pct-ss2026-studienkolleg",
    family: "India",
    kind: "boundary",
    profile: {
      ...personas.p1CbseNoJee,
      schoolGradePercent: 65,
      intake: { term: "summer", year: 2026 },
    },
    expected: { path: "studienkolleg" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: India 70% cutoff (SS 2026)",
  },
  {
    id: "IN-boundary-jee-low-score-still-direct",
    family: "India",
    kind: "boundary",
    routesTo: ["UP-ELIG-04"],
    profile: { ...personas.p2CbseJeeAdvanced, schoolGradePercent: 65 },
    expected: { path: "subject_restricted" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: JEE Advanced with <70% Class XII",
  },
  {
    id: "IN-missing-grade-honest-unknown",
    family: "India",
    kind: "missing",
    routesTo: ["UP-ELIG-10"],
    profile: missingGrade,
    expected: { path: "unknown", unknownsMatch: ["confirm"] },
    assertedIn:
      "lib/engine/__tests__/edge-cases.test.ts: missing grades cannot satisfy",
  },
  {
    id: "IN-cross-country-riyadh-cbse",
    family: "India",
    kind: "positive",
    routesTo: ["UP-ELIG-01", "UP-ELIG-05"],
    profile: personas.p9CbseInRiyadh,
    expected: {
      path: "studienkolleg",
      aps: "not_required",
      testAS: "unknown",
      citedUrlContains: [
        "https://www.vfsglobal.com/Germany/SaudiArabia/pdf/Checklist_Student_Visa.pdf",
      ],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 9",
  },
  {
    id: "PK-negative-fsc-honest-unknown",
    family: "Pakistan",
    kind: "negative",
    routesTo: ["UP-ELIG-08"],
    profile: personas.p5PakistaniFsc,
    expected: {
      path: "unknown",
      aps: "unknown",
      dMAT: "not_required",
      unknownsMatch: ["official|confirm"],
      stepsMatch: ["Consular Services Portal"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 5",
  },
  {
    id: "PK-negative-2yr-bcom-unknown",
    family: "Pakistan",
    kind: "negative",
    routesTo: ["UP-ELIG-08"],
    profile: personas.p6Pakistani2yrBcom,
    expected: {
      path: "unknown",
      aps: "unknown",
      dMAT: "unknown",
      unknownsMatch: ["confirm"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 6",
  },
  {
    id: "PK-exception-4yr-bs-unknown",
    family: "Pakistan",
    kind: "exception",
    routesTo: ["UP-ELIG-08"],
    profile: personas.p7Pakistani4yrBs,
    expected: {
      path: "unknown",
      aps: "unknown",
      dMAT: "unknown",
      unknownsMatch: ["confirm"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 7",
  },
  {
    id: "SA-positive-tawjihiyah-studienkolleg",
    family: "Saudi",
    kind: "positive",
    routesTo: ["UP-ELIG-09"],
    profile: personas.p8SaudiTawjihiyah,
    expected: {
      path: "studienkolleg",
      aps: "not_required",
      citedUrlContains: [
        "https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436",
      ],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 8",
  },
  {
    id: "SA-exception-bachelor-unknown-path",
    family: "Saudi",
    kind: "exception",
    routesTo: ["UP-ELIG-09"],
    profile: personas.p10SaudiBachelor,
    expected: {
      path: "unknown",
      aps: "not_required",
      dMAT: "unknown",
      unknownsMinLength: 1,
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 10",
  },
  {
    id: "GCE-positive-sa-three-al-direct",
    family: "GCE",
    kind: "positive",
    routesTo: ["UP-ELIG-01"],
    profile: gceP11,
    expected: {
      path: "subject_restricted",
      aps: "not_required",
      citedUrlContains: [
        "https://www.daad.de/en/studying-in-germany/requirements/gce/",
      ],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 11",
  },
  {
    id: "GCE-positive-three-al-no-as-required",
    family: "GCE",
    kind: "boundary",
    profile: gceThreeAlOnly,
    expected: { path: "subject_restricted" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: three qualifying A-Levels without AS",
  },
  {
    id: "GCE-negative-grades-below-c",
    family: "GCE",
    kind: "negative",
    profile: gceGradesBelowC,
    expected: { path: "unknown" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: GCE grades below C never direct",
  },
  {
    id: "GCE-exception-pk-anabin-caveat",
    family: "GCE",
    kind: "exception",
    routesTo: ["UP-ELIG-01", "UP-ELIG-08"],
    profile: gceP12,
    expected: {
      path: "unknown",
      aps: "unknown",
      unknownsMatch: ["anabin"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 12",
  },
  {
    id: "IB-negative-sl-stem-studienkolleg",
    family: "IB",
    kind: "negative",
    routesTo: ["UP-ELIG-02"],
    profile: ibP13,
    expected: {
      path: "studienkolleg",
      aps: "unknown",
      unknownsMatch: ["APS"],
      citedUrlContains: [
        "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
      ],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 13",
  },
  {
    id: "IB-missing-no-diploma-unknown",
    family: "IB",
    kind: "missing",
    routesTo: ["UP-ELIG-02"],
    profile: ibNoDiploma,
    expected: { path: "unknown" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: IB without full diploma",
  },
  {
    id: "IB-negative-missing-hl-structure",
    family: "IB",
    kind: "negative",
    profile: ibMissingHlStructure,
    expected: { path: "unknown" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: IB missing HL structure",
  },
  {
    id: "APS-positive-india-required",
    family: "APS",
    kind: "positive",
    routesTo: ["UP-ELIG-05", "UP-ELIG-06"],
    profile: personas.p1CbseNoJee,
    expected: {
      aps: "required",
      documentsContain: ["APS"],
      citedUrlContains: ["https://aps-india.de/news/"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 1",
  },
  {
    id: "APS-positive-sa-visa-exempt",
    family: "APS",
    kind: "positive",
    routesTo: ["UP-ELIG-05"],
    profile: personas.p8SaudiTawjihiyah,
    expected: {
      aps: "not_required",
      citedUrlContains: [
        "https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436",
      ],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 8",
  },
  {
    id: "APS-missing-pk-unknown",
    family: "APS",
    kind: "missing",
    routesTo: ["UP-ELIG-05", "UP-ELIG-10"],
    profile: personas.p5PakistaniFsc,
    expected: { aps: "unknown" },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 5",
  },
  {
    id: "APS-missing-ib-india-unknown",
    family: "APS",
    kind: "missing",
    routesTo: ["UP-ELIG-05", "UP-ELIG-06"],
    profile: ibP13,
    expected: { aps: "unknown", unknownsMatch: ["APS"] },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 13",
  },
  {
    id: "DMAT-negative-bachelor-not-required",
    family: "dMAT",
    kind: "negative",
    routesTo: ["UP-ELIG-07"],
    profile: personas.p1CbseNoJee,
    expected: { dMAT: "not_required" },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 1",
  },
  {
    id: "DMAT-missing-india-3yr-unknown",
    family: "dMAT",
    kind: "missing",
    routesTo: ["UP-ELIG-07", "UP-ELIG-11"],
    profile: personas.p3Indian3yrBsc,
    expected: {
      path: "unknown",
      aps: "required",
      testAS: "unknown",
      dMAT: "unknown",
      unknownsMatch: ["aps-india\\.de\\/dmat"],
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 3",
  },
  {
    id: "DMAT-boundary-ws2026-not-required",
    family: "dMAT",
    kind: "boundary",
    routesTo: ["UP-ELIG-07"],
    profile: personas.p4Indian4yrBtech,
    expected: {
      path: "unknown",
      aps: "required",
      dMAT: "not_required",
    },
    assertedIn: "lib/engine/__tests__/evaluate.test.ts: Part E persona 4",
  },
  {
    id: "DMAT-exception-existing-aps-exempt",
    family: "dMAT",
    kind: "exception",
    profile: {
      ...personas.p3Indian3yrBsc,
      hasExistingApsCertificate: true,
    },
    expected: { dMAT: "not_required" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: completed APS exempts dMAT",
  },
  {
    id: "DMAT-missing-unstated-field-unknown",
    family: "dMAT",
    kind: "missing",
    routesTo: ["UP-ELIG-07", "UP-ELIG-11"],
    profile: noPriorDegreeField,
    expected: { dMAT: "unknown", unknownsMatch: ["dMAT"] },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: unstated prior-degree field",
  },
  {
    id: "DMAT-boundary-saudi-degree-out-of-tree",
    family: "dMAT",
    kind: "boundary",
    profile: indianPassportSaudiDegree,
    expected: { dMAT: "unknown" },
    assertedIn:
      "lib/engine/__tests__/evaluate.test.ts: Saudi degree outside India dMAT tree",
  },
];

export const CURRENT_BEHAVIOR_CASES: CurrentCase[] = z
  .array(CurrentCaseSchema)
  .parse(
    RAW_CURRENT.map((c) => ({
      ...c,
      acceptance: "current-behavior",
      issueId: "UP-TEST-01",
    })),
  );

type RawFuture = Omit<FutureSpec, "acceptance" | "verifiedOfficialClaim"> & {
  profile: Profile | null;
};

const RAW_FUTURE: RawFuture[] = [
  {
    id: "FUTURE-GCE-fourth-al-trio",
    family: "GCE",
    kind: "boundary",
    issueId: "UP-ELIG-01",
    summary:
      "Valid 3-AL trio passes even when a fourth AL is below C; two qualifying ALs state the exact unmet condition.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome (direct subject-restricted for a valid trio), not asserted, not verified.",
    profile: {
      ...gceP11,
      targetField: "cs",
      gce: {
        ...gceP11.gce!,
        subjects: [
          ...gceP11.gce!.subjects.filter((s) => s.level === "AL"),
          {
            independenceGroup: "history",
            level: "AL",
            grade: "D",
            list: "A",
            category: "history",
          },
        ],
      },
    },
    needsFutureSchema: false,
  },
  {
    id: "FUTURE-IB-grade3-compensation",
    family: "IB",
    kind: "boundary",
    issueId: "UP-ELIG-02",
    summary:
      "One compensated grade 3 passes where the KMK recognition rules allow it.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: null,
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11"],
  },
  {
    id: "FUTURE-India-one-year-route",
    family: "India",
    kind: "positive",
    issueId: "UP-ELIG-03",
    summary:
      "Class XII >=70% plus one successful recognized related bachelor year gives direct subject-restricted access.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified. No ECTS equivalence invented.",
    profile: null,
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11", "UP-ELIG-10"],
  },
  {
    id: "FUTURE-India-jee-main-plus-advanced",
    family: "India",
    kind: "positive",
    issueId: "UP-ELIG-04",
    summary:
      "Explicit JEE Main + Advanced facts restrict the route to technology/natural-science targets.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: null,
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11"],
  },
  {
    id: "FUTURE-APS-scoped-requirements",
    family: "APS",
    kind: "exception",
    issueId: "UP-ELIG-05",
    summary:
      "Indian qualification with Saudi visa filing keeps application/recognition APS while the visa scope omits it.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: null,
    needsFutureSchema: true,
  },
  {
    id: "FUTURE-APS-transition-date",
    family: "APS",
    kind: "boundary",
    issueId: "UP-ELIG-06",
    summary:
      "APS procedure/status plus timing facts select the pre/post March-2026-transition rule.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: null,
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11", "UP-ELIG-10"],
  },
  {
    id: "FUTURE-dMAT-affected-field",
    family: "dMAT",
    kind: "positive",
    issueId: "UP-ELIG-07",
    summary:
      "Prior-degree field, partnership status, and APS timing facts drive required/not-required/targeted-review.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: null,
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11", "UP-ELIG-10"],
  },
  {
    id: "FUTURE-Pakistan-hssc-streams",
    family: "Pakistan",
    kind: "boundary",
    issueId: "UP-ELIG-08",
    summary:
      "HSSC/FSc stream-specific Studienkolleg routes plus the 49.99/50 boundary and one-year direct routes.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: {
      ...personas.p5PakistaniFsc,
      schoolGradePercent: 50,
    },
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11", "UP-ELIG-10"],
  },
  {
    id: "FUTURE-Saudi-certificate-subtypes",
    family: "Saudi",
    kind: "positive",
    issueId: "UP-ELIG-09",
    summary:
      "Exact certificate type/stream drives national, private-school, industrial, and graduate routes.",
    wantedOutcomeNote:
      "INFORMATIONAL ONLY — desired route-issue outcome, not asserted, not verified.",
    profile: null,
    needsFutureSchema: true,
    blockedBy: ["UP-ELIG-11", "UP-ELIG-10"],
  },
];

export const FUTURE_PENDING_SPECS: FutureSpec[] = z
  .array(FutureSpecSchema)
  .parse(
    RAW_FUTURE.map((s) => ({
      ...s,
      acceptance: "future-spec-NOT-acceptance",
      verifiedOfficialClaim: false as const,
    })),
  );

// The engine profiles the current checker schema can actually express. Used by
// the runner to prove pending specs invent no future-schema fields.
export const KNOWN_PROFILE_KEYS = [
  "targetDegree",
  "intake",
  "nationality",
  "certificateCountry",
  "curriculumType",
  "board",
  "schoolGradePercent",
  "jeeAdvanced",
  "visaApplicationCountry",
  "hasExistingApsCertificate",
  "ib",
  "gce",
  "targetField",
] as const;
