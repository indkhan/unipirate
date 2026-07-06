"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { removeMyCourse } from "@/lib/db/queries";
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

  await removeMyCourse(db, id);
  revalidatePath("/dashboard");
}
