import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Enums,
  Tables,
  TablesUpdate,
} from "@/lib/db/database.types";

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
    query = query.filter("conditions->>country", "eq", filters.country);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  return unwrap(await query);
}

export async function updateAdminRule(
  db: Db,
  id: string,
  rule: Pick<
    TablesUpdate<"rules">,
    | "conditions"
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
      .order("created_at", { ascending: true }),
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
