// Pure course-task definition helpers. Course facts become explicit admin-owned
// definitions before they are materialized for a student's application.
import type { Tables } from "@/lib/db/database.types";

export type CourseTaskKind = "submission" | "requirement" | "custom";
export type CourseTaskDueMode = "source_deadline" | "fixed_date" | "none";

export type CourseTaskDefinition = {
  id: string;
  courseId: string;
  kind: CourseTaskKind;
  sourceKey: string | null;
  titleTemplate: string;
  description: string | null;
  sourceUrl: string | null;
  dueMode: CourseTaskDueMode;
  dueDate: string | null;
  sortOrder: number;
  sourceSnapshot: unknown;
  retiredAt: string | null;
};

export type CourseTaskCandidate = Omit<
  CourseTaskDefinition,
  "id" | "courseId" | "description" | "sourceUrl" | "dueDate" | "sortOrder" | "retiredAt"
> & {
  description: null;
  sourceUrl: string;
};

type CourseFacts = {
  id: string;
  name: string | null;
  university_name: string | null;
  deadlines: unknown;
  requirements: unknown;
  source_url: string;
  created_at: string;
};

/** Non-empty strings out of a jsonb column. */
export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

export function toCourseTaskDefinition(
  row: Tables<"course_task_definitions">,
): CourseTaskDefinition {
  return {
    id: row.id,
    courseId: row.course_id,
    kind: row.kind,
    sourceKey: row.source_key,
    titleTemplate: row.title_template,
    description: row.description,
    sourceUrl: row.source_url,
    dueMode: row.due_mode,
    dueDate: row.due_date,
    sortOrder: row.sort_order,
    sourceSnapshot: row.source_snapshot,
    retiredAt: row.retired_at,
  };
}

export function deriveCourseTaskCandidates(course: CourseFacts): CourseTaskCandidate[] {
  const deadlines = strings(course.deadlines);
  const requirements = strings(course.requirements);
  const candidates: CourseTaskCandidate[] = [];

  if (deadlines.some((line) => /\d/.test(line))) {
    candidates.push({
      kind: "submission",
      sourceKey: "submission",
      titleTemplate: "Submit application — {{course}}",
      description: null,
      sourceUrl: course.source_url,
      dueMode: "source_deadline",
      sourceSnapshot: { deadlines },
    });
  }

  for (const requirement of requirements) {
    candidates.push({
      kind: "requirement",
      sourceKey: `requirement:${requirement}`,
      titleTemplate: `Prepare: ${requirement} — {{course}}`,
      description: null,
      sourceUrl: course.source_url,
      dueMode: "source_deadline",
      sourceSnapshot: { requirement, deadlines },
    });
  }

  return candidates;
}

export function renderCourseTaskTitle(template: string, courseLabel: string): string {
  return template.replaceAll("{{course}}", courseLabel);
}

/** Presentation-only admin preview; source deadlines remain verbatim. */
export function courseTaskAdminPreview(
  task: Pick<CourseTaskDefinition, "titleTemplate" | "dueMode" | "sourceSnapshot">,
  courseLabel: string,
): { title: string; sourceDeadlineLines: string[] } {
  const snapshot = task.sourceSnapshot;
  const deadlines = task.dueMode === "source_deadline" && snapshot && typeof snapshot === "object" && "deadlines" in snapshot
    ? strings(snapshot.deadlines)
    : [];
  return { title: renderCourseTaskTitle(task.titleTemplate, courseLabel), sourceDeadlineLines: deadlines };
}
