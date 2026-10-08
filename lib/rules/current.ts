// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/jee-ordinary+saudi+pakistan-current-v2+diagnostics+assessment-v1@sha256:272b6bfadb6bb6be646b40014c9a6e206955df6a5e97fe2594b89398d3692490";
export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
