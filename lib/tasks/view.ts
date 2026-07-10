// Read side of the dashboard: loads the saved profile, applications, and
// active task rows, then derives buckets, the applications rail, calendar
// events, and the next deadline. Strictly read-only — task rows are
// materialized at event time by materialize.ts, never during render.
import {
  getProfile,
  getPublishedRules,
  listApplicationsWithCourses,
  listTasks,
  type ApplicationWithCourse,
} from "@/lib/db/queries";
import type { Database, Tables } from "@/lib/db/database.types";
import { evaluate, type Result } from "@/lib/engine/evaluate";
import {
  bucketTasks,
  daysUntil,
  parseDeadlineDate,
  selectSubmissionDeadline,
  type TargetIntake,
} from "@/lib/tasks/generate";
import { profileFromAnswers } from "@/lib/tasks/profile";
import { todayIsoBerlin } from "@/lib/tasks/dates";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = Pick<SupabaseClient<Database>, "from">;

export type DashboardTask = {
  id: string;
  key: string;
  kind: "generated" | "course_task" | "manual";
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
  adminChangeState: "current" | "update_pending" | "removal_pending";
  adminSnapshot: Record<string, unknown> | null;
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

export type DashboardView = {
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

function preferredBucket(
  value: string | null,
): "now" | "next" | "later" | null {
  return value === "now" || value === "next" || value === "later" ? value : null;
}

function displayTasks(dbTasks: Tables<"tasks">[]): DashboardTask[] {
  return dbTasks.map((task) => {
    const generated = task.task_key !== null;
    const courseTask = task.course_task_definition_id !== null;
    const snapshot = task.admin_snapshot;
    return {
      id: task.id,
      key: task.task_key ?? `manual:${task.id}`,
      kind: courseTask ? "course_task" : generated ? "generated" : "manual",
      title: task.title,
      description: task.description,
      done: task.done,
      dueDate: task.due_date,
      verbatimDue: task.verbatim_due,
      order: generated ? task.sort_order : 25,
      preferredBucket: preferredBucket(task.preferred_bucket),
      applicationId: task.application_id,
      source: task.source_url
        ? { url: task.source_url, verifiedAt: task.source_verified_at }
        : null,
      scope: task.application_id ? "university" : "global",
      adminChangeState: task.admin_change_state,
      adminSnapshot:
        snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
          ? snapshot as Record<string, unknown>
          : null,
    };
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
    detail: [course.location, course.degree].filter(Boolean).join(" \u00b7 "),
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

export async function buildDashboardView(
  db: Db,
  userId: string,
): Promise<DashboardView> {
  const todayIso = todayIsoBerlin();
  const savedProfile = await getProfile(db, userId);
  const { profile, hasProfile } = profileFromAnswers(savedProfile);
  const result = profile ? evaluate(profile, await getPublishedRules(db)) : null;

  const [applications, dbTasks] = await Promise.all([
    listApplicationsWithCourses(db, userId),
    listTasks(db, userId),
  ]);

  const allTasks = displayTasks(dbTasks);
  const pendingTasks = allTasks.filter((task) => !task.done);
  const doneTasks = allTasks.filter((task) => task.done);
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
    allDone: allTasks.length > 0 && pendingTasks.length === 0,
    empty: rail.length === 0 && allTasks.length === 0,
    hasProfile,
    universityCount: rail.length,
    checkedAt: todayIso,
    result,
  };
}
