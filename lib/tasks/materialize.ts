// Write side of source-generated tasks. Called at event time (profile saved,
// result claimed, course added, application status changed) — never during
// dashboard render. Each task_key is inserted once; after that the task is
// owned by the user and generation never changes or recreates it.
import {
  getApplicationWithCourse,
  getProfile,
  getPublishedRules,
  listApplicationsWithCourses,
  listActiveCourseTaskDefinitions,
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
import { todayIsoBerlin } from "@/lib/tasks/dates";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = Pick<SupabaseClient<Database>, "from">;

function toGenerationApplication(
  application: ApplicationWithCourse,
  taskDefinitions: Awaited<ReturnType<typeof listActiveCourseTaskDefinitions>>,
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
          task_definitions: taskDefinitions,
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
}

async function materializeCourseTasksForApplicationRow(
  db: Db,
  userId: string,
  application: ApplicationWithCourse,
  intake?: TargetIntake,
): Promise<void> {
  const taskDefinitions = application.courses
    ? await listActiveCourseTaskDefinitions(db, application.courses.id)
    : [];
  const desired = generateCourseTasks(
    [toGenerationApplication(application, taskDefinitions)],
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

