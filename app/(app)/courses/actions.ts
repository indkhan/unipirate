"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { ensureApplication } from "@/lib/db/queries";
import { materializeCourseTasksForApplication } from "@/lib/tasks/materialize";

export async function addCourseToDashboard(courseId: string): Promise<void> {
  const id = z.string().uuid().parse(courseId);
  const { db, user } = await requireUser("/courses");

  const application = await ensureApplication(db, user.id, id);
  await materializeCourseTasksForApplication(db, user.id, application.id);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
}
