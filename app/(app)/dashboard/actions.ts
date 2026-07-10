"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser, type Session } from "@/lib/auth/session";
import {
  deleteApplicationForCourse,
  deleteManualTask as deleteManualTaskRow,
  insertAnswerReport,
  insertTask,
  listApplications,
  removeMyCourse,
  setTaskPreferredBucket,
  setTaskDone,
  updateManualTask as updateManualTaskRow,
  updateApplicationStatus,
} from "@/lib/db/queries";
import {
  materializeCourseTasksForApplication,
  removeOpenGeneratedTasksForApplication,
} from "@/lib/tasks/materialize";

const removeCourseSchema = z.object({
  id: z.string().uuid(),
});

export async function removeCourse(input: unknown): Promise<void> {
  const { id } = removeCourseSchema.parse(input);
  const { db, user } = await requireUser();

  await deleteApplicationForCourse(db, user.id, id);
  await removeMyCourse(db, id);
  revalidatePath("/dashboard");
}

const toggleTaskSchema = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
});

export async function toggleTask(input: unknown): Promise<void> {
  const { id, done } = toggleTaskSchema.parse(input);
  const { db } = await requireUser();

  await setTaskDone(db, id, done);
}

const moveTaskSchema = z.object({
  id: z.string().uuid(),
  bucket: z.enum(["now", "next", "later"]),
});

export async function moveTaskToBucket(input: unknown): Promise<void> {
  const { id, bucket } = moveTaskSchema.parse(input);
  const { db, user } = await requireUser();

  await setTaskPreferredBucket(db, user.id, id, bucket);
}

const taskDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
);

const manualTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().max(2000).nullable(),
    )
    .optional()
    .default(null),
  sourceUrl: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().url().max(2048).nullable(),
    )
    .optional()
    .default(null),
  dueDate: taskDateSchema,
  applicationId: z
    .preprocess((value) => (value === "" ? null : value), z.string().uuid().nullable())
    .optional()
    .default(null),
});

async function assertOwnedApplication(
  db: Session["db"],
  userId: string,
  applicationId: string | null,
): Promise<void> {
  if (!applicationId) return;
  const applications = await listApplications(db, userId);
  if (!applications.some((application) => application.id === applicationId)) {
    throw new Error("Application not found");
  }
}

export async function createManualTask(input: unknown): Promise<void> {
  const task = manualTaskSchema.parse(input);
  const { db, user } = await requireUser();

  await assertOwnedApplication(db, user.id, task.applicationId);
  await insertTask(db, {
    user_id: user.id,
    title: task.title,
    description: task.description,
    source_url: task.sourceUrl,
    due_date: task.dueDate,
    application_id: task.applicationId,
  });
  revalidatePath("/dashboard");
}

const updateManualTaskSchema = manualTaskSchema.extend({
  id: z.string().uuid(),
});

export async function updateManualTask(input: unknown): Promise<void> {
  const task = updateManualTaskSchema.parse(input);
  const { db, user } = await requireUser();

  await assertOwnedApplication(db, user.id, task.applicationId);
  await updateManualTaskRow(db, user.id, task.id, {
    title: task.title,
    description: task.description,
    source_url: task.sourceUrl,
    due_date: task.dueDate,
    application_id: task.applicationId,
  });
  revalidatePath("/dashboard");
}

const deleteManualTaskSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteManualTask(input: unknown): Promise<void> {
  const { id } = deleteManualTaskSchema.parse(input);
  const { db, user } = await requireUser();

  await deleteManualTaskRow(db, user.id, id);
  revalidatePath("/dashboard");
}

const applicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["planning", "applied", "admitted", "rejected"]),
});

export async function setApplicationStatus(input: unknown): Promise<void> {
  const { id, status } = applicationStatusSchema.parse(input);
  const { db, user } = await requireUser();

  await updateApplicationStatus(db, id, status);
  if (status === "planning") {
    await materializeCourseTasksForApplication(db, user.id, id);
  } else {
    await removeOpenGeneratedTasksForApplication(db, user.id, id);
  }
  revalidatePath("/dashboard");
}

const reportAnswerSchema = z.object({
  question: z.string().min(1).max(4000),
  answer: z.string().min(1).max(16000),
  citations: z.array(
    z.object({ type: z.enum(["rule", "web"]), ref: z.string() }),
  ),
});

export async function reportAssistantAnswer(input: unknown): Promise<void> {
  const { question, answer, citations } = reportAnswerSchema.parse(input);
  const { db, user } = await requireUser();

  await insertAnswerReport(db, {
    user_id: user.id,
    message: "Reported assistant answer",
    context: { question, answer, citations },
  });
}
