import {expect, it} from "vitest";
import type {Tables} from "@/lib/db/database.types";
import {profileFromAnswers} from "../profile";
import {answers} from "@/lib/rules/__tests__/assessment-fixtures";
it("valid legacy answers retain current profile mapping without storage mutation", () => {const row={answers} as unknown as Tables<"profiles">;const before=JSON.stringify(row);expect(profileFromAnswers(row).profile?.intake).toEqual(answers.intake);expect(JSON.stringify(row)).toBe(before);});
it.each([{targetDegree: "bachelor", curriculumType: "other", intake: {term: "winter", year: "future"}}, {targetDegree: "bachelor", curriculumType: "other"}])("invalid partial/raw profiles cannot become current rule authority %j", answers => {
 expect(profileFromAnswers({answers} as unknown as Tables<"profiles">)).toEqual({profile: null, hasProfile: false});
});
it("missing profile remains unavailable", () => expect(profileFromAnswers(null)).toEqual({profile: null, hasProfile: false}));
