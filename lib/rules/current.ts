// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/qualification-guidance+jee+saudi+pakistan-current-v2+process+diagnostics+assessment-v1@sha256:882cf10dbcfe8aba010bd7a6648793b8dad5a1f1b171decbb965f830dc54e446";

export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
