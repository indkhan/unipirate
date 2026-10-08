// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/jee-ordinary+saudi+pakistan-current-v2+assessment-v1@sha256:2773be9b5a158e853f1d88febaf5b231a42e3778fc395776470f9de34c4635e5";
export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
