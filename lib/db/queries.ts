import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Tables,
  TablesInsert,
} from "@/lib/db/database.types";
import type { GeneratedTaskUpsert } from "@/lib/tasks/generate";

type Db = Pick<SupabaseClient<Database>, "from">;
type RpcDb = Pick<SupabaseClient<Database>, "rpc">;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ---------------------------------------------------------- reference data

export async function getCountries(db: Db): Promise<Tables<"countries">[]> {
  return unwrap(await db.from("countries").select().order("name"));
}

export async function getQualifications(
  db: Db,
  countryCode?: string,
): Promise<Tables<"qualifications">[]> {
  let query = db.from("qualifications").select().order("board_or_type");
  // null country_code = international curricula (IB, GCE) — always included
  if (countryCode) {
    query = query.or(`country_code.eq.${countryCode},country_code.is.null`);
  }
  return unwrap(await query);
}

export async function getUniversities(
  db: Db,
): Promise<Tables<"universities">[]> {
  return unwrap(await db.from("universities").select().order("name"));
}

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

/** The user's imported courses (created_by); syncDashboard bridges these into
 *  applications. Courses added from the finder link straight into applications. */
export async function getMyCourses(
  db: Db,
  userId: string,
): Promise<Tables<"courses">[]> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
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
): Promise<void> {
  const { error } = await db
    .from("applications")
    .upsert(
      { user_id: userId, course_id: courseId },
      { onConflict: "user_id,course_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export async function ensureApplications(
  db: Db,
  userId: string,
  courses: Tables<"courses">[],
): Promise<void> {
  const rows = courses
    .filter((course) => course.review_status !== "rejected")
    .map((course) => ({ user_id: userId, course_id: course.id }));
  if (rows.length === 0) return;
  const { error } = await db
    .from("applications")
    .upsert(rows, {
      onConflict: "user_id,course_id",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(error.message);
}

export async function insertApplication(
  db: Db,
  application: TablesInsert<"applications">,
): Promise<Tables<"applications">> {
  return unwrap(
    await db.from("applications").insert(application).select().single(),
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

export async function deleteApplicationForCourse(
  db: Db,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await db
    .from("applications")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
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
      .order("due_date", { ascending: true, nullsFirst: false }),
  );
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

export async function deleteManualTask(
  db: Db,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await db
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .is("task_key", null);
  if (error) throw new Error(error.message);
}

export async function setTaskDone(
  db: Db,
  id: string,
  done: boolean,
): Promise<Tables<"tasks">> {
  return unwrap(
    await db.from("tasks").update({ done }).eq("id", id).select().single(),
  );
}

export async function upsertGeneratedTasks(
  db: Db,
  rows: GeneratedTaskUpsert[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db
    .from("tasks")
    .upsert(rows, { onConflict: "user_id,task_key" });
  if (error) throw new Error(error.message);
}

export async function deleteStaleGeneratedTasks(
  db: Db,
  userId: string,
  staleKeys: string[],
): Promise<void> {
  if (staleKeys.length === 0) return;
  const { error } = await db
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("done", false)
    .in("task_key", staleKeys);
  if (error) throw new Error(error.message);
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
  Pick<Tables<"checks">, "id" | "profile" | "result" | "created_at"> | null
> {
  return unwrap(
    await db
      .from("checks")
      .select("id, profile, result, created_at")
      .eq("id", id)
      .maybeSingle(),
  );
}

// ------------------------------------------------------------------ reports

// No .select() — anonymous reports (user_id null) have no read-back policy.
export async function insertRuleReport(
  db: Db,
  report: TablesInsert<"rule_reports">,
): Promise<void> {
  const { error } = await db.from("rule_reports").insert(report);
  if (error) throw new Error(error.message);
}

export async function insertAnswerReport(
  db: Db,
  report: TablesInsert<"answer_reports">,
): Promise<void> {
  const { error } = await db.from("answer_reports").insert(report);
  if (error) throw new Error(error.message);
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
 * ponytail: UTC day boundary (~5:30am IST reset), fine for a soft quota. */
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
  const { error } = await db.from("assistant_messages").insert(message);
  if (error) throw new Error(error.message);
}
