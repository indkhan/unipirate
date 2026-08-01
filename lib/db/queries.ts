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

// ------------------------------------------------------------------- rules

/** Beta + verified rules — everything RLS exposes to the public. */
export async function getPublishedRules(db: Db): Promise<Tables<"rules">[]> {
  return unwrap(await db.from("rules").select());
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
  return unwrap(await db.from("applications").select().eq("user_id", userId));
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
  return unwrap(
    await db
      .from("applications")
      .select("*, courses(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ) as ApplicationWithCourse[];
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
  return unwrap(
    await db
      .from("applications")
      .select("*, courses(*)")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle(),
  ) as ApplicationWithCourse | null;
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
  unwrap(await db.from("tasks").upsert(rows, { onConflict: "user_id,task_key" }));
}

// ------------------------------------------------------------------- checks

/** Anonymous eligibility check record; returns the shareable id. */
export async function insertCheck(
  db: Db,
  check: TablesInsert<"checks">,
): Promise<string> {
  const row = unwrap<{ id: string }>(
    await db.from("checks").insert(check).select("id").single(),
  );
  return row.id;
}

export async function getCheck(
  db: Db,
  id: string,
): Promise<
  Pick<Tables<"checks">, "id" | "answers" | "result" | "created_at"> | null
> {
  return unwrap(
    await db
      .from("checks")
      .select("id, answers, result, created_at")
      .eq("id", id)
      .maybeSingle(),
  );
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
