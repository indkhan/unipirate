// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/jee-ordinary+pakistan-current-v2+assessment-v1@sha256:4c1865b87e8ed5102c52cd193e2844551571a3e2e3999abb5ef363398bdd237a";
export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
