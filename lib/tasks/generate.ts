import type { Citation, Result } from "@/lib/engine/evaluate";

export type GeneratedTask = {
  key: string;
  title: string;
  dueDate: string | null;
  verbatimDue: string | null;
  order: number;
  applicationId: string | null;
  ruleId: string | null;
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
};

export type ApplicationForTaskGeneration = {
  id: string;
  status: string;
  course: CourseForTaskGeneration | null;
};

export type BucketedTasks<T extends { dueDate: string | null; order: number; key: string }> = {
  now: T[];
  next: T[];
  later: T[];
};

export type ExistingGeneratedTask = {
  task_key: string | null;
  title: string;
  due_date: string | null;
  application_id: string | null;
  generated_from_rule_id: string | null;
  done: boolean;
};

export type GeneratedTaskUpsert = {
  user_id: string;
  task_key: string;
  title: string;
  due_date: string | null;
  application_id: string | null;
  generated_from_rule_id: string | null;
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

function firstDatedLine(lines: string[]): { date: string; verbatim: string } | null {
  for (const line of lines) {
    const date = parseDeadlineDate(line);
    if (date) return { date, verbatim: line };
  }
  return null;
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

export function generateTasks(
  result: Result | null,
  applications: ApplicationForTaskGeneration[],
): GeneratedTask[] {
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
        source: citation
          ? { url: citation.sourceUrl, verifiedAt: citation.verifiedAt }
          : null,
      });
    }
  }

  for (const application of applications) {
    const course = application.course;
    if (!course || course.review_status === "rejected") continue;
    if (application.status === "applied" || application.status === "admitted") {
      continue;
    }

    const deadlines = asStrings(course.deadlines);
    const requirements = asStrings(course.requirements);
    const firstDeadline = firstDatedLine(deadlines);
    const label = courseLabel(course);
    const source = { url: course.source_url, verifiedAt: course.created_at };

    for (const deadline of deadlines) {
      if (!/\d/.test(deadline)) continue;
      generated.push({
        key: `app:${application.id}:deadline:${hashDjb2(deadline)}`,
        title: `Submit application — ${label}`,
        dueDate: parseDeadlineDate(deadline),
        verbatimDue: deadline,
        order: 30,
        applicationId: application.id,
        ruleId: null,
        source,
      });
    }

    for (const requirement of requirements) {
      generated.push({
        key: `app:${application.id}:req:${hashDjb2(requirement)}`,
        title: `Prepare: ${requirement} — ${label}`,
        dueDate: firstDeadline?.date ?? null,
        verbatimDue: firstDeadline?.verbatim ?? null,
        order: 28,
        applicationId: application.id,
        ruleId: null,
        source,
      });
    }
  }

  return generated.sort((a, b) => a.key.localeCompare(b.key));
}

function band(order: number): number {
  // ponytail: order bands are the dependency mechanism for generated tasks.
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

export function prepareGeneratedTaskSync(
  userId: string,
  desired: GeneratedTask[],
  existing: ExistingGeneratedTask[],
): { upsertRows: GeneratedTaskUpsert[]; staleKeysToDelete: string[] } {
  const desiredKeys = new Set(desired.map((task) => task.key));
  const existingByKey = new Map(
    existing.flatMap((task) => (task.task_key ? [[task.task_key, task]] : [])),
  );
  const desiredRows = desired.map((task) => ({
    user_id: userId,
    task_key: task.key,
    title: task.title,
    due_date: task.dueDate,
    application_id: task.applicationId,
    generated_from_rule_id: task.ruleId,
  }));
  return {
    upsertRows: desiredRows.filter((row) => {
      const existingRow = existingByKey.get(row.task_key);
      return (
        !existingRow ||
        existingRow.title !== row.title ||
        existingRow.due_date !== row.due_date ||
        existingRow.application_id !== row.application_id ||
        existingRow.generated_from_rule_id !== row.generated_from_rule_id
      );
    }),
    staleKeysToDelete: existing.flatMap((task) =>
      task.task_key !== null && !task.done && !desiredKeys.has(task.task_key)
        ? [task.task_key]
        : [],
    ),
  };
}
