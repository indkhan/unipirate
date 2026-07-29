// RLS integration test: anon vs owner vs admin against the real Supabase
// project. Skips entirely when .env.local / env keys are absent, when the
// linked remote schema has not applied current migrations, or when the secret
// key cannot use the auth admin API (needed to create test users), so plain
// `pnpm test` stays green anywhere. Creates only rls-test-* users and its own
// rows; deletes them in cleanup.

import { randomUUID } from "node:crypto";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/database.types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — keys may still come from the environment
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

type Db = SupabaseClient<Database>;

const PASSWORD = `rls-test-${randomUUID()}`;

function anonClient(): Db {
  return createClient<Database>(url!, publishableKey!, {
    auth: { persistSession: false },
  });
}

/**
 * The suite needs two capabilities beyond the presence of keys: the current
 * schema on the linked project, and a secret key that can manage users via
 * the auth admin API. Missing either is an environment limitation, not a
 * regression — warn and skip.
 */
async function canRunSuite(): Promise<boolean> {
  if (!configured) return false;

  const service = createClient<Database>(url!, secretKey!, {
    auth: { persistSession: false },
  });

  const { error } = await service
    .from("admin_audit_events")
    .select("id")
    .limit(1);
  if (
    error &&
    (error.code === "PGRST205" ||
      error.message.includes("Could not find the table"))
  ) {
    console.warn(
      "Skipping RLS integration tests: admin_audit_events migration is not applied.",
    );
    return false;
  }

  const { error: adminError } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });
  if (adminError) {
    console.warn(
      `Skipping RLS integration tests: the secret key cannot use the auth admin API (${adminError.message}).`,
    );
    return false;
  }

  return true;
}

async function signedInClient(email: string): Promise<Db> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return client;
}

const suiteReady = await canRunSuite();

describe.skipIf(!suiteReady)("RLS: anon vs owner vs admin", () => {
  let service: Db;
  let anon: Db;
  let owner: Db;
  let other: Db;
  let admin: Db;
  let ownerUser: User;
  let otherUser: User;
  let adminUser: User;
  let draftRuleId: string;
  let betaRuleId: string;
  let auditRuleId: string;
  let pendingCourseId: string;
  let rejectCourseId: string;
  let anonymousCheckId: string | undefined;
  let claimCheckId: string | undefined;
  const createdUserIds: string[] = [];
  const createdRuleIds: string[] = [];
  const createdCourseIds: string[] = [];

  async function createUser(appMetadata?: Record<string, unknown>) {
    const { data, error } = await service.auth.admin.createUser({
      email: `rls-test-${randomUUID()}@example.com`,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    createdUserIds.push(data.user.id);
    return data.user;
  }

  beforeAll(async () => {
    service = createClient<Database>(url!, secretKey!, {
      auth: { persistSession: false },
    });
    anon = anonClient();

    ownerUser = await createUser();
    otherUser = await createUser();
    adminUser = await createUser({ role: "admin" });
    owner = await signedInClient(ownerUser.email!);
    other = await signedInClient(otherUser.email!);
    admin = await signedInClient(adminUser.email!);

    // fixtures via service role: one draft + one beta rule, one pending course
    const { data: rules, error: rulesError } = await service
      .from("rules")
      .insert([
        {
          conditions: { test: "draft" },
          outcomes: {},
          status: "draft",
          source_url: `https://example.com/rls-test/${randomUUID()}`,
          source_quote: "rls test draft",
        },
        {
          conditions: { test: "beta" },
          outcomes: {},
          status: "beta",
          source_url: `https://example.com/rls-test/${randomUUID()}`,
          source_quote: "rls test beta",
        },
        {
          conditions: { test: "audit" },
          outcomes: {},
          status: "draft",
          source_url: `https://example.com/rls-test/${randomUUID()}`,
          source_quote: "rls test audit",
        },
      ])
      .select("id, status, source_quote");
    if (rulesError) throw new Error(rulesError.message);
    draftRuleId = rules.find((r) => r.source_quote === "rls test draft")!.id;
    betaRuleId = rules.find((r) => r.source_quote === "rls test beta")!.id;
    auditRuleId = rules.find((r) => r.source_quote === "rls test audit")!.id;
    createdRuleIds.push(...rules.map((r) => r.id));

    const { data: course, error: courseError } = await owner
      .from("courses")
      .insert({
        imported_by: ownerUser.id,
        source_url: "https://example.com/rls-test/course",
        normalized_url: `example.com/rls-test/course/${randomUUID()}`,
      })
      .select("id")
      .single();
    if (courseError) throw new Error(courseError.message);
    pendingCourseId = course.id;
    createdCourseIds.push(course.id);

    const { data: rejectCourse, error: rejectCourseError } = await owner
      .from("courses")
      .insert({
        imported_by: ownerUser.id,
        source_url: "https://example.com/rls-test/reject-course",
        normalized_url: `example.com/rls-test/reject-course/${randomUUID()}`,
      })
      .select("id")
      .single();
    if (rejectCourseError) throw new Error(rejectCourseError.message);
    rejectCourseId = rejectCourse.id;
    createdCourseIds.push(rejectCourse.id);

    const { error: auditFixtureError } = await service
      .from("admin_audit_events")
      .insert({
        table_name: "rules",
        row_id: draftRuleId,
        action: "update",
        old_status: "draft",
        new_status: "draft",
        old_row: { fixture: "before" },
        new_row: { fixture: "after" },
      });
    if (auditFixtureError) throw new Error(auditFixtureError.message);
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    const auditedRowIds = [...createdRuleIds, ...createdCourseIds];
    if (auditedRowIds.length > 0)
      await service.from("admin_audit_events").delete().in("row_id", auditedRowIds);
    if (createdCourseIds.length > 0)
      await service.from("courses").delete().in("id", createdCourseIds);
    if (anonymousCheckId)
      await service.from("checks").delete().eq("id", anonymousCheckId);
    if (claimCheckId)
      await service.from("checks").delete().eq("id", claimCheckId);
    if (createdRuleIds.length > 0)
      await service.from("rules").delete().in("id", createdRuleIds);
    for (const id of createdUserIds) await service.auth.admin.deleteUser(id);
  }, 60_000);

  // ------------------------------------------------------------------ anon

  it("anon reads beta rules but never drafts", async () => {
    const { data, error } = await anon.from("rules").select("id");
    expect(error).toBeNull();
    const ids = data!.map((r) => r.id);
    expect(ids).toContain(betaRuleId);
    expect(ids).not.toContain(draftRuleId);
  });

  it("anon cannot write rules", async () => {
    const { error } = await anon.from("rules").insert({
      conditions: {},
      outcomes: {},
      source_url: "https://example.com/nope",
      source_quote: "nope",
    });
    expect(error).not.toBeNull();
  });

  it("anon does not see pending courses", async () => {
    const { data, error } = await anon
      .from("courses")
      .select("id")
      .eq("id", pendingCourseId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("anon cannot read profiles", async () => {
    const { data, error } = await anon.from("profiles").select("user_id");
    expect(error).toBeNull(); // RLS filters rather than erroring on select
    expect(data).toHaveLength(0);
  });

  it("anon can share a check but cannot read its ownership metadata", async () => {
    const { data: check, error: insertError } = await anon
      .from("checks")
      .insert({
        answers: { targetDegree: "bachelor" },
        owner_token_hash: "a".repeat(64),
        profile: { targetDegree: "bachelor" },
        result: { path: "unknown" },
      })
      .select("id")
      .single();
    if (insertError?.code === "PGRST204") {
      console.warn(
        "Skipping check-ownership RLS assertion: migration is not applied.",
      );
      return;
    }
    expect(insertError).toBeNull();
    anonymousCheckId = check!.id;

    const { data: publicCheck, error: publicError } = await anon
      .from("checks")
      .select("id, profile, result, created_at")
      .eq("id", anonymousCheckId)
      .single();
    expect(publicError).toBeNull();
    expect(publicCheck!.id).toBe(anonymousCheckId);

    const { error: privateError } = await anon
      .from("checks")
      .select("owner_token_hash")
      .eq("id", anonymousCheckId);
    expect(privateError).not.toBeNull();
  });

  it("anon can file an anonymous answer report", async () => {
    const { error } = await anon
      .from("answer_reports")
      .insert({ message: "rls test anon report", context: { test: true } });
    expect(error).toBeNull();
    await service
      .from("answer_reports")
      .delete()
      .eq("message", "rls test anon report");
  });

  it("anon reads kb_chunks but cannot write them", async () => {
    const slug = `rls-test-chunk-${randomUUID()}`;
    const { error: fixtureError } = await service.from("kb_chunks").insert({
      source_type: "snippet",
      slug,
      title: "rls test chunk",
      content: "rls test content",
      source_url: "https://example.com/rls-test/chunk",
    });
    if (fixtureError?.code === "PGRST205") {
      console.warn("Skipping kb_chunks RLS assertions: migration not applied.");
      return;
    }
    expect(fixtureError).toBeNull();

    const { data, error } = await anon
      .from("kb_chunks")
      .select("slug")
      .eq("slug", slug);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const { error: writeError } = await anon.from("kb_chunks").insert({
      source_type: "snippet",
      slug: `${slug}-nope`,
      title: "nope",
      content: "nope",
      source_url: "https://example.com/nope",
    });
    expect(writeError).not.toBeNull();

    await service.from("kb_chunks").delete().eq("slug", slug);
  });

  // ----------------------------------------------------------------- owner

  it("owner upserts own profile; other user cannot see it", async () => {
    const { error } = await owner.from("profiles").upsert({
      user_id: ownerUser.id,
      country_code: "in",
      answers: { class12_percent: 82 },
    });
    expect(error).toBeNull();

    const { data: otherView } = await other
      .from("profiles")
      .select("user_id")
      .eq("user_id", ownerUser.id);
    expect(otherView).toHaveLength(0);
  });

  it("owner cannot write a profile for someone else", async () => {
    const { error } = await owner
      .from("profiles")
      .upsert({ user_id: otherUser.id, answers: {} });
    expect(error).not.toBeNull();
  });

  it("claims a check once for its token holder and rejects another user", async () => {
    const tokenHash = "b".repeat(64);
    const { data: check, error: insertError } = await service
      .from("checks")
      .insert({
        answers: { targetDegree: "bachelor", nationality: "in" },
        owner_token_hash: tokenHash,
        profile: {
          targetDegree: "bachelor",
          nationality: "in",
          certificateCountry: "in",
        },
        result: { path: "unknown" },
      })
      .select("id")
      .single();
    if (insertError?.code === "PGRST204") return;
    expect(insertError).toBeNull();
    claimCheckId = check!.id;

    const missing = await owner.rpc("claim_check", {
      p_check_id: claimCheckId,
      p_token_hash: "c".repeat(64),
    });
    if (missing.error?.code === "PGRST202") return;
    expect(missing.error).toBeNull();
    expect(missing.data).toBe(false);

    const claimed = await owner.rpc("claim_check", {
      p_check_id: claimCheckId,
      p_token_hash: tokenHash,
    });
    expect(claimed).toEqual(expect.objectContaining({ data: true, error: null }));

    const repeated = await owner.rpc("claim_check", {
      p_check_id: claimCheckId,
      p_token_hash: tokenHash,
    });
    expect(repeated.data).toBe(true);

    const crossUser = await other.rpc("claim_check", {
      p_check_id: claimCheckId,
      p_token_hash: tokenHash,
    });
    expect(crossUser.data).toBe(false);

    const { data: profile } = await owner
      .from("profiles")
      .select("country_code, answers")
      .eq("user_id", ownerUser.id)
      .single();
    expect(profile).toEqual(
      expect.objectContaining({
        country_code: "in",
        answers: expect.objectContaining({ targetDegree: "bachelor" }),
      }),
    );
  });

  it("owner CRUDs own tasks; other sees none", async () => {
    const { data: task, error } = await owner
      .from("tasks")
      .insert({ user_id: ownerUser.id, title: "rls test task" })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { error: updateError } = await owner
      .from("tasks")
      .update({ done: true })
      .eq("id", task!.id);
    expect(updateError).toBeNull();

    const { data: otherView } = await other
      .from("tasks")
      .select("id")
      .eq("id", task!.id);
    expect(otherView).toHaveLength(0);
  });

  it("admin sees definition-linked task copies but not private manual tasks", async () => {
    const { data: manual, error: manualError } = await owner
      .from("tasks")
      .insert({ user_id: ownerUser.id, title: "rls private manual task" })
      .select("id")
      .single();
    expect(manualError).toBeNull();

    // A definition-linked copy is what the admin course-task sync fans out.
    const { data: definition, error: definitionError } = await service
      .from("course_task_definitions")
      .insert({
        course_id: pendingCourseId,
        kind: "submission",
        title_template: "Submit application — {{course}}",
        due_mode: "source_deadline",
        sort_order: 30,
      })
      .select("id")
      .single();
    expect(definitionError).toBeNull();

    const { data: assigned, error: assignedError } = await service
      .from("tasks")
      .insert({
        user_id: ownerUser.id,
        title: "rls course task copy",
        task_key: `app:${randomUUID()}:course-task:${definition!.id}`,
        course_task_definition_id: definition!.id,
      })
      .select("id")
      .single();
    expect(assignedError).toBeNull();

    const { data: adminManualView } = await admin
      .from("tasks")
      .select("id")
      .eq("id", manual!.id);
    expect(adminManualView).toHaveLength(0);

    const { data: adminCopyView } = await admin
      .from("tasks")
      .select("id")
      .eq("id", assigned!.id);
    expect(adminCopyView).toHaveLength(1);

    await service.from("tasks").delete().eq("id", assigned!.id);
    await service.from("course_task_definitions").delete().eq("id", definition!.id);
  });

  it("owner reads own pending course but cannot approve it", async () => {
    const { data } = await owner
      .from("courses")
      .select("id")
      .eq("id", pendingCourseId);
    expect(data).toHaveLength(1);

    // update is filtered by RLS (no update policy for non-admins) → 0 rows
    const { data: updated, error } = await owner
      .from("courses")
      .update({ review_status: "approved" })
      .eq("id", pendingCourseId)
      .select("id");
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);
  });

  it("owner removes own course but not another user's course", async () => {
    const { data: course, error: insertError } = await owner
      .from("courses")
      .insert({
        imported_by: ownerUser.id,
        source_url: "https://example.com/rls-test/delete-course",
        normalized_url: `example.com/rls-test/delete-course/${randomUUID()}`,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    createdCourseIds.push(course!.id);

    const { error: crossUserError } = await other.rpc("remove_my_course", {
      course_id: course!.id,
    });
    if (crossUserError?.code === "PGRST202") {
      console.warn(
        "Skipping course removal RLS assertions: remove_my_course migration is not applied.",
      );
      return;
    }
    expect(crossUserError).toBeNull();

    const { data: stillOwned } = await service
      .from("courses")
      .select("imported_by")
      .eq("id", course!.id)
      .single();
    expect(stillOwned?.imported_by).toBe(ownerUser.id);

    const { error: ownerError } = await owner.rpc("remove_my_course", {
      course_id: course!.id,
    });
    expect(ownerError).toBeNull();

    const { data: ownerView } = await owner
      .from("courses")
      .select("id")
      .eq("id", course!.id);
    expect(ownerView).toHaveLength(0);

    const { data: approvedCourse, error: approvedInsertError } = await service
      .from("courses")
      .insert({
        imported_by: ownerUser.id,
        source_url: "https://example.com/rls-test/approved-detach-course",
        normalized_url: `example.com/rls-test/approved-detach-course/${randomUUID()}`,
        review_status: "approved",
      })
      .select("id")
      .single();
    expect(approvedInsertError).toBeNull();
    createdCourseIds.push(approvedCourse!.id);

    const { error: detachError } = await owner.rpc("remove_my_course", {
      course_id: approvedCourse!.id,
    });
    expect(detachError).toBeNull();

    const { data: detachedCourse } = await service
      .from("courses")
      .select("imported_by, review_status")
      .eq("id", approvedCourse!.id)
      .single();
    expect(detachedCourse).toEqual(
      expect.objectContaining({ imported_by: null, review_status: "approved" }),
    );
  });

  it("owner logs own assistant messages; others see none", async () => {
    const { error } = await owner.from("assistant_messages").insert({
      user_id: ownerUser.id,
      role: "user",
      content: "rls test question",
    });
    if (error?.code === "PGRST205") {
      console.warn(
        "Skipping assistant_messages RLS assertions: migration not applied.",
      );
      return;
    }
    expect(error).toBeNull();

    const { error: crossError } = await owner.from("assistant_messages").insert({
      user_id: otherUser.id,
      role: "user",
      content: "rls test cross-user question",
    });
    expect(crossError).not.toBeNull();

    const { data: otherView, error: otherError } = await other
      .from("assistant_messages")
      .select("id")
      .eq("user_id", ownerUser.id);
    expect(otherError).toBeNull();
    expect(otherView).toHaveLength(0);

    const { data: ownView } = await owner
      .from("assistant_messages")
      .select("content")
      .eq("user_id", ownerUser.id);
    expect(ownView!.map((m) => m.content)).toContain("rls test question");

    await service
      .from("assistant_messages")
      .delete()
      .eq("user_id", ownerUser.id);
  });

  it("owner cannot update rules", async () => {
    const { data, error } = await owner
      .from("rules")
      .update({ status: "verified" })
      .eq("id", betaRuleId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("owner cannot read admin audit events", async () => {
    const { data, error } = await owner.from("admin_audit_events").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // ----------------------------------------------------------------- admin

  it("admin reads draft rules and all profiles", async () => {
    const { data: rules } = await admin
      .from("rules")
      .select("id")
      .eq("id", draftRuleId);
    expect(rules).toHaveLength(1);

    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", ownerUser.id);
    expect(profiles).toHaveLength(1);
  });

  it("admin can read the course task source review queue", async () => {
    const { error } = await admin
      .from("course_task_source_reviews")
      .select("id")
      .eq("status", "pending");
    expect(error).toBeNull();
  });

  it("admin updates a rule", async () => {
    const { data, error } = await admin
      .from("rules")
      .update({ notes: "checked by admin" })
      .eq("id", draftRuleId)
      .select("notes")
      .single();
    expect(error).toBeNull();
    expect(data!.notes).toBe("checked by admin");
  });

  it("admin rule status updates create audit rows", async () => {
    const { error } = await admin
      .from("rules")
      .update({ status: "verified" })
      .eq("id", auditRuleId);
    expect(error).toBeNull();

    const { data: auditRows, error: auditError } = await admin
      .from("admin_audit_events")
      .select("old_status, new_status")
      .eq("table_name", "rules")
      .eq("row_id", auditRuleId)
      .eq("old_status", "draft")
      .eq("new_status", "verified");
    expect(auditError).toBeNull();
    expect(auditRows).toHaveLength(1);
  });

  it("admin approves a course; anon can then read it", async () => {
    const { error } = await admin
      .from("courses")
      .update({ review_status: "approved" })
      .eq("id", pendingCourseId);
    expect(error).toBeNull();

    const { data: auditRows, error: auditError } = await admin
      .from("admin_audit_events")
      .select("old_status, new_status")
      .eq("table_name", "courses")
      .eq("row_id", pendingCourseId)
      .eq("old_status", "pending")
      .eq("new_status", "approved");
    expect(auditError).toBeNull();
    expect(auditRows).toHaveLength(1);

    const { data } = await anon
      .from("courses")
      .select("id")
      .eq("id", pendingCourseId);
    expect(data).toHaveLength(1);
  });

  it("admin rejects a course and the rejected row stays private", async () => {
    const { error } = await admin
      .from("courses")
      .update({ review_status: "rejected" })
      .eq("id", rejectCourseId);
    expect(error).toBeNull();

    const { data: auditRows, error: auditError } = await admin
      .from("admin_audit_events")
      .select("old_status, new_status")
      .eq("table_name", "courses")
      .eq("row_id", rejectCourseId)
      .eq("old_status", "pending")
      .eq("new_status", "rejected");
    expect(auditError).toBeNull();
    expect(auditRows).toHaveLength(1);

    const { data } = await anon
      .from("courses")
      .select("id")
      .eq("id", rejectCourseId);
    expect(data).toHaveLength(0);
  });
});
