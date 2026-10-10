// I/O shell: one server clock capture for each evaluation. Bump this revision
// when profile mapping, derived facts, selection or outcome merging changes.
import { AssessmentContextSchema } from "./assessment";
export const ENGINE_REVISION = "unipirate/qualification-guidance+jee+saudi+pakistan-current-v2+process+diagnostics+assessment-v1@sha256:3c7bc0698c3bc650ddfbe951bd44b999cbcf79a87600ae9228e1d8ae61ab1284";

export function currentAssessmentContext() {
  return AssessmentContextSchema.parse({evaluatedAt: new Date().toISOString(), engineRevision: ENGINE_REVISION});
}
