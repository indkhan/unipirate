// Pure entry and navigation policy. Attendance hints never establish an issuer.
import { z } from "zod";
import { COUNTRIES, isAnswered, visibleSteps, type PartialAnswers } from "./steps";

const degreeSchema = z.enum(["bachelor", "master"]);
const countrySchema = z.string().refine(code => COUNTRIES.some(country => country.code === code));

export function checkerEntry(params: { degree?: unknown; country?: unknown }): PartialAnswers {
  const degree = degreeSchema.safeParse(params.degree);
  const country = countrySchema.safeParse(params.country);
  return {
    ...(degree.success ? { targetDegree: degree.data } : {}),
    ...(country.success && (!degree.success || degree.data === "bachelor") ? { certificateCountry: country.data } : {}),
  };
}

/** Only answered entry questions are skipped; Back still exposes both. */
export function nextEntryStep(answers: PartialAnswers, from = -1): number {
  const steps = visibleSteps(answers);
  let index = from + 1;
  while (index < steps.length - 1 &&
    ["targetDegree", "certificateCountry"].includes(steps[index]) && isAnswered(answers, steps[index])) index++;
  return index;
}

/** Identity survives reordered questions; old numeric drafts stop at missing evidence. */
export function restoredStepIndex(answers: PartialAnswers, index: number, stepId?: string): number {
  const steps = visibleSteps(answers);
  const namedIndex = stepId ? steps.findIndex(step => step === stepId) : -1;
  const firstMissing = steps.findIndex(step => !isAnswered(answers, step));
  return Math.min(namedIndex === -1 ? index : namedIndex, steps.length - 1,
    firstMissing === -1 ? steps.length - 1 : firstMissing);
}
