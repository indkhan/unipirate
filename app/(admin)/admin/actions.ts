"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminCourse,
  insertAdminCourseTaskDefinition,
  listAdminCourseTaskDefinitions,
  resolveCourseConflict,
  publishAdminRuleVersion,
  updateAdminCourse,
  updateAdminCourseTaskDefinition,
  updateAdminRule,
  updateCourseReviewStatus,
  syncAdminCourseTaskDefinitions,
  publishAdminCourseResearch,
  saveAdminCourseResearchDraft,
  patchAdminCourseResearchDraft,
} from "@/lib/db/admin-queries";
import { hasResearch, ResearchDraftSchema, ResearchPatchSchema } from "@/lib/courses/research";
import { normalizeUrl } from "@/lib/courses/import";
import type { Json } from "@/lib/db/database.types";
import { CalendarDateSchema } from "@/lib/engine/calendar-day";
import { DraftSaveSchema, JsonSchema, preflightPublication } from "@/lib/rules/versioning";
import { deriveCourseTaskCandidates } from "@/lib/tasks/course-tasks";

const ruleReviewFormSchema=z.object({
 id:z.string().uuid(),expected_revision:z.coerce.number().int().positive().safe(),
 expected_raw_snapshot:z.string().min(2),expected_predecessor_id:z.string().uuid().or(z.literal("")),
});
const optionalScopeDate=CalendarDateSchema.or(z.literal("")).transform(value=>value===""?null:value);
const optionalScopeIntake=z.string().regex(/^([0-9]+)?$/).transform(value=>value===""?null:Number(value));
const ruleSaveFormSchema=ruleReviewFormSchema.omit({expected_predecessor_id:true}).extend({
 raw_snapshot:z.string().min(2),effective_from:optionalScopeDate,effective_until:optionalScopeDate,intake_from:optionalScopeIntake,intake_until:optionalScopeIntake,
});
function ruleFeedback(id:unknown,message:string):never {
 const parsed=z.string().uuid().safeParse(id);
 redirect('/admin?view=rules'+(parsed.success?'&rule='+parsed.data:'')+'&message='+encodeURIComponent(message));
}
function ruleError(error:unknown):string {
 if(error instanceof z.ZodError)return "Review validation failed: "+error.issues.map(issue=>issue.path.join(".")+": "+issue.message).join("; ");
 if(error instanceof SyntaxError)return "Rule JSON must be valid. Reload the saved draft and review again.";
 return error instanceof Error?error.message:"Rule change failed; reload and review again.";
}

const courseReviewSchema = z.object({
  id: z.string().uuid(),
  review_status: z.enum(["approved", "rejected"]),
});

const courseUpdateSchema = z.object({
  id: z.string().uuid(),
  source_url: z.string().url(),
  name: z.string(),
  university_name: z.string(),
  location: z.string(),
  degree: z.string(),
  language: z.string(),
  description: z.string(),
  tuition: z.string().min(2),
  deadlines: z.string().min(2),
  requirements: z.string().min(2),
});

/** Rule conditions/outcomes and course facts are edited as raw JSON textareas. */
function parseJson<T>(
  value: string,
  field: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  shape: string,
): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} must be valid JSON.`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error(`${field} must be ${shape}.`);

  return result.data;
}

const jsonStringArray = z.array(z.string().min(1));
const nullableJsonString = z.string().min(1).nullable();

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateRuleAction(formData:FormData) {
 const {db}=await requireAdmin();
 let message="Draft saved. Review the saved snapshot separately before publication.";
 try{
  const values=ruleSaveFormSchema.parse(Object.fromEntries(["id","expected_revision","expected_raw_snapshot","raw_snapshot","effective_from","effective_until","intake_from","intake_until"].map(key=>[key,formData.get(key)])));
  const input=DraftSaveSchema.parse({rule_id:values.id,revision:values.expected_revision,raw_snapshot:JsonSchema.parse(JSON.parse(values.expected_raw_snapshot)),next_snapshot:JsonSchema.parse(JSON.parse(values.raw_snapshot)),effective_from:values.effective_from,effective_until:values.effective_until,intake_from:values.intake_from,intake_until:values.intake_until});
  await updateAdminRule(db,input);
 }catch(error){message=ruleError(error);}
 ruleFeedback(formData.get("id"),message);
}
export async function reverifyRuleAction(formData:FormData) {
 const {db}=await requireAdmin();
 let message="New immutable rule version published. Source verification date preserved.";
 try{
  const values=ruleReviewFormSchema.extend({approval_status:z.enum(["beta","verified"]),confirmed:z.literal("on")}).parse(Object.fromEntries(["id","expected_revision","expected_raw_snapshot","expected_predecessor_id","approval_status","confirmed"].map(key=>[key,formData.get(key)])));
  const approval=preflightPublication({rule_id:values.id,revision:values.expected_revision,raw_snapshot:JsonSchema.parse(JSON.parse(values.expected_raw_snapshot)),predecessor_id:values.expected_predecessor_id||null,approval_status:values.approval_status,confirmed:true});
  await publishAdminRuleVersion(db,approval);
 }catch(error){message=ruleError(error);}
 ruleFeedback(formData.get("id"),message);
}

export async function reviewCourseAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = courseReviewSchema.parse({
    id: formData.get("id"),
    review_status: formData.get("review_status"),
  });

  const existing = await getAdminCourse(db, values.id);
  if (values.review_status === "approved" && hasResearch(existing.field_extraction)) throw new Error("Use explicit research review/publication for this draft.");
  const course = await updateCourseReviewStatus(db, values.id, values.review_status);
  if (values.review_status === "approved") {
    await ensureSourceTaskDefinitions(db, course);
    await syncAdminCourseTaskDefinitions(db, course.id);
  }

  redirect(`/admin?view=reviews&queue=pending&message=${encodeURIComponent(values.review_status === "approved" ? "Course approved." : "Course rejected.")}`);
}

export async function publishCourseResearchAction(formData: FormData) {
  const { db, user } = await requireAdmin();
  const values = z.object({ id: z.string().uuid(), attest: z.literal("yes"), accepted: z.array(z.string().min(1).max(250)).max(400) }).strict().parse({
    id: formData.get("id"), attest: formData.get("attest"), accepted: formData.getAll("accepted"),
  });
  const reconciliation = z.array(z.object({ key: z.string().min(1).max(250), reason: z.string().trim().min(20).max(2000) }).strict()).max(400).parse(
    formData.getAll("reconciled").map(key => ({ key, reason: formData.get(`reconciliation_reason:${key}`) })),
  );
  await publishAdminCourseResearch(db, values.id, values.accepted, user.id, reconciliation);
  redirect(`/admin?view=reviews&queue=pending&message=${encodeURIComponent("Reviewed research published; unaccepted facts remain unresolved.")}`);
}

export async function patchCourseResearchDraftAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = z.object({ id: z.string().uuid(), expected: z.string().min(2).max(850_000) }).strict().parse({ id: formData.get("id"), expected: formData.get("expected") });
  const rawPatch = formData.has("patch")
    ? JSON.parse(z.string().min(2).max(100_000).parse(formData.get("patch")))
    : { kind: "reject", reason: formData.get("reason"), entries: z.array(z.string().max(500)).max(50).parse(formData.getAll("entry")).map(e => JSON.parse(e)) };
  const patch = ResearchPatchSchema.parse(rawPatch);
  await patchAdminCourseResearchDraft(db, values.id, JSON.parse(values.expected), patch);
  redirect("/admin?view=reviews&queue=pending&course=" + values.id + "&message=" + encodeURIComponent("Field review saved as pending. Explicit review and publication are still required."));
}

export async function saveCourseResearchDraftAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = z.object({ id: z.string().uuid(), draft: z.string().min(2).max(850_000) }).strict().parse({ id: formData.get("id"), draft: formData.get("draft") });
  // Shape validation here; retained original captures are merged and the complete
  // evidence/scope contract is validated by the caller-scoped recovery helper.
  const draft = ResearchDraftSchema.innerType().parse(JSON.parse(values.draft));
  await saveAdminCourseResearchDraft(db, values.id, draft);
  redirect(`/admin?view=reviews&queue=pending&course=${values.id}&message=${encodeURIComponent("Research recovery saved as pending. Review and publication are still required.")}`);
}

async function ensureSourceTaskDefinitions(
  db: Awaited<ReturnType<typeof requireAdmin>>["db"],
  course: Awaited<ReturnType<typeof getAdminCourse>>,
) {
  const existing = await listAdminCourseTaskDefinitions(db, course.id);
  const candidates = deriveCourseTaskCandidates(course);
  await Promise.all(
    candidates
      .filter((candidate) => !existing.some((row) => row.source_key === candidate.sourceKey))
      .map((candidate, index) =>
        insertAdminCourseTaskDefinition(db, {
          course_id: course.id,
          kind: candidate.kind,
          source_key: candidate.sourceKey,
          title_template: candidate.titleTemplate,
          description: candidate.description,
          source_url: candidate.sourceUrl,
          due_mode: candidate.dueMode,
          due_date: null,
          source_snapshot: candidate.sourceSnapshot as Json,
          sort_order: 30 + index,
        }),
      ),
  );
}

const courseTaskSchema = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  kind: z.enum(["submission", "requirement", "custom"]),
  source_key: z.string().min(1).nullable(),
  title_template: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2000).nullable(),
  source_url: z.string().trim().url().max(2048).nullable(),
  due_mode: z.enum(["source_deadline", "fixed_date", "none"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  source_snapshot: z.string(),
  sort_order: z.coerce.number().int().min(1).max(999),
}).superRefine((value, ctx) => {
  if ((value.due_mode === "fixed_date") !== (value.due_date !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed dates require a due date." });
  }
});

function optionalFormText(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

export async function saveCourseTaskAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = courseTaskSchema.parse({
    id: optionalFormText(formData.get("id")) ?? undefined,
    course_id: formData.get("course_id"),
    kind: formData.get("kind"),
    source_key: optionalFormText(formData.get("source_key")),
    title_template: formData.get("title_template"),
    description: optionalFormText(formData.get("description")),
    source_url: optionalFormText(formData.get("source_url")),
    due_mode: formData.get("due_mode"),
    due_date: formData.get("due_mode") === "fixed_date" ? optionalFormText(formData.get("due_date")) : null,
    source_snapshot: formData.get("source_snapshot") ?? "null",
    sort_order: formData.get("sort_order"),
  });
  const sourceSnapshot = JSON.parse(values.source_snapshot) as Json;
  const course = await getAdminCourse(db, values.course_id);
  const payload = {
    kind: values.kind,
    source_key: values.source_key,
    title_template: values.title_template,
    description: values.description,
    source_url: values.source_url,
    due_mode: values.due_mode,
    due_date: values.due_date,
    source_snapshot: sourceSnapshot,
    sort_order: values.sort_order,
  };
  if (values.id) {
    await updateAdminCourseTaskDefinition(db, values.id, payload);
  } else {
    await insertAdminCourseTaskDefinition(db, { course_id: course.id, ...payload });
  }
  if (course.review_status === "approved") {
    await syncAdminCourseTaskDefinitions(db, course.id);
  }
  redirect(`/admin?view=tasks&course=${course.id}&message=${encodeURIComponent("Task changes saved.")}`);
}

export async function retireCourseTaskAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = z.object({ id: z.string().uuid(), course_id: z.string().uuid() }).parse({
    id: formData.get("id"),
    course_id: formData.get("course_id"),
  });
  await updateAdminCourseTaskDefinition(db, values.id, { retired_at: new Date().toISOString() });
  const course = await getAdminCourse(db, values.course_id);
  if (course.review_status === "approved") {
    await syncAdminCourseTaskDefinitions(db, course.id);
  }
  redirect(`/admin?view=tasks&course=${course.id}&message=${encodeURIComponent("Task retired.")}`);
}

const sourceChangeSchema = z.object({
  courseId: z.string().uuid(),
  sourceKey: z.string().min(1),
});

/**
 * Apply one official-source difference shown in the tasks view. The diff is
 * recomputed from the course facts and current definitions at render and
 * adopt time — there is no stored review queue; a difference stays visible
 * until it is adopted or the definition is edited.
 */
export async function adoptCourseTaskSourceChangeAction(formData: FormData) {
  const { db } = await requireAdmin();
  const { courseId, sourceKey } = sourceChangeSchema.parse({
    courseId: formData.get("courseId"),
    sourceKey: formData.get("sourceKey"),
  });
  const course = await getAdminCourse(db, courseId);
  const candidate = deriveCourseTaskCandidates(course).find(
    (item) => item.sourceKey === sourceKey,
  );
  const definitions = await listAdminCourseTaskDefinitions(db, course.id);
  const definition = definitions.find((item) => item.source_key === sourceKey);

  if (definition && !candidate) {
    // the source no longer proposes this task — retire the definition
    await updateAdminCourseTaskDefinition(db, definition.id, {
      retired_at: new Date().toISOString(),
    });
  } else if (definition && candidate) {
    await updateAdminCourseTaskDefinition(db, definition.id, {
      source_snapshot: candidate.sourceSnapshot as Json,
      due_mode: candidate.dueMode,
      due_date: null,
      source_url: candidate.sourceUrl,
      retired_at: null,
    });
  } else if (candidate) {
    await insertAdminCourseTaskDefinition(db, {
      course_id: course.id,
      kind: candidate.kind,
      source_key: candidate.sourceKey,
      title_template: candidate.titleTemplate,
      description: candidate.description,
      source_url: candidate.sourceUrl,
      due_mode: candidate.dueMode,
      due_date: null,
      source_snapshot: candidate.sourceSnapshot as Json,
      sort_order: 30 + definitions.length,
    });
  } else {
    throw new Error("This source change no longer exists; refresh the page.");
  }
  await syncAdminCourseTaskDefinitions(db, course.id);
  redirect(`/admin?view=tasks&course=${course.id}&message=${encodeURIComponent("Official source change applied.")}`);
}

const conflictResolveSchema = z.object({
  id: z.string().uuid(),
  keep_new: z.enum(["true", "false"]),
});

export async function resolveConflictAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = conflictResolveSchema.parse({
    id: formData.get("id"),
    keep_new: formData.get("keep_new"),
  });

  const update = await getAdminCourse(db, values.id);
  if (values.keep_new === "true" && hasResearch(update.field_extraction)) throw new Error("Use explicit research review/publication for this update.");
  await resolveCourseConflict(db, values.id, values.keep_new === "true");
  if (values.keep_new === "true" && update.conflicts_with) {
    const course = await getAdminCourse(db, update.conflicts_with);
    await ensureSourceTaskDefinitions(db, course);
    await syncAdminCourseTaskDefinitions(db, course.id);
  }

  redirect(`/admin?view=reviews&queue=conflicts&message=${encodeURIComponent("Course conflict resolved.")}`);
}

export async function updateCourseAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = courseUpdateSchema.parse({
    id: formData.get("id"),
    source_url: formData.get("source_url"),
    name: formData.get("name") ?? "",
    university_name: formData.get("university_name") ?? "",
    location: formData.get("location") ?? "",
    degree: formData.get("degree") ?? "",
    language: formData.get("language") ?? "",
    description: formData.get("description") ?? "",
    tuition: formData.get("tuition"),
    deadlines: formData.get("deadlines"),
    requirements: formData.get("requirements"),
  });

  const existing = await getAdminCourse(db, values.id);
  const metadata = existing.field_extraction && typeof existing.field_extraction === "object" && !Array.isArray(existing.field_extraction) ? existing.field_extraction : {};
  await updateAdminCourse(db, values.id, {
    source_url: values.source_url,
    normalized_url: normalizeUrl(values.source_url),
    name: nullableText(values.name),
    university_name: nullableText(values.university_name),
    location: nullableText(values.location),
    degree: nullableText(values.degree),
    language: nullableText(values.language),
    description: nullableText(values.description),
    tuition: parseJson(values.tuition, "tuition", nullableJsonString, "a JSON string or null"),
    deadlines: parseJson(values.deadlines, "deadlines", jsonStringArray, "a JSON array of non-empty strings"),
    requirements: parseJson(values.requirements, "requirements", jsonStringArray, "a JSON array of non-empty strings"),
    extraction_method: "manual",
    field_extraction: {
      ...metadata,
      core: "manual",
      description: "manual",
      deadlines: "manual",
      requirements: "manual",
      tuition: "manual",
    },
  });

  // No review rows to enqueue: the tasks view diffs current course facts
  // against the definitions live, so any change shows up there immediately.
  redirect(`/admin?view=reviews&queue=pending&course=${values.id}&message=${encodeURIComponent("Course edits saved.")}`);
}
