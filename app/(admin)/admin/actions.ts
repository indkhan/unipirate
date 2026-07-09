"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminRule,
  resolveCourseConflict,
  reverifyAdminRule,
  updateAdminCourse,
  updateAdminRule,
  updateCourseReviewStatus,
} from "@/lib/db/admin-queries";
import { normalizeUrl } from "@/lib/courses/import";
import type { Json } from "@/lib/db/database.types";
import { EngineRuleSchema } from "@/lib/engine/evaluate";

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

  await updateCourseReviewStatus(db, values.id, values.review_status);

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

  redirect("/admin");
}
