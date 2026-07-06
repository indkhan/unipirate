"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  deleteApplicationForCourse,
  insertAnswerReport,
  removeMyCourse,
  setTaskDone,
  updateApplicationStatus,
} from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

const removeCourseSchema = z.object({
  id: z.string().uuid(),
});

export async function removeCourse(input: unknown): Promise<void> {
  const { id } = removeCourseSchema.parse(input);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect("/login");

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
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect("/login");

  await setTaskDone(db, id, done);
  revalidatePath("/dashboard");
}

const applicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["planning", "applied", "admitted", "rejected"]),
});

export async function setApplicationStatus(input: unknown): Promise<void> {
  const { id, status } = applicationStatusSchema.parse(input);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect("/login");

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
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect("/login");

  await insertAnswerReport(db, {
    user_id: user.id,
    message: "Reported assistant answer",
    context: { question, answer, citations },
  });
}
