"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminRule,
  getAdminCourse,
  createAdminCourseTaskSourceReview,
  getAdminCourseTaskSourceReview,
  insertAdminCourseTaskDefinition,
  listAdminCourseTaskDefinitions,
  resolveCourseConflict,
  reverifyAdminRule,
  updateAdminCourse,
  updateAdminCourseTaskDefinition,
  updateAdminRule,
  updateCourseReviewStatus,
  syncAdminCourseTaskDefinitions,
  resolveAdminCourseTaskSourceReview,
} from "@/lib/db/admin-queries";
import { normalizeUrl } from "@/lib/courses/import";
import type { Json } from "@/lib/db/database.types";
import { EngineRuleSchema } from "@/lib/engine/evaluate";
import { deriveCourseTaskCandidates } from "@/lib/tasks/course-tasks";

const ruleStatusSchema = z.enum(["draft", "beta", "verified"]);

const ruleUpdateSchema = z.object({
  id: z.string().uuid(),
  country_code: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/)
    .or(z.literal("")),
  conditions: z.string().min(2),
  outcomes: z.string().min(2),
  source_url: z.string().url(),
  source_quote: z.string().min(1),
  notes: z.string(),
  status: ruleStatusSchema,
});

const idSchema = z.object({
  id: z.string().uuid(),
});

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

function parseJsonObject(value: string, field: string): Json {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} must be valid JSON.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object.`);
  }

  return parsed as Json;
}

function parseJsonArray(value: string, field: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} must be valid JSON.`);
  }

  const result = z.array(z.string().min(1)).safeParse(parsed);
  if (!result.success) {
    throw new Error(`${field} must be a JSON array of non-empty strings.`);
  }

  return result.data;
}

function parseNullableJsonString(value: string, field: string): string | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} must be valid JSON.`);
  }

  const result = z.string().min(1).nullable().safeParse(parsed);
  if (!result.success) {
    throw new Error(`${field} must be a JSON string or null.`);
  }

  return result.data;
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateRuleAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = ruleUpdateSchema.parse({
    id: formData.get("id"),
    country_code: formData.get("country_code") ?? "",
    conditions: formData.get("conditions"),
    outcomes: formData.get("outcomes"),
    source_url: formData.get("source_url"),
    source_quote: formData.get("source_quote"),
    notes: formData.get("notes") ?? "",
    status: formData.get("status"),
  });

  const conditions = parseJsonObject(values.conditions, "conditions");
  const outcomes = parseJsonObject(values.outcomes, "outcomes");
  const existing = await getAdminRule(db, values.id);
  const publishing =
    values.status !== "draft" && values.status !== existing.status;
  const lastVerifiedAt = publishing
    ? new Date().toISOString()
    : existing.last_verified_at;
  EngineRuleSchema.parse({
    id: values.id,
    conditions,
    outcomes,
    source_url: values.source_url,
    source_quote: values.source_quote,
    status: values.status,
    last_verified_at: lastVerifiedAt,
  });

  await updateAdminRule(db, values.id, {
    country_code: values.country_code || null,
    last_verified_at: lastVerifiedAt,
    conditions,
    outcomes,
    source_url: values.source_url,
    source_quote: values.source_quote,
    notes: values.notes.trim() === "" ? null : values.notes,
    status: values.status,
  });

  redirect(`/admin?rule=${values.id}`);
}

export async function reverifyRuleAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = idSchema.parse({ id: formData.get("id") });

  await reverifyAdminRule(db, values.id);

  redirect(`/admin?rule=${values.id}`);
}

export async function reviewCourseAction(formData: FormData) {
  const { db } = await requireAdmin();
  const values = courseReviewSchema.parse({
    id: formData.get("id"),
    review_status: formData.get("review_status"),
  });

  const course = await updateCourseReviewStatus(db, values.id, values.review_status);
  if (values.review_status === "approved") {
    await ensureSourceTaskDefinitions(db, course);
    await syncAdminCourseTaskDefinitions(db, course.id);
  }

  redirect("/admin");
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
    due_date: optionalFormText(formData.get("due_date")),
    source_snapshot: formData.get("source_snapshot") ?? "null",
    sort_order: formData.get("sort_order"),
  });
  const sourceSnapshot = JSON.parse(values.source_snapshot) as Json;
  const course = await getAdminCourse(db, values.course_id);
  const existing = values.id
    ? (await listAdminCourseTaskDefinitions(db, values.course_id)).find((row) => row.id === values.id)
    : undefined;
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
    revision: (existing?.revision ?? 0) + 1,
  };
  if (values.id) {
    await updateAdminCourseTaskDefinition(db, values.id, payload);
  } else {
    await insertAdminCourseTaskDefinition(db, { course_id: course.id, ...payload });
  }
  if (course.review_status === "approved") {
    await syncAdminCourseTaskDefinitions(db, course.id);
  }
  redirect("/admin");
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
  redirect("/admin");
}

const sourceReviewSchema = z.object({ id: z.string().uuid() });

export async function keepCourseTaskSourceReviewAction(formData: FormData) {
  const { db } = await requireAdmin();
  const { id } = sourceReviewSchema.parse({ id: formData.get("id") });
  await resolveAdminCourseTaskSourceReview(db, id, "kept");
  redirect("/admin");
}

export async function adoptCourseTaskSourceReviewAction(formData: FormData) {
  const { db } = await requireAdmin();
  const { id } = sourceReviewSchema.parse({ id: formData.get("id") });
  const review = await getAdminCourseTaskSourceReview(db, id);
  const course = await getAdminCourse(db, review.course_id);
  const candidates = deriveCourseTaskCandidates(course);
  const candidate = candidates.find((item) => item.sourceKey === review.candidate_key);
  const definitions = await listAdminCourseTaskDefinitions(db, course.id);
  const definition = review.course_task_definition_id
    ? definitions.find((item) => item.id === review.course_task_definition_id)
    : undefined;

  if (review.change_type === "removed" && definition) {
    await updateAdminCourseTaskDefinition(db, definition.id, {
      retired_at: new Date().toISOString(),
      revision: definition.revision + 1,
    });
  } else if (definition && candidate) {
    await updateAdminCourseTaskDefinition(db, definition.id, {
      source_snapshot: candidate.sourceSnapshot as Json,
      due_mode: candidate.dueMode,
      source_url: candidate.sourceUrl,
      revision: definition.revision + 1,
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
    throw new Error("The proposed source task is no longer available; keep or edit the current task instead.");
  }
  await resolveAdminCourseTaskSourceReview(db, id, "adopted");
  await syncAdminCourseTaskDefinitions(db, course.id);
  redirect("/admin");
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

  await resolveCourseConflict(db, values.id, values.keep_new === "true");

  redirect("/admin");
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

  const before = await getAdminCourse(db, values.id);
  await updateAdminCourse(db, values.id, {
    source_url: values.source_url,
    normalized_url: normalizeUrl(values.source_url),
    name: nullableText(values.name),
    university_name: nullableText(values.university_name),
    location: nullableText(values.location),
    degree: nullableText(values.degree),
    language: nullableText(values.language),
    description: nullableText(values.description),
    tuition: parseNullableJsonString(values.tuition, "tuition"),
    deadlines: parseJsonArray(values.deadlines, "deadlines"),
    requirements: parseJsonArray(values.requirements, "requirements"),
    extraction_method: "manual",
    field_extraction: {
      core: "manual",
      description: "manual",
      deadlines: "manual",
      requirements: "manual",
      tuition: "manual",
    },
  });

  if (before.review_status === "approved") {
    const definitions = await listAdminCourseTaskDefinitions(db, before.id);
    const current = await getAdminCourse(db, before.id);
    const candidates = deriveCourseTaskCandidates(current);
    const byKey = new Map(definitions.filter((definition) => definition.source_key).map((definition) => [definition.source_key!, definition]));
    const candidateKeys = new Set(candidates.map((candidate) => candidate.sourceKey));
    await Promise.all([
      ...candidates.flatMap((candidate) => {
        if (!candidate.sourceKey) return [];
        const definition = byKey.get(candidate.sourceKey);
        if (!definition) {
          return [createAdminCourseTaskSourceReview(db, {
            course_id: current.id,
            candidate_key: candidate.sourceKey,
            change_type: "new",
            new_snapshot: candidate.sourceSnapshot as Json,
          })];
        }
        return JSON.stringify(definition.source_snapshot) === JSON.stringify(candidate.sourceSnapshot)
          ? []
          : [createAdminCourseTaskSourceReview(db, {
              course_id: current.id,
              course_task_definition_id: definition.id,
              candidate_key: candidate.sourceKey,
              change_type: "changed",
              old_snapshot: definition.source_snapshot,
              new_snapshot: candidate.sourceSnapshot as Json,
            })];
      }),
      ...definitions.flatMap((definition) =>
        definition.source_key && !candidateKeys.has(definition.source_key)
          ? [createAdminCourseTaskSourceReview(db, {
              course_id: current.id,
              course_task_definition_id: definition.id,
              candidate_key: definition.source_key,
              change_type: "removed",
              old_snapshot: definition.source_snapshot,
            })]
          : [],
      ),
    ]);
  }

  redirect("/admin");
}
