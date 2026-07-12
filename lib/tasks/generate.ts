// Pure task generation: engine results and tracked courses → deterministic
// GeneratedTask lists, plus deadline parsing and Now/Next/Later bucketing.
// Zero I/O — materialize.ts writes the output to the DB, view.ts renders it.
// Task identity is the `key` (`rule:<id>:step:<n>`, `app:<id>:submit`,
// `app:<id>:req:<hash>`); regeneration reconciles by key so user state
// (done, preferred bucket) survives.
import type { Citation, Result, Term } from "@/lib/engine/evaluate";
import type { Json } from "@/lib/db/database.types";
import {
  renderCourseTaskTitle,
  type CourseTaskDefinition,
} from "@/lib/tasks/course-tasks";

export type GeneratedTask = {
  key: string;
  title: string;
  dueDate: string | null;
  verbatimDue: string | null;
  order: number;
  applicationId: string | null;
  ruleId: string | null;
  courseTaskDefinitionId: string | null;
  adminSnapshot: Json | null;
  definitionRevision: number | null;
  source: { url: string; verifiedAt: string | null } | null;
};

export type CourseForTaskGeneration = {
  id: string;
  name: string | null;
  university_name: string | null;
  deadlines: unknown;
  requirements: unknown;
  source_url: string;
  created_at: string;
  review_status: string;
  task_definitions?: CourseTaskDefinition[];
};

export type ApplicationForTaskGeneration = {
  id: string;
  status: string;
  course: CourseForTaskGeneration | null;
};

export type TargetIntake = { term: Term; year: number };

export type BucketedTasks<T extends { dueDate: string | null; order: number; key: string }> = {
  now: T[];
  next: T[];
  later: T[];
};

export type ExistingGeneratedTask = {
  task_key: string | null;
  title: string;
  due_date: string | null;
  verbatim_due: string | null;
  sort_order: number;
  source_url: string | null;
  source_verified_at: string | null;
  application_id: string | null;
  generated_from_rule_id: string | null;
  done: boolean;
  generated_active: boolean;
  course_task_definition_id: string | null;
  admin_snapshot: unknown;
  definition_revision: number | null;
  has_personal_edits: boolean;
};

export type GeneratedTaskUpsert = {
  user_id: string;
  task_key: string;
  title: string;
  due_date: string | null;
  verbatim_due: string | null;
  sort_order: number;
  source_url: string | null;
  source_verified_at: string | null;
  application_id: string | null;
  generated_from_rule_id: string | null;
  generated_active: boolean;
  course_task_definition_id: string | null;
  admin_snapshot: Json | null;
  definition_revision: number | null;
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  januar: 1,
  february: 2,
  feb: 2,
  februar: 2,
  march: 3,
  mar: 3,
  märz: 3,
  maerz: 3,
  april: 4,
  apr: 4,
  may: 5,
  mai: 5,
  june: 6,
  jun: 6,
  juni: 6,
  july: 7,
  jul: 7,
  juli: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  october: 10,
  oct: 10,
  okt: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
  dezember: 12,
  dez: 12,
};

const MONTH_LENGTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const max = month === 2 && isLeapYear(year) ? 29 : MONTH_LENGTH[month - 1];
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > max) {
    return null;
  }
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function parseDeadlineDate(input: string): string | null {
  const iso = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(input);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dotted = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/.exec(input);
  if (dotted) {
    return toIsoDate(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  }

  const monthAlternation = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const dayMonth = new RegExp(
    `(?<!\\d)(\\d{1,2})\\.?\\s+(${monthAlternation})\\s+(\\d{4})(?!\\d)`,
    "i",
  ).exec(input);
  if (dayMonth) {
    return toIsoDate(
      Number(dayMonth[3]),
      MONTHS[dayMonth[2].toLowerCase()],
      Number(dayMonth[1]),
    );
  }

  const monthDay = new RegExp(
    `\\b(${monthAlternation})\\s+(\\d{1,2}),\\s*(\\d{4})(?!\\d)`,
    "i",
  ).exec(input);
  if (monthDay) {
    return toIsoDate(
      Number(monthDay[3]),
      MONTHS[monthDay[1].toLowerCase()],
      Number(monthDay[2]),
    );
  }

  return null;
}

export function daysUntil(isoDate: string, todayIso: string): number {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(isoDate) - toUtc(todayIso)) / 86_400_000);
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

function parseDayMonth(input: string): { month: number; day: number }[] {
  const monthAlternation = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const found: { month: number; day: number }[] = [];

  const dayMonth = new RegExp(
    `(?<!\\d)(\\d{1,2})\\.?\\s+(${monthAlternation})(?!\\s+\\d{4})`,
    "gi",
  );
  for (const match of input.matchAll(dayMonth)) {
    found.push({
      month: MONTHS[match[2].toLowerCase()],
      day: Number(match[1]),
    });
  }

  const monthDay = new RegExp(
    `\\b(${monthAlternation})\\s+(\\d{1,2})(?!,?\\s*\\d{4})`,
    "gi",
  );
  for (const match of input.matchAll(monthDay)) {
    found.push({
      month: MONTHS[match[1].toLowerCase()],
      day: Number(match[2]),
    });
  }

  return found;
}

function termMentioned(line: string): Term | null {
  const lower = line.toLowerCase();
  if (/\bwinter\b/.test(lower)) return "winter";
  if (/\bsummer\b/.test(lower)) return "summer";
  return null;
}

function monthLikelyMatchesTerm(month: number, term: Term): boolean {
  if (term === "winter") return month >= 2 && month <= 8;
  return month >= 9 || month <= 2;
}

function deadlineYear(line: string, month: number, intake: TargetIntake): number {
  const lower = line.toLowerCase();
  if (/\bprevious year\b/.test(lower)) return intake.year - 1;
  if (/\bof the year\b|\bsame year\b|\bcurrent year\b/.test(lower)) {
    return intake.year;
  }
  if (intake.term === "summer" && month >= 9) return intake.year - 1;
  return intake.year;
}

function deadlineForIntake(
  line: string,
  intake: TargetIntake,
): { date: string | null; verbatim: string } | null {
  const mentioned = termMentioned(line);
  if (mentioned && mentioned !== intake.term) return null;

  const explicitDate = parseDeadlineDate(line);
  if (explicitDate) {
    if (!mentioned && !monthLikelyMatchesTerm(Number(explicitDate.slice(5, 7)), intake.term)) {
      return null;
    }
    return { date: explicitDate, verbatim: line };
  }

  const dates = parseDayMonth(line);
  if (dates.length === 0) return null;
  const endpoint = dates[dates.length - 1];
  if (!mentioned && !monthLikelyMatchesTerm(endpoint.month, intake.term)) {
    return null;
  }

  const year = deadlineYear(line, endpoint.month, intake);
  return {
    date: mentioned ? toIsoDate(year, endpoint.month, endpoint.day) : null,
    verbatim: line,
  };
}

export function selectSubmissionDeadline(
  lines: string[],
  todayIso?: string,
  intake?: TargetIntake,
): { date: string | null; verbatim: string | null } {
  if (intake) {
    const intakeMatches = lines.flatMap((line) => {
      const deadline = deadlineForIntake(line, intake);
      return deadline ? [deadline] : [];
    });
    if (intakeMatches.length > 0) {
      return (
        intakeMatches
          .filter((deadline) => deadline.date)
          .sort((a, b) => a.date!.localeCompare(b.date!))[0] ??
        intakeMatches[0]
      );
    }
  }

  const dated = lines.flatMap((line) => {
    const date = parseDeadlineDate(line);
    return date ? [{ date, verbatim: line }] : [];
  });

  if (dated.length > 0) {
    const sorted = [...dated].sort((a, b) => a.date.localeCompare(b.date));
    if (todayIso) {
      return (
        sorted.find((deadline) => daysUntil(deadline.date, todayIso) >= 0) ??
        sorted[sorted.length - 1]
      );
    }
    return sorted[0];
  }

  const undated = lines.find((line) => /\d/.test(line));
  return { date: null, verbatim: undated ?? null };
}

function hashDjb2(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function courseLabel(course: CourseForTaskGeneration): string {
  return course.university_name ?? course.name ?? "this university";
}

function citationByRuleId(citations: Citation[]): Map<string, Citation> {
  return new Map(citations.map((citation) => [citation.ruleId, citation]));
}

export function generateGlobalTasks(result: Result | null): GeneratedTask[] {
  const generated: GeneratedTask[] = [];
  const citations = citationByRuleId(result?.citations ?? []);

  if (result && result.path !== "insufficient") {
    for (const step of result.stepsDetailed) {
      const citation = citations.get(step.ruleId);
      const dueDate = parseDeadlineDate(step.text);
      generated.push({
        key: `rule:${step.ruleId}:step:${step.order}`,
        title: step.text,
        dueDate,
        verbatimDue: dueDate ? step.text : null,
        order: step.order,
        applicationId: null,
        ruleId: step.ruleId,
        courseTaskDefinitionId: null,
        adminSnapshot: null,
        definitionRevision: null,
        source: citation
          ? { url: citation.sourceUrl, verifiedAt: citation.verifiedAt }
          : null,
      });
    }
  }

  return generated.sort((a, b) => a.key.localeCompare(b.key));
}

export function generateCourseTasks(
  applications: ApplicationForTaskGeneration[],
  todayIso?: string,
  intake?: TargetIntake,
): GeneratedTask[] {
  const generated: GeneratedTask[] = [];

  for (const application of applications) {
    const course = application.course;
    if (!course || course.review_status !== "approved") continue;
    if (application.status === "applied" || application.status === "admitted") {
      continue;
    }

    const definitions = course.task_definitions;
    if (definitions) {
      for (const definition of definitions) {
        if (definition.retiredAt) continue;
        const snapshot = definition.sourceSnapshot as { deadlines?: unknown } | null;
        const deadlineLines = snapshot ? asStrings(snapshot.deadlines) : [];
        const selected = definition.dueMode === "source_deadline"
          ? selectSubmissionDeadline(deadlineLines, todayIso, intake)
          : { date: definition.dueDate, verbatim: definition.dueDate };
        const title = renderCourseTaskTitle(definition.titleTemplate, courseLabel(course));
        const adminSnapshot = {
          title,
          description: definition.description,
          source_url: definition.sourceUrl,
          due_date: selected.date,
          verbatim_due: selected.verbatim,
          sort_order: definition.sortOrder,
        };
        generated.push({
          key: `app:${application.id}:course-task:${definition.id}`,
          title,
          dueDate: selected.date,
          verbatimDue: selected.verbatim,
          order: definition.sortOrder,
          applicationId: application.id,
          ruleId: null,
          courseTaskDefinitionId: definition.id,
          adminSnapshot,
          definitionRevision: definition.revision,
          source: definition.sourceUrl
            ? { url: definition.sourceUrl, verifiedAt: course.created_at }
            : null,
        });
      }
      continue;
    }

    const deadlines = asStrings(course.deadlines);
    const requirements = asStrings(course.requirements);
    const submitDeadline = selectSubmissionDeadline(deadlines, todayIso, intake);
    const label = courseLabel(course);
    const source = { url: course.source_url, verifiedAt: course.created_at };

    if (submitDeadline.verbatim) {
      generated.push({
        key: `app:${application.id}:submit`,
        title: `Submit application — ${label}`,
        dueDate: submitDeadline.date,
        verbatimDue: submitDeadline.verbatim,
        order: 30,
        applicationId: application.id,
        ruleId: null,
        courseTaskDefinitionId: null,
        adminSnapshot: null,
        definitionRevision: null,
        source,
      });
    }

    for (const requirement of requirements) {
      generated.push({
        key: `app:${application.id}:req:${hashDjb2(requirement)}`,
        title: `Prepare: ${requirement} — ${label}`,
        dueDate: submitDeadline.date,
        verbatimDue: submitDeadline.verbatim,
        order: 28,
        applicationId: application.id,
        ruleId: null,
        courseTaskDefinitionId: null,
        adminSnapshot: null,
        definitionRevision: null,
        source,
      });
    }
  }

  return generated.sort((a, b) => a.key.localeCompare(b.key));
}

export function generateTasks(
  result: Result | null,
  applications: ApplicationForTaskGeneration[],
  todayIso?: string,
  intake?: TargetIntake,
): GeneratedTask[] {
  return [
    ...generateGlobalTasks(result),
    ...generateCourseTasks(applications, todayIso, intake),
  ].sort((a, b) => a.key.localeCompare(b.key));
}

function band(order: number): number {
  // Trade-off: order bands are the dependency mechanism for generated tasks.
  // Upgrade path: explicit rule dependencies if the route gets branchier.
  return Math.floor(order / 10);
}

function taskSort<T extends { dueDate: string | null; order: number; key: string }>(
  todayIso: string,
) {
  return (a: T, b: T) => {
    const aOverdue = a.dueDate !== null && daysUntil(a.dueDate, todayIso) < 0;
    const bOverdue = b.dueDate !== null && daysUntil(b.dueDate, todayIso) < 0;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.order !== b.order) return a.order - b.order;
    return a.key.localeCompare(b.key);
  };
}

export function bucketTasks<
  T extends { dueDate: string | null; order: number; key: string },
>(tasks: T[], todayIso: string): BucketedTasks<T> {
  const sorted = [...tasks].sort(taskSort<T>(todayIso));
  const minBand = Math.min(...sorted.map((task) => band(task.order)));
  const nowKeys = new Set(
    sorted
      .filter((task) => {
        const overdue = task.dueDate !== null && daysUntil(task.dueDate, todayIso) < 0;
        return overdue || band(task.order) === minBand;
      })
      .slice(0, 3)
      .map((task) => task.key),
  );
  const now = sorted.filter((task) => nowKeys.has(task.key));
  const remaining = sorted.filter((task) => !nowKeys.has(task.key));
  const next = remaining.filter((task) => {
    const dueSoon =
      task.dueDate !== null &&
      daysUntil(task.dueDate, todayIso) >= 0 &&
      daysUntil(task.dueDate, todayIso) <= 60;
    return band(task.order) <= minBand + 1 || dueSoon;
  });
  const nextKeys = new Set(next.map((task) => task.key));
  const later = remaining.filter((task) => !nextKeys.has(task.key));
  return { now, next, later };
}

export function prepareGeneratedTaskMaterialization(
  userId: string,
  desired: GeneratedTask[],
  existing: ExistingGeneratedTask[],
): {
  upsertRows: GeneratedTaskUpsert[];
  staleOpenKeysToDelete: string[];
  staleDoneKeysToDeactivate: string[];
} {
  const desiredKeys = new Set(desired.map((task) => task.key));
  const existingByKey = new Map(
    existing.flatMap((task) => (task.task_key ? [[task.task_key, task]] : [])),
  );
  const desiredRows = desired.map((task) => ({
    user_id: userId,
    task_key: task.key,
    title: task.title,
    due_date: task.dueDate,
    verbatim_due: task.verbatimDue,
    sort_order: task.order,
    source_url: task.source?.url ?? null,
    source_verified_at: task.source?.verifiedAt ?? null,
    application_id: task.applicationId,
    generated_from_rule_id: task.ruleId,
    course_task_definition_id: task.courseTaskDefinitionId,
    admin_snapshot: task.adminSnapshot,
    definition_revision: task.definitionRevision,
    generated_active: true,
  }));
  return {
    upsertRows: desiredRows.filter((row) => {
      const existingRow = existingByKey.get(row.task_key);
      if (!existingRow) return true;
      // Existing rows are user-owned after first materialization. Admin
      // definition fan-out is handled by the scoped SQL synchronizer; render
      // or profile materialization must never overwrite a user's copy.
      return false;
    }),
    staleOpenKeysToDelete: existing.flatMap((task) =>
      task.task_key !== null && !task.done && !desiredKeys.has(task.task_key) &&
      !(task.course_task_definition_id !== null && task.has_personal_edits)
        ? [task.task_key]
        : [],
    ),
    staleDoneKeysToDeactivate: existing.flatMap((task) =>
      task.task_key !== null &&
      task.done &&
      task.generated_active &&
      !desiredKeys.has(task.task_key) &&
      !(task.course_task_definition_id !== null && task.has_personal_edits)
        ? [task.task_key]
        : [],
    ),
  };
}
