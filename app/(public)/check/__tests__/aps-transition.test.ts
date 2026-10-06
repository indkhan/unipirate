import { describe, expect, it } from "vitest";
import { AnswersSchema, buildProfile, isAnswered, PartialAnswersSchema, visibleSteps, withAnswer, type PartialAnswers } from "../steps";
import { deriveFacts } from "@/lib/engine/evaluate";

const legacy = {targetDegree: "bachelor", nationality: "in", certificateCountry: "in", visaApplicationCountry: "in", curriculumType: "national", board: "cbse", schoolGradePercent: 65, jeeAdvanced: false, hasExistingApsCertificate: false, targetField: "cs", intake: {term: "winter", year: 2026}} as const;
const current = {...legacy, qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, hasPriorUniversityStudy: false, schoolQualificationCountry: "in", schoolQualificationContext: "national", apsApplicationContext: "unknown", apsProcedureStatus: "pending", apsSubmissionConfirmation: "confirmed", apsSubmissionDate: "2026-03-14"} as const;

describe("APS transition input contract", () => {
  it("reads legacy records without requiring new date answers", () => {
    expect(AnswersSchema.safeParse(legacy).success).toBe(true);
    expect(buildProfile(AnswersSchema.parse(legacy))).not.toHaveProperty("apsProcedure");
  });
  it("maps a reported APS-confirmed relevant submission", () => {
    const parsed = AnswersSchema.safeParse(current);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(deriveFacts(buildProfile(parsed.data)).aps_confirmed_submission_day).toBe(20260314);
  });
  it("asks only applicable progressive questions", () => {
    expect(visibleSteps(current as PartialAnswers)).toContain("apsSubmissionDate");
    expect(visibleSteps({...current, apsSubmissionConfirmation: "unknown"} as PartialAnswers)).not.toContain("apsSubmissionDate");
    expect(visibleSteps({...current, apsProcedureStatus: "not_started"} as PartialAnswers)).not.toContain("apsSubmissionConfirmation");
    for (const changes of [{targetDegree: "master"}, {curriculumType: "ib"}, {schoolQualificationCountry: "sa"}, {schoolQualificationContext: "unknown"}]) {
      expect(visibleSteps({...current, ...changes} as PartialAnswers)).not.toContain("apsProcedureStatus");
    }
  });
  it("accepts explicit uncertainty but requires confirmed date to be real", () => {
    expect(AnswersSchema.safeParse({...current, apsSubmissionConfirmation: "unknown", apsSubmissionDate: undefined}).success).toBe(true);
    for (const date of [undefined, "2026-02-29", "2026-04-31", "14/03/2026", "2026-03-14T00:00:00Z"]) {
      expect(AnswersSchema.safeParse({...current, apsSubmissionDate: date}).success).toBe(false);
    }
    expect(PartialAnswersSchema.safeParse({apsSubmissionDate: "2026-03-"}).success).toBe(true);
    expect(isAnswered({apsSubmissionDate: "2026-02-29"} as PartialAnswers, "apsSubmissionDate" as never)).toBe(false);
  });
  it("prunes dependent timing on procedure, confirmation and qualification edits", () => {
    for (const [key, value] of [["apsProcedureStatus", "new_evaluation"], ["apsSubmissionConfirmation", "unknown"], ["schoolQualificationCountry", "sa"], ["schoolQualificationContext", "unknown"], ["curriculumType", "ib"], ["board", "cisce"], ["schoolGradePercent", 66], ["hasExistingApsCertificate", true]] as const) {
      const edited = withAnswer(current as PartialAnswers, key as never, value as never);
      expect(edited).not.toHaveProperty("apsSubmissionDate");
    }
    const visaEdit = withAnswer(current as PartialAnswers, "visaApplicationCountry", "sa");
    expect(visaEdit.apsSubmissionDate).toBe("2026-03-14");
    expect(current.apsSubmissionDate).toBe("2026-03-14");
  });
  it("rejects milestone aliases rather than interpreting them", () => {
    for (const key of ["apsRegistrationDate", "apsPaymentDate", "apsDocumentsShippedDate", "apsDocumentsReceivedDate"]) {
      expect(AnswersSchema.safeParse({...current, [key]: "2026-03-14"}).success).toBe(false);
    }
  });
});
