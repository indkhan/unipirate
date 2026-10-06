import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile, isAnswered, normalizeAnswers, PartialAnswersSchema, visibleSteps, withAnswer } from "../steps";
import { deriveFacts, evaluate } from "@/lib/engine/evaluate";
import { reviewedDmatRules } from "@/lib/engine/__tests__/dmat.fixture";

import { dmatAnswers } from "./dmat.fixture";

describe("UP-ELIG-07 progressive reported inputs", () => {
  it.each(["single", "multiple", "unknown"] as const)("round-trips the earlier intake with %s qualification scope", dmatQualificationScope => {
    const answers = AnswersSchema.parse({ ...dmatAnswers, dmatQualificationScope, intake: { term: "winter", year: 2026 } });
    expect(evaluate(buildProfile(answers), reviewedDmatRules()).dMAT).toBe("not_required");
    expect(evaluate(buildProfile(AnswersSchema.parse({ ...answers, intake: { term: "summer", year: 2027 } })), reviewedDmatRules()).dMAT)
      .toBe(dmatQualificationScope === "single" ? "required" : "unknown");
    expect(evaluate(buildProfile(AnswersSchema.parse({ ...answers, intake: null })), reviewedDmatRules()).dMAT).toBe("unknown");
  });

  const unknownProcedure = { ...dmatAnswers, dmatProcedure: "unknown" } as const;
  const confirmedPartnership = { ...unknownProcedure, dmatPartnershipStatus: "confirmed", dmatPartnershipKind: "exchange",
    dmatPartnershipIssuerRole: "home_institution", dmatPartnershipIssuer: "Home University", dmatPartnershipGroup: "G1",
    dmatPartnershipReference: "Official exchange confirmation" } as const;
  const unaffected = { ...unknownProcedure, dmatFieldBasis: "aps_confirmation", dmatApsClassification: "unaffected",
    dmatClassificationReference: "APS confirmation for this qualification" } as const;

  it("collects independent partnership and APS classification with uncertain procedure", () => {
    for (const input of [confirmedPartnership, unaffected]) {
      const parsed = AnswersSchema.parse(input);
      const profile = buildProfile(parsed);
      expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("not_required");
      expect(profile.dmat?.procedure).toBe("unknown");
    }
    expect(AnswersSchema.parse(confirmedPartnership).dmatPartnershipGroup).toBe("G1");
    expect(AnswersSchema.parse(unaffected).dmatClassificationReference).toBe(unaffected.dmatClassificationReference);
  });

  it.each([[3, 4, "not_required"], [3, 5, "unknown"], [4, 6, "not_required"], [4, 7, "unknown"]] as const)(
    "uses actual semester boundary with uncertain procedure: %i years, %i semesters", (priorDegreeYears, dmatCompletedSemesters, expected) => {
      const input = { ...unknownProcedure, priorStudyCompletion: "in_progress", priorDegreeYears,
        yearsOfUniversityStudy: 2, dmatSemesterStatus: "known", dmatCompletedSemesters } as const;
      expect(evaluate(buildProfile(AnswersSchema.parse(input)), reviewedDmatRules()).dMAT).toBe(expected);
      expect(AnswersSchema.safeParse({ ...input, dmatCompletedSemesters: undefined }).success).toBe(false);
      expect(evaluate(buildProfile(AnswersSchema.parse({ ...input, dmatSemesterStatus: "unknown" })), reviewedDmatRules()).dMAT).toBe("unknown");
    });

  it("keeps unknown/negative evidence unresolved and incomplete confirmations invalid", () => {
    expect(PartialAnswersSchema.safeParse({ ...confirmedPartnership, dmatPartnershipReference: "" }).success).toBe(true);
    expect(AnswersSchema.safeParse({ ...confirmedPartnership, dmatPartnershipReference: "" }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...confirmedPartnership, dmatPartnershipGroup: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...unaffected, dmatClassificationReference: undefined }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...unknownProcedure, dmatPartnershipStatus: undefined }).success).toBe(false);
    for (const dmatPartnershipStatus of ["none", "pending", "unknown"] as const) {
      expect(evaluate(buildProfile(AnswersSchema.parse({ ...confirmedPartnership, dmatPartnershipStatus })), reviewedDmatRules()).dMAT).toBe("unknown");
    }
    for (const dmatApsClassification of ["affected", "unknown"] as const) {
      expect(evaluate(buildProfile(AnswersSchema.parse({ ...unaffected, dmatApsClassification })), reviewedDmatRules()).dMAT).toBe("unknown");
    }
  });

  it("prunes procedure-specific timing while preserving independent evidence across procedure edits", () => {
    const current = { ...confirmedPartnership, dmatProcedure: "current_initial", dmatRegistrationStatus: "completed",
      dmatRegistrationDate: "2026-06-28", dmatDispatchStatus: "complete", dmatDispatchDate: "2026-06-29" } as const;
    const changed = withAnswer(current, "dmatProcedure", "unknown");
    expect(changed.dmatPartnershipGroup).toBe("G1");
    expect(changed.dmatFieldEntry).toBe("Engineering");
    expect(changed).not.toHaveProperty("dmatRegistrationStatus");
    expect(changed).not.toHaveProperty("dmatDispatchDate");
    expect(evaluate(buildProfile(AnswersSchema.parse(changed)), reviewedDmatRules()).dMAT).toBe("not_required");
    const newProcedure = withAnswer(changed, "dmatProcedure", "current_new");
    expect(newProcedure.dmatPartnershipReference).toBe(current.dmatPartnershipReference);
    expect(newProcedure).not.toHaveProperty("dmatRegistrationDate");
    expect(AnswersSchema.safeParse(newProcedure).success).toBe(false);
    expect(withAnswer(unaffected, "dmatProcedure", "current_initial").dmatClassificationReference).toBe(unaffected.dmatClassificationReference);
    const enrolled = { ...unknownProcedure, priorStudyCompletion: "in_progress", dmatSemesterStatus: "known", dmatCompletedSemesters: 6 } as const;
    expect(withAnswer(enrolled, "dmatProcedure", "current_new").dmatCompletedSemesters).toBe(6);
    expect(withAnswer(enrolled, "priorStudyCompletion", "completed")).not.toHaveProperty("dmatCompletedSemesters");
    expect(withAnswer(confirmedPartnership, "dmatPartnershipStatus", "pending")).not.toHaveProperty("dmatPartnershipReference");
  });

  it("does not reuse timing or certificate possession when procedure is unknown", () => {
    const input = { ...unknownProcedure, hasExistingApsCertificate: true, dmatRegistrationStatus: "completed",
      dmatRegistrationDate: "2026-06-28", dmatDispatchStatus: "complete", dmatDispatchDate: "2026-06-28" } as const;
    const profile = buildProfile(AnswersSchema.parse(input));
    expect(profile.dmat?.registration).toBeUndefined();
    expect(profile.dmat?.dispatch).toBeUndefined();
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("unknown");
    expect(evaluate(buildProfile(AnswersSchema.parse({ ...input, dmatProcedure: "relevant_completed" })), reviewedDmatRules()).dMAT).toBe("not_required");
    expect(evaluate(buildProfile(AnswersSchema.parse({ ...input, dmatProcedure: "relevant_completed", hasExistingApsCertificate: false })), reviewedDmatRules()).dMAT).toBe("unknown");
  });
  it("validates, round-trips JSON and maps reports with a versioned source basis", () => {
    const answers = AnswersSchema.parse(JSON.parse(JSON.stringify(dmatAnswers)));
    const profile = buildProfile(answers);
    expect(profile.dmat?.field).toEqual({ basis: "list_v1", entry: "Engineering", version: "1.0",
      sourceUrl: "https://aps-india.de/wp-content/uploads/2026/06/dMAT_India_Affected_Fields_List.pdf" });
    expect(profile.dmat?.degreeTitle).toBe(dmatAnswers.dmatDegreeTitle);
    expect(profile.qualificationHistory?.field).toBe(dmatAnswers.priorStudyField);
    expect(evaluate(profile, reviewedDmatRules()).dMAT).toBe("required");
  });
  it("asks only master's Indian national tertiary cases for the new contract", () => {
    expect(visibleSteps(dmatAnswers)).toContain("dmatProcedure");
    for (const changes of [{ priorStudyCountry: "sa" }, { priorQualificationContext: "unknown" }, { targetDegree: "bachelor" }, { hasPriorUniversityStudy: false }]) {
      expect(visibleSteps({ ...dmatAnswers, ...changes } as typeof dmatAnswers)).not.toContain("dmatProcedure");
    }
  });
  it("preserves unversioned legacy answers without adding required questions", () => {
    const legacy = { targetDegree: "master", nationality: "in", certificateCountry: "in", curriculumType: "national",
      hasExistingApsCertificate: true, visaApplicationCountry: "in", targetField: "cs", intake: { term: "summer", year: 2027 } } as const;
    expect(AnswersSchema.safeParse(legacy).success).toBe(true);
    expect(evaluate(buildProfile(AnswersSchema.parse(legacy)), reviewedDmatRules()).dMAT).toBe("unknown");
  });
  it("requires explicit negative events without mandatory shipment dates", () => {
    expect(AnswersSchema.safeParse(dmatAnswers).success).toBe(true);
    const steps = visibleSteps(dmatAnswers);
    expect(steps).not.toContain("dmatRegistrationDate");
    expect(steps).not.toContain("dmatDispatchDate");
    expect(AnswersSchema.safeParse({ ...dmatAnswers, dmatDispatchStatus: undefined }).success).toBe(false);
  });
  it("accepts uncertainty without collecting an invented classification", () => {
    const unknown = { ...dmatAnswers, dmatFieldBasis: "unknown", dmatRegistrationStatus: "unknown", dmatDispatchStatus: "unknown", dmatPartnershipStatus: "pending" } as const;
    expect(AnswersSchema.safeParse(unknown).success).toBe(true);
    expect(evaluate(buildProfile(AnswersSchema.parse(unknown)), reviewedDmatRules()).dMAT).toBe("unknown");
    expect(normalizeAnswers(unknown)).not.toHaveProperty("dmatFieldEntry");
  });
  it("does not allow an unlisted entry or unaffected decision from the PDF", () => {
    expect(AnswersSchema.safeParse({ ...dmatAnswers, dmatFieldEntry: "BCA" }).success).toBe(false);
    const aps = { ...dmatAnswers, dmatFieldBasis: "aps_confirmation", dmatApsClassification: "unaffected", dmatClassificationReference: "APS confirmation of this degree" } as const;
    expect(AnswersSchema.safeParse(aps).success).toBe(true);
    expect(evaluate(buildProfile(AnswersSchema.parse(aps)), reviewedDmatRules()).dMAT).toBe("not_required");
    expect(AnswersSchema.safeParse({ ...aps, dmatClassificationReference: " " }).success).toBe(false);
  });
  it("collects separate Gregorian registration and complete dispatch dates", () => {
    const timed = { ...dmatAnswers, dmatRegistrationStatus: "completed", dmatRegistrationDate: "2026-06-29",
      dmatDispatchStatus: "complete", dmatDispatchDate: "2026-06-28" } as const;
    const facts = deriveFacts(buildProfile(AnswersSchema.parse(timed)));
    expect(facts.dmat_registration_day).toBe(20260629);
    expect(facts.dmat_complete_dispatch_day).toBe(20260628);
    expect(facts).not.toHaveProperty("aps_confirmed_submission_day");
    expect(AnswersSchema.safeParse({ ...timed, dmatDispatchDate: "2026-02-29" }).success).toBe(false);
    expect(PartialAnswersSchema.safeParse({ ...timed, dmatDispatchDate: "2026-02-" }).success).toBe(true);
    expect(isAnswered({ ...timed, dmatDispatchDate: "2026-02-29" }, "dmatDispatchDate")).toBe(false);
    expect(withAnswer(timed, "dmatDispatchStatus", "unknown")).not.toHaveProperty("dmatDispatchDate");
  });
  it("captures official partnership details and prunes them when pending", () => {
    const partnership = { ...dmatAnswers, dmatPartnershipStatus: "confirmed", dmatPartnershipKind: "double_degree",
      dmatPartnershipIssuerRole: "german_partner", dmatPartnershipIssuer: "German University", dmatPartnershipGroup: "P42",
      dmatPartnershipReference: "Official programme confirmation" } as const;
    expect(evaluate(buildProfile(AnswersSchema.parse(partnership)), reviewedDmatRules()).dMAT).toBe("not_required");
    expect(AnswersSchema.safeParse({ ...partnership, dmatPartnershipGroup: undefined }).success).toBe(false);
    expect(withAnswer(partnership, "dmatPartnershipStatus", "pending")).not.toHaveProperty("dmatPartnershipGroup");
  });
  it("asks actual semesters only for enrolled three/four-year bachelor history", () => {
    const enrolled = { ...dmatAnswers, priorStudyCompletion: "in_progress", dmatSemesterStatus: "known", dmatCompletedSemesters: 6 } as const;
    expect(visibleSteps(enrolled)).toContain("dmatCompletedSemesters");
    expect(AnswersSchema.safeParse({ ...enrolled, dmatCompletedSemesters: 6.5 }).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...enrolled, dmatSemesterStatus: "unknown" }).success).toBe(true);
    expect(visibleSteps(dmatAnswers)).not.toContain("dmatCompletedSemesters");
    expect(withAnswer(enrolled, "dmatSemesterStatus", "unknown")).not.toHaveProperty("dmatCompletedSemesters");
  });
  it("asks completed-procedure applicability explicitly and skips timing/classification", () => {
    const completed = { ...dmatAnswers, hasExistingApsCertificate: true, dmatProcedure: "relevant_completed" } as const;
    const steps = visibleSteps(completed);
    expect(steps).not.toContain("dmatRegistrationStatus");
    expect(steps).not.toContain("dmatFieldBasis");
    expect(evaluate(buildProfile(AnswersSchema.parse(completed)), reviewedDmatRules()).dMAT).toBe("not_required");
    expect(withAnswer(completed, "dmatProcedure", "current_new")).not.toHaveProperty("dmatRegistrationStatus");
  });
  it("retains the reported title while selecting the procedure so the flow can advance", () => {
    const selected = withAnswer({ ...dmatAnswers, dmatProcedure: undefined }, "dmatProcedure", "current_initial");
    expect(selected.dmatDegreeTitle).toBe("Bachelor of Technology");
    expect(isAnswered(selected, "dmatDegreeTitle")).toBe(true);
  });
  it("invalidates evidence after issuer, qualification, field or procedure edits", () => {
    for (const [key, value] of [["priorStudyInstitution", "Changed issuer"], ["priorQualificationType", "master"], ["priorStudyField", "Computing"], ["priorDegreeYears", 3], ["priorStudyCountry", "sa"], ["priorQualificationContext", "unknown"]] as const) {
      expect(withAnswer(dmatAnswers, key, value)).not.toHaveProperty("dmatProcedure");
    }
    const changed = withAnswer(dmatAnswers, "dmatDegreeTitle", "New official title");
    expect(changed).not.toHaveProperty("dmatFieldBasis");
    expect(changed).not.toHaveProperty("dmatProcedure");
    expect(withAnswer(dmatAnswers, "nationality", "sa").dmatFieldEntry).toBe("Engineering");
    expect(withAnswer(dmatAnswers, "visaApplicationCountry", "in").dmatFieldEntry).toBe("Engineering");
  });
});
