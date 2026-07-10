import { Button } from "@/components/ui/button";
import type { Json, Tables } from "@/lib/db/database.types";
import type { ConflictCourse } from "@/lib/db/admin-queries";
import { deriveCourseTaskCandidates } from "@/lib/tasks/course-tasks";
import { cn } from "@/lib/utils";

import {
  resolveConflictAction,
  adoptCourseTaskSourceReviewAction,
  keepCourseTaskSourceReviewAction,
  reviewCourseAction,
  retireCourseTaskAction,
  saveCourseTaskAction,
  updateCourseAction,
} from "./actions";
import { statusBadge } from "./admin-shared";

function compactJson(value: Json | null): string {
  if (value === null) return "Not extracted";
  return JSON.stringify(value);
}

function formatEditableJson(value: Json | null): string {
  return JSON.stringify(value, null, 2);
}

function formatEditableArrayJson(value: Json | null): string {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function CourseEditField({
  label,
  name,
  defaultValue,
  highlighted,
  multiline,
}: {
  label: string;
  name: string;
  defaultValue: string;
  highlighted: boolean;
  multiline?: boolean;
}) {
  const className = cn(
    "rounded-md border bg-background px-2 text-sm",
    highlighted && "border-amber-300 bg-amber-50",
    multiline ? "min-h-20 py-2 font-mono text-xs" : "h-8",
  );

  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-medium uppercase text-muted-foreground">
      {label}
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={4}
          className={className}
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          className={className}
        />
      )}
    </label>
  );
}

function CourseTaskForm({
  course,
  task,
}: {
  course: Tables<"courses">;
  task: {
    id?: string;
    kind: "submission" | "requirement" | "custom";
    sourceKey: string | null;
    titleTemplate: string;
    description: string | null;
    sourceUrl: string | null;
    dueMode: "source_deadline" | "fixed_date" | "none";
    dueDate: string | null;
    sourceSnapshot: Json | null;
    sortOrder: number;
    retiredAt?: string | null;
  };
}) {
  return (
    <div className="rounded-md border p-2">
      <form action={saveCourseTaskAction} className="grid gap-2">
        <input type="hidden" name="id" value={task.id ?? ""} />
        <input type="hidden" name="course_id" value={course.id} />
        <input type="hidden" name="kind" value={task.kind} />
        <input type="hidden" name="source_key" value={task.sourceKey ?? ""} />
        <input type="hidden" name="source_snapshot" value={JSON.stringify(task.sourceSnapshot)} />
        <div className="grid gap-2 md:grid-cols-[1fr_100px]">
          <input name="title_template" defaultValue={task.titleTemplate} className="h-8 rounded border bg-background px-2 text-sm" aria-label="Task title" />
          <input name="sort_order" type="number" min="1" defaultValue={task.sortOrder} className="h-8 rounded border bg-background px-2 text-sm" aria-label="Task order" />
        </div>
        <textarea name="description" defaultValue={task.description ?? ""} rows={2} className="rounded border bg-background p-2 text-sm" placeholder="Notes" />
        <div className="grid gap-2 md:grid-cols-3">
          <input name="source_url" type="url" defaultValue={task.sourceUrl ?? ""} className="h-8 rounded border bg-background px-2 text-sm" placeholder="Source URL" />
          <select name="due_mode" defaultValue={task.dueMode} className="h-8 rounded border bg-background px-2 text-sm">
            <option value="source_deadline">Official deadline</option>
            <option value="fixed_date">Fixed date</option>
            <option value="none">No date</option>
          </select>
          <input name="due_date" type="date" defaultValue={task.dueDate ?? ""} className="h-8 rounded border bg-background px-2 text-sm" />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{task.kind}{task.sourceKey ? ` · ${task.sourceKey}` : ""}</span>
          <Button type="submit" variant="outline" size="sm">Save task</Button>
        </div>
      </form>
      {task.id && !task.retiredAt ? (
        <form action={retireCourseTaskAction} className="mt-2 text-right">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="course_id" value={course.id} />
          <Button type="submit" variant="ghost" size="sm">Retire task</Button>
        </form>
      ) : null}
    </div>
  );
}

function CourseTaskEditor({
  course,
  definitions,
}: {
  course: Tables<"courses">;
  definitions: Tables<"course_task_definitions">[];
}) {
  const existingKeys = new Set(definitions.map((definition) => definition.source_key));
  const candidates = deriveCourseTaskCandidates(course).filter(
    (candidate) => !existingKeys.has(candidate.sourceKey),
  );
  const displayed = definitions.map((definition) => ({
    id: definition.id,
    kind: definition.kind,
    sourceKey: definition.source_key,
    titleTemplate: definition.title_template,
    description: definition.description,
    sourceUrl: definition.source_url,
    dueMode: definition.due_mode,
    dueDate: definition.due_date,
    sourceSnapshot: definition.source_snapshot,
    sortOrder: definition.sort_order,
    retiredAt: definition.retired_at,
  }));

  return (
    <section className="mt-3 grid gap-2 border-t pt-3">
      <div>
        <h4 className="text-sm font-semibold">Course tasks</h4>
        <p className="text-xs text-muted-foreground">Generated deadline and requirement tasks, plus custom tasks. Pending-course edits publish on approval.</p>
      </div>
      {displayed.map((task) => <CourseTaskForm key={task.id} course={course} task={task} />)}
      {candidates.map((candidate, index) => (
        <CourseTaskForm key={candidate.sourceKey} course={course} task={{
          kind: candidate.kind,
          sourceKey: candidate.sourceKey,
          titleTemplate: candidate.titleTemplate,
          description: candidate.description,
          sourceUrl: candidate.sourceUrl,
          dueMode: candidate.dueMode,
          dueDate: null,
          sourceSnapshot: candidate.sourceSnapshot as Json,
          sortOrder: 30 + definitions.length + index,
        }} />
      ))}
      <CourseTaskForm course={course} task={{
        kind: "custom", sourceKey: null, titleTemplate: "", description: null,
        sourceUrl: null, dueMode: "none", dueDate: null, sourceSnapshot: null,
        sortOrder: 30 + definitions.length + candidates.length,
      }} />
    </section>
  );
}

function CourseEditForm({ course, definitions }: { course: Tables<"courses">; definitions: Tables<"course_task_definitions">[] }) {
  // Per-field-group extraction method — AI-filled groups need human eyes.
  const groups = (course.field_extraction ?? {}) as Record<string, string>;
  const ai = (group: string) => groups[group] === "ai";

  return (
    <>
    <form action={updateCourseAction} className="mt-3 grid gap-3">
      <input type="hidden" name="id" value={course.id} />
      <label className="grid gap-1 text-[11px] font-medium uppercase text-muted-foreground">
        Source URL
        <input
          name="source_url"
          type="url"
          required
          defaultValue={course.source_url}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
      </label>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <CourseEditField
          label="Name"
          name="name"
          defaultValue={course.name ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="University"
          name="university_name"
          defaultValue={course.university_name ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="Location"
          name="location"
          defaultValue={course.location ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="Degree"
          name="degree"
          defaultValue={course.degree ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="Language"
          name="language"
          defaultValue={course.language ?? ""}
          highlighted={ai("core")}
        />
      </div>

      <CourseEditField
        label="Description/content"
        name="description"
        defaultValue={course.description ?? ""}
        highlighted={ai("description")}
        multiline
      />

      <div className="grid gap-2 lg:grid-cols-3">
        <CourseEditField
          label="Tuition JSON"
          name="tuition"
          defaultValue={formatEditableJson(course.tuition)}
          highlighted={ai("tuition")}
          multiline
        />
        <CourseEditField
          label="Deadlines JSON"
          name="deadlines"
          defaultValue={formatEditableArrayJson(course.deadlines)}
          highlighted={ai("deadlines")}
          multiline
        />
        <CourseEditField
          label="Requirements JSON"
          name="requirements"
          defaultValue={formatEditableArrayJson(course.requirements)}
          highlighted={ai("requirements")}
          multiline
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Current extracted values: tuition{" "}
          <span className="font-mono">{compactJson(course.tuition)}</span>
        </p>
        <Button type="submit" variant="outline" size="sm">
          Save edits
        </Button>
      </div>
    </form>
    <CourseTaskEditor course={course} definitions={definitions} />
    </>
  );
}

export function CourseQueue({ courses, definitionsByCourse }: { courses: Tables<"courses">[]; definitionsByCourse: Map<string, Tables<"course_task_definitions">[]> }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Course review queue</h2>
        <span className="text-xs text-muted-foreground">
          {courses.length} pending
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        {courses.map((course) => (
          <article key={course.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    {course.name ?? "Untitled course"}
                  </h3>
                  {statusBadge(course.extraction_method ?? "unknown")}
                </div>
                <a
                  href={course.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-2"
                >
                  {course.source_url}
                </a>
              </div>
              <div className="flex gap-2">
                <form action={reviewCourseAction}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="review_status" value="approved" />
                  <Button type="submit" size="sm">
                    Approve
                  </Button>
                </form>
                <form action={reviewCourseAction}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="review_status" value="rejected" />
                  <Button type="submit" variant="outline" size="sm">
                    Reject
                  </Button>
                </form>
              </div>
            </div>

            <CourseEditForm course={course} definitions={definitionsByCourse.get(course.id) ?? []} />
          </article>
        ))}
      </div>

      {courses.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No pending courses need review.
        </p>
      )}
    </section>
  );
}

export function CourseTaskLibrary({
  courses,
  definitionsByCourse,
}: {
  courses: Tables<"courses">[];
  definitionsByCourse: Map<string, Tables<"course_task_definitions">[]>;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Approved course task library</h2>
          <p className="text-xs text-muted-foreground">Task edits publish to all students currently planning that course.</p>
        </div>
        <span className="text-xs text-muted-foreground">{courses.length} approved</span>
      </div>
      <div className="mt-3 grid gap-3">
        {courses.map((course) => (
          <article key={course.id} className="rounded-lg border p-3">
            <h3 className="text-sm font-semibold">{course.name ?? "Untitled course"}</h3>
            <p className="text-xs text-muted-foreground">{course.university_name ?? "University not extracted"}</p>
            <CourseTaskEditor course={course} definitions={definitionsByCourse.get(course.id) ?? []} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function CourseTaskSourceReviewQueue({
  reviews,
}: {
  reviews: Tables<"course_task_source_reviews">[];
}) {
  if (reviews.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Official source task changes</h2>
      <p className="mt-1 text-xs text-muted-foreground">Students keep the current task until you adopt or keep each source change.</p>
      <div className="mt-3 grid gap-2">
        {reviews.map((review) => (
          <article key={review.id} className="rounded border p-3 text-sm">
            <p><strong>{review.change_type}</strong> · {review.candidate_key}</p>
            <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify({ old: review.old_snapshot, proposed: review.new_snapshot }, null, 2)}</pre>
            <div className="mt-2 flex gap-2">
              <form action={adoptCourseTaskSourceReviewAction}><input type="hidden" name="id" value={review.id} /><Button type="submit" size="sm">Adopt source change</Button></form>
              <form action={keepCourseTaskSourceReviewAction}><input type="hidden" name="id" value={review.id} /><Button type="submit" size="sm" variant="outline">Keep current task</Button></form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ConflictQueue({ conflicts }: { conflicts: ConflictCourse[] }) {
  if (conflicts.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Conflicting courses</h2>
        <span className="text-xs text-muted-foreground">
          {conflicts.length} to resolve
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        A user reported that the saved course is outdated and submitted the
        page again. Compare, edit either side if needed, then keep one — user
        dashboards move to the survivor automatically.
      </p>

      <div className="mt-3 grid gap-3">
        {conflicts.map((conflict) => (
          <article key={conflict.id} className="rounded-lg border p-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <div className="min-w-0 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    Existing: {conflict.old_course?.name ?? "Untitled course"}
                  </h3>
                  {statusBadge(conflict.old_course?.review_status ?? "missing")}
                </div>
                {conflict.old_course ? (
                  <>
                    <a
                      href={conflict.old_course.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-2"
                    >
                      {conflict.old_course.source_url}
                    </a>
                    <CourseEditForm course={conflict.old_course} definitions={[]} />
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    The disputed course no longer exists.
                  </p>
                )}
              </div>

              <div className="min-w-0 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    Update: {conflict.name ?? "Untitled course"}
                  </h3>
                  {statusBadge(conflict.extraction_method ?? "unknown")}
                </div>
                <a
                  href={conflict.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-2"
                >
                  {conflict.source_url}
                </a>
                <CourseEditForm course={conflict} definitions={[]} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <form action={resolveConflictAction}>
                <input type="hidden" name="id" value={conflict.id} />
                <input type="hidden" name="keep_new" value="false" />
                <Button type="submit" variant="outline" size="sm">
                  Keep existing (reject update)
                </Button>
              </form>
              <form action={resolveConflictAction}>
                <input type="hidden" name="id" value={conflict.id} />
                <input type="hidden" name="keep_new" value="true" />
                <Button type="submit" size="sm">
                  Replace with update (approve)
                </Button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
