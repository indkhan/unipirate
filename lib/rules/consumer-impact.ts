// Pure, hypothetical publication preview. Never creates authoritative metadata.
import {z} from "zod";
import {AnswersSchema, buildProfile} from "@/app/(public)/check/steps";
import {EngineRuleSchema, evaluate, intakeIndex} from "@/lib/engine/evaluate";
import {AssessmentContextSchema, compareAssessments, evaluateAssessment} from "./assessment";
import {RuleDraftSchema, RuleVersionSchema, assessmentDateUtc, type RuleVersion} from "./versioning";

export function previewDraftImpact(population: readonly {answers: unknown}[], versions: unknown, input: unknown, approval: unknown, inputContext: unknown) {
 const context = AssessmentContextSchema.parse(inputContext);
 const available = z.array(RuleVersionSchema).parse(versions);
 const draft = RuleDraftSchema.parse(input);
 const status = z.enum(["beta", "verified"]).parse(approval);
 const raw = z.record(z.unknown()).parse(draft.raw_snapshot);
 const policy = EngineRuleSchema.safeParse({...raw, status});
 const result = {total: population.length, assessed: 0, invalidProfiles: 0, invalidProposal: !policy.success || raw.id !== draft.rule_id, policyChanged: 0, explanationChanged: 0, sourceOnly: 0, newCoverage: 0, unresolvedBefore: 0, unresolvedAfter: 0};
 const date = assessmentDateUtc(context.evaluatedAt);
 for (const row of population) {
  const answers = AnswersSchema.safeParse(row.answers);
  if (!answers.success) {result.invalidProfiles++; continue;}
  if (result.invalidProposal || !policy.success) continue;
  const profile = buildProfile(answers.data);
  const before = evaluateAssessment(profile, available, context);
  const target = profile.intake ? intakeIndex(profile.intake.term, profile.intake.year) : undefined;
  const dateApplies = (draft.effective_from === null || date >= draft.effective_from) && (draft.effective_until === null || date < draft.effective_until);
  const missingIntake = dateApplies && target === undefined && (draft.intake_from !== null || draft.intake_until !== null);
  const applies = dateApplies && !missingIntake && (target === undefined || ((draft.intake_from === null || target >= draft.intake_from) && (draft.intake_until === null || target < draft.intake_until)));
  const retained = before.selectedVersions.filter(v => (!applies && !missingIntake) || v.rule_id !== draft.rule_id);
  // Draft identity below is a comparison operand only, never a selected immutable
  // input or stored assessment. Publication/reviewer dates remain unavailable.
  const proposed: RuleVersion = {...draft, id: draft.rule_id, version_number: 1, supersedes_version_id: null, raw_snapshot: {...raw, status} as RuleVersion["raw_snapshot"], status, reviewed_by: null, reviewed_at: null, published_at: null, captured_at: null, draft_revision: draft.revision, provenance: "human_publication"};
  // Match the selector's canonical logical UUID order, including the replacement.
  const selectedVersions = (applies ? [...retained, proposed] : retained).sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  const rules = selectedVersions.map(v => EngineRuleSchema.parse(v.raw_snapshot));
  const after = {...before, result: evaluate(profile, rules), selectedVersions};
  const diff = compareAssessments(before, after);
  result.assessed++;
  result.policyChanged += Number(diff.policyChanged); result.explanationChanged += Number(diff.explanationChanged);
  result.sourceOnly += Number(diff.explanationChanged && !diff.policyChanged); result.newCoverage += Number(diff.newCoverage);
  result.unresolvedBefore += Number(before.metadata.selectionIssues.length > 0);
  result.unresolvedAfter += Number(missingIntake || before.metadata.selectionIssues.some(issue => !applies || issue.ruleId !== draft.rule_id));
 }
 return result;
}
