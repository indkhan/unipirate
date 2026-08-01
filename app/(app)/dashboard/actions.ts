"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser, type Session } from "@/lib/auth/session";
import {
  deleteApplicationForCourse,
  deleteManualTask as deleteTaskRow,
  insertAnswerReport,
  hasApplication,
  insertTask,
  removeMyCourse,
  setTaskPreferredBucket,
  setTaskDone,
  updateManualTask as updateTaskRow,
  updateApplicationStatus,
  updateCourseTaskAssignment as updateCourseTaskAssignmentRow,
  resolveCourseTaskAssignment,
} from "@/lib/db/queries";

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
  const { db, user } = await requireUser();

  await setTaskDone(db, user.id, id, done);
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

const taskSchema = z.object({
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

/** Trust-boundary check: a forged applicationId must not attach to a new task. */
async function assertOwnedApplication(
  db: Session["db"],
  userId: string,
  applicationId: string | null,
): Promise<void> {
  if (!applicationId) return;
  if (!(await hasApplication(db, userId, applicationId))) {
    throw new Error("Application not found");
  }
}

export async function createTask(input: unknown): Promise<void> {
  const task = taskSchema.parse(input);
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

const updateTaskSchema = taskSchema.extend({
  id: z.string().uuid(),
});

export async function updateTask(input: unknown): Promise<void> {
  const task = updateTaskSchema.parse(input);
  const { db, user } = await requireUser();

  await assertOwnedApplication(db, user.id, task.applicationId);
  await updateTaskRow(db, user.id, task.id, {
    title: task.title,
    description: task.description,
    source_url: task.sourceUrl,
    due_date: task.dueDate,
    application_id: task.applicationId,
  });
  revalidatePath("/dashboard");
}

const courseTaskEditSchema = taskSchema.extend({ id: z.string().uuid() });

export async function updateCourseTask(input: unknown): Promise<void> {
  const task = courseTaskEditSchema.parse(input);
  const { db, user } = await requireUser();
  await updateCourseTaskAssignmentRow(db, user.id, task.id, {
    title: task.title,
    description: task.description,
    source_url: task.sourceUrl,
    due_date: task.dueDate,
  });
  revalidatePath("/dashboard");
}

const courseTaskResolutionSchema = z.object({
  id: z.string().uuid(),
  resolution: z.enum(["adopt", "keep", "remove", "manual"]),
});

export async function resolveCourseTaskUpdate(input: unknown): Promise<void> {
  const { id, resolution } = courseTaskResolutionSchema.parse(input);
  const { db, user } = await requireUser();
  await resolveCourseTaskAssignment(db, user.id, id, resolution);
  revalidatePath("/dashboard");
}

const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteTask(input: unknown): Promise<void> {
  const { id } = deleteTaskSchema.parse(input);
  const { db, user } = await requireUser();

  await deleteTaskRow(db, user.id, id);
  revalidatePath("/dashboard");
}

const applicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["planning", "applied", "admitted", "rejected"]),
});

export async function setApplicationStatus(input: unknown): Promise<void> {
  const { id, status } = applicationStatusSchema.parse(input);
  const { db } = await requireUser();

  await updateApplicationStatus(db, id, status);
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
