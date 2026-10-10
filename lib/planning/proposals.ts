// Pure proposal policy. Only immutable reviewed offering facts confer verification.
import { z } from "zod";
import { CalendarDateSchema } from "@/lib/engine/calendar-day";
import { parseDeadlineDate, type GeneratedTask } from "@/lib/tasks/generate";
import { generateOfferingProcessTasks, type OfferingProcessPlan } from "@/lib/tasks/offering-process";
const sourceUrl = z.string().max(2048).url().refine(v => /^https?:\/\//.test(v));
export const ProposalEvidenceSchema = z.object({ source_url: sourceUrl, source_quote: z.string().min(1).max(12000), last_verified_at: z.string().datetime().nullable() }).strict();
export const ProposalCandidateSchema = z.object({
  semantic_action_key: z.string().min(1).max(500), stage: z.enum(["preliminary", "verified"]),
  title: z.string().trim().min(1).max(200), description: z.string().max(2000).nullable(), reason: z.string().min(1).max(2000),
  due_date: CalendarDateSchema.nullable(), verbatim_due: z.string().max(12000).nullable(),
  evidence: z.array(ProposalEvidenceSchema).max(30), source_version_id: z.string().uuid().nullable(),
  legacy_task_key: z.string().min(1).max(500).nullable(),
}).strict().superRefine((v, ctx) => {
  if (v.stage === "preliminary" && (v.due_date !== null || v.verbatim_due !== null || v.source_version_id !== null || v.evidence.length)) ctx.addIssue({code:"custom",message:"Preliminary preparation has no official deadline or reviewed authority"});
  if (v.stage === "verified" && (!v.source_version_id || !v.evidence.length || v.evidence.some(e=>!e.last_verified_at))) ctx.addIssue({code:"custom",message:"Verified proposals require an immutable reviewed offering and literal evidence"});
  if (v.due_date && !v.verbatim_due) ctx.addIssue({code:"custom",message:"Official date requires literal source wording"});
  if (v.due_date && v.verbatim_due && (parseDeadlineDate(v.verbatim_due)!==v.due_date || (v.verbatim_due.match(/\b\d{4}\b/g)??[]).length!==1 || /\b(?:from|between|to|until|through|bis|ab)\b|[–—]/i.test(v.verbatim_due))) ctx.addIssue({code:"custom",message:"Official date must match one explicit unambiguous literal source date"});
});
export type ProposalCandidate = z.infer<typeof ProposalCandidateSchema>;
export const TaskProposalSchema = ProposalCandidateSchema.innerType().extend({
  id:z.string().uuid(),user_id:z.string().uuid(),application_id:z.string().uuid().nullable(),course_id:z.string().uuid().nullable(),
  offering_id:z.string().uuid().nullable(),intake_term:z.enum(["winter","summer"]).nullable(),intake_year:z.number().int().min(1).max(9999).nullable(),applicant_group:z.string().nullable(),
  input_fingerprint:z.string().regex(/^[0-9a-f]{64}$/),material_fingerprint:z.string().regex(/^[0-9a-f]{64}$/),
  status:z.enum(["pending","approved","dismissed","superseded","needs_recheck"]),revision:z.number().int().positive(),
  approved_revision:z.number().int().positive().nullable(),approved_task_id:z.string().uuid().nullable(),approval_fingerprint:z.string().nullable(),base_task_revision:z.number().int().positive().nullable(),
  before_task:z.object({id:z.string().uuid(),title:z.string(),description:z.string().nullable(),due_date:CalendarDateSchema.nullable(),done:z.boolean(),planning_revision:z.number().int().positive()}).strict().nullable(),
  change_fields:z.array(z.enum(["title","description","due_date"])),created_at:z.string().datetime({offset:true}),updated_at:z.string().datetime({offset:true}),
}).strict();
export type TaskProposal=z.infer<typeof TaskProposalSchema>;
export const ProposalSelectionSchema = z.array(z.object({id:z.string().uuid(),revision:z.number().int().positive(),edit:z.object({title:z.string().trim().min(1).max(200),description:z.string().max(2000).nullable(),due_date:CalendarDateSchema.nullable()}).strict().optional()}).strict()).min(1).max(100).refine(v=>new Set(v.map(p=>p.id)).size===v.length,"Select each shown proposal once");
export function reconcileProposal(existing: {status:string;material_fingerprint:string;approved_task_id:string|null}, fingerprint:string, task:{id:string;done:boolean}|null): "keep"|"pending"|"update" {
  if (existing.material_fingerprint===fingerprint || existing.status==="superseded") return "keep";
  if (existing.approved_task_id) return task?.id===existing.approved_task_id ? "update" : "keep";
  return "pending";
}
// Legacy candidates are preparation ONLY. Their date/source fields cannot certify an offering.
export function proposalsFromGeneratedTasks(tasks: GeneratedTask[]): ProposalCandidate[] {
  return tasks.map(t=> {
    const title=t.key.endsWith(":vpd_request") ? "Confirm whether a VPD is needed and prepare questions" :
      t.key.endsWith(":uni_assist_submission") ? "Confirm whether uni-assist applies to this application" :
      t.key.endsWith(":university_submission") ? "Confirm university application instructions" :
      t.key.endsWith(":fee_confirmation") ? "Confirm applicable fees with the official source" :
      t.applicationId ? "Prepare to verify this programme's application requirements" : "Prepare to verify the applicable qualification requirements";
    const url=sourceUrl.safeParse(t.source?.url);
    const pointer=url.success?`Review the official source and confirm whether these instructions apply: ${url.data}`:null;
    return ProposalCandidateSchema.parse({semantic_action_key:t.key,stage:"preliminary",title,description:pointer && pointer.length<=2000?pointer:null,reason:"Preparation suggestion; confirm current requirements with the official source before acting.",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:t.key});
  });
}
export function proposalsFromOfferingPlan(applicationId:string,status:string,plan:OfferingProcessPlan,today:string):ProposalCandidate[] {
  CalendarDateSchema.parse(today);
  if (!plan.version || !plan.offering || !plan.routeFact || plan.route==="unresolved") return [];
  return generateOfferingProcessTasks(applicationId,status,plan).map(task=> {
    const kind=task.key.split(":").at(-1);
    const stage=plan.stages.find(s=>s.kind===kind);
    const facts=[plan.routeFact!,...(stage?.portal?[stage.portal]:[]),...(stage?.deadline?[stage.deadline]:[]),...(kind==="fee_confirmation"?plan.fees:[])];
    const evidence=facts.flatMap(f=>f.evidence.map(e=>({source_url:e.source_url,source_quote:e.source_quote,last_verified_at:e.last_verified_at})));
    const uniqueEvidence=evidence.filter((e,index)=>evidence.findIndex(other=>other.source_url===e.source_url && other.source_quote===e.source_quote && other.last_verified_at===e.last_verified_at)===index);
    return ProposalCandidateSchema.parse({semantic_action_key:task.key,stage:"verified",title:task.title,description:"Review the applicable instructions and literal evidence shown with this suggestion.",reason:`Reviewed procedure for ${plan.offering!.intake_term} ${plan.offering!.intake_year}, ${plan.offering!.applicant_group}.`,due_date:task.dueDate && task.dueDate>=today?task.dueDate:null,verbatim_due:task.verbatimDue,evidence:uniqueEvidence,source_version_id:plan.version!.id,legacy_task_key:task.key});
  });
}

export function proposalsFromOfferingRequirements(applicationId:string,status:string,plan:OfferingProcessPlan):ProposalCandidate[] {
  if (status!=="planning" || !plan.offering || !plan.version) return [];
  const titles={document:"Review the published document requirement",language:"Review the published language requirement",prerequisite:"Review the published prerequisite"};
  return plan.version.facts.filter(f=>f.status==="verified" && f.applicability===plan.offering!.applicant_group && f.verbatim!==null && (f.kind==="document" || f.kind==="language" || f.kind==="prerequisite")).map(f=>{
    const key=`app:${applicationId}:offering:${plan.offering!.id}:fact:${f.kind}:${f.key}`;
    return ProposalCandidateSchema.parse({semantic_action_key:key,stage:"verified",title:titles[f.kind as keyof typeof titles],
      // Never truncate literal source wording. Long statements remain in full evidence.
      description:f.verbatim!.length<=2000?f.verbatim:null,reason:`Review the literal published requirement for ${plan.offering!.intake_term} ${plan.offering!.intake_year}, ${plan.offering!.applicant_group}; this task does not assess fulfilment or an exemption.`,
      due_date:null,verbatim_due:null,evidence:f.evidence.map(e=>({source_url:e.source_url,source_quote:e.source_quote,last_verified_at:e.last_verified_at})),source_version_id:plan.version!.id,legacy_task_key:null});
  });
}
export function proposalsForWithdrawnApprovedActions(existing:Pick<TaskProposal,"application_id"|"offering_id"|"semantic_action_key"|"approved_task_id"|"title"|"description"|"legacy_task_key"|"status">[],supportedKeys:readonly string[],applicationId:string,offeringId:string|null):ProposalCandidate[]{
  if (!offeringId) return [];
  const supported=new Set(supportedKeys),prefix=`app:${applicationId}:offering:${offeringId}:`;
  return existing.filter(p=>p.application_id===applicationId && (p.offering_id===offeringId || p.offering_id===null && p.semantic_action_key.startsWith(prefix)) && p.approved_task_id!==null && p.status!=="superseded" && !supported.has(p.semantic_action_key)).map(p=>ProposalCandidateSchema.parse({
    semantic_action_key:p.semantic_action_key,stage:"preliminary",title:p.title,description:p.description,
    reason:"The latest reviewed source no longer supports this action for the selected intake and applicant group. Confirm current instructions with the official source before proceeding. Approval removes the previous official date; your task identity and unrelated edits remain.",
    due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:p.legacy_task_key,
  }));
}
