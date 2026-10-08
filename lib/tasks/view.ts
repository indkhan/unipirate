import { resolveOfferingProcess, generateOfferingProcessTasks, isVisibleOfferingTask, isOfferingProcessKey, type OfferingProcessPlan } from "./offering-process";
// Read side of the dashboard: loads the saved profile, applications, and
// active task rows, then derives buckets, the applications rail, calendar
// events, and the next deadline. Strictly read-only — task rows are
// materialized at event time by materialize.ts, never during render.
import {
  getProfile,
  getApplicationOfferingCatalogue,
  listCourseSubmissionDefinitionIds,
  listRuleVersions,
  listApplicationsWithCourses,
  listTasks,
  type ApplicationWithCourse,
} from "@/lib/db/queries";
import type { Database, Tables } from "@/lib/db/database.types";
import {processHistoryRuleIds,isProcessTaskKey} from "@/lib/engine/process-identity";
import type {ProcessAssessment} from "@/lib/rules/process-assessment";
import type { Result } from "@/lib/engine/evaluate";
import { evaluateAssessment } from "@/lib/rules/assessment";
import { currentAssessmentContext } from "@/lib/rules/current";
import {
  bucketTasks,
  isCurrentApsTask,
  daysUntil,
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
  processEvidence?: "personal_history";
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
  offeringProcess?: {plan:OfferingProcessPlan;offerings:Awaited<ReturnType<typeof getApplicationOfferingCatalogue>>["offerings"];selection:{offering_id:string|null;applicant_context:unknown}};
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
  empty: boolean;
  hasProfile: boolean;
  checkedAt: string;
  assessmentEvaluatedAt: string;
  result: Result | null;
  process?: ProcessAssessment;
};

function preferredBucket(
  value: string | null,
): "now" | "next" | "later" | null {
  return value === "now" || value === "next" || value === "later" ? value : null;
}

function displayTasks(dbTasks: Tables<"tasks">[],processIds:Set<string>): DashboardTask[] {
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
      processEvidence: (isProcessTaskKey(task.task_key,processIds)||isOfferingProcessKey(task.task_key))?"personal_history":undefined,
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

function railApplication(
  application: ApplicationWithCourse,
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
    nextDeadline: {iso:null,verbatim:null},
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
  const context = currentAssessmentContext();
  const versions=await listRuleVersions(db);
  const assessment=profile?evaluateAssessment(profile,versions,context):null;
  const result=assessment?.result??null;
  const processIds=processHistoryRuleIds(versions);

  const [applications, dbTasks] = await Promise.all([
    listApplicationsWithCourses(db, userId),
    listTasks(db, userId),
  ]);

  const offeringApplications = await Promise.all(applications.map(async application => {
    const catalogue = application.courses?.review_status === "approved"
      ? await getApplicationOfferingCatalogue(db,application.course_id,application.offering_id ?? null)
      : {programme:null,offerings:[],versions:[]};
    const selection = {offering_id:application.offering_id ?? null,applicant_context:application.offering_applicant_context ?? null};
    const plan = resolveOfferingProcess({...catalogue,courseId:application.course_id,selection});
    const submissionIds = catalogue.programme ? await listCourseSubmissionDefinitionIds(db,application.course_id) : [];
    return {id:application.id,status:application.status,plan,catalogue,selection,submissionIds};
  }));
  // Actual identity only: editable titles and unrelated PROC02 visa reminders do not participate.
  const obsoleteUniAssistIds = new Set(["uni-assist-vpd-process"]);
  for (const version of versions) {
    const raw = version.raw_snapshot;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const identity = raw as Record<string,unknown>;
      if (identity.id === "uni-assist-vpd-process" || identity.slug === "uni-assist-vpd-process" || typeof identity.notes === "string" && identity.notes.startsWith("Bootstrap candidate: uni-assist-vpd-process.")) obsoleteUniAssistIds.add(version.rule_id);
    }
  }
  const planningIds = new Set(applications.filter(a=>a.status==="planning").map(a=>a.id));
  const visibleRows = dbTasks.filter(task => {
    if (task.done) return true;
    if (!isCurrentApsTask(task,result) || !isVisibleOfferingTask(task,offeringApplications)) return false;
    if (isProcessTaskKey(task.task_key,obsoleteUniAssistIds)) {
      const ruleId = /^rule:([^:]+):step:/.exec(task.task_key ?? "")?.[1];
      if (ruleId && obsoleteUniAssistIds.has(ruleId)) return false;
    }
    const application = offeringApplications.find(a=>a.id===task.application_id);
    if (task.course_task_definition_id && application?.submissionIds.includes(task.course_task_definition_id)) return false;
    return task.course_task_definition_id === null || planningIds.has(task.application_id ?? "");
  });
  const allTasks = displayTasks(visibleRows,processIds).map(task => {
    if (task.done || !isOfferingProcessKey(task.key)) return task;
    const application = offeringApplications.find(a=>a.id===task.applicationId);
    const desired = application && generateOfferingProcessTasks(application.id,application.status,application.plan).find(t=>t.key===task.key);
    const saved = visibleRows.find(t=>t.id===task.id);
    // Read projection only. Keep personal dates; untouched planning dates use today's same plan as the rail.
    return desired && !saved?.has_personal_edits ? {...task,dueDate:desired.dueDate,verbatimDue:desired.verbatimDue} : task;
  });
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
  const rail = applications.flatMap(application => {
    const row = railApplication(application);
    if (!row) return [];
    const selected = offeringApplications.find(a=>a.id===application.id)!;
    const stageKeys = new Set(generateOfferingProcessTasks(application.id,application.status,selected.plan).filter(t=>!t.key.endsWith(":fee_confirmation")).map(t=>t.key));
    const selectedTasks = pendingTasks.filter(t=>stageKeys.has(t.key));
    const deadline = nextDeadline(selectedTasks,todayIso);
    return [{...row,nextDeadline:{iso:deadline?.iso ?? null,verbatim:deadline?.verbatim ?? null},offeringProcess:{plan:selected.plan,offerings:selected.catalogue.offerings,selection:selected.selection}}];
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
    empty: rail.length === 0 && allTasks.length === 0,
    hasProfile,
    checkedAt: todayIso,
    assessmentEvaluatedAt: context.evaluatedAt,
    result,
    process:assessment?.process,
  };
}
