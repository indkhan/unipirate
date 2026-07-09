import { z } from "zod";

import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import type { Tables } from "@/lib/db/database.types";
import type { Profile } from "@/lib/engine/evaluate";

const RawProfileSchema = z
  .object({
    targetDegree: z.enum(["bachelor", "master"]),
    curriculumType: z.enum(["national", "ib", "gce", "other"]),
  })
  .passthrough() as z.ZodType<Profile>;

export function profileFromAnswers(row: Tables<"profiles"> | null): {
  profile: Profile | null;
  hasProfile: boolean;
} {
  if (!row) return { profile: null, hasProfile: false };
  const answers = AnswersSchema.safeParse(row.answers);
  if (answers.success) return { profile: buildProfile(answers.data), hasProfile: true };

  const rawProfile = RawProfileSchema.safeParse(row.answers);
  return {
    profile: rawProfile.success ? rawProfile.data : null,
    hasProfile: rawProfile.success,
  };
}
