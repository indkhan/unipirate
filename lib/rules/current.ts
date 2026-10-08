// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/jee-ordinary+saudi+pakistan-current-v2+diagnostics+assessment-v1@sha256:ee253f54abbb96973d125f218ed4269024b65135c42f518b58f954cf848a0307";
export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
