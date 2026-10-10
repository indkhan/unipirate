// Actual disposable-service RLS gate. Missing keys self-skip; configured failures
// must fail. Only ephemeral rls-test fixtures are created. Immutable rule/version/
// publication history is retained deliberately; mutable fixtures and auth users
// are cleaned up. Root executes this suite; pure/unit workers never load it.

import { randomUUID } from "node:crypto";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/database.types";
import { getAdminRuleDraft, listAdminRuleVersions, publishAdminRuleVersion, updateAdminRule } from "@/lib/db/admin-queries";
import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import { evaluateAssessment } from "@/lib/rules/assessment";
import { currentAssessmentContext } from "@/lib/rules/current";
import { answers as fixtureAnswers } from "@/lib/rules/__tests__/assessment-fixtures";
import { RawRuleSchema, type RuleDraft, type RuleVersion } from "@/lib/rules/versioning";
import { getCourseByNormalizedUrl } from "@/lib/db/queries";

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

async function signedInClient(email: string): Promise<Db> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return client;
}

const suiteReady = configured;

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
  let betaVersion: RuleVersion;
  let pendingCourseId: string;
  let rejectCourseId: string;
  let anonymousCheckId: string | undefined;
  let claimCheckId: string | undefined;
  const createdUserIds: string[] = [];
  const createdRuleIds: string[] = [];
  const fixtureVerifiedAt = new Date().toISOString();
  const createdCourseIds: string[] = [];
  const createdDefinitionIds: string[] = [];

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

  function reviewToken(draft: RuleDraft, predecessor: string | null) {
    return { rule_id: draft.rule_id, revision: draft.revision, raw_snapshot: draft.raw_snapshot, predecessor_id: predecessor };
  }
  function rpcApproval(draft: RuleDraft, predecessor: string | null) {
    return { p_rule_id: draft.rule_id, p_expected_draft_revision: draft.revision,
      p_expected_raw_snapshot: draft.raw_snapshot,
      // Trade-off: generated types spell nullable SQL UUID as string; preserve
      // the actual NULL first-publication token, as the production helper does.
      p_expected_predecessor_id: predecessor as string, p_approval_status: "verified" as const };
  }

  function authoritativeCheck() {
    const answers = AnswersSchema.parse(fixtureAnswers);
    const assessment = evaluateAssessment(buildProfile(answers), [betaVersion], currentAssessmentContext());
    return { answers, result: assessment.result, assessment_metadata: assessment.metadata };
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

    // Every logical rule starts as a draft. The trigger initializes its workspace;
    // only the authenticated admin publication RPC can create beta/verified history.
    const { data: rules, error: rulesError } = await service
      .from("rules")
      .insert([
        {
          conditions: { target_degree: "bachelor", certificate_country: "zz" },
          outcomes: { path: "unknown" },
          status: "draft",
          source_url: `https://example.com/rls-test/${randomUUID()}`,
          source_quote: "rls test draft",
          last_verified_at: fixtureVerifiedAt,
          slug: `rls-test-${randomUUID()}`,
        },
        {
          conditions: { target_degree: "bachelor", certificate_country: "zz" },
          outcomes: { path: "unknown" },
          status: "draft",
          source_url: `https://example.com/rls-test/${randomUUID()}`,
          source_quote: "rls test beta",
          last_verified_at: fixtureVerifiedAt,
          slug: `rls-test-${randomUUID()}`,
        },
        {
          conditions: { target_degree: "bachelor", certificate_country: "zz" },
          outcomes: { path: "unknown" },
          status: "draft",
          source_url: `https://example.com/rls-test/${randomUUID()}`,
          source_quote: "rls test audit",
          last_verified_at: fixtureVerifiedAt,
          slug: `rls-test-${randomUUID()}`,
        },
      ])
      .select("id, status, source_quote");
    if (rulesError) throw new Error(rulesError.message);
    draftRuleId = rules.find((r) => r.source_quote === "rls test draft")!.id;
    betaRuleId = rules.find((r) => r.source_quote === "rls test beta")!.id;
    auditRuleId = rules.find((r) => r.source_quote === "rls test audit")!.id;
    createdRuleIds.push(...rules.map((r) => r.id));
    const betaDraft = await getAdminRuleDraft(admin, betaRuleId);
    const beta = await publishAdminRuleVersion(admin, { ...reviewToken(betaDraft, null), approval_status: "beta", confirmed: true });
    betaVersion = beta;
    expect(beta).toMatchObject({ rule_id: betaRuleId, status: "beta", version_number: 1, supersedes_version_id: null, reviewed_by: adminUser.id });

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

  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    // Do not delete logical rules, workspaces, immutable versions/publication
    // journals or authoritative checks. Their historical UUIDs survive auth deletion.
    // Non-publication course audit rows and NULL-authority check fixtures are mutable.
    const mutableAuditIds = [...createdCourseIds, ...createdDefinitionIds];
    if (mutableAuditIds.length > 0) {
      const { error } = await service.from("admin_audit_events").delete().in("row_id", mutableAuditIds).is("rule_publication", null);
      expect(error).toBeNull();
    }
    if (createdCourseIds.length > 0) {
      const { error } = await service.from("courses").delete().in("id", createdCourseIds);
      expect(error).toBeNull();
    }
    for (const id of [anonymousCheckId, claimCheckId].filter((id): id is string => Boolean(id))) {
      const { error } = await service.from("checks").delete().eq("id", id).is("assessment_metadata", null);
      expect(error).toBeNull();
    }
    for (const id of createdUserIds) {
      const { error } = await service.auth.admin.deleteUser(id);
      expect(error).toBeNull();
    }
    console.info("Retained ephemeral immutable RLS artifacts:", { ruleIds: createdRuleIds, checkIds: [anonymousCheckId, claimCheckId].filter(Boolean) });
    if (claimCheckId) {
      const retained = await service.from("checks").select("claimed_by,claimed_at,assessment_metadata").eq("id", claimCheckId).single();
      expect(retained.error).toBeNull();
      expect(retained.data?.claimed_by).toBeNull();
      expect(retained.data?.claimed_at).not.toBeNull();
      expect(retained.data?.assessment_metadata).not.toBeNull();
    }
  }, 60_000);

  // ------------------------------------------------------------------ anon

  it("looks up the canonical course while its importer has a pending update", async () => {
    const normalizedUrl = `https://example.com/rls-test/lookup/${randomUUID()}`;
    const original = await owner.from("courses").insert({ imported_by: ownerUser.id, source_url: normalizedUrl, normalized_url: normalizedUrl }).select("id").single();
    expect(original.error).toBeNull();
    createdCourseIds.push(original.data!.id);
    const update = await owner.from("courses").insert({ imported_by: ownerUser.id, source_url: normalizedUrl, normalized_url: normalizedUrl, conflicts_with: original.data!.id }).select("id").single();
    expect(update.error).toBeNull();
    createdCourseIds.push(update.data!.id);
    expect((await getCourseByNormalizedUrl(owner, normalizedUrl))?.id).toBe(original.data!.id);
  });

  it.each([true, false])("resolves course updates (keep new: %s) without deleting applications or task progress", async (keepNew) => {
    const normalizedUrl = `https://example.com/rls-test/conflict/${randomUUID()}`;
    const original = await service.from("courses").insert({ imported_by: ownerUser.id, name: "Original", source_url: normalizedUrl, normalized_url: normalizedUrl, review_status: "approved" }).select("id").single();
    expect(original.error).toBeNull();
    createdCourseIds.push(original.data!.id);
    const update = await owner.from("courses").insert({ imported_by: ownerUser.id, name: "Updated", source_url: normalizedUrl, normalized_url: normalizedUrl, conflicts_with: original.data!.id }).select("id").single();
    expect(update.error).toBeNull();
    createdCourseIds.push(update.data!.id);
    const application = await owner.from("applications").insert({ user_id: ownerUser.id, course_id: original.data!.id, status: "applied" }).select("id").single();
    expect(application.error).toBeNull();
    const definition = await service.from("course_task_definitions").insert({ course_id: original.data!.id, kind: "custom", title_template: "Reviewed task", due_mode: "none", sort_order: 30 }).select("id").single();
    expect(definition.error).toBeNull();
    createdDefinitionIds.push(definition.data!.id);
    const task = await owner.from("tasks").insert({ user_id: ownerUser.id, application_id: application.data!.id, course_task_definition_id: definition.data!.id, title: "My edited completed task", done: true, preferred_bucket: "later" }).select("id").single();
    expect(task.error).toBeNull();
    const duplicateApplication = await owner.from("applications").insert({ user_id: ownerUser.id, course_id: update.data!.id }).select("id").single();
    expect(duplicateApplication.error).toBeNull();
    const updateReminder = await owner.from("tasks").insert({ user_id: ownerUser.id, application_id: duplicateApplication.data!.id, title: "Personal update reminder" }).select("id").single();
    expect(updateReminder.error).toBeNull();
    const otherApplication = await other.from("applications").insert({ user_id: otherUser.id, course_id: update.data!.id }).select("id").single();
    expect(otherApplication.error).toBeNull();
    expect((await owner.rpc("resolve_course_conflict", { p_new_course_id: update.data!.id, p_keep_new: keepNew })).error).not.toBeNull();
    expect((await admin.rpc("resolve_course_conflict", { p_new_course_id: update.data!.id, p_keep_new: keepNew })).error).toBeNull();
    const survivor = await owner.from("courses").select("id,name").eq("id", original.data!.id).single();
    expect(survivor.data).toEqual({ id: original.data!.id, name: keepNew ? "Updated" : "Original" });
    const applications = await owner.from("applications").select("id,course_id,status").eq("course_id", original.data!.id);
    expect(applications.data).toEqual([{ id: application.data!.id, course_id: original.data!.id, status: "applied" }]);
    const tasks = await owner.from("tasks").select("id,title,done,preferred_bucket,application_id").in("id", [task.data!.id, updateReminder.data!.id]);
    expect(tasks.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: task.data!.id, title: "My edited completed task", done: true, preferred_bucket: "later", application_id: application.data!.id }),
      expect.objectContaining({ id: updateReminder.data!.id, title: "Personal update reminder", application_id: application.data!.id }),
    ]));
    const moved = await other.from("applications").select("id,course_id").eq("id", otherApplication.data!.id).single();
    expect(moved.data).toEqual({ id: otherApplication.data!.id, course_id: original.data!.id });
  });

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

  it("browser clients cannot insert authoritative checks or enumerate them", async () => {
    for (const client of [anon, owner]) {
      const { error: insertError } = await client.from("checks").insert({
        answers: { targetDegree: "bachelor" },
        result: { path: "direct" },
      });
      expect(insertError).not.toBeNull();
      const { error: readError } = await client.from("checks").select("id, answers, result");
      expect(readError).not.toBeNull();
    }
  });

  it("a shared check lookup exposes only its public projection", async () => {
    const { data: check, error: insertError } = await service
      .from("checks")
      .insert({
        ...authoritativeCheck(),
        owner_token_hash: "a".repeat(64),
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    anonymousCheckId = check!.id;

    const response = await fetch(`${url}/rest/v1/rpc/get_shared_check`, {
      method: "POST",
      headers: { apikey: publishableKey!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_check_id: anonymousCheckId }),
    });
    expect(response.status).toBe(200);
    const [publicCheck] = await response.json();
    expect(Object.keys(publicCheck).sort()).toEqual(["answers", "assessment_metadata", "created_at", "id", "result"]);
    expect(publicCheck.id).toBe(anonymousCheckId);
    expect(publicCheck.assessment_metadata).toMatchObject({ formatVersion: 1, selectedVersionIds: [betaVersion.id] });

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
        ...authoritativeCheck(),
        owner_token_hash: tokenHash,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    claimCheckId = check!.id;

    const missing = await owner.rpc("claim_check", {
      p_check_id: claimCheckId,
      p_token_hash: "c".repeat(64),
    });
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

    const { data: profile, error: profileError } = await owner
      .from("profiles")
      .select("answers")
      .eq("user_id", ownerUser.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile).toEqual(
      expect.objectContaining({
        answers: expect.objectContaining({ targetDegree: "bachelor", certificateCountry: "in" }),
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

  it("admin sees shared definitions but no student's generated or manual task copies", async () => {
    const { data: manual, error: manualError } = await owner
      .from("tasks")
      .insert({ user_id: ownerUser.id, title: "rls private manual task" })
      .select("id")
      .single();
    expect(manualError).toBeNull();

    // Shared definitions remain admin-visible; student state stays owner-only.
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
    createdDefinitionIds.push(definition!.id);

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
    expect(adminCopyView).toHaveLength(0);
    const { data: adminDefinitionView } = await admin.from("course_task_definitions").select("id").eq("id",definition!.id);
    expect(adminDefinitionView).toHaveLength(1);

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

  it("owner cannot update protected compatibility rules", async () => {
    const { error } = await owner.from("rules").update({ status: "verified" }).eq("id", betaRuleId);
    expect(error).not.toBeNull();
    const mirror = await anon.from("rules").select("status").eq("id", betaRuleId).single();
    expect(mirror.error).toBeNull();
    expect(mirror.data?.status).toBe("beta");
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

  it("admin direct compatibility writes are denied", async () => {
    const response = await admin.from("rules").update({ notes: "checked by admin" }).eq("id", draftRuleId);
    expect(response.error).not.toBeNull();
  });

  it("admin guarded publication creates the verified version and immutable audit row", async () => {
    const draft = await getAdminRuleDraft(admin, auditRuleId);
    const published = await publishAdminRuleVersion(admin, { ...reviewToken(draft, null), approval_status: "verified", confirmed: true });
    expect(published).toMatchObject({ rule_id: auditRuleId, status: "verified", version_number: 1,
      supersedes_version_id: null, draft_revision: draft.revision, reviewed_by: adminUser.id, provenance: "human_publication" });
    expect(published.published_at).toBe(published.reviewed_at);
    expect(published.raw_snapshot).toEqual({ ...RawRuleSchema.parse(draft.raw_snapshot), status: "verified" });
    const auditRows = await admin.from("admin_audit_events").select("id,old_status,new_status,rule_publication,actor_user_id")
      .eq("table_name", "rules").eq("row_id", auditRuleId).eq("old_status", "draft").eq("new_status", "verified");
    expect(auditRows.error).toBeNull();
    expect(auditRows.data).toHaveLength(1);
    expect(auditRows.data![0]).toMatchObject({ actor_user_id: adminUser.id, rule_publication: {
      rule_id: auditRuleId, version_id: published.id, reviewed_by: adminUser.id, draft_revision: draft.revision,
      version_number: 1, supersedes_version_id: null, status: "verified" } });
    const auditId = auditRows.data![0].id;
    expect((await service.from("admin_audit_events").delete().eq("id", auditId)).error).not.toBeNull();
    expect((await service.from("admin_audit_events").update({ new_status: "beta" }).eq("id", auditId)).error).not.toBeNull();
    expect((await admin.from("admin_audit_events").select("id").eq("id", auditId)).data).toHaveLength(1);
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
  it("only authenticated admins can edit drafts or invoke protected publication", async () => {
    const draft = await getAdminRuleDraft(admin, draftRuleId);
    for (const client of [anon, owner, other, service]) {
      const result = await client.rpc("publish_rule_version", rpcApproval(draft, null));
      expect(result.error).not.toBeNull();
    }
    for (const client of [owner, other]) {
      const read = await client.from("rule_drafts").select("rule_id").eq("rule_id", draftRuleId);
      expect(read.error).toBeNull(); expect(read.data).toHaveLength(0);
      const edit = await client.from("rule_drafts").update({ raw_snapshot: draft.raw_snapshot }).eq("rule_id", draftRuleId).select();
      expect(edit.error).toBeNull(); expect(edit.data).toHaveLength(0);
    }
    expect(await listAdminRuleVersions(admin, draftRuleId)).toHaveLength(0);
  });

  it("admin draft CAS and exact publication revision/raw/predecessor tokens reject stale approvals", async () => {
    const original = await getAdminRuleDraft(admin, draftRuleId);
    const exact = rpcApproval(original, null);
    const beforeAudit = await admin.from("admin_audit_events").select("id").eq("row_id", draftRuleId);
    expect(beforeAudit.error).toBeNull();
    for (const args of [
      { ...exact, p_expected_draft_revision: original.revision + 1 },
      { ...exact, p_expected_raw_snapshot: { ...RawRuleSchema.parse(original.raw_snapshot), notes: "unreviewed token" } },
      { ...exact, p_expected_predecessor_id: randomUUID() },
    ]) expect((await admin.rpc("publish_rule_version", args)).error).not.toBeNull();
    expect(await listAdminRuleVersions(admin, draftRuleId)).toHaveLength(0);
    expect((await admin.from("admin_audit_events").select("id").eq("row_id", draftRuleId)).data).toEqual(beforeAudit.data);
    const saved = await updateAdminRule(admin, { rule_id: original.rule_id, revision: original.revision, raw_snapshot: original.raw_snapshot,
      next_snapshot: { ...RawRuleSchema.parse(original.raw_snapshot), notes: "synthetic reviewed draft edit" },
      effective_from: original.effective_from, effective_until: original.effective_until,
      intake_from: original.intake_from, intake_until: original.intake_until });
    expect(saved.revision).toBe(original.revision + 1);
    expect(saved.edited_by).toBe(adminUser.id);
    const mirror = await admin.from("rules").select("status,notes").eq("id", draftRuleId).single();
    expect(mirror.error).toBeNull(); expect(mirror.data).toEqual({ status: "draft", notes: null });
    await expect(updateAdminRule(admin, { rule_id: original.rule_id, revision: original.revision, raw_snapshot: original.raw_snapshot,
      next_snapshot: original.raw_snapshot, effective_from: null, effective_until: null, intake_from: null, intake_until: null })).rejects.toThrow("changed");
    expect((await admin.rpc("publish_rule_version", exact)).error).not.toBeNull();
    const first = await publishAdminRuleVersion(admin, { ...reviewToken(saved, null), approval_status: "verified", confirmed: true });
    expect(first.raw_snapshot).toEqual({ ...RawRuleSchema.parse(saved.raw_snapshot), status: "verified" });
    expect((await admin.rpc("publish_rule_version", rpcApproval(saved, null))).error).not.toBeNull();
    const second = await publishAdminRuleVersion(admin, { ...reviewToken(saved, first.id), approval_status: "verified", confirmed: true });
    expect(second).toMatchObject({ version_number: 2, supersedes_version_id: first.id, draft_revision: saved.revision, reviewed_by: adminUser.id });
    expect(await listAdminRuleVersions(admin, draftRuleId)).toHaveLength(2);
    expect((await admin.rpc("publish_rule_version", rpcApproval(saved, first.id))).error).not.toBeNull();
    const events = await admin.from("admin_audit_events").select("id").eq("row_id", draftRuleId).not("rule_publication", "is", null);
    expect(events.error).toBeNull(); expect(events.data).toHaveLength(2);
    for (const client of [admin, service]) {
      expect((await client.from("rule_versions").update({ status: "beta" }).eq("id", first.id)).error).not.toBeNull();
      expect((await client.from("rule_versions").delete().eq("id", first.id)).error).not.toBeNull();
      expect((await client.from("rule_versions").insert({ rule_id: draftRuleId, version_number: 3, raw_snapshot: second.raw_snapshot, status: "verified", provenance: "human_publication" })).error).not.toBeNull();
    }
    expect((await listAdminRuleVersions(admin, draftRuleId)).find(v => v.id === first.id)).toEqual(first);
  });

  it("genuine reviewer account deletion retains immutable reviewer attribution and denies its old JWT", async () => {
    const reviewerUser = await createUser({ role: "admin" });
    const reviewer = await signedInClient(reviewerUser.email!);
    const draft = await getAdminRuleDraft(reviewer, betaRuleId);
    const [predecessor] = await listAdminRuleVersions(reviewer, betaRuleId);
    const published = await publishAdminRuleVersion(reviewer, { ...reviewToken(draft, predecessor.id), approval_status: "beta", confirmed: true });
    const audit = await admin.from("admin_audit_events").select().eq("row_id", betaRuleId).eq("actor_user_id", reviewerUser.id).single();
    expect(audit.error).toBeNull();
    const removed = await service.auth.admin.deleteUser(reviewerUser.id);
    expect(removed.error).toBeNull();
    createdUserIds.splice(createdUserIds.indexOf(reviewerUser.id), 1);
    const retained = (await listAdminRuleVersions(admin, betaRuleId)).find(v => v.id === published.id);
    expect(retained).toEqual(published);
    expect(retained?.reviewed_by).toBe(reviewerUser.id);
    const journal = await admin.from("admin_audit_events").select().eq("id", audit.data!.id).single();
    expect(journal.error).toBeNull();
    expect(journal.data).toEqual({ ...audit.data, actor_user_id: null });
    expect((await reviewer.rpc("publish_rule_version", rpcApproval(draft, published.id))).error).not.toBeNull();
  });

});
