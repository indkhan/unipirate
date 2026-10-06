import { describe, expect, it } from "vitest";
import { OfferingVersionSchema, OfferingSchema } from "../offerings";
const id = "00000000-0000-4000-8000-000000000001";
const evidence = { source_url: "https://example.edu/official?intake=2027#deadline", source_quote: "Synthetic fixture: closing date 15 July 2027.", retrieved_at: "2026-10-06T12:00:00Z", last_verified_at: "2026-10-06T13:00:00Z", verified_by: id, source_hash: null };
const fact = { key: "closing", kind: "deadline", status: "verified", verbatim: evidence.source_quote, applicability: "Synthetic non-EU applicants", evidence: [evidence], deadline_kind: "application_closing", date: "2027-07-15", time: null, timezone: null, route: null };
const version = { offering_id: id, version: 1, review_status: "verified", reviewed_at: evidence.last_verified_at, reviewed_by: id, facts: [fact] };
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
    expect(OfferingVersionSchema.parse({ ...version, facts: [{ ...fact, date: "2028-02-29" }] }).facts[0].date).toBe("2028-02-29");
    expect(OfferingVersionSchema.parse({ ...version, facts: [{ ...fact, date: "2026-07-15" }] }).facts[0].date).toBe("2026-07-15");
  });
  it("accepts an unresolved route without fabricating evidence", () => {
    const unresolved = { ...fact, kind: "route", key: "route", status: "unresolved", verbatim: null, evidence: [], deadline_kind: null, date: null, route: "unresolved" };
    expect(OfferingVersionSchema.parse({ ...version, facts: [unresolved] }).facts[0].route).toBe("unresolved");
  });
  it.each(["direct", "uni_assist", "vpd_then_university"])("accepts evidenced route %s", (route) => {
    expect(OfferingVersionSchema.parse({ ...version, facts: [{ ...fact, kind: "route", deadline_kind: null, date: null, route }] }).facts[0].route).toBe(route);
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
  const field = { ...fact, time: '12:00:00', evidence: [evidence, { ...evidence, source_url: 'https://example.edu/second', last_verified_at: null, verified_by: null }] };
  expect(OfferingVersionSchema.parse({ ...version, facts: [field] }).facts[0]).toEqual(field);
});
