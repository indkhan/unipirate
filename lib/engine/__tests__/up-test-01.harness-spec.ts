// UP-TEST-01 harness milestone: versioned current-behavior corpus.
// Every row restates an outcome already asserted by the evaluate /
// edge-cases suites against ./personas.ts + ./rules.fixture.ts —
// "current behavior", not official correctness. FUTURE rows are unverified
// specification data for the route issues, never executable acceptance.
// Pure module: zero I/O. No new educational, visa, or fee facts.
import type { Profile, Result } from "../evaluate";
import * as personas from "./personas";

// UP-ELIG-05 only: APS baseline scalars remain unknown pending explicit
// issuer/scope review. Admission, dMAT and other expectations are unchanged.
export const HARNESS_VERSION = "up-test-01/v1-current-behavior.1" as const;
export const HARNESS_BASELINE_SHA =
  "951ab821920497443cd66dfc7917d044a1f00159" as const;

export type Family =
  | "GCE"
  | "IB"
  | "India"
  | "Pakistan"
  | "Saudi"
  | "APS"
  | "dMAT";
export type CaseKind =
  | "positive"
  | "negative"
  | "boundary"
  | "missing"
  | "exception";

export type CurrentExpectation = {
  id: string;
  family: Family;
  kind: CaseKind;
  routesTo?: string[];
  assertedIn: string;
  profile: Profile;
  path?: Result["path"];
  aps?: Result["aps"];
  testAS?: Result["testAS"];
  dMAT?: Result["dMAT"];
  citedUrls?: string[];
  unknownsMatch?: RegExp[];
  documentSubstrings?: string[];
  stepSubstrings?: string[];
  minUnknowns?: number;
};

export type FutureSpec = {
  id: string;
  family: Family;
  issue: string;
  note: string;
  needsFutureSchema: boolean;
  verified: false;
};

const gceP11 = personas.p11ALevelsInSaudi;

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

const ibP13 = personas.p13IbInIndia;

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

export const CURRENT: CurrentExpectation[] = [
  {
    id: "IN-positive-studienkolleg", family: "India", kind: "positive",
    routesTo: ["UP-ELIG-03", "UP-ELIG-04"], profile: personas.p1CbseNoJee,
    path: "studienkolleg", aps: "unknown", testAS: "unknown", dMAT: "not_required",
    citedUrls: ["https://aps-india.de/news/"],
    assertedIn: "evaluate.test.ts: Part E persona 1",
  },
  {
    id: "IN-positive-jee-direct", family: "India", kind: "positive",
    routesTo: ["UP-ELIG-04"], profile: personas.p2CbseJeeAdvanced,
    path: "subject_restricted", aps: "unknown", testAS: "unknown",
    assertedIn: "evaluate.test.ts: Part E persona 2",
  },
  {
    id: "IN-boundary-65pct-ws2026-insufficient", family: "India", kind: "boundary",
    profile: { ...personas.p1CbseNoJee, schoolGradePercent: 65 },
    path: "insufficient",
    assertedIn: "evaluate.test.ts: India 70% cutoff (WS 2026/27)",
  },
  {
    id: "IN-boundary-65pct-ss2026-studienkolleg", family: "India", kind: "boundary",
    profile: { ...personas.p1CbseNoJee, schoolGradePercent: 65, intake: { term: "summer", year: 2026 } },
    path: "studienkolleg",
    assertedIn: "evaluate.test.ts: India 70% cutoff (SS 2026)",
  },
  {
    id: "IN-boundary-jee-low-score-still-direct", family: "India", kind: "boundary",
    routesTo: ["UP-ELIG-04"], profile: { ...personas.p2CbseJeeAdvanced, schoolGradePercent: 65 },
    path: "subject_restricted",
    assertedIn: "evaluate.test.ts: JEE Advanced with <70% Class XII",
  },
  {
    id: "IN-missing-grade-honest-unknown", family: "India", kind: "missing",
    routesTo: ["UP-ELIG-10"],
    profile: { ...personas.p1CbseNoJee, schoolGradePercent: undefined },
    path: "unknown", unknownsMatch: [/confirm/i],
    assertedIn: "edge-cases.test.ts: missing grades cannot satisfy",
  },
  {
    id: "IN-cross-country-riyadh-cbse", family: "India", kind: "positive",
    routesTo: ["UP-ELIG-01", "UP-ELIG-05"], profile: personas.p9CbseInRiyadh,
    path: "studienkolleg", aps: "unknown", testAS: "unknown",
    citedUrls: ["https://www.vfsglobal.com/Germany/SaudiArabia/pdf/Checklist_Student_Visa.pdf"],
    assertedIn: "evaluate.test.ts: Part E persona 9",
  },
  {
    id: "PK-negative-fsc-honest-unknown", family: "Pakistan", kind: "negative",
    routesTo: ["UP-ELIG-08"], profile: personas.p5PakistaniFsc,
    path: "unknown", aps: "unknown", dMAT: "not_required",
    unknownsMatch: [/official|confirm/i], stepSubstrings: ["Consular Services Portal"],
    assertedIn: "evaluate.test.ts: Part E persona 5",
  },
  {
    id: "PK-negative-2yr-bcom-unknown", family: "Pakistan", kind: "negative",
    routesTo: ["UP-ELIG-08"], profile: personas.p6Pakistani2yrBcom,
    path: "unknown", aps: "unknown", dMAT: "unknown", unknownsMatch: [/confirm/i],
    assertedIn: "evaluate.test.ts: Part E persona 6",
  },
  {
    id: "PK-exception-4yr-bs-unknown", family: "Pakistan", kind: "exception",
    routesTo: ["UP-ELIG-08"], profile: personas.p7Pakistani4yrBs,
    path: "unknown", aps: "unknown", dMAT: "unknown", unknownsMatch: [/confirm/i],
    assertedIn: "evaluate.test.ts: Part E persona 7",
  },
  {
    id: "SA-positive-tawjihiyah-studienkolleg", family: "Saudi", kind: "positive",
    routesTo: ["UP-ELIG-09"], profile: personas.p8SaudiTawjihiyah,
    path: "studienkolleg", aps: "unknown",
    citedUrls: ["https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436"],
    assertedIn: "evaluate.test.ts: Part E persona 8",
  },
  {
    id: "SA-exception-bachelor-unknown-path", family: "Saudi", kind: "exception",
    routesTo: ["UP-ELIG-09"], profile: personas.p10SaudiBachelor,
    path: "unknown", aps: "unknown", dMAT: "unknown", minUnknowns: 1,
    assertedIn: "evaluate.test.ts: Part E persona 10",
  },
  {
    id: "GCE-positive-sa-three-al-direct", family: "GCE", kind: "positive",
    routesTo: ["UP-ELIG-01"], profile: gceP11,
    path: "subject_restricted", aps: "unknown",
    citedUrls: ["https://www.daad.de/en/studying-in-germany/requirements/gce/"],
    assertedIn: "evaluate.test.ts: Part E persona 11",
  },
  {
    id: "GCE-positive-three-al-no-as-required", family: "GCE", kind: "boundary",
    profile: gceThreeAlOnly, path: "subject_restricted",
    assertedIn: "evaluate.test.ts: three qualifying A-Levels without AS",
  },
  {
    id: "GCE-negative-grades-below-c", family: "GCE", kind: "negative",
    profile: gceGradesBelowC, path: "unknown",
    assertedIn: "evaluate.test.ts: GCE grades below C never direct",
  },
  {
    id: "GCE-exception-pk-anabin-caveat", family: "GCE", kind: "exception",
    routesTo: ["UP-ELIG-01", "UP-ELIG-08"], profile: personas.p12ALevelsInPakistan,
    path: "unknown", aps: "unknown", unknownsMatch: [/anabin/i],
    assertedIn: "evaluate.test.ts: Part E persona 12",
  },
  {
    id: "IB-negative-sl-stem-studienkolleg", family: "IB", kind: "negative",
    routesTo: ["UP-ELIG-02"], profile: ibP13,
    path: "studienkolleg", aps: "unknown", unknownsMatch: [/APS/],
    citedUrls: ["https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/"],
    assertedIn: "evaluate.test.ts: Part E persona 13",
  },
  {
    id: "IB-missing-no-diploma-unknown", family: "IB", kind: "missing",
    routesTo: ["UP-ELIG-02"], profile: ibNoDiploma, path: "unknown",
    assertedIn: "evaluate.test.ts: IB without full diploma",
  },
  {
    id: "IB-negative-missing-hl-structure", family: "IB", kind: "negative",
    profile: ibMissingHlStructure, path: "unknown",
    assertedIn: "evaluate.test.ts: IB missing HL structure",
  },
  {
    id: "APS-legacy-india-unresolved", family: "APS", kind: "positive",
    routesTo: ["UP-ELIG-05", "UP-ELIG-06"], profile: personas.p1CbseNoJee,
    aps: "unknown",
    citedUrls: ["https://aps-india.de/news/"],
    assertedIn: "evaluate.test.ts: Part E persona 1",
  },
  {
    id: "APS-legacy-sa-visa-unresolved", family: "APS", kind: "positive",
    routesTo: ["UP-ELIG-05"], profile: personas.p8SaudiTawjihiyah,
    aps: "unknown",
    citedUrls: ["https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436"],
    assertedIn: "evaluate.test.ts: Part E persona 8",
  },
  {
    id: "APS-missing-pk-unknown", family: "APS", kind: "missing",
    routesTo: ["UP-ELIG-05", "UP-ELIG-10"], profile: personas.p5PakistaniFsc,
    aps: "unknown",
    assertedIn: "evaluate.test.ts: Part E persona 5",
  },
  {
    id: "APS-missing-ib-india-unknown", family: "APS", kind: "missing",
    routesTo: ["UP-ELIG-05", "UP-ELIG-06"], profile: ibP13,
    aps: "unknown", unknownsMatch: [/APS/],
    assertedIn: "evaluate.test.ts: Part E persona 13",
  },
  {
    id: "DMAT-negative-bachelor-not-required", family: "dMAT", kind: "negative",
    routesTo: ["UP-ELIG-07"], profile: personas.p1CbseNoJee,
    dMAT: "not_required",
    assertedIn: "evaluate.test.ts: Part E persona 1",
  },
  {
    id: "DMAT-missing-india-3yr-unknown", family: "dMAT", kind: "missing",
    routesTo: ["UP-ELIG-07", "UP-ELIG-11"], profile: personas.p3Indian3yrBsc,
    path: "unknown", aps: "unknown", testAS: "unknown", dMAT: "unknown",
    unknownsMatch: [/aps-india\.de\/dmat/],
    assertedIn: "evaluate.test.ts: Part E persona 3",
  },
  {
    id: "DMAT-boundary-ws2026-not-required", family: "dMAT", kind: "boundary",
    routesTo: ["UP-ELIG-07"], profile: personas.p4Indian4yrBtech,
    path: "unknown", aps: "unknown", dMAT: "not_required",
    assertedIn: "evaluate.test.ts: Part E persona 4",
  },
  {
    id: "DMAT-exception-existing-aps-exempt", family: "dMAT", kind: "exception",
    profile: { ...personas.p3Indian3yrBsc, hasExistingApsCertificate: true },
    dMAT: "not_required",
    assertedIn: "evaluate.test.ts: completed APS exempts dMAT",
  },
  {
    id: "DMAT-missing-unstated-field-unknown", family: "dMAT", kind: "missing",
    routesTo: ["UP-ELIG-07", "UP-ELIG-11"],
    profile: {
      targetDegree: "master", intake: { term: "summer", year: 2027 },
      nationality: "in", certificateCountry: "in", curriculumType: "national",
    },
    dMAT: "unknown", unknownsMatch: [/dMAT/],
    assertedIn: "evaluate.test.ts: unstated prior-degree field",
  },
  {
    id: "DMAT-boundary-saudi-degree-out-of-tree", family: "dMAT", kind: "boundary",
    profile: {
      targetDegree: "master", intake: { term: "summer", year: 2027 },
      nationality: "in", certificateCountry: "sa", curriculumType: "national",
      hasExistingApsCertificate: false,
    },
    dMAT: "unknown",
    assertedIn: "evaluate.test.ts: Saudi degree outside India dMAT tree",
  },
];

export const FUTURE: FutureSpec[] = [
  { id: "FUTURE-GCE-fourth-al-trio", family: "GCE", issue: "UP-ELIG-01", needsFutureSchema: false, verified: false, note: "Valid 3-AL trio passes despite a fourth AL below C; two qualifying ALs state the exact unmet condition." },
  { id: "FUTURE-IB-grade3-compensation", family: "IB", issue: "UP-ELIG-02", needsFutureSchema: true, verified: false, note: "One compensated grade 3 passes where KMK rules allow; Math-SL school exceptions with effective sessions." },
  { id: "FUTURE-India-one-year-route", family: "India", issue: "UP-ELIG-03", needsFutureSchema: true, verified: false, note: "Class XII >=70% + one successful recognized related bachelor year gives direct subject-restricted access." },
  { id: "FUTURE-India-jee-main-plus-advanced", family: "India", issue: "UP-ELIG-04", needsFutureSchema: true, verified: false, note: "Separate JEE Main + Advanced facts restrict the route to technology/natural-science targets." },
  { id: "FUTURE-APS-transition-date", family: "APS", issue: "UP-ELIG-06", needsFutureSchema: true, verified: false, note: "APS procedure/status + timing facts select the pre/post March-2026-transition rule." },
  { id: "FUTURE-dMAT-affected-field", family: "dMAT", issue: "UP-ELIG-07", needsFutureSchema: true, verified: false, note: "Prior-degree field, partnership status, and APS timing drive required/not-required/targeted-review." },
  { id: "FUTURE-Pakistan-hssc-streams", family: "Pakistan", issue: "UP-ELIG-08", needsFutureSchema: true, verified: false, note: "HSSC/FSc stream-specific Studienkolleg routes, 49.99/50 boundary, one-year direct routes." },
  { id: "FUTURE-Saudi-certificate-subtypes", family: "Saudi", issue: "UP-ELIG-09", needsFutureSchema: true, verified: false, note: "Exact certificate type/stream drives national, private-school, industrial, and graduate routes." },
];
