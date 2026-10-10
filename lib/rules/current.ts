// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/qualification-guidance+jee+saudi+pakistan-current-v2+process+diagnostics+assessment-v1@sha256:3db4d3f02a2bf78825519827489daba77e28f98cec276284c9bf5bb4a5b42d27";

export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
