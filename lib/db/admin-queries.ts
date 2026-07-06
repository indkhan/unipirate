import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Enums,
  Tables,
  TablesUpdate,
} from "@/lib/db/database.types";
import { EngineRuleSchema } from "@/lib/engine/evaluate";

type Db = Pick<SupabaseClient<Database>, "from">;

export type AdminRuleFilters = {
  country?: string;
  status?: Enums<"rule_status">;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

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

/** Pending "the page changed" submissions with the course they dispute. */
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
  const { error } = await db.rpc("resolve_course_conflict", {
    p_new_course_id: newCourseId,
    p_keep_new: keepNew,
  });
  if (error) throw new Error(error.message);
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
