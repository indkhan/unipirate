import { ApplicationOfferingSelectionSchema, SetApplicationOfferingSchema } from "@/lib/tasks/offering-process";
import { z } from "zod";
import { ManualTaskSchema, TaskReceiptSchema, type ManualTaskInput } from "@/lib/tasks/manual";
import { ProposalCandidateSchema,ProposalSelectionSchema,TaskProposalSchema, type ProposalCandidate } from "@/lib/planning/proposals";
import { AnswersSchema } from "@/app/(public)/check/steps";
import { AssessmentMetadataSchema, AssessmentResultSchema } from "@/lib/rules/assessment";
import { RuleIdSchema, RuleVersionSchema, type RuleVersion } from "@/lib/rules/versioning";
import { CourseCatalogueIdSchema, parseOfferingRow, parseOfferingVersionRow, parseProgrammeRow } from "@/lib/courses/offerings";
// All user-facing database access lives here — pages, actions, and API routes
// never build queries inline. Every helper takes a caller-scoped Supabase
// client, so row-level security (not this module) is the authorization
// boundary. Admin-only queries live in admin-queries.ts.
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Json,
  Tables,
  TablesInsert,
} from "@/lib/db/database.types";
import type { GeneratedTaskUpsert } from "@/lib/tasks/generate";
import {
  toCourseTaskDefinition,
  type CourseTaskDefinition,
} from "@/lib/tasks/course-tasks";
import { unwrap } from "@/lib/db/unwrap";

type Db = Pick<SupabaseClient<Database>, "from">;
type RpcDb = Pick<SupabaseClient<Database>, "rpc">;

// Durable planning operations. Privileges in SQL distinguish authenticated
// enqueue/approval from the narrow internal worker lease/write functions.
export async function getPlanningSettings(db:Db){return unwrap<Tables<"planning_settings">>(await db.from("planning_settings").select("*").eq("id",true).single());}
export async function enqueuePlanningJob(db:RpcDb,event:"research"|"preliminary"|"verified",applicationId:string|null,sourceVersionId:string|null=null){
  return unwrap(await db.rpc("enqueue_planning_job",{p_event:z.enum(["research","preliminary","verified"]).parse(event),p_application_id:applicationId as string,p_source_version_id:sourceVersionId as string}));
}
export async function listPlanningJobs(db:Db,userId:string){
  return unwrap(await db.from("planning_jobs").select("*").eq("user_id",z.string().uuid().parse(userId)).order("created_at",{ascending:false}));
}
export async function listActionablePlanningJobs(db:RpcDb,userId:string){
  z.string().uuid().parse(userId);return unwrap(await db.rpc("actionable_planning_jobs"));
}
const RetryPlanningReceiptSchema=z.object({status:z.enum(["queued","existing","obsolete"]),job_id:z.string().uuid().nullable()}).strict()
  .refine(receipt=>(receipt.status==="obsolete")===(receipt.job_id===null),"Retry receipt must identify current work or an obsolete context");
export async function retryPlanningJob(db:RpcDb,userId:string,jobId:string){
  z.string().uuid().parse(userId);return RetryPlanningReceiptSchema.parse(unwrap(await db.rpc("retry_planning_job",{p_job_id:z.string().uuid().parse(jobId)})));
}
export async function leasePlanningJobs(db:RpcDb,worker:string,limit:number){return unwrap(await db.rpc("lease_planning_jobs",{p_worker:z.string().uuid().parse(worker),p_limit:z.number().int().min(1).max(20).parse(limit)}));}
export async function finishPlanningJob(db:RpcDb,id:string,worker:string,success:boolean,errorCode:string|null){return unwrap(await db.rpc("finish_planning_job",{p_id:id,p_worker:worker,p_success:success,p_error_code:errorCode as string}));}
export async function refreshPlanningJob(db:RpcDb,id:string,worker:string){return unwrap(await db.rpc("refresh_planning_job",{p_id:id,p_worker:worker}));}
export async function advancePlanningJob(db:RpcDb,id:string,worker:string,currentCursor:number,nextCursor:number,complete:boolean){
 return unwrap(await db.rpc("advance_planning_job",{p_id:z.string().uuid().parse(id),p_worker:z.string().uuid().parse(worker),p_current_cursor:z.number().int().nonnegative().parse(currentCursor),p_next_cursor:z.number().int().nonnegative().parse(nextCursor),p_complete:z.boolean().parse(complete)}));
}
export async function retireMissingPlanningProposals(db:RpcDb,id:string,worker:string,fingerprint:string,supportedKeys:string[]){
 return unwrap(await db.rpc("retire_missing_planning_proposals",{p_job_id:z.string().uuid().parse(id),p_worker:z.string().uuid().parse(worker),p_input_fingerprint:z.string().regex(/^[0-9a-f]{64}$/).parse(fingerprint),p_supported_action_keys:z.array(z.string().min(1).max(500)).parse(supportedKeys)}));
}
export async function saveTaskProposals(db:RpcDb,jobId:string,worker:string,fingerprint:string,candidates:ProposalCandidate[]){
  return unwrap(await db.rpc("save_task_proposals",{p_job_id:jobId,p_worker:worker,p_input_fingerprint:fingerprint,p_candidates:z.array(ProposalCandidateSchema).max(100).parse(candidates) as Json}));
}
export async function listTaskProposals(db:Db,userId:string){
  const rows:Tables<"task_proposals">[]=[];
  for(let offset=0;;offset+=500){const page=unwrap(await db.from("task_proposals").select("*").eq("user_id",z.string().uuid().parse(userId)).order("created_at").order("id").range(offset,offset+499));rows.push(...page);if(page.length<500)return z.array(TaskProposalSchema).parse(rows.map(row=>{const {approved_source_url,source_baseline_known,...dto}=row;void approved_source_url;void source_baseline_known;return dto;}));}
}
export async function approveTaskProposals(db:RpcDb,selection:unknown){return unwrap(await db.rpc("approve_task_proposals",{p_selection:ProposalSelectionSchema.parse(selection) as Json}));}
export async function dismissTaskProposal(db:RpcDb,id:string,revision:number){
  const result=unwrap(await db.rpc("dismiss_task_proposal",{p_id:z.string().uuid().parse(id),p_revision:z.number().int().positive().parse(revision)}));
  if(!result)throw new Error("This suggestion changed. Refresh it before rejecting.");
}

/** Worker-only context shell. Never return this to an HTTP caller or admin UI. */
export async function getPlanningJobContext(db:Db,job:{user_id:string;application_id:string|null;course_id:string|null}){
 const owner=z.string().uuid().parse(job.user_id);
 const application=job.application_id ? await getApplicationWithCourse(db,owner,z.string().uuid().parse(job.application_id)) : null;
 if(job.application_id&&(!application||application.course_id!==job.course_id))throw Object.assign(new Error("stale_context"),{code:"stale_context"});
 return {profile:await getProfile(db,owner),application};
}
export async function finishPlanningResearch(db:RpcDb,jobId:string,worker:string,expected:Json|null,draft:unknown){
 const {ResearchDraftSchema}=await import("@/lib/courses/research");
 return unwrap(await db.rpc("save_planning_research",{p_job_id:z.string().uuid().parse(jobId),p_worker:z.string().uuid().parse(worker),p_expected_metadata:expected as Json,p_expected_sql_null:expected===null,p_draft:ResearchDraftSchema.parse(draft) as unknown as Json}));
}

// ------------------------------------------------------------------- rules

/** Beta + verified rules — everything RLS exposes to the public. */
export async function getPublishedRules(db: Db): Promise<Tables<"rules">[]> {
  return unwrap(await db.from("rules").select());
}

/** Immutable history only; callers must select applicability explicitly before evaluation.
 * Current consumers use evaluateAssessment with an explicit server instant.
 */
export async function listRuleVersions(db: Db, ruleId?: string): Promise<RuleVersion[]> {
 const id=ruleId===undefined?undefined:RuleIdSchema.parse(ruleId);
 const rows: RuleVersion[] = [];
 for (let offset = 0; ; ) {
  let query=db.from("rule_versions").select("*", {count: "exact"}).order("rule_id").order("version_number",{ascending:false}).range(offset,offset+499);
  if(id!==undefined)query=query.eq("rule_id",id);
  const response = await query;
  const page=z.array(RuleVersionSchema).parse(unwrap(response));
  rows.push(...page); offset += page.length;
  if (response.count !== null ? offset >= response.count : page.length < 500) return rows;
  if (!page.length) throw new Error("Incomplete immutable rule history read.");
 }
}

// ----------------------------------------------------------------- courses

export async function getApprovedCourses(db: Db): Promise<Tables<"courses">[]> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .eq("review_status", "approved")
      .order("name"),
  );
}

/** RLS decides visibility: approved → everyone, pending → owner/admin only. */
export async function getCourseById(
  db: Db,
  id: string,
): Promise<Tables<"courses"> | null> {
  return unwrap(
    await db.from("courses").select().eq("id", id).maybeSingle(),
  );
}

export async function getCourseByNormalizedUrl(
  db: Db,
  normalizedUrl: string,
): Promise<Tables<"courses"> | null> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .eq("normalized_url", normalizedUrl)
      .is("conflicts_with", null)
      .maybeSingle(),
  );
}

export async function insertCourse(
  db: Db,
  course: TablesInsert<"courses">,
): Promise<Tables<"courses">> {
  return unwrap(await db.from("courses").insert(course).select().single());
}

export async function removeMyCourse(
  db: RpcDb,
  id: string,
): Promise<void> {
  unwrap(await db.rpc("remove_my_course", { course_id: id }));
}

// ----------------------------------------------------------------- profile

export async function getProfile(
  db: Db,
  userId: string,
): Promise<Tables<"profiles"> | null> {
  return unwrap(
    await db.from("profiles").select().eq("user_id", userId).maybeSingle(),
  );
}

export async function upsertProfile(
  db: Db,
  profile: TablesInsert<"profiles">,
): Promise<Tables<"profiles">> {
  return unwrap(await db.from("profiles").upsert(profile).select().single());
}

// ------------------------------------------------------------- applications

export async function listApplications(
  db: Db,
  userId: string,
): Promise<Tables<"applications">[]> {
  return unwrap(await db.from("applications").select().eq("user_id", userId)).map(validateApplicationOfferingSelection);
}

export async function hasApplicationForCourse(
  db: Db,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { count, error } = await db
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Bounded ownership check — RLS scopes the row, this keeps the payload at a count. */
export async function hasApplication(
  db: Db,
  userId: string,
  applicationId: string,
): Promise<boolean> {
  const { count, error } = await db
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export type ApplicationWithCourse = Tables<"applications"> & {
  courses: Tables<"courses"> | null;
};

export async function listApplicationsWithCourses(
  db: Db,
  userId: string,
): Promise<ApplicationWithCourse[]> {
  const rows = unwrap(
    await db
      .from("applications")
      .select("*, courses(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ) as ApplicationWithCourse[];
  return rows.map(validateApplicationOfferingSelection);
}

/** Idempotently link one course to the user's dashboard (finder / URL dedupe). */
export async function ensureApplication(
  db: Db,
  userId: string,
  courseId: string,
): Promise<Tables<"applications">> {
  unwrap(
    await db
      .from("applications")
      .upsert(
        { user_id: userId, course_id: courseId },
        { onConflict: "user_id,course_id", ignoreDuplicates: true },
      ),
  );
  return unwrap(
    await db
      .from("applications")
      .select()
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single(),
  );
}

export async function updateApplicationStatus(
  db: Db,
  id: string,
  status: string,
): Promise<Tables<"applications">> {
  return unwrap(
    await db
      .from("applications")
      .update({ status })
      .eq("id", id)
      .select()
      .single(),
  );
}

export async function getApplicationWithCourse(
  db: Db,
  userId: string,
  id: string,
): Promise<ApplicationWithCourse | null> {
  const row = unwrap(
    await db
      .from("applications")
      .select("*, courses(*)")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle(),
  ) as ApplicationWithCourse | null;
  return row ? validateApplicationOfferingSelection(row) : null;
}

export async function listActiveCourseTaskDefinitions(
  db: Db,
  courseId: string,
): Promise<CourseTaskDefinition[]> {
  const rows = unwrap(
    await db
      .from("course_task_definitions")
      .select()
      .eq("course_id", courseId)
      .is("retired_at", null)
      .order("sort_order"),
  );
  return rows.map(toCourseTaskDefinition);
}

export async function deleteApplicationForCourse(
  db: Db,
  userId: string,
  courseId: string,
): Promise<void> {
  unwrap(
    await db
      .from("applications")
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId),
  );
}

// -------------------------------------------------------------------- tasks

export async function createPersonalTaskReceipt(db:RpcDb,operationId:string,instruction:string,input:ManualTaskInput) {
  const task=ManualTaskSchema.parse(input);
  return TaskReceiptSchema.parse(unwrap(await db.rpc("create_personal_task",{
    p_operation_id:z.string().uuid().parse(operationId),p_instruction:z.string().min(1).max(20000).parse(instruction),p_task:task,
  })));
}

export async function getPersonalTaskReceipt(db:Db,userId:string,operationId:string,instruction:string) {
  const row=unwrap<Pick<Tables<"personal_task_operations">,"instruction"|"task_receipt">|null>(await db.from("personal_task_operations").select("instruction,task_receipt").eq("user_id",z.string().uuid().parse(userId)).eq("operation_id",z.string().uuid().parse(operationId)).maybeSingle());
  if(!row)return null;
  if(row.instruction!==instruction)throw new Error("This request ID was already used for different task content.");
  return TaskReceiptSchema.parse({status:"already_exists",task:row.task_receipt});
}

export async function listTasks(
  db: Db,
  userId: string,
): Promise<Tables<"tasks">[]> {
  return unwrap(
    await db
      .from("tasks")
      .select()
      .eq("user_id", userId)
      .eq("generated_active", true)
      .order("due_date", { ascending: true, nullsFirst: false }),
  );
}

export async function listGeneratedTasksByPrefix(
  db: Db,
  userId: string,
  prefix: string,
): Promise<Tables<"tasks">[]> {
  return unwrap(
    await db
      .from("tasks")
      .select()
      .eq("user_id", userId)
      .like("task_key", `${prefix}%`),
  );
}

export async function hasGeneratedTasksMissingMetadata(
  db: Db,
  userId: string,
): Promise<boolean> {
  const { count, error } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("generated_active", true)
    .not("task_key", "is", null)
    .or("source_url.is.null,and(application_id.not.is.null,verbatim_due.is.null)");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function insertTask(
  db: Db,
  task: TablesInsert<"tasks">,
): Promise<Tables<"tasks">> {
  return unwrap(await db.from("tasks").insert(task).select().single());
}

export async function updateManualTask(
  db: Db,
  userId: string,
  id: string,
  task: Pick<
    TablesInsert<"tasks">,
    "title" | "description" | "source_url" | "due_date" | "application_id"
  >,
): Promise<Tables<"tasks">> {
  return unwrap(
    await db
      .from("tasks")
      .update(task)
      .eq("user_id", userId)
      .eq("id", id)
      .is("task_key", null)
      .select()
      .single(),
  );
}

export async function getCourseTaskAssignment(
  db: Db,
  userId: string,
  id: string,
): Promise<Tables<"tasks"> | null> {
  return unwrap(
    await db
      .from("tasks")
      .select()
      .eq("id", id)
      .eq("user_id", userId)
      .not("course_task_definition_id", "is", null)
      .maybeSingle(),
  );
}

export async function updateCourseTaskAssignment(
  db: Db,
  userId: string,
  id: string,
  task: Pick<
    TablesInsert<"tasks">,
    "title" | "description" | "source_url" | "due_date"
  >,
): Promise<void> {
  unwrap(
    await db
      .from("tasks")
      .update({ ...task, has_personal_edits: true })
      .eq("id", id)
      .eq("user_id", userId)
      .not("course_task_definition_id", "is", null),
  );
}

export async function resolveCourseTaskAssignment(
  db: Db,
  userId: string,
  id: string,
  resolution: "adopt" | "keep" | "remove" | "manual",
): Promise<void> {
  const task = await getCourseTaskAssignment(db, userId, id);
  if (!task) throw new Error("Course task not found");
  if (resolution === "remove") {
    unwrap(await db.from("tasks").delete().eq("id", id).eq("user_id", userId));
    return;
  }
  if (resolution === "manual") {
    unwrap(
      await db
        .from("tasks")
        .update({
          task_key: null,
          course_task_definition_id: null,
          admin_snapshot: null,
          has_personal_edits: false,
          admin_change_state: "current",
        })
        .eq("id", id)
        .eq("user_id", userId),
    );
    return;
  }
  if (resolution === "keep") {
    unwrap(
      await db
        .from("tasks")
        .update({ admin_change_state: "current" })
        .eq("id", id)
        .eq("user_id", userId),
    );
    return;
  }
  const snapshot = task.admin_snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Admin task version is unavailable");
  }
  const value = snapshot as Record<string, Json | undefined>;
  unwrap(
    await db
      .from("tasks")
      .update({
        title: typeof value.title === "string" ? value.title : task.title,
        description: typeof value.description === "string" ? value.description : null,
        source_url: typeof value.source_url === "string" ? value.source_url : null,
        due_date: typeof value.due_date === "string" ? value.due_date : null,
        verbatim_due: typeof value.verbatim_due === "string" ? value.verbatim_due : null,
        sort_order: typeof value.sort_order === "number" ? value.sort_order : task.sort_order,
        has_personal_edits: false,
        admin_change_state: "current",
      })
      .eq("id", id)
      .eq("user_id", userId),
  );
}

export async function deleteManualTask(
  db: Db,
  userId: string,
  id: string,
): Promise<void> {
  unwrap(
    await db
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .eq("id", id)
      .is("task_key", null),
  );
}

export async function setTaskDone(
  db: Db,
  userId: string,
  id: string,
  done: boolean,
): Promise<Tables<"tasks">> {
  return unwrap(
    await db
      .from("tasks")
      .update({ done })
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single(),
  );
}

export async function setTaskPreferredBucket(
  db: Db,
  userId: string,
  id: string,
  preferredBucket: "now" | "next" | "later",
): Promise<Tables<"tasks">> {
  const result = await db
    .from("tasks")
    .update({ preferred_bucket: preferredBucket })
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single();
  // PostgREST caches the table schema; right after the preferred_bucket
  // migration is applied the column can be missing from that cache. Degrade
  // to a no-op (return the unchanged row) instead of failing the drag.
  if (
    result.error?.message.includes("preferred_bucket") &&
    result.error.message.includes("schema cache")
  ) {
    return unwrap(
      await db
        .from("tasks")
        .select()
        .eq("user_id", userId)
        .eq("id", id)
        .single(),
    );
  }
  return unwrap(result);
}

export async function upsertGeneratedTasks(
  db: Db,
  rows: GeneratedTaskUpsert[],
): Promise<void> {
  if (rows.length === 0) return;
  unwrap(await db.from("tasks").upsert(rows, { onConflict: "user_id,task_key", ignoreDuplicates: true }));
}

// ------------------------------------------------------------------- checks

/** Anonymous eligibility check record; returns the shareable id. */
export async function insertCheck(
  db: Db,
  check: unknown,
): Promise<string> {
  const validated = z.object({
    answers: AnswersSchema, result: AssessmentResultSchema, assessment_metadata: AssessmentMetadataSchema,
    owner_token_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    claimed_by: z.string().uuid().optional(), claimed_at: z.string().datetime().nullable(),
  }).strict().superRefine((value, ctx) => {
    if (Boolean(value.claimed_by) !== Boolean(value.claimed_at) ||
        (value.claimed_by ? value.owner_token_hash !== null : value.owner_token_hash === null))
      ctx.addIssue({code: z.ZodIssueCode.custom, message: "Invalid server ownership."});
  }).parse(check);
  const row = unwrap<{ id: string }>(
    await db.from("checks").insert(validated as unknown as TablesInsert<"checks">).select("id").single(),
  );
  return row.id;
}

export async function getCheck(
  db: RpcDb,
  id: string,
): Promise<
  Pick<Tables<"checks">, "id" | "answers" | "result" | "created_at" | "assessment_metadata"> | null
> {
  const rows = unwrap(await db.rpc("get_shared_check", { p_check_id: RuleIdSchema.parse(id) }));
  if (!rows[0]) return null;
  return z.object({id: RuleIdSchema, answers: z.unknown(), result: z.unknown(), created_at: z.string().datetime({offset: true}), assessment_metadata: z.unknown()}).parse(rows[0]) as Pick<Tables<"checks">, "id" | "answers" | "result" | "created_at" | "assessment_metadata">;
}

/**
 * Atomically claim an anonymous check for the signed-in user (verifies the
 * owner-token hash and copies the answers into the profile). True on success.
 */
export async function claimCheck(
  db: RpcDb,
  checkId: string,
  tokenHash: string,
): Promise<boolean> {
  return unwrap(
    await db.rpc("claim_check", {
      p_check_id: checkId,
      p_token_hash: tokenHash,
    }),
  );
}

/**
 * Whether the current request views a check as its anonymous owner, its
 * claimed owner, or the public. Falls back to "public" on any error so a
 * shared result page always renders.
 */
export async function getResultViewer(
  db: RpcDb,
  checkId: string,
  tokenHash: string | null,
): Promise<"anonymous_owner" | "claimed_owner" | "public"> {
  const { data, error } = await db.rpc("result_viewer", {
    p_check_id: checkId,
    // omit the param so the SQL default (null) applies
    p_token_hash: tokenHash ?? undefined,
  });
  if (error) return "public";
  return data === "anonymous_owner" || data === "claimed_owner"
    ? data
    : "public";
}

// ------------------------------------------------------------------ reports

// No .select() — anonymous reports (user_id null) have no read-back policy.
export async function insertAnswerReport(
  db: Db,
  report: TablesInsert<"answer_reports">,
): Promise<void> {
  unwrap(await db.from("answer_reports").insert(report));
}

// --------------------------------------------------------------- assistant

export type KbMatch =
  Database["public"]["Functions"]["match_kb_chunks"]["Returns"][number];

/** Semantic search over the assistant KB. `queryEmbedding` is a JSON-encoded number[]. */
export async function matchKbChunks(
  db: RpcDb,
  queryEmbedding: string,
  matchCount = 6,
): Promise<KbMatch[]> {
  return unwrap(
    await db.rpc("match_kb_chunks", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
    }),
  );
}

/** Questions asked since UTC midnight — the daily quota counter.
 * Trade-off: UTC day boundary (~5:30am IST reset), fine for a soft quota. */
export async function countTodayAssistantQuestions(
  db: Db,
  userId: string,
): Promise<number> {
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("assistant_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", utcMidnight.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function insertAssistantMessage(
  db: Db,
  message: TablesInsert<"assistant_messages">,
): Promise<void> {
  unwrap(await db.from("assistant_messages").insert(message));
}

// Additive catalogue reads. Legacy course/task callers keep their old contracts.
export async function getProgrammeByLegacyCourse(db: Db, courseId: string) {
  const row = unwrap(await db.from("programmes").select().eq("legacy_course_id", CourseCatalogueIdSchema.parse(courseId)).maybeSingle());
  return row === null ? null : parseProgrammeRow(row);
}
export async function listCourseOfferings(db: Db, programmeId: string) {
  const rows = unwrap(await db.from("course_offerings").select().eq("programme_id", CourseCatalogueIdSchema.parse(programmeId)).order("intake_year").order("intake_term"));
  return rows.map(parseOfferingRow);
}
export async function listReviewedOfferingVersions(db: Db, offeringId: string) {
  const rows = unwrap(await db.from("course_offering_versions").select().eq("offering_id", CourseCatalogueIdSchema.parse(offeringId)).eq("review_status", "verified").order("version", { ascending: false }));
  return rows.map(parseOfferingVersionRow);
}

/** Exact protected references only. Missing IDs remain missing, never substituted. */
export async function getRuleVersionsByIds(db: Db, input: unknown): Promise<RuleVersion[]> {
  const ids = z.array(RuleIdSchema).parse(input);
  if (!ids.length) return [];
  return z.array(RuleVersionSchema).parse(unwrap(await db.from("rule_versions").select().in("id", ids)));
}

/** RPC text is untrusted; attach stored logical identity through an exact slug lookup. */
export async function matchKbRuleHints(db: Db & RpcDb, embedding: string) {
  const vector = z.array(z.number().finite()).min(1).parse(JSON.parse(embedding));
  const matches = z.array(z.object({slug: z.string().min(1)})).parse(await matchKbChunks(db, JSON.stringify(vector)));
  if (!matches.length) return [];
  const rows = z.array(z.object({slug: z.string(), rule_id: RuleIdSchema.nullable()})).parse(
    unwrap(await db.from("kb_chunks").select("slug, rule_id").in("slug", matches.map(match => match.slug))));
  return matches.flatMap(match => {const exact = rows.filter(row => row.slug === match.slug); return exact.length === 1 ? [exact[0]] : [];});
}

/** Validate new selection columns without upgrading missing historical selection. */
function validateApplicationOfferingSelection<T extends Tables<"applications">>(row: T): T {
  ApplicationOfferingSelectionSchema.parse({offering_id:row.offering_id ?? null,applicant_context:row.offering_applicant_context ?? null});
  return row;
}

/** Caller-visible reviewed catalogue; no profile intake or private research fallback. */
export async function getApplicationOfferingCatalogue(db: Db, courseId: string, offeringId: string | null) {
  const course = CourseCatalogueIdSchema.parse(courseId);
  const selected = CourseCatalogueIdSchema.nullable().parse(offeringId);
  const programme = await getProgrammeByLegacyCourse(db, course);
  const offerings = programme ? await listCourseOfferings(db, programme.id) : [];
  const belongs = selected !== null && offerings.some(o=>o.id===selected);
  const versions = belongs ? await listReviewedOfferingVersions(db, selected) : [];
  return {programme,offerings,versions};
}

/** RLS remains the authorization boundary; also reject forged/mismatched payloads before update. */
export async function setApplicationOfferingSelection(db: Db, userId: string, input: unknown): Promise<Tables<"applications">> {
  const owner = CourseCatalogueIdSchema.parse(userId);
  const {id,selection} = SetApplicationOfferingSchema.parse(input);
  const application = await getApplicationWithCourse(db, owner, id);
  if (!application) throw new Error("Application not found");
  if (selection.offering_id !== null) {
    const catalogue = await getApplicationOfferingCatalogue(db, application.course_id, selection.offering_id);
    const offering = catalogue.offerings.find(o=>o.id===selection.offering_id);
    if (!catalogue.programme || catalogue.programme.legacy_course_id !== application.course_id || !offering || offering.programme_id !== catalogue.programme.id || offering.applicant_group !== selection.applicant_context?.applicant_group)
      throw new Error("Offering or applicant group does not match this application course");
  }
  const row = unwrap<Tables<"applications">>(await db.from("applications").update({offering_id:selection.offering_id,offering_applicant_context:selection.applicant_context}).eq("id",id).eq("user_id",owner).select().single());
  return validateApplicationOfferingSelection(row);
}

/** Includes retired identities so old pending generic submissions cannot contradict a selected plan. */
export async function listCourseSubmissionDefinitionIds(db: Db, courseId: string): Promise<string[]> {
  const rows = unwrap(await db.from("course_task_definitions").select("id").eq("course_id",CourseCatalogueIdSchema.parse(courseId)).eq("kind","submission"));
  return z.array(z.object({id:CourseCatalogueIdSchema}).strict()).parse(rows).map(row=>row.id);
}
