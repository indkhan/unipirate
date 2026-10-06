import { describe, expect, it } from "vitest";
import { CourseEvidenceSchema, OfferingVersionSchema, OfferingSchema, ProgrammeCorrectionSchema, parseOfferingRow } from "../offerings";
const id = "00000000-0000-4000-8000-000000000001";
const evidence = { source_url: "https://example.edu/official?intake=2027#deadline", source_quote: "Synthetic fixture: closing date 15 July 2027.", retrieved_at: "2026-10-06T12:00:00Z", last_verified_at: "2026-10-06T13:00:00Z", verified_by: id, source_hash: null };
const fact = { key: "closing", kind: "deadline", status: "verified", verbatim: evidence.source_quote, applicability: "Synthetic non-EU applicants", evidence: [evidence], deadline_kind: "application_closing", date: "2027-07-15", time: null, timezone: null, route: null };
const version = { offering_id: id, version: 1, review_status: "verified", reviewed_at: evidence.last_verified_at, reviewed_by: id, facts: [fact] };

it('rejects the reserved applicability key rather than silently dropping scope', () => {
  const scope = { programme_id: id, intake_term: 'winter', intake_year: 2027, applicant_group: 'Synthetic', applicability: JSON.parse('{"__proto__":"Synthetic scope"}') };
  expect(OfferingSchema.safeParse(scope).success).toBe(false);
  expect(() => parseOfferingRow({ ...scope, id, created_at: '2026-10-06T12:00:00Z' })).toThrow();
});
it.each([{}, JSON.parse('{"constructor":" Synthetic scope ","toString":false,"countries":[" XX ","YY"],"empty":[]}')])('round-trips ordinary applicability properties: %j', (applicability) => {
  const row = { programme_id: id, intake_term: 'winter', intake_year: 2027, applicant_group: 'Synthetic', applicability, id, created_at: '2026-10-06T12:00:00Z' };
  expect(parseOfferingRow(row)).toEqual(row);
  expect(JSON.stringify(parseOfferingRow(row).applicability)).toBe(JSON.stringify(applicability));
});

it.each([
  ['2026-10-06T12:00:00.0010000Z', '2026-10-06T12:00:00.0009999Z', false],
  ['2026-10-06T12:00:00.0009999Z', '2026-10-06T12:00:00.0000001Z', true],
  ['2026-10-06T23:59:59.9999999Z', '2026-10-06T23:59:59.9990000Z', true],
  ['2026-10-06T23:59:59.9999999Z', '2026-10-07T00:00:00Z', true],
  ['2026-10-07T00:00:00.001+01:00', '2026-10-06T23:00:00.0009999Z', false],
  ['2026-10-07T00:00:00.001+01:00', '2026-10-06T23:00:00.0019999Z', true],
  ['2026-10-06T12:00:00.1Z', '2026-10-06T12:00:00.10Z', true],
  ['2026-10-06T12:00:00Z', '2026-10-06T12:00:00.000Z', true],
] as const)('compares paired capture instants at milliseconds: %s / %s', (retrieved_at, last_verified_at, accepted) => {
  const capture = { ...evidence, retrieved_at, last_verified_at };
  const result = CourseEvidenceSchema.safeParse(capture);
  expect(result.success).toBe(accepted);
  if (result.success) expect(result.data).toEqual(capture);
});

it.each(['2026-10-05T24:00:00Z', '2026-02-29T12:00:00Z', '2026-10-05T12:00:60Z', '2026-10-05T12:00:00+16:00', '2026-10-05T12:00:00+01:60', '2026-10-05T12:00:00+0530', '2026-10-05T12:00:00+1600', '0000-01-01T12:00:00Z', '2026-10-05T12:00:00Z\n'])('rejects nonrepresentable capture timestamp %j', (retrieved_at) => {
  expect(CourseEvidenceSchema.safeParse({ ...evidence, retrieved_at }).success).toBe(false);
});
it.each([id.replaceAll('-', ''), `{${id}}`])('rejects noncanonical captured reviewer %s', (verified_by) => {
  expect(CourseEvidenceSchema.safeParse({ ...evidence, verified_by }).success).toBe(false);
});
it('preserves uppercase canonical reviewer spelling', () => {
  const capture = { ...evidence, verified_by: 'abcdefab-cdef-4abc-8abc-abcdefabcdef'.toUpperCase() };
  expect(CourseEvidenceSchema.parse(capture)).toEqual(capture);
});
it.each(['2024-02-29T12:00Z', '2026-10-05T12:00:00.123456Z', '2026-10-05T12:00:00+05:30', '2026-10-05T12:00:00-15:59'])('preserves accepted capture timestamp %s', (retrieved_at) => {
  const capture = { ...evidence, retrieved_at, last_verified_at: null, verified_by: null };
  expect(CourseEvidenceSchema.parse(capture)).toEqual(capture);
});
it.each(['\t', '\n', '\u00a0', '\u2000\u2028\u2029\ufeff'])('rejects JS blank capture wording/hash %j', (blank) => {
  expect(CourseEvidenceSchema.safeParse({ ...evidence, source_quote: blank }).success).toBe(false);
  expect(CourseEvidenceSchema.safeParse({ ...evidence, source_hash: blank }).success).toBe(false);
  for (const field of ['name', 'university_name', 'degree']) expect(ProgrammeCorrectionSchema.safeParse({ [field]: blank }).success).toBe(false);
  const scope = { programme_id: id, intake_term: 'winter', intake_year: 2027, applicant_group: 'Synthetic', applicability: {} };
  for (const change of [{ applicant_group: blank }, { applicability: { country: blank } }, { applicability: { country: [blank] } }]) expect(OfferingSchema.safeParse({ ...scope, ...change }).success).toBe(false);
  for (const field of ['key', 'applicability', 'verbatim', 'timezone']) expect(OfferingVersionSchema.safeParse({ ...version, facts: [{ ...fact, time: '12:00:00', [field]: blank }] }).success).toBe(false);
});
it('preserves nonblank whitespace around captured text', () => {
  const capture = { ...evidence, source_quote: '\tSynthetic wording\n', source_hash: '\u00a0hash\ufeff' };
  expect(CourseEvidenceSchema.parse(capture)).toEqual(capture);
});
describe("offering contracts", () => {
  it("preserves verbatim evidence, URL, dates and scoped deadline", () => { expect(OfferingVersionSchema.parse(version)).toEqual(version); });
  it("keeps pending research pending and allows missing facts", () => {
    const pending = { ...version, review_status: "pending", reviewed_at: null, reviewed_by: null, facts: [{ ...fact, status: "pending", date: null, evidence: [{ ...evidence, last_verified_at: null, verified_by: null }] }] };
    expect(OfferingVersionSchema.parse(pending)).toEqual(pending);
    expect(OfferingVersionSchema.parse({ ...pending, facts: [] }).facts).toEqual([]);
  });
  it.each([
    { facts: [{ ...fact, evidence: [] }] }, { facts: [{ ...fact, status: "pending" }] },
    { facts: [{ ...fact, date: "2027-02-29" }] }, { reviewed_at: null },
    { facts: [{ ...fact, verbatim: "Invented fixture assertion" }] },
    { facts: [{ ...fact, evidence: [{ ...evidence, last_verified_at: null }] }] },
    { facts: [fact, fact] }, { facts: [{ ...fact, time: "25:59:00", timezone: null }] },
    { facts: [{ ...fact, route: "direct" }] },
  ])("rejects invalid or unsupported reviewed data: %j", (change) => { expect(() => OfferingVersionSchema.parse({ ...version, ...change })).toThrow(); });
  it("accepts leap days and explicit earlier-year dates without changing intake", () => {
    for (const date of ["2028-02-29", "2026-07-15"]) {
      const wording = `Synthetic closing date ${date}`;
      expect(OfferingVersionSchema.parse({ ...version, facts: [{ ...fact, date, verbatim: wording, evidence: [{ ...evidence, source_quote: wording }] }] }).facts[0].date).toBe(date);
    }
  });
  it("accepts an unresolved route without fabricating evidence", () => {
    const unresolved = { ...fact, kind: "route", key: "route", status: "unresolved", verbatim: null, evidence: [], deadline_kind: null, date: null, route: "unresolved" };
    expect(OfferingVersionSchema.parse({ ...version, facts: [unresolved] }).facts[0].route).toBe("unresolved");
  });
  it.each(["direct", "uni_assist", "vpd_then_university"])("accepts evidenced route %s", (route) => {
    const wording = `Synthetic application route: ${route}`;
    expect(OfferingVersionSchema.parse({ ...version, facts: [{ ...fact, kind: "route", deadline_kind: null, date: null, route, verbatim: wording, evidence: [{ ...evidence, source_quote: wording }] }] }).facts[0].route).toBe(route);
  });
  it("requires explicit scope and preserves applicant-specific intake", () => {
    const scope = { programme_id: id, intake_term: "winter", intake_year: 2027, applicant_group: "Synthetic non-EU", applicability: { qualification_country: "XX" } };
    expect(OfferingSchema.parse(scope)).toEqual(scope);
    for (const change of [{ intake_year: null }, { applicant_group: " " }, { intake_year: 2027.5 }, { intake_year: 0 }]) expect(OfferingSchema.safeParse({ ...scope, ...change }).success).toBe(false);
  });
});


it.each(['language', 'prerequisite', 'fee', 'document', 'description'])('preserves independently reviewed %s facts', (kind) => {
  const field = { ...fact, kind, deadline_kind: null, date: null };
  expect(OfferingVersionSchema.parse({ ...version, facts: [field] }).facts[0]).toEqual(field);
});
it('preserves independent summer/winter and applicant-group scopes', () => {
  const common = { programme_id: id, intake_year: 2027, applicability: {} };
  const scopes = [
    { ...common, intake_term: 'summer', applicant_group: 'non-EU' },
    { ...common, intake_term: 'winter', applicant_group: 'non-EU' },
    { ...common, intake_term: 'winter', applicant_group: 'EU' },
  ];
  expect(scopes.map((s) => OfferingSchema.parse(s))).toEqual(scopes);
});
it('keeps multi-source captures and does not infer a timezone', () => {
  const wording = 'Synthetic closing date 15 July 2027 at 12:00:00';
  const field = { ...fact, verbatim: wording, time: '12:00:00', evidence: [{ ...evidence, source_quote: wording }, { ...evidence, source_url: 'https://example.edu/second', last_verified_at: null, verified_by: null }] };
  expect(OfferingVersionSchema.parse({ ...version, facts: [field] }).facts[0]).toEqual(field);
});

it.each(['https://Example.invalid:443/path?intake=2027#deadline', 'http://example.invalid:1/', 'https://example.invalid:65535?x=1#y'])('preserves accepted source URLs verbatim: %s', (source_url) => {
  expect(CourseEvidenceSchema.parse({ ...evidence, source_url }).source_url).toBe(source_url);
});
it.each(['https://example.invalid:bad/', 'https://example.invalid:65536/', 'https://example.invalid:0/', 'https://-bad.invalid/', 'https://bad-.invalid/', 'https://bad..invalid/', 'https://user@example.invalid/', 'https://999.999.999.999/', 'https://example.invalid/back\\slash'])('rejects unsupported source URLs: %s', (source_url) => {
  expect(CourseEvidenceSchema.safeParse({ ...evidence, source_url }).success).toBe(false);
});
