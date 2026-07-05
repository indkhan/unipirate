// RLS integration test: anon vs owner vs admin against the real Supabase
// project. Skips entirely when .env.local / env keys are absent, or when the
// linked remote schema has not applied current migrations, so plain `pnpm test`
// stays green anywhere. Creates only rls-test-* users and its own rows; deletes
// them in cleanup.

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

async function hasCurrentSchema(): Promise<boolean> {
  if (!configured) return false;

  const service = createClient<Database>(url!, secretKey!, {
    auth: { persistSession: false },
  });
  const { error } = await service
    .from("admin_audit_events")
    .select("id")
    .limit(1);

  if (!error) return true;

  if (
    error.code === "PGRST205" ||
    error.message.includes("Could not find the table")
  ) {
    console.warn(
      "Skipping RLS integration tests: admin_audit_events migration is not applied.",
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

const schemaReady = await hasCurrentSchema();

describe.skipIf(!configured || !schemaReady)("RLS: anon vs owner vs admin", () => {
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
        created_by: ownerUser.id,
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
        created_by: ownerUser.id,
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
