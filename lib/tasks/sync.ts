import { z } from "zod";

import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";
import {
  deleteStaleGeneratedTasks,
  ensureApplications,
  getMyCourses,
  getProfile,
  getPublishedRules,
  listApplicationsWithCourses,
  listTasks,
  upsertGeneratedTasks,
  type ApplicationWithCourse,
} from "@/lib/db/queries";
import type { Database, Tables } from "@/lib/db/database.types";
import { evaluate, type Profile, type Result } from "@/lib/engine/evaluate";
import {
  bucketTasks,
  daysUntil,
  generateTasks,
  parseDeadlineDate,
  prepareGeneratedTaskSync,
  selectSubmissionDeadline,
  type GeneratedTask,
  type TargetIntake,
} from "@/lib/tasks/generate";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = Pick<SupabaseClient<Database>, "from">;

const RawProfileSchema = z
  .object({
    targetDegree: z.enum(["bachelor", "master"]),
    curriculumType: z.enum(["national", "ib", "gce", "other"]),
  })
  .passthrough() as z.ZodType<Profile>;

export type DashboardTask = {
  id: string;
  key: string;
  kind: "generated" | "manual";
  title: string;
  description: string | null;
  done: boolean;
  dueDate: string | null;
  verbatimDue: string | null;
  order: number;
  preferredBucket: "now" | "next" | "later" | null;
  applicationId: string | null;
  source: { url: string; verifiedAt: string | null } | null;
  scope: "global" | "university";
};

export type RailApplication = {
  id: string;
  status: string;
  courseId: string;
  courseName: string;
  universityName: string;
  detail: string;
  sourceUrl: string;
  nextDeadline: { iso: string | null; verbatim: string | null };
};

export type CalendarEvent = {
  key: string;
  title: string;
  dueDate: string;
  verbatimDue: string | null;
};

export type DashboardSyncView = {
  buckets: {
    now: DashboardTask[];
    next: DashboardTask[];
    later: DashboardTask[];
  };
  doneTasks: DashboardTask[];
  rail: RailApplication[];
  calendarEvents: CalendarEvent[];
  nextDeadline: { iso: string; verbatim: string; daysUntil: number } | null;
  allDone: boolean;
  empty: boolean;
  hasProfile: boolean;
  universityCount: number;
  checkedAt: string;
  result: Result | null;
};

function todayIsoBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function profileFromAnswers(row: Tables<"profiles"> | null): {
  profile: Profile | null;
  hasProfile: boolean;
} {
  if (!row) return { profile: null, hasProfile: false };
  const answers = AnswersSchema.safeParse(row.answers);
  if (answers.success) return { profile: buildProfile(answers.data), hasProfile: true };

  const rawProfile = RawProfileSchema.safeParse(row.answers);
  return {
    profile: rawProfile.success ? rawProfile.data : null,
    hasProfile: rawProfile.success,
  };
}

function toGenerationApplications(applications: ApplicationWithCourse[]) {
  return applications.map((application) => ({
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
  }));
}

function generatedByKey(tasks: GeneratedTask[]): Map<string, GeneratedTask> {
  return new Map(tasks.map((task) => [task.key, task]));
}

function displayTasks(
  dbTasks: Tables<"tasks">[],
  generated: GeneratedTask[],
): DashboardTask[] {
  const metadata = generatedByKey(generated);
  return dbTasks.flatMap<DashboardTask>((task) => {
    if (!task.task_key) {
      return [
        {
          id: task.id,
          key: `manual:${task.id}`,
          kind: "manual" as const,
          title: task.title,
          description: task.description,
          done: task.done,
          dueDate: task.due_date,
          verbatimDue: null,
          order: 25,
          preferredBucket:
            task.preferred_bucket === "now" ||
            task.preferred_bucket === "next" ||
            task.preferred_bucket === "later"
              ? task.preferred_bucket
              : null,
          applicationId: task.application_id,
          source: task.source_url
            ? { url: task.source_url, verifiedAt: null }
            : null,
          scope: task.application_id ? ("university" as const) : ("global" as const),
        },
      ];
    }
    const generatedTask = metadata.get(task.task_key);
    if (!generatedTask) return [];
    return [
      {
        id: task.id,
        key: task.task_key,
        kind: "generated" as const,
        title: task.title,
        description: task.description,
        done: task.done,
        dueDate: task.due_date,
        verbatimDue: generatedTask.verbatimDue,
        order: generatedTask.order,
        preferredBucket:
          task.preferred_bucket === "now" ||
          task.preferred_bucket === "next" ||
          task.preferred_bucket === "later"
            ? task.preferred_bucket
            : null,
        applicationId: task.application_id,
        source: generatedTask.source,
        scope: task.application_id ? "university" : "global",
      },
    ];
  });
}

function datedDeadline(
  lines: unknown,
  todayIso: string,
  intake?: TargetIntake,
): { iso: string | null; verbatim: string | null } {
  if (!Array.isArray(lines)) return { iso: null, verbatim: null };
  const selected = selectSubmissionDeadline(
    lines.filter((line): line is string => typeof line === "string"),
    todayIso,
    intake,
  );
  if (selected.verbatim) return { iso: selected.date, verbatim: selected.verbatim };

  for (const line of lines) {
    if (typeof line !== "string" || !/\d/.test(line)) continue;
    const iso = parseDeadlineDate(line);
    if (iso) return { iso, verbatim: line };
  }
  return { iso: null, verbatim: null };
}

function railApplication(
  application: ApplicationWithCourse,
  todayIso: string,
  intake?: TargetIntake,
): RailApplication | null {
  const course = application.courses;
  if (!course || course.review_status === "rejected") return null;
  return {
    id: application.id,
    status: application.status,
    courseId: course.id,
    courseName: course.name ?? "Untitled course",
    universityName: course.university_name ?? "University pending review",
    detail: [course.location, course.degree].filter(Boolean).join(" · "),
    sourceUrl: course.source_url,
    nextDeadline: datedDeadline(course.deadlines, todayIso, intake),
  };
}

function nextDeadline(
  tasks: DashboardTask[],
  todayIso: string,
): { iso: string; verbatim: string; daysUntil: number } | null {
  const dated = tasks
    .filter((task) => task.dueDate !== null)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const next = dated.find((task) => daysUntil(task.dueDate!, todayIso) >= 0) ?? dated[0];
  return next?.dueDate
    ? {
        iso: next.dueDate,
        verbatim: next.verbatimDue ?? next.dueDate,
        daysUntil: daysUntil(next.dueDate, todayIso),
      }
    : null;
}

export async function syncDashboard(
  db: Db,
  userId: string,
): Promise<DashboardSyncView> {
  const todayIso = todayIsoBerlin();
  const savedProfile = await getProfile(db, userId);
  const { profile, hasProfile } = profileFromAnswers(savedProfile);
  const result = profile ? evaluate(profile, await getPublishedRules(db)) : null;

  const courses = await getMyCourses(db, userId);
  await ensureApplications(db, userId, courses);
  const applications = await listApplicationsWithCourses(db, userId);

  const desired = generateTasks(
    result,
    toGenerationApplications(applications),
    todayIso,
    profile?.intake,
  );
  const beforeTasks = await listTasks(db, userId);
  const reconciliation = prepareGeneratedTaskSync(userId, desired, beforeTasks);
  await upsertGeneratedTasks(db, reconciliation.upsertRows);
  await deleteStaleGeneratedTasks(db, userId, reconciliation.staleKeysToDelete);

  const currentDbTasks =
    reconciliation.upsertRows.length === 0 && reconciliation.staleKeysToDelete.length === 0
      ? beforeTasks
      : await listTasks(db, userId);
  const allGeneratedTasks = displayTasks(currentDbTasks, desired);
  const pendingTasks = allGeneratedTasks.filter((task) => !task.done);
  const doneTasks = allGeneratedTasks.filter((task) => task.done);
  const defaultBuckets = bucketTasks(
    pendingTasks.filter((task) => task.preferredBucket === null),
    todayIso,
  );
  const buckets = {
    now: [
      ...pendingTasks.filter((task) => task.preferredBucket === "now"),
      ...defaultBuckets.now,
    ],
    next: [
      ...pendingTasks.filter((task) => task.preferredBucket === "next"),
      ...defaultBuckets.next,
    ],
    later: [
      ...pendingTasks.filter((task) => task.preferredBucket === "later"),
      ...defaultBuckets.later,
    ],
  };
  const rail = applications.flatMap((application) => {
    const row = railApplication(application, todayIso, profile?.intake);
    return row ? [row] : [];
  });
  const calendarEvents = pendingTasks.flatMap((task) =>
    task.dueDate
      ? [
          {
            key: task.key,
            title: task.title,
            dueDate: task.dueDate,
            verbatimDue: task.verbatimDue,
          },
        ]
      : [],
  );

  return {
    buckets,
    doneTasks,
    rail,
    calendarEvents,
    nextDeadline: nextDeadline(pendingTasks, todayIso),
    allDone: allGeneratedTasks.length > 0 && pendingTasks.length === 0,
    empty: rail.length === 0 && allGeneratedTasks.length === 0,
    hasProfile,
    universityCount: rail.length,
    checkedAt: todayIso,
    result,
  };
}
