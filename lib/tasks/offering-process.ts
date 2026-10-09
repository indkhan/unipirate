// Pure consumer of immutable COURSE02 facts; applicant reports never certify eligibility.
import { z } from "zod";
import { ProgrammeSchema, parseOfferingRow, parseOfferingVersionRow, parseProgrammeRow } from "@/lib/courses/offerings";
import { parseDeadlineDate, type GeneratedTask } from "./generate";
import type { Json } from "@/lib/db/database.types";

export const ApplicantOfferingContextSchema = z.object({
  applicant_group: z.string().refine(value => value.trim().length > 0, "Confirm the named applicant group"),
  confirmed: z.literal(true),
}).strict();
export const ApplicationOfferingSelectionSchema = z.object({
  offering_id: z.string().uuid().nullable(),
  applicant_context: ApplicantOfferingContextSchema.nullable(),
}).strict().refine(value => (value.offering_id === null) === (value.applicant_context === null), "Selection and group confirmation must be supplied together");
export const SetApplicationOfferingSchema = z.object({id:z.string().uuid(),selection:ApplicationOfferingSelectionSchema}).strict();
export type ApplicationOfferingSelection = z.infer<typeof ApplicationOfferingSelectionSchema>;
type Offering = ReturnType<typeof parseOfferingRow>;
type Version = ReturnType<typeof parseOfferingVersionRow>;
export type ProcessFact = Version["facts"][number];
export type OfferingStage = {
  kind: "university_submission" | "uni_assist_submission" | "vpd_request";
  title: string;
  portal: ProcessFact | null;
  deadline: ProcessFact | null;
  dueDate: string | null;
  deadlineLabel: "Preparation target" | "Application closing";
  confirmation: string | null;
};
export type OfferingProcessPlan = {
  route: "direct" | "uni_assist" | "vpd_then_university" | "unresolved";
  reason: string | null;
  offering: Offering | null;
  version: Version | null;
  routeFact: ProcessFact | null;
  stages: OfferingStage[];
  fees: ProcessFact[];
  officialSources: string[];
};
export function resolveOfferingProcess(input: {
  courseId: string; programme: unknown; selection: unknown; offerings: unknown[]; versions: unknown[];
}): OfferingProcessPlan {
  const plan: OfferingProcessPlan = {route:"unresolved",reason:null,offering:null,version:null,routeFact:null,stages:[],fees:[],officialSources:[]};
  const unknown = (reason: string) => ({...plan,reason});
  if (!input.programme) return unknown("Confirm this programme's intake, applicant group and application procedure with the university; no reviewed offering is available.");
  let programme: ReturnType<typeof parseProgrammeRow>;
  let offerings: Offering[];
  let versions: Version[];
  try {
    programme = parseProgrammeRow(input.programme);
    offerings = input.offerings.map(parseOfferingRow);
    versions = input.versions.map(parseOfferingVersionRow);
  } catch { return unknown("Reviewed offering data is unavailable; confirm the procedure with the official source."); }
  plan.officialSources = [programme.source_url];
  if (programme.legacy_course_id !== input.courseId) return unknown("The selected offering does not belong to this course; select this course's intake and applicant group.");
  const selected = ApplicationOfferingSelectionSchema.safeParse(input.selection);
  if (!selected.success || selected.data.offering_id === null) return unknown("Select this application's intake and explicitly confirm its named applicant group, or ask the university which group applies.");
  const matches = offerings.filter(o => o.id === selected.data.offering_id && o.programme_id === programme.id);
  if (matches.length !== 1) return unknown("The selected offering is unavailable for this programme; confirm the intake and applicant group with the university.");
  const offering = matches[0]; plan.offering = offering;
  if (selected.data.applicant_context?.applicant_group !== offering.applicant_group) return unknown("Confirm the exact applicant group for this offering; the saved report does not match.");
  // Research source_scope is retained provenance, never an eligibility condition.
  if (Object.keys(offering.applicability).some(key => key !== "source_scope")
    || ("source_scope" in offering.applicability && typeof offering.applicability.source_scope !== "string")) return unknown("This offering has additional applicability conditions that we cannot yet assess. Confirm them with the university.");
  const reviewed = versions.filter(v => v.offering_id === offering.id && v.review_status === "verified").sort((a,b)=>b.version-a.version);
  if (!reviewed.length) return unknown("No reviewed procedure exists for this selected intake and group. Confirm with the university.");
  if (reviewed.filter(v => v.version === reviewed[0].version).length !== 1) return unknown("The latest reviewed version is ambiguous; confirm the procedure with the university.");
  const version = reviewed[0]; plan.version = version;
  // Unsupported free text is never parsed into country, nationality or EU status.
  const routes = version.facts.filter(f => f.kind === "route");
  const applicableRoutes = routes.filter(f => f.applicability === offering.applicant_group);
  plan.officialSources = [...new Set([programme.source_url,...applicableRoutes.flatMap(f=>f.evidence.map(e=>e.source_url))])];
  if (applicableRoutes.length !== 1 || routes.some(f => f.applicability !== offering.applicant_group)) return unknown("The latest reviewed route is missing, conflicting or has unsupported applicability. Confirm the procedure for this intake and group.");
  const route = applicableRoutes[0];
  if (route.status !== "verified" || route.route === null || route.route === "unresolved") return unknown("The latest reviewed route is unresolved. Confirm this intake's procedure with the university.");
  plan.route = route.route; plan.routeFact = route;
  const applicable = version.facts.filter(f => f.status === "verified" && f.applicability === offering.applicant_group);
  const field = (keys: string[], kind: ProcessFact["kind"], deadlineKind?: ProcessFact["deadline_kind"]) => {
    const facts = version.facts.filter(f=>keys.includes(f.key));
    // Coexisting identities cannot silently pick one assertion over another.
    const fact = facts.length === 1 ? facts[0] : null;
    return fact?.status === "verified" && fact.applicability === offering.applicant_group && fact.kind === kind
      && (deadlineKind === undefined || fact.deadline_kind === deadlineKind) ? fact : null;
  };
  const stage = (kind: OfferingStage["kind"], prefix: string, title: string, preparation = false): OfferingStage => {
    const researchStage = preparation ? "vpd" : kind === "uni_assist_submission" ? "uniassist" : "university";
    const capturedPortal = field([prefix+".portal", "application_link:"+researchStage], "description");
    // Reuse the source URL grammar without treating a provenance URL as a portal.
    const portal = capturedPortal?.verbatim && ProgrammeSchema.shape.source_url.safeParse(capturedPortal.verbatim).success ? capturedPortal : null;
    const deadlineKind = preparation ? "vpd_preparation_target" : "application_closing";
    const deadline = field([preparation ? "process.vpd.preparation" : prefix+".closing", `deadline:${researchStage}:${deadlineKind}`], "deadline", deadlineKind);
    const dueDate = deadline?.date ?? literalDeadlineDate(deadline);
    const missing = [!portal ? "portal" : null,!dueDate ? (preparation ? "preparation target" : "closing deadline") : null].filter(Boolean);
    return {kind,title,portal,deadline,dueDate,deadlineLabel:preparation?"Preparation target":"Application closing",confirmation:missing.length ? "Confirm the "+missing.join(" and ")+" with the official source." : null};
  };
  if (plan.route === "vpd_then_university") plan.stages.push(stage("vpd_request","process.uni_assist","Request VPD",true));
  if (plan.route === "uni_assist") plan.stages.push(stage("uni_assist_submission","process.uni_assist","Submit uni-assist application"));
  else plan.stages.push(stage("university_submission","process.university","Submit university application"));
  plan.fees = applicable.filter(f=>f.kind==="fee");
  return plan;
}

function literalDeadlineDate(fact: ProcessFact | null): string | null {
  if (!fact?.verbatim || !fact.key.startsWith("deadline:")) return null;
  // Trade-off: only one explicit full date in supported literal wording sorts.
  // Ranges, multiple years and undated statements need official confirmation.
  if ((fact.verbatim.match(/\b\d{4}\b/g) ?? []).length !== 1
    || /\b(?:from|between|to|until|through|bis|ab)\b|[–—]/i.test(fact.verbatim)) return null;
  const numericDate = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/.test(fact.verbatim);
  if ((fact.verbatim.match(/\d+/g) ?? []).length !== (numericDate ? 3 : 2)) return null;
  return parseDeadlineDate(fact.verbatim);
}

export function generateOfferingProcessTasks(applicationId: string, status: string, plan: OfferingProcessPlan): GeneratedTask[] {
  if (status !== "planning" || plan.route === "unresolved" || !plan.offering || !plan.version || !plan.routeFact) return [];
  const evidence = plan.routeFact.evidence.find(e=>e.last_verified_at && e.source_quote.includes(plan.routeFact!.verbatim!))!;
  const snapshot = {offering:plan.offering,version:plan.version,routeFact:plan.routeFact,fees:plan.fees};
  const task = (stage: string, title: string, order: number, deadline: ProcessFact | null, dueDate: string | null, extra: object): GeneratedTask => ({
    key:"app:"+applicationId+":offering:"+plan.offering!.id+":process:"+stage,title,
    dueDate,verbatimDue:deadline?.verbatim??null,order,applicationId,ruleId:null,courseTaskDefinitionId:null,
    adminSnapshot:{...snapshot,stage,...extra} as Json,source:{url:evidence.source_url,verifiedAt:evidence.last_verified_at},
  });
  const tasks = plan.stages.map((s,index)=>task(s.kind,s.title+(s.confirmation?" — "+s.confirmation:""),s.kind==="vpd_request"?20:30+index,s.deadline,s.dueDate,{stageFact:s}));
  // No structured payer/waiver contract exists. Literal guidance never authorizes payment.
  if (plan.route !== "direct") tasks.push(task("fee_confirmation","Confirm applicable fees, payer and exemptions with the official source",22,null,null,{}));
  return tasks;
}

export function isOfferingProcessKey(key: string | null): boolean {
  return !!key && /^app:[^:]+:offering:[^:]+:process:(university_submission|uni_assist_submission|vpd_request|fee_confirmation)$/.test(key);
}
export function isVisibleOfferingTask(task: {task_key:string|null;application_id:string|null;done:boolean}, applications: {id:string;status:string;plan:OfferingProcessPlan}[]): boolean {
  if (task.done || !isOfferingProcessKey(task.task_key)) return true;
  const application = applications.find(a=>a.id===task.application_id);
  return !!application && generateOfferingProcessTasks(application.id,application.status,application.plan).some(t=>t.key===task.task_key);
}
