"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureApplication } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { materializeCourseTasksForApplication } from "@/lib/tasks/materialize";

export async function addCourseToDashboard(courseId: string): Promise<void> {
  const id = z.string().uuid().parse(courseId);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in to add courses.");

  const application = await ensureApplication(db, user.id, id);
  await materializeCourseTasksForApplication(db, user.id, application.id);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
}
