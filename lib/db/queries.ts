import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Tables,
  TablesInsert,
} from "@/lib/db/database.types";

type Db = Pick<SupabaseClient<Database>, "from">;

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
    await db.from("courses").select().eq("review_status", "approved"),
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

export async function setTaskDone(
  db: Db,
  id: string,
  done: boolean,
): Promise<Tables<"tasks">> {
  return unwrap(
    await db.from("tasks").update({ done }).eq("id", id).select().single(),
  );
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
