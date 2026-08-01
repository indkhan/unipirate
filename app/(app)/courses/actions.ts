"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { trackCourse } from "@/lib/tasks/materialize";

export async function addCourseToDashboard(courseId: string): Promise<void> {
  const id = z.string().uuid().parse(courseId);
  const { db, user } = await requireUser("/courses");

  await trackCourse(db, user.id, id);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
}
