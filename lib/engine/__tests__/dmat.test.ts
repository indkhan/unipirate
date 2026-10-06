import { describe, expect, it } from "vitest";
import { deriveFacts, EngineRuleSchema, evaluate, type Profile } from "../evaluate";
import { ruleData } from "@/scripts/rules.bootstrap";
import { p3Indian3yrBsc } from "./personas";
import { dmatProfile, reviewedDmatRules } from "./dmat.fixture";

describe("UP-ELIG-07 procedure-specific dMAT", () => {
  it("preserves the intake boundary for the new profile contract", () => {
    expect(evaluate({ ...dmatProfile, intake: { term: "winter", year: 2026 } }, reviewedDmatRules()).dMAT).toBe("not_required");
    expect(evaluate(dmatProfile, reviewedDmatRules()).dMAT).toBe("required");
  });
  it("keeps the exact legacy certificate-only profile readable but unresolved", () => {
    const profile = { ...p3Indian3yrBsc, hasExistingApsCertificate: true };
    expect(evaluate(profile, ruleData).dMAT).toBe("unknown");
  });

  it("does not use possession of an old certificate for a new evaluation", () => {
    const profile: Profile = { ...p3Indian3yrBsc, hasExistingApsCertificate: true,
      tertiaryQualification: { issuer: "Example University", country: "in", context: "national" },
      apsProcedure: { status: "new_evaluation" } };
    expect(evaluate(profile, ruleData).dMAT).toBe("unknown");
  });

  it("provides source-backed dMAT candidates as drafts pending admin review", () => {
    const candidates = ruleData.filter(r => r.id.startsWith("dmat-reviewed-"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(r => r.status === "draft")).toBe(true);
  });

  it("requires a clearly reported affected group only on reviewed draft copies", () => {
    expect(evaluate(dmatProfile, ruleData).dMAT).toBe("unknown");
    const result = evaluate(dmatProfile, reviewedDmatRules());
    expect(result.dMAT).toBe("required");
    expect(result.path).toBe("unknown");
    expect(result.citations.some(c => c.supports.includes("dMAT") && c.sourceUrl === "https://aps-india.de/dmat/")).toBe(true);
  });

  it.each(["Engineering", "Commerce / Accounting / Finance / Economics", "Business / Management"])("supports reported %s without consulting the target field", entry => {
    const profile = { ...dmatProfile, targetField: "humanities", dmat: { ...dmatProfile.dmat!, field: { ...dmatProfile.dmat!.field!, entry } } } as Profile;
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("required");
  });

  it.each(["B.Sc. Computer Science", "BCA", "IT", "AI", "Data Science", "B.Tech", "Engineering Management", "unlisted degree"])("does not classify raw title %s", degreeTitle => {
    const profile = { ...dmatProfile, qualificationHistory: { ...dmatProfile.qualificationHistory!, field: degreeTitle },
      dmat: { ...dmatProfile.dmat!, degreeTitle, field: { basis: "unknown" as const } } };
    const result = evaluate(profile, reviewedDmatRules());
    expect(result.dMAT).toBe("unknown");
    expect(result.unknowns.join(" ")).toMatch(/classification.*APS India/i);
  });

  it("requires official confirmation for an unaffected classification", () => {
    const profile = { ...dmatProfile, dmat: { ...dmatProfile.dmat!, field: { basis: "aps_confirmation" as const,
      classification: "unaffected" as const, reference: "APS response for this official degree and branch" } } };
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("not_required");
    expect(evaluate({ ...profile, dmat: { ...profile.dmat, field: { ...profile.dmat.field, reference: " " } } }, reviewedDmatRules()).dMAT).toBe("unknown");
  });

  it.each(["multiple", "unknown"] as const)("requests review for %s qualifications", qualificationScope => {
    const result = evaluate({ ...dmatProfile, dmat: { ...dmatProfile.dmat!, qualificationScope } }, reviewedDmatRules());
    expect(result.dMAT).toBe("unknown");
    expect(result.unknowns.join(" ")).toMatch(/qualification.*APS India/i);
  });

  it("exempts the relevant completed procedure, never certificate possession alone", () => {
    const completed = { ...dmatProfile, hasExistingApsCertificate: true,
      dmat: { qualificationScope: "single" as const, procedure: "relevant_completed" as const } };
    expect(evaluate(completed, reviewedDmatRules()).dMAT).toBe("not_required");
    expect(evaluate({ ...completed, hasExistingApsCertificate: false }, reviewedDmatRules()).dMAT).toBe("unknown");
    expect(evaluate({ ...dmatProfile, hasExistingApsCertificate: true,
      dmat: { ...dmatProfile.dmat!, procedure: "current_new" } }, reviewedDmatRules()).dMAT).toBe("required");
  });

  it.each(["registration", "dispatch"] as const)("uses distinct %s dates at the June boundary", event => {
    for (const [date, expected] of [["2026-06-28", "not_required"], ["2026-06-29", "required"], ["2026-06-30", "required"]]) {
      const profile = { ...dmatProfile, dmat: { ...dmatProfile.dmat!,
        [event]: { status: event === "registration" ? "completed" : "complete", date } } } as Profile;
      expect(evaluate(profile, reviewedDmatRules()).dMAT, `${event}: ${date}`).toBe(expected);
      expect(deriveFacts(profile)[event === "registration" ? "dmat_registration_day" : "dmat_complete_dispatch_day"]).toBe(Number(date.replaceAll("-", "")));
      expect(deriveFacts(profile)).not.toHaveProperty("aps_confirmed_submission_day");
    }
  });

  it.each(["incomplete", "unknown"] as const)("never exempts %s shipment", status => {
    const profile = { ...dmatProfile, dmat: { ...dmatProfile.dmat!, dispatch: { status, date: "2026-06-28" } } };
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("unknown");
    expect(deriveFacts(profile)).not.toHaveProperty("dmat_complete_dispatch_day");
  });

  it("retains complete dispatch exemption with later receipt and pending verification", () => {
    const profile = { ...dmatProfile, apsProcedure: { status: "pending" as const },
      dmat: { ...dmatProfile.dmat!, dispatch: { status: "complete" as const, date: "2026-06-28" } },
      apsDocumentsReceivedDate: "2026-06-30" };
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("not_required");
  });

  it("exempts only a confirmed partnership with its confirmation details", () => {
    const confirmed = { status: "confirmed" as const, kind: "exchange" as const,
      issuerRole: "home_institution" as const, issuer: "Example University", groupNumber: "A123", reference: "Official exchange confirmation" };
    expect(evaluate({ ...dmatProfile, dmat: { ...dmatProfile.dmat!, partnership: confirmed } }, reviewedDmatRules()).dMAT).toBe("not_required");
    for (const partnership of [{ status: "pending" as const }, { status: "unknown" as const }, { ...confirmed, groupNumber: "" }]) {
      expect(evaluate({ ...dmatProfile, dmat: { ...dmatProfile.dmat!, partnership } }, reviewedDmatRules()).dMAT).toBe("unknown");
    }
  });

  it.each([[3, 4, "not_required"], [3, 5, "required"], [4, 6, "not_required"], [4, 7, "required"]])("uses actual semester count: %i years, %i semesters", (degreeYears, completedSemesters, expected) => {
    const profile = { ...dmatProfile, qualificationHistory: { ...dmatProfile.qualificationHistory!, completion: "in_progress" as const, degreeYears, completedYears: 0 },
      dmat: { ...dmatProfile.dmat!, completedSemesters } };
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe(expected);
    expect(evaluate({ ...profile, dmat: { ...profile.dmat, completedSemesters: undefined } }, reviewedDmatRules()).dMAT).toBe("unknown");
  });

  it("keeps missing events, invalid dates, unknown basis/version and issuer context unresolved", () => {
    const variants: Profile[] = [
      { ...dmatProfile, dmat: { ...dmatProfile.dmat!, registration: undefined } },
      { ...dmatProfile, dmat: { ...dmatProfile.dmat!, dispatch: undefined } },
      { ...dmatProfile, dmat: { ...dmatProfile.dmat!, registration: { status: "completed", date: "2026-02-29" } } },
      { ...dmatProfile, dmat: { ...dmatProfile.dmat!, procedure: "unknown" } },
      { ...dmatProfile, tertiaryQualification: { issuer: "Example University", country: "in", context: "unknown" } },
      { ...dmatProfile, tertiaryQualification: { country: "in", context: "national" } },
      { ...dmatProfile, intake: undefined },
    ];
    for (const profile of variants) expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("unknown");
    const unsupportedVersion = { ...dmatProfile, dmat: { ...dmatProfile.dmat!, field: { ...dmatProfile.dmat!.field!, version: "2.0" } } } as unknown as Profile;
    expect(evaluate(unsupportedVersion, reviewedDmatRules()).dMAT).toBe("unknown");
  });

  it("keeps nationality/visa independent and recognition/admission unchanged", () => {
    const base = evaluate(dmatProfile, reviewedDmatRules());
    for (const nationality of ["in", "pk", "sa"]) {
      const result = evaluate({ ...dmatProfile, nationality, visaApplicationCountry: "sa" }, reviewedDmatRules());
      expect(result.dMAT).toBe("required");
      expect(result.path).toBe(base.path);
      expect(result.apsScopes).toEqual(base.apsScopes);
    }
    expect(evaluate({ ...dmatProfile, tertiaryQualification: { issuer: "Saudi University", country: "sa", context: "national" } }, reviewedDmatRules()).dMAT).toBe("unknown");
  });

  it("keeps legacy raw fields, date keys and partnership booleans disabled", () => {
    for (const key of ["prior_degree_field", "partnership_program", "aps_registration_day", "aps_documents_shipped_day"]) {
      expect(EngineRuleSchema.safeParse({ ...ruleData[0], conditions: { [key]: "unknown" } }).success).toBe(false);
    }
  });
  it("preserves non-dMAT outcomes on a mixed legacy certificate rule", () => {
    const rule = { ...ruleData.find(r => r.id === "dmat-india-existing-aps-exempt")!, outcomes: { dmat: "not_required", testas: "required" } };
    const result = evaluate({ ...p3Indian3yrBsc, hasExistingApsCertificate: true }, [rule]);
    expect(result.dMAT).toBe("unknown");
    expect(result.testAS).toBe("required");
  });
});
