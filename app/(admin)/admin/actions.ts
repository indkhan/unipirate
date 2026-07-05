"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  getAdminRule,
  reverifyAdminRule,
  updateAdminRule,
  updateCourseReviewStatus,
} from "@/lib/db/admin-queries";
import type { Json } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
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

async function requireAdminDb() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/hello");

  return db;
}

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

export async function updateRuleAction(formData: FormData) {
  const db = await requireAdminDb();
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
  const db = await requireAdminDb();
  const values = idSchema.parse({ id: formData.get("id") });

  await reverifyAdminRule(db, values.id);

  redirect(`/admin?rule=${values.id}`);
}

export async function reviewCourseAction(formData: FormData) {
  const db = await requireAdminDb();
  const values = courseReviewSchema.parse({
    id: formData.get("id"),
    review_status: formData.get("review_status"),
  });

  await updateCourseReviewStatus(db, values.id, values.review_status);

  redirect("/admin");
}
