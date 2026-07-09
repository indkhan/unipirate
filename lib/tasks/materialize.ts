import {
  deactivateGeneratedTasks,
  deleteOpenGeneratedTasksForApplication as deleteOpenGeneratedTaskRowsForApplication,
  deleteStaleGeneratedTasks,
  getApplicationWithCourse,
  getProfile,
  getPublishedRules,
  listApplicationsWithCourses,
  listGeneratedTasksByPrefix,
  upsertGeneratedTasks,
  type ApplicationWithCourse,
} from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import { evaluate, type Profile } from "@/lib/engine/evaluate";
import {
  generateCourseTasks,
  generateGlobalTasks,
  prepareGeneratedTaskMaterialization,
  type ApplicationForTaskGeneration,
  type TargetIntake,
} from "@/lib/tasks/generate";
import { profileFromAnswers } from "@/lib/tasks/profile";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = Pick<SupabaseClient<Database>, "from">;

function todayIsoBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toGenerationApplication(
  application: ApplicationWithCourse,
): ApplicationForTaskGeneration {
  return {
    id: application.id,
    status: application.status,
    course: application.courses
      ? {
          id: application.courses.id,
          name: application.courses.name,
          university_name: application.courses.university_name,
          deadlines: application.courses.deadlines,
          requirements: application.courses.requirements,
          source_url: application.courses.source_url,
          created_at: application.courses.created_at,
          review_status: application.courses.review_status,
        }
      : null,
  };
}

async function currentProfile(db: Db, userId: string): Promise<Profile | null> {
  const savedProfile = await getProfile(db, userId);
  return profileFromAnswers(savedProfile).profile;
}

async function materializeGeneratedPrefix(
  db: Db,
  userId: string,
  prefix: string,
  desired: ReturnType<typeof generateGlobalTasks>,
): Promise<void> {
  const existing = await listGeneratedTasksByPrefix(db, userId, prefix);
  const reconciliation = prepareGeneratedTaskMaterialization(
    userId,
    desired,
    existing,
  );
  await upsertGeneratedTasks(db, reconciliation.upsertRows);
  await deleteStaleGeneratedTasks(db, userId, reconciliation.staleOpenKeysToDelete);
  await deactivateGeneratedTasks(
    db,
    userId,
    reconciliation.staleDoneKeysToDeactivate,
  );
}

export async function materializeGlobalTasksForUser(
  db: Db,
  userId: string,
): Promise<void> {
  const profile = await currentProfile(db, userId);
  const result = profile ? evaluate(profile, await getPublishedRules(db)) : null;
  await materializeGeneratedPrefix(
    db,
    userId,
    "rule:",
    generateGlobalTasks(result),
  );
}

async function materializeCourseTasksForApplicationRow(
  db: Db,
  userId: string,
  application: ApplicationWithCourse,
  intake?: TargetIntake,
): Promise<void> {
  const desired = generateCourseTasks(
    [toGenerationApplication(application)],
    todayIsoBerlin(),
    intake,
  );
  await materializeGeneratedPrefix(
    db,
    userId,
    `app:${application.id}:`,
    desired,
  );
}

export async function materializeCourseTasksForApplication(
  db: Db,
  userId: string,
  applicationId: string,
): Promise<void> {
  const application = await getApplicationWithCourse(db, userId, applicationId);
  if (!application) return;

  const profile = await currentProfile(db, userId);
  await materializeCourseTasksForApplicationRow(
    db,
    userId,
    application,
    profile?.intake,
  );
}

export async function materializeAllTasksForUser(
  db: Db,
  userId: string,
): Promise<void> {
  const profile = await currentProfile(db, userId);
  const result = profile ? evaluate(profile, await getPublishedRules(db)) : null;
  await materializeGeneratedPrefix(
    db,
    userId,
    "rule:",
    generateGlobalTasks(result),
  );

  const applications = await listApplicationsWithCourses(db, userId);
  for (const application of applications) {
    await materializeCourseTasksForApplicationRow(
      db,
      userId,
      application,
      profile?.intake,
    );
  }
}

export async function removeOpenGeneratedTasksForApplication(
  db: Db,
  userId: string,
  applicationId: string,
): Promise<void> {
  const existing = await listGeneratedTasksByPrefix(
    db,
    userId,
    `app:${applicationId}:`,
  );
  await deleteOpenGeneratedTaskRowsForApplication(db, userId, applicationId);
  await deactivateGeneratedTasks(
    db,
    userId,
    existing.flatMap((task) =>
      task.done && task.generated_active && task.task_key ? [task.task_key] : [],
    ),
  );
}
