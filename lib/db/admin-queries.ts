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
import { EngineRuleSchema } from "@/lib/engine/evaluate";
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

export async function listAdminRules(
  db: Db,
  filters: AdminRuleFilters,
): Promise<Tables<"rules">[]> {
  let query = db
    .from("rules")
    .select()
    .order("updated_at", { ascending: false });

  if (filters.country) {
    query = query.eq("country_code", filters.country);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  return unwrap(await query);
}

export async function getAdminRule(
  db: Db,
  id: string,
): Promise<Tables<"rules">> {
  return unwrap(await db.from("rules").select().eq("id", id).single());
}

export async function updateAdminRule(
  db: Db,
  id: string,
  rule: Pick<
    TablesUpdate<"rules">,
    | "conditions"
    | "country_code"
    | "last_verified_at"
    | "outcomes"
    | "source_url"
    | "source_quote"
    | "notes"
    | "status"
  >,
): Promise<Tables<"rules">> {
  return unwrap(
    await db.from("rules").update(rule).eq("id", id).select().single(),
  );
}

export async function reverifyAdminRule(
  db: Db,
  id: string,
): Promise<Tables<"rules">> {
  const existing = await getAdminRule(db, id);
  const parsed = EngineRuleSchema.safeParse(existing);
  if (!parsed.success) {
    throw new Error(
      `Rule cannot be verified until its schema errors are fixed: ${parsed.error.message}`,
    );
  }

  return unwrap(
    await db
      .from("rules")
      .update({
        status: "verified",
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single(),
  );
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
