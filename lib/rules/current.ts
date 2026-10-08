// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/jee-ordinary+saudi+pakistan-current-v2+process+diagnostics+assessment-v1@sha256:885e3aa8b25f79345df48c8aab33269815ea133f836c440f85451e5aa5b72178";

export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
