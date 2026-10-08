// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/academic+process-assessment-v1@sha256:f1d8295a6533b037385d20877c724a98bb854883c8f5d7790985ba33661148ae";
export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
