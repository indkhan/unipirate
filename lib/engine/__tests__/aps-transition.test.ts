import { describe, expect, it } from "vitest";
import { deriveFacts, evaluate, EngineRuleSchema, type Profile } from "../evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";
import { calendarDay, CalendarDateSchema } from "../calendar-day";
import { legacyTransitionRules } from "./aps-transition-legacy.fixture";

const transitionProfile: Profile = {
  targetDegree: "bachelor", curriculumType: "national", board: "cbse",
  schoolQualification: { country: "in", context: "national" },
  schoolGradePercent: 65, jeeAdvanced: false,
  intake: { term: "winter", year: 2026 }, hasExistingApsCertificate: false,
};
const procedure = (date: string) => ({status: "pending", submissionConfirmation: "confirmed", submissionDate: date} as const);

describe("UP-ELIG-06 confirmed complete APS submission", () => {
  it("leaves the exact authorized public grandfather record inactive until human rule review", () => {
    const grandfather = legacyTransitionRules.find(r => r.slug === "in-70pct-grandfathered-aps-unknown")!;
    expect(grandfather.id).toBe("1cb0cf24-8f39-44b4-b692-b9cb164e47fd");
    expect(grandfather.conditions).toHaveProperty("aps_application_day", {op: "lt", value: 20260315});
    expect(grandfather.outcomes.path).toBe("unknown");
    expect(EngineRuleSchema.safeParse(grandfather).success).toBe(false);
    const before = {...transitionProfile, apsProcedure: procedure("2026-03-14")};
    expect(evaluate(before, [...legacyTransitionRules]).path).toBe("insufficient");
    expect(evaluate(before, [...legacyTransitionRules]).citations.some(c => c.ruleId === grandfather.id)).toBe(false);
    const reviewed = ruleData.filter(r => r.id.startsWith("aps-transition-")).map(r => ({...r, status: "verified"}));
    expect(evaluate(before, [...legacyTransitionRules, ...reviewed]).path).toBe("unknown");
    expect(evaluate(transitionProfile, [...legacyTransitionRules, ...reviewed]).path).toBe("unknown");
  });
  it("shares real Gregorian validation and YYYYMMDD units with dependent issues", () => {
    for (const date of ["0001-01-01", "1904-02-29", "2000-02-29", "9999-12-31"]) {
      expect(CalendarDateSchema.safeParse(date).success).toBe(true);
      expect(calendarDay(date)).toBe(Number(date.replaceAll("-", "")));
    }
    for (const date of ["2100-02-29", "2026-03-00", " 2026-03-14", 20260314, null]) expect(CalendarDateSchema.safeParse(date).success).toBe(false);
  });
  it.each(["pending", "completed", "new_evaluation"] as const)("uses only the confirmed date for this %s procedure", status => {
    expect(deriveFacts({...transitionProfile, apsProcedure: {...procedure("2026-03-16"), status}}).aps_confirmed_submission_day).toBe(20260316);
  });
  it.each(["2026-03-14", "2026-03-15", "2026-03-16", "2000-02-29"])("restates %s without timestamps", date => {
    expect(deriveFacts({...transitionProfile, apsProcedure: procedure(date)} as Profile).aps_confirmed_submission_day).toBe(Number(date.replaceAll("-", "")));
  });
  it.each(["2026-02-29", "1900-02-29", "2026-04-31", "2026-00-15", "2026-13-01", "0000-01-01", "15/03/2026", "2026-3-15", "2026-03-15T00:00:00Z"])("does not derive invalid %s", date => {
    expect(deriveFacts({...transitionProfile, apsProcedure: procedure(date)} as Profile)).not.toHaveProperty("aps_confirmed_submission_day");
  });
  it.each([undefined, {status: "unknown"}, {status: "pending", submissionConfirmation: "unknown", submissionDate: "2026-03-14"}, {status: "not_started", submissionConfirmation: "confirmed", submissionDate: "2026-03-14"}])("never invents a confirmed milestone: %j", apsProcedure => {
    expect(deriveFacts({...transitionProfile, apsProcedure} as Profile)).not.toHaveProperty("aps_confirmed_submission_day");
  });
  it("never treats registration/payment/shipment/receipt as submission", () => {
    for (const key of ["apsRegistrationDate", "apsPaymentDate", "apsDocumentsShippedDate", "apsDocumentsReceivedDate", "apsApplicationDate"]) {
      expect(deriveFacts({...transitionProfile, [key]: "2026-03-14"})).not.toHaveProperty("aps_confirmed_submission_day");
    }
  });
  it("does not activate legacy date or other unsupported facts", () => {
    for (const key of ["aps_application_day", "aps_registration_day", "aps_documents_shipped_day", "years_of_university_study", "partnership_program"]) {
      expect(EngineRuleSchema.safeParse({id: key, conditions: {[key]: 20260314}, outcomes: {path: "unknown"}, status: "verified", source_url: "https://aps-india.de/news/", source_quote: "Fixture", last_verified_at: "2026-10-07T00:00:00Z"}).success).toBe(false);
    }
  });
  it("keeps draft candidates out of runtime", () => {
    const candidates = ruleData.filter(r => r.id.startsWith("aps-transition-"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(r => r.status === "draft")).toBe(true);
    expect(evaluate({...transitionProfile, apsProcedure: procedure("2026-03-14")} as Profile, candidates).citations).toEqual([]);
  });
  it.each([["2026-03-14", "unknown", "aps-transition-before"], ["2026-03-15", "insufficient", "aps-transition-current"], ["2026-03-16", "insufficient", "aps-transition-current"]])("selects reviewed boundary %s", (date, path, id) => {
    const rules = ruleData.filter(r => r.id.startsWith("aps-transition-")).map(r => ({...r, status: "verified"}));
    const result = evaluate({...transitionProfile, apsProcedure: procedure(date)} as Profile, rules);
    expect(result.path).toBe(path);
    expect(result.citations.some(c => c.ruleId === id && c.supports.includes("path"))).toBe(true);
    expect(result.citations.every(c => c.sourceUrl === "https://aps-india.de/news/")).toBe(true);
  });
  it("asks the precise missing question without a certificate or 65% exemption", () => {
    const rules = ruleData.filter(r => r.id.startsWith("aps-transition-")).map(r => ({...r, status: "verified"}));
    for (const held of [true, false, undefined]) {
      const result = evaluate({...transitionProfile, hasExistingApsCertificate: held}, rules);
      expect(result.path).toBe("unknown");
      expect(result.unknowns.some(n => /APS.*confirm.*complete.*submission/i.test(n))).toBe(true);
    }
  });
  it("does not extend the transition to other qualifications or missing intakes", () => {
    const rules = ruleData.filter(r => r.id.startsWith("aps-transition-")).map(r => ({...r, status: "verified"}));
    for (const changed of [{targetDegree: "master"}, {curriculumType: "ib"}, {schoolQualification: undefined}, {schoolQualification: {country: "sa", context: "national"}}, {intake: undefined}, {intake: {term: "summer", year: 2026}}]) {
      const p = {...transitionProfile, apsProcedure: procedure("2026-03-14"), ...changed} as Profile;
      expect(deriveFacts(p)).not.toHaveProperty("aps_application_day");
      expect(evaluate(p, rules).citations.filter(c => c.supports.includes("path"))).toEqual([]);
    }
  });
  it("preserves scoped certificate fulfilment and does not invent a positive admission route", () => {
    const rules = ruleData.filter(r => r.id.startsWith("aps-transition-")).map(r => ({...r, status: "verified"}));
    for (const percent of [69.99, 70, 70.01]) {
      const result = evaluate({...transitionProfile, schoolGradePercent: percent, hasExistingApsCertificate: true, apsProcedure: procedure("2026-03-16")}, rules);
      expect(result.path).toBe(percent < 70 ? "insufficient" : "unknown");
      expect(result.apsCertificate).toBe("held");
      expect(result.apsScopes).toEqual({qualification: "unknown", application: "unknown", visa: "unknown"});
    }
  });
});
