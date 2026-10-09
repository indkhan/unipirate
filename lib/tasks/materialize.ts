import { resolveOfferingProcess, generateOfferingProcessTasks } from "./offering-process";
// Write side of source-generated tasks. Called at event time (profile saved,
// result claimed, course added, application status changed) — never during
// dashboard render. Each task_key is inserted once; after that the task is
// owned by the user and generation never changes or recreates it.
import {
  ensureApplication,
  getPlanningSettings,
  enqueuePlanningJob,
  getApplicationOfferingCatalogue,
  getApplicationWithCourse,
  getProfile,
  listRuleVersions,
  listApplicationsWithCourses,
  listActiveCourseTaskDefinitions,
  listGeneratedTasksByPrefix,
  upsertGeneratedTasks,
  type ApplicationWithCourse,
} from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import type { Profile } from "@/lib/engine/evaluate";
import { evaluateAssessment, type Assessment } from "@/lib/rules/assessment";
import { currentAssessmentContext } from "@/lib/rules/current";
import {
  generateCourseTasks,
  generateGlobalTasks,
  generateProcessTasks,
  newGeneratedTaskRows,
  type ApplicationForTaskGeneration,
  type TargetIntake,
} from "@/lib/tasks/generate";
import { profileFromAnswers } from "@/lib/tasks/profile";
import { todayIsoBerlin } from "@/lib/tasks/dates";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = Pick<SupabaseClient<Database>, "from" | "rpc">;

async function enqueueApplicationPlanning(db: Db, application: ApplicationWithCourse): Promise<void> {
  if (application.courses?.review_status === "approved") {
    const catalogue = await getApplicationOfferingCatalogue(db, application.course_id, application.offering_id ?? null);
    const plan = resolveOfferingProcess({...catalogue,courseId:application.course_id,selection:{offering_id:application.offering_id ?? null,applicant_context:application.offering_applicant_context ?? null}});
    if (plan.route !== "unresolved" && plan.version) {
      await enqueuePlanningJob(db, "verified", application.id, plan.version.id);
      return;
    }
  }
  await enqueuePlanningJob(db, "preliminary", application.id);
}

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
  await upsertGeneratedTasks(db, newGeneratedTaskRows(userId, desired, existing));
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
  const catalogue = application.courses?.review_status === "approved"
    ? await getApplicationOfferingCatalogue(db,application.course_id,application.offering_id ?? null)
    : {programme:null,offerings:[],versions:[]};
  const plan = resolveOfferingProcess({...catalogue,courseId:application.course_id,selection:{offering_id:application.offering_id ?? null,applicant_context:application.offering_applicant_context ?? null}});
  const desired = [
    ...generateCourseTasks([toGenerationApplication(application,catalogue.programme ? taskDefinitions.filter(d=>d.kind!=="submission") : taskDefinitions)],todayIsoBerlin(),intake),
    ...generateOfferingProcessTasks(application.id,application.status,plan),
  ];
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
  const settings = await getPlanningSettings(db);
  if (!settings) throw new Error("Planning settings unavailable");
  if (settings.enabled) {
    await enqueueApplicationPlanning(db, application);
    return;
  }

  const profile = await currentProfile(db, userId);
  await materializeCourseTasksForApplicationRow(
    db,
    userId,
    application,
    profile?.intake,
  );
}

/** Put a course on the user's dashboard and materialize its admin-defined tasks. */
export async function trackCourse(
  db: Db,
  userId: string,
  courseId: string,
): Promise<string> {
  const application = await ensureApplication(db, userId, courseId);
  await materializeCourseTasksForApplication(db, userId, application.id);
  return application.id;
}

export async function materializeAllTasksForUser(
  db: Db,
  userId: string,
  assessment?: Assessment,
): Promise<void> {
  const settings = await getPlanningSettings(db);
  if (!settings) throw new Error("Planning settings unavailable");
  if (settings.enabled) {
    await enqueuePlanningJob(db, "preliminary", null);
    const applications = await listApplicationsWithCourses(db, userId);
    for (const application of applications) await enqueueApplicationPlanning(db, application);
    return;
  }
  const profile = await currentProfile(db, userId);
  const current=assessment ?? (profile ? evaluateAssessment(profile, await listRuleVersions(db), currentAssessmentContext()) : null);
  const result=current?.result??null;
  await materializeGeneratedPrefix(
    db,
    userId,
    "rule:",
    [...generateGlobalTasks(result),...generateProcessTasks(current?.process)],
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

