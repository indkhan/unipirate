// Current assessments require complete validated answers. Invalid historical
// raw/partial rows remain stored unchanged and yield unavailable coverage.
import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import type { Tables } from "@/lib/db/database.types";
import type { Profile } from "@/lib/engine/evaluate";

export function profileFromAnswers(row: Tables<"profiles"> | null): {
  profile: Profile | null;
  hasProfile: boolean;
} {
  if (!row) return {profile: null, hasProfile: false};
  const answers = AnswersSchema.safeParse(row.answers);
  return answers.success
    ? {profile: buildProfile(answers.data), hasProfile: true}
    : {profile: null, hasProfile: false};
}
