import { ProgrammeCorrectionSchema, ProgrammeSchema, OfferingSchema, OfferingVersionSchema, CourseCatalogueIdSchema, parseProgrammeRow, parseOfferingRow, parseOfferingVersionRow } from "@/lib/courses/offerings";
// Queries for the /admin review workspace: rule editing/verification, the
// course review queues, and the audit trail. Callers must hold an admin
// session (requireAdmin) — RLS rejects these writes for everyone else.
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/db/database.types";
import { z } from "zod";
import { DraftSaveSchema, RawRuleSchema, RuleDraftSchema, RuleIdSchema, RuleVersionSchema, jsonEqual, preflightPublication, type RuleDraft, type RuleVersion } from "@/lib/rules/versioning";
import { toCourseTaskDefinition } from "@/lib/tasks/course-tasks";
import {
  generateCourseTasks,
  prepareCourseTaskDefinitionSync,
  type GeneratedTaskUpsert,
} from "@/lib/tasks/generate";
import type { ApplicationWithCourse } from "@/lib/db/queries";
import { profileFromAnswers } from "@/lib/tasks/profile";
import { todayIsoBerlin } from "@/lib/tasks/dates";
import { unwrap } from "@/lib/db/unwrap";

type Db = Pick<SupabaseClient<Database>, "from">;

export type AdminRuleFilters = {
  country?: string;
  status?: Enums<"rule_status">;
};

export type AdminRule = z.infer<typeof RawRuleSchema> & { draft: RuleDraft; versions: RuleVersion[] };
function adminRule(draft: RuleDraft, versions: RuleVersion[]): AdminRule {
 const raw = RawRuleSchema.parse(draft.raw_snapshot);
 if(raw.id!==draft.rule_id) throw new Error("Workspace logical identity mismatch.");
 return {...raw,draft,versions};
}
export async function listAdminRules(db: Db, filters: AdminRuleFilters): Promise<AdminRule[]> {
 const [draftRows,versionRows]=await Promise.all([
  db.from("rule_drafts").select().order("edited_at",{ascending:false}),
  db.from("rule_versions").select().order("version_number",{ascending:false}),
 ]);
 const versions=z.array(RuleVersionSchema).parse(unwrap(versionRows));
 return z.array(RuleDraftSchema).parse(unwrap(draftRows)).map(draft=>adminRule(draft,versions.filter(v=>v.rule_id===draft.rule_id)))
  .filter(rule=>(!filters.country||rule.country_code===filters.country)&&(!filters.status||rule.status===filters.status));
}
export async function getAdminRuleDraft(db:Db,id:string):Promise<RuleDraft> {
 return RuleDraftSchema.parse(unwrap(await db.from("rule_drafts").select().eq("rule_id",RuleIdSchema.parse(id)).single()));
}
export async function listAdminRuleVersions(db:Db,id:string):Promise<RuleVersion[]> {
 return z.array(RuleVersionSchema).parse(unwrap(await db.from("rule_versions").select().eq("rule_id",RuleIdSchema.parse(id)).order("version_number",{ascending:false})));
}
export async function getAdminRule(db:Db,id:string):Promise<AdminRule> {
 const [draft,versions]=await Promise.all([getAdminRuleDraft(db,id),listAdminRuleVersions(db,id)]);
 return adminRule(draft,versions);
}
export class RuleReviewStaleError extends Error {
 constructor(){super("Rule draft or predecessor changed; reload and review again. Your changes were not published.");}
}
/** Compare-and-save the workspace only. DB stamps its revision, editor and time. */
export async function updateAdminRule(db:Db,input:unknown):Promise<RuleDraft> {
 const values=DraftSaveSchema.parse(input);
 const result=await db.from("rule_drafts").update({raw_snapshot:values.next_snapshot,
  effective_from:values.effective_from,effective_until:values.effective_until,intake_from:values.intake_from,intake_until:values.intake_until})
  .eq("rule_id",values.rule_id).eq("revision",values.revision).eq("raw_snapshot",JSON.stringify(values.raw_snapshot)).select().maybeSingle();
 const row=unwrap(result);if(!row)throw new RuleReviewStaleError();
 return RuleDraftSchema.parse(row);
}
/** Preflight exact raw data, compare review tokens, then append through the protected RPC. */
export async function publishAdminRuleVersion(db:Pick<SupabaseClient<Database>,"from"|"rpc">,input:unknown):Promise<RuleVersion> {
 const approval=preflightPublication(input);
 const [draft,versions]=await Promise.all([getAdminRuleDraft(db,approval.rule_id),listAdminRuleVersions(db,approval.rule_id)]);
 if(draft.revision!==approval.revision||!jsonEqual(draft.raw_snapshot,approval.raw_snapshot)||(versions[0]?.id??null)!==approval.predecessor_id)throw new RuleReviewStaleError();
 preflightPublication({...approval,raw_snapshot:draft.raw_snapshot});
 const response=await db.rpc("publish_rule_version",{p_rule_id:approval.rule_id,p_expected_draft_revision:approval.revision,
  p_expected_raw_snapshot:draft.raw_snapshot,p_expected_predecessor_id:approval.predecessor_id as string,p_approval_status:approval.approval_status});
 // Trade-off: generated RPC types spell the nullable SQL predecessor as string; null is the
 // explicit first-publication token required by the DB contract, never a UUID substitute.
 if(response.error&&/rule (draft|predecessor) changed/.test(response.error.message))throw new RuleReviewStaleError();
 return RuleVersionSchema.parse(unwrap(response));
}

export async function listPendingCourses(
  db: Db,
): Promise<Tables<"courses">[]> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .eq("review_status", "pending")
      // conflict submissions have their own review section
      .is("conflicts_with", null)
      .order("created_at", { ascending: true }),
  );
}

export type ConflictCourse = Tables<"courses"> & {
  old_course: Tables<"courses"> | null;
};

/**
 * Pending "the page changed" submissions with the course they dispute.
 *
 * Trade-off: two round trips rather than a PostgREST embed on the
 * `conflicts_with` self-FK — the generated types resolve that embed to an array
 * rather than a to-one object, so it cannot be typed without a cast that hides
 * whether the shape is right. Upgrade path: switch to
 * `courses!courses_conflicts_with_fkey(*)` once verified against the project.
 */
export async function listConflictCourses(db: Db): Promise<ConflictCourse[]> {
  const updates = unwrap(
    await db
      .from("courses")
      .select()
      .not("conflicts_with", "is", null)
      .order("created_at", { ascending: true }),
  );
  if (updates.length === 0) return [];

  const oldIds = updates
    .map((c) => c.conflicts_with)
    .filter((id): id is string => id !== null);
  const oldCourses = unwrap(
    await db.from("courses").select().in("id", oldIds),
  );
  const byId = new Map(oldCourses.map((c) => [c.id, c]));
  return updates.map((c) => ({
    ...c,
    old_course: c.conflicts_with ? (byId.get(c.conflicts_with) ?? null) : null,
  }));
}

export async function resolveCourseConflict(
  db: Pick<SupabaseClient<Database>, "rpc">,
  newCourseId: string,
  keepNew: boolean,
): Promise<void> {
  unwrap(
    await db.rpc("resolve_course_conflict", {
      p_new_course_id: newCourseId,
      p_keep_new: keepNew,
    }),
  );
}

export async function updateCourseReviewStatus(
  db: Db,
  id: string,
  reviewStatus: Extract<Enums<"course_review_status">, "approved" | "rejected">,
): Promise<Tables<"courses">> {
  return unwrap(
    await db
      .from("courses")
      .update({ review_status: reviewStatus })
      .eq("id", id)
      .select()
      .single(),
  );
}

export async function updateAdminCourse(
  db: Db,
  id: string,
  course: Pick<
    TablesUpdate<"courses">,
    | "deadlines"
    | "description"
    | "degree"
    | "extraction_method"
    | "field_extraction"
    | "language"
    | "location"
    | "name"
    | "normalized_url"
    | "requirements"
    | "source_url"
    | "tuition"
    | "university_name"
  >,
): Promise<Tables<"courses">> {
  return unwrap(
    await db.from("courses").update(course).eq("id", id).select().single(),
  );
}

export async function getAdminCourse(db: Db, id: string): Promise<Tables<"courses">> {
  return unwrap(await db.from("courses").select().eq("id", id).single());
}

export async function listAdminCourses(db: Db): Promise<Tables<"courses">[]> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .neq("review_status", "rejected")
      .order("updated_at", { ascending: false }),
  );
}

export async function listAdminCourseTaskDefinitions(
  db: Db,
  courseId: string,
): Promise<Tables<"course_task_definitions">[]> {
  return unwrap(
    await db
      .from("course_task_definitions")
      .select()
      .eq("course_id", courseId)
      .order("sort_order"),
  );
}

export async function insertAdminCourseTaskDefinition(
  db: Db,
  definition: TablesInsert<"course_task_definitions">,
): Promise<Tables<"course_task_definitions">> {
  return unwrap(
    await db.from("course_task_definitions").insert(definition).select().single(),
  );
}

export async function updateAdminCourseTaskDefinition(
  db: Db,
  id: string,
  definition: TablesUpdate<"course_task_definitions">,
): Promise<Tables<"course_task_definitions">> {
  return unwrap(
    await db
      .from("course_task_definitions")
      .update(definition)
      .eq("id", id)
      .select()
      .single(),
  );
}

/**
 * Fans an admin's course-task definition edits out to every student tracking the
 * course, using the same intake-aware generator as initial materialization —
 * SQL cannot do the deadline selection, and a second parser would eventually
 * disagree with the first about which deadline line applies.
 *
 * Trade-off: not transactional. Every write is idempotent and keyed on
 * (user_id, task_key), so a partial failure leaves some students synced and the
 * rest untouched — never a half-written task — and re-saving the definition
 * converges. Upgrade path: hand these pre-computed rows to one security-definer
 * SQL function as jsonb, which buys atomicity while keeping one parser.
 */
export async function syncAdminCourseTaskDefinitions(
  db: Db,
  courseId: string,
): Promise<void> {
  const applications = unwrap(
    await db
      .from("applications")
      .select("*, courses(*)")
      .eq("course_id", courseId)
      .eq("status", "planning"),
  ) as ApplicationWithCourse[];
  if (applications.length === 0) return;

  const userIds = applications.map((application) => application.user_id);
  const [profiles, tasks, definitions] = await Promise.all([
    unwrap(await db.from("profiles").select().in("user_id", userIds)),
    unwrap(await db.from("tasks").select().in("application_id", applications.map((application) => application.id))),
    listAdminCourseTaskDefinitions(db, courseId),
  ]);
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const definitionsForGeneration = definitions.map(toCourseTaskDefinition);

  const today = todayIsoBerlin();
  const upsertRows: GeneratedTaskUpsert[] = [];
  const deactivateKeys: string[] = [];
  const removalPendingKeys: string[] = [];
  const personalUpdates: {
    userId: string;
    taskKey: string;
    adminSnapshot: Json | null;
  }[] = [];

  for (const application of applications) {
    if (!application.courses) continue;
    const profile = profileFromAnswers(profilesByUser.get(application.user_id) ?? null).profile;
    const desired = generateCourseTasks([{
      id: application.id,
      status: application.status,
      course: {
        ...application.courses,
        task_definitions: definitionsForGeneration,
      },
    }], today, profile?.intake);
    const sync = prepareCourseTaskDefinitionSync(
      application.user_id,
      desired,
      tasks.filter((task) => task.application_id === application.id),
    );

    upsertRows.push(...sync.upsertRows);
    deactivateKeys.push(...sync.deactivateKeys);
    removalPendingKeys.push(...sync.removalPendingKeys);
    personalUpdates.push(
      ...sync.personalUpdates.map((update) => ({
        userId: application.user_id,
        ...update,
      })),
    );
  }

  // task_key embeds the application uuid, so the key sets are globally unique;
  // the user_id filters are kept so the planner uses the (user_id, task_key) index.
  if (upsertRows.length > 0) {
    unwrap(await db.from("tasks").upsert(upsertRows, { onConflict: "user_id,task_key" }));
  }
  if (deactivateKeys.length > 0) {
    unwrap(
      await db
        .from("tasks")
        .update({ generated_active: false })
        .in("user_id", userIds)
        .in("task_key", deactivateKeys),
    );
  }
  if (removalPendingKeys.length > 0) {
    unwrap(
      await db
        .from("tasks")
        .update({ admin_change_state: "removal_pending" })
        .in("user_id", userIds)
        .in("task_key", removalPendingKeys),
    );
  }
  // ponytail: one update per personalized copy — each carries a distinct
  // admin_snapshot, so it cannot batch. Fine below ~50 trackers per course.
  for (const update of personalUpdates) {
    unwrap(
      await db
        .from("tasks")
        .update({
          admin_snapshot: update.adminSnapshot,
          admin_change_state: "update_pending",
          generated_active: true,
        })
        .eq("user_id", update.userId)
        .eq("task_key", update.taskKey),
    );
  }
}





export async function listRecentAdminAuditEvents(
  db: Db,
  limit = 25,
): Promise<Tables<"admin_audit_events">[]> {
  return unwrap(
    await db
      .from("admin_audit_events")
      .select()
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

// Catalogue writes; RLS requires the caller's admin session, never service escalation.
export async function insertAdminProgramme(db: Db, input: unknown) {
  const row = unwrap(await db.from("programmes").insert(ProgrammeSchema.parse(input)).select().single());
  return parseProgrammeRow(row);
}
export async function insertAdminCourseOffering(db: Db, input: unknown) {
  const row = unwrap(await db.from("course_offerings").insert(OfferingSchema.parse(input)).select().single());
  return parseOfferingRow(row);
}
export async function insertAdminOfferingVersion(db: Db, input: unknown) {
  const row = unwrap(await db.from("course_offering_versions").insert(OfferingVersionSchema.parse(input)).select().single());
  return parseOfferingVersionRow(row);
}
export async function listAdminOfferingVersions(db: Db, offeringId: string) {
  const rows = unwrap(await db.from("course_offering_versions").select().eq("offering_id", CourseCatalogueIdSchema.parse(offeringId)).order("version", { ascending: false }));
  return rows.map(parseOfferingVersionRow);
}

/** Correct catalogue labels without changing canonical/legacy identity or review state. */
export async function updateAdminProgramme(db: Db, id: string, input: unknown) {
  const programmeId = CourseCatalogueIdSchema.parse(id);
  const correction = ProgrammeCorrectionSchema.parse(input);
  const row = unwrap(await db.from("programmes").update(correction).eq("id", programmeId).select().single());
  return parseProgrammeRow(row);
}

/** Attach once after approval; the DB checks course lifecycle and freezes the link. */
export async function attachAdminProgrammeLegacyCourse(db: Db, id: string, courseId: string) {
  const programmeId = CourseCatalogueIdSchema.parse(id);
  const legacyCourseId = CourseCatalogueIdSchema.parse(courseId);
  const row = unwrap(await db.from("programmes").update({ legacy_course_id: legacyCourseId })
    .eq("id", programmeId).is("legacy_course_id", null).select().single());
  return parseProgrammeRow(row);
}
